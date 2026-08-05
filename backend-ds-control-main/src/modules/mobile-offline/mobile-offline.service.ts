import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { db } from '@infra/database';
import {
  applications,
  assistants,
  cultureTypes,
  customers,
  drones,
  farms,
  plots,
  products,
  routes,
  users,
} from '@infra/database/schema';
import { ServiceOrderRepository } from '@repositories/service-order/service-order.repository';
import { UserType } from '@repositories/users/user.types';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { buildOfflineDatasetManifest } from './offline-dataset-manifest';
import { toSafeOfflineUser, withoutOfflinePlotApplicationDetails } from './offline-dataset-scope';

const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/satellite-streets-v12';
const OFFLINE_MIN_ZOOM = 10;
const OFFLINE_MAX_ZOOM = 17;

type CoordinateBounds = {
  northEast: [number, number];
  southWest: [number, number];
};

type FarmForOffline = typeof farms.$inferSelect & {
  customer?: { id: string; name: string } | null;
  plots?: Array<Record<string, unknown>>;
};

const isFiniteLongitude = (value: number) =>
  Number.isFinite(value) && value >= -180 && value <= 180;
const isFiniteLatitude = (value: number) => Number.isFinite(value) && value >= -90 && value <= 90;

const collectCoordinates = (value: unknown, result: Array<[number, number]>) => {
  if (!Array.isArray(value)) return;

  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    isFiniteLongitude(value[0]) &&
    isFiniteLatitude(value[1])
  ) {
    result.push([value[0], value[1]]);
    return;
  }

  value.forEach((item) => {
    collectCoordinates(item, result);
  });
};

const extractGeoJsonCoordinates = (geoJson: unknown): Array<[number, number]> => {
  if (!geoJson || typeof geoJson !== 'object') return [];

  const coordinates: Array<[number, number]> = [];
  const candidate = geoJson as {
    type?: string;
    coordinates?: unknown;
    geometry?: { coordinates?: unknown };
    features?: Array<{ geometry?: { coordinates?: unknown } }>;
  };

  if (candidate.coordinates) {
    collectCoordinates(candidate.coordinates, coordinates);
  }

  if (candidate.geometry?.coordinates) {
    collectCoordinates(candidate.geometry.coordinates, coordinates);
  }

  if (Array.isArray(candidate.features)) {
    candidate.features.forEach((feature) => {
      collectCoordinates(feature.geometry?.coordinates, coordinates);
    });
  }

  return coordinates;
};

const calculateFarmBounds = (farm: FarmForOffline): CoordinateBounds | null => {
  const coordinates = (farm.plots ?? []).flatMap((plot) =>
    extractGeoJsonCoordinates((plot as { geoJson?: unknown }).geoJson),
  );

  if (coordinates.length === 0) return null;

  const lngs = coordinates.map(([lng]) => lng);
  const lats = coordinates.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  if (![minLng, maxLng, minLat, maxLat].every(Number.isFinite)) return null;

  const lngPadding = Math.max((maxLng - minLng) * 0.08, 0.002);
  const latPadding = Math.max((maxLat - minLat) * 0.08, 0.002);

  return {
    northEast: [Math.min(180, maxLng + lngPadding), Math.min(90, maxLat + latPadding)],
    southWest: [Math.max(-180, minLng - lngPadding), Math.max(-90, minLat - latPadding)],
  };
};

const centerFromBounds = (bounds: CoordinateBounds): [number, number] => [
  (bounds.northEast[0] + bounds.southWest[0]) / 2,
  (bounds.northEast[1] + bounds.southWest[1]) / 2,
];

export class MobileOfflineService {
  private readonly serviceOrderRepository = new ServiceOrderRepository();

  public async getBootstrap(userId: string) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });

    if (!user) {
      throw new AppError('Usuario autenticado nao encontrado', HTTP_STATUS_CODES.UNAUTHORIZED);
    }

    const tenant = user.customerId
      ? await db.query.customers.findFirst({
          where: and(eq(customers.id, user.customerId), isNull(customers.deletedAt)),
        })
      : null;
    const [serviceOrdersList, farmIds] = await this.getServiceOrdersAndFarmIds(user);
    const farmsList = await this.getFarms(Array.from(farmIds), user);
    const normalizedFarmIds = farmsList.map((farm) => farm.id);
    const serviceOrderIds = serviceOrdersList.map((serviceOrder) => serviceOrder.id);

    const [applicationsList, routesList, supportData] = await Promise.all([
      this.getApplications(normalizedFarmIds, serviceOrderIds, user.id, user.type),
      this.getRoutes(normalizedFarmIds),
      this.getSupportData(),
    ]);

    const mapPackages = farmsList
      .map((farm) => {
        const bounds = calculateFarmBounds(farm);
        if (!bounds) return null;

        return {
          farmId: farm.id,
          name: farm.name,
          styleURL: MAPBOX_STYLE_URL,
          bounds,
          center: centerFromBounds(bounds),
          minZoom: OFFLINE_MIN_ZOOM,
          maxZoom: OFFLINE_MAX_ZOOM,
        };
      })
      .filter(Boolean);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      type: user.type,
      customerId: user.customerId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };

    return {
      user: safeUser,
      tenant,
      permissions: this.getPermissions(user.type),
      farms: farmsList,
      plots: farmsList.flatMap((farm) => farm.plots ?? []),
      serviceOrders: serviceOrdersList,
      applications: applicationsList,
      routes: routesList,
      assistants: supportData.assistants,
      drones: supportData.drones,
      cultureTypes: supportData.cultureTypes,
      products: supportData.products,
      mapPackages,
      serverTime: new Date().toISOString(),
    };
  }

  public async getDataset(userId: string, requestedServiceOrderIds: string[]) {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!user) {
      throw new AppError('Usuario autenticado nao encontrado', HTTP_STATUS_CODES.UNAUTHORIZED);
    }
    if (user.type !== UserType.PILOT) {
      throw new AppError(
        'Somente pilotos podem preparar datasets offline operacionais',
        HTTP_STATUS_CODES.FORBIDDEN,
      );
    }
    const tenant = user.customerId
      ? await db.query.customers.findFirst({
          where: and(eq(customers.id, user.customerId), isNull(customers.deletedAt)),
        })
      : null;

    const selectedIds = [...new Set(requestedServiceOrderIds)].sort();
    const assignedOpenOrders = await this.serviceOrderRepository.getOpenServiceOrdersByPilotId(
      user.id,
      1,
      1000,
      true,
      true,
      true,
      true,
      true,
      true,
    );
    const selectedIdSet = new Set(selectedIds);
    const safePilot = toSafeOfflineUser(user);
    const serviceOrdersList = assignedOpenOrders
      .filter((serviceOrder) => selectedIdSet.has(serviceOrder.id))
      .map((serviceOrder) => ({
        ...serviceOrder,
        farms: [...(serviceOrder.farms ?? [])].sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
        plots: [...(serviceOrder.plots ?? [])]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((plot) => withoutOfflinePlotApplicationDetails(plot)),
        pilots: serviceOrder.pilots?.filter((pilot) => pilot.id === user.id).map(() => safePilot),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    if (serviceOrdersList.length !== selectedIds.length) {
      throw new AppError(
        'Uma ou mais Ordens de Servico nao estao abertas ou atribuidas ao piloto autenticado',
        HTTP_STATUS_CODES.FORBIDDEN,
      );
    }

    const farmIds = new Set<string>();
    const plotIds = new Set<string>();
    serviceOrdersList.forEach((serviceOrder) => {
      serviceOrder.farms?.forEach((farm) => {
        farmIds.add(farm.id);
      });
      serviceOrder.plots?.forEach((plot) => {
        plotIds.add(plot.id);
      });
    });

    const farmsList = await this.getFarms([...farmIds], user, plotIds);
    const normalizedFarmIds = farmsList.map((farm) => farm.id);
    const [applicationsList, routesList, supportData] = await Promise.all([
      this.getSelectedPilotApplications(selectedIds, normalizedFarmIds, [...plotIds], user.id),
      this.getRoutes(normalizedFarmIds),
      this.getSupportData(),
    ]);
    const mapPackages = this.buildMapPackages(farmsList);
    if (mapPackages.length !== farmsList.length) {
      throw new AppError(
        'Uma ou mais fazendas selecionadas nao possuem geometria valida para mapa offline',
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }
    const serverTime = new Date().toISOString();
    const payload = {
      user: safePilot,
      tenant,
      permissions: this.getPermissions(user.type),
      farms: farmsList,
      plots: farmsList.flatMap((farm) => farm.plots ?? []),
      serviceOrders: serviceOrdersList,
      applications: applicationsList,
      routes: routesList,
      assistants: supportData.assistants,
      drones: supportData.drones,
      cultureTypes: supportData.cultureTypes,
      products: supportData.products,
      mapPackages,
    };

    return {
      ...payload,
      serverTime,
      manifest: buildOfflineDatasetManifest(payload, selectedIds, serverTime),
    };
  }

  private getPermissions(userType: string) {
    const basePermissions = ['offline:read', 'maps:offline'];

    if (userType === UserType.PILOT) {
      return [...basePermissions, 'applications:create-offline'];
    }

    if (userType === UserType.FARMER) {
      return [...basePermissions, 'farms:read', 'service-orders:read'];
    }

    return [...basePermissions, 'admin:read', 'farms:read', 'service-orders:read'];
  }

  private async getServiceOrdersAndFarmIds(user: typeof users.$inferSelect) {
    if (user.type === UserType.PILOT) {
      const serviceOrdersList = await this.serviceOrderRepository.getOpenServiceOrdersByPilotId(
        user.id,
        1,
        1000,
        true,
        true,
        true,
        true,
        true,
        true,
      );

      const farmIds = new Set<string>();
      serviceOrdersList.forEach((serviceOrder) => {
        serviceOrder.farms?.forEach((farm) => {
          farmIds.add(farm.id);
        });
      });

      return [serviceOrdersList, farmIds] as const;
    }

    const filters = {
      status: 'open' as const,
      customerId: user.type === UserType.FARMER ? (user.customerId ?? undefined) : undefined,
    };

    const serviceOrdersList = await this.serviceOrderRepository.getAllServiceOrders(
      1,
      1000,
      undefined,
      filters,
      true,
      true,
      true,
      true,
      true,
      true,
    );

    const farmIds = new Set<string>();
    serviceOrdersList.forEach((serviceOrder) => {
      serviceOrder.farms?.forEach((farm) => {
        farmIds.add(farm.id);
      });
    });

    return [serviceOrdersList, farmIds] as const;
  }

  private async getFarms(
    initialFarmIds: string[],
    user: typeof users.$inferSelect,
    selectedPlotIds?: Set<string>,
  ) {
    const conditions = [isNull(farms.deletedAt)];

    if (user.type === UserType.FARMER) {
      if (!user.customerId) return [];
      conditions.push(eq(farms.customerId, user.customerId));
    } else if (user.type === UserType.PILOT) {
      if (initialFarmIds.length === 0) return [];
      conditions.push(inArray(farms.id, initialFarmIds));
    }

    const result = await db.query.farms.findMany({
      where: and(...conditions),
      with: {
        customer: {
          columns: {
            id: true,
            name: true,
          },
        },
        plots: {
          where: isNull(plots.deletedAt),
        },
      },
      orderBy: (table, { asc }) => [asc(table.name)],
    });
    return result
      .map((farm) => ({
        ...farm,
        plots:
          selectedPlotIds === undefined
            ? farm.plots
            : farm.plots.filter((plot) => selectedPlotIds.has(plot.id)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private async getSelectedPilotApplications(
    serviceOrderIds: string[],
    farmIds: string[],
    plotIds: string[],
    pilotId: string,
  ) {
    if (serviceOrderIds.length === 0 || farmIds.length === 0) return [];
    const result = await db.query.applications.findMany({
      where: and(
        isNull(applications.deletedAt),
        inArray(applications.serviceOrderId, serviceOrderIds),
        inArray(applications.farmId, farmIds),
        plotIds.length > 0
          ? or(isNull(applications.plotId), inArray(applications.plotId, plotIds))
          : isNull(applications.plotId),
        eq(applications.pilotId, pilotId),
      ),
      with: {
        assistant: true,
        culture: true,
        drone: true,
        farm: true,
        pilot: true,
        plot: true,
        product: true,
        serviceOrder: true,
      },
      orderBy: [desc(applications.date)],
    });
    return result
      .map((application) => ({
        ...application,
        pilot: toSafeOfflineUser(application.pilot),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private buildMapPackages(farmsList: FarmForOffline[]) {
    return farmsList
      .map((farm) => {
        const bounds = calculateFarmBounds(farm);
        if (!bounds) return null;
        return {
          farmId: farm.id,
          name: farm.name,
          styleURL: MAPBOX_STYLE_URL,
          bounds,
          center: centerFromBounds(bounds),
          minZoom: OFFLINE_MIN_ZOOM,
          maxZoom: OFFLINE_MAX_ZOOM,
        };
      })
      .filter(Boolean);
  }

  private async getApplications(
    farmIds: string[],
    serviceOrderIds: string[],
    userId: string,
    userType: string,
  ) {
    const scopeConditions = [];

    if (farmIds.length > 0) {
      scopeConditions.push(inArray(applications.farmId, farmIds));
    }

    if (serviceOrderIds.length > 0) {
      scopeConditions.push(inArray(applications.serviceOrderId, serviceOrderIds));
    }

    if (userType === UserType.PILOT) {
      scopeConditions.push(eq(applications.pilotId, userId));
    }

    if (scopeConditions.length === 0) return [];

    return await db.query.applications.findMany({
      where: and(isNull(applications.deletedAt), or(...scopeConditions)),
      with: {
        assistant: true,
        culture: true,
        drone: true,
        farm: true,
        pilot: true,
        plot: true,
        product: true,
        serviceOrder: true,
      },
      orderBy: [desc(applications.date)],
    });
  }

  private async getRoutes(farmIds: string[]) {
    if (farmIds.length === 0) return [];

    const result = await db.query.routes.findMany({
      where: and(inArray(routes.farmId, farmIds), isNull(routes.deletedAt)),
      with: {
        farm: true,
        customer: true,
      },
      orderBy: (table, { asc }) => [asc(table.name)],
    });
    return result.sort((left, right) => left.id.localeCompare(right.id));
  }

  private async getSupportData() {
    const [assistantsList, dronesList, cultureTypesList, productsList] = await Promise.all([
      db.query.assistants.findMany({
        where: isNull(assistants.deletedAt),
        orderBy: (table, { asc }) => [asc(table.name)],
      }),
      db.query.drones.findMany({
        where: isNull(drones.deletedAt),
        orderBy: (table, { asc }) => [asc(table.name)],
      }),
      db.query.cultureTypes.findMany({
        where: isNull(cultureTypes.deletedAt),
        orderBy: (table, { asc }) => [asc(table.name)],
      }),
      db.query.products.findMany({
        where: isNull(products.deletedAt),
        orderBy: (table, { asc }) => [asc(table.name)],
      }),
    ]);

    return {
      assistants: assistantsList.sort((left, right) => left.id.localeCompare(right.id)),
      drones: dronesList.sort((left, right) => left.id.localeCompare(right.id)),
      cultureTypes: cultureTypesList.sort((left, right) => left.id.localeCompare(right.id)),
      products: productsList.sort((left, right) => left.id.localeCompare(right.id)),
    };
  }
}
