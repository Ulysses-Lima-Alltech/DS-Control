import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { db } from '@infra/database';
import { customers, farms, routes } from '@infra/database/schema';
import { and, eq, isNull } from 'drizzle-orm';

import type { PaginatedRequest } from '@common/types/paginated-request.types';
import { RouteVM, type RouteViewModelSchema } from '@models/route.vm';
import { app } from '@modules/app/app.module';
import { RouteRepository } from '@repositories/routes/route.repository';
import type {
  Route,
  RouteOrderBy,
  RouteOrderType,
  RouteWithCustomer,
  RouteWithFarm,
  RouteWithFarmAndCustomer,
} from '@repositories/routes/route.types';
import type { CreateRouteDTO } from '../dto/create-route.dto';
import type { CreateRoutesBatchDTO } from '../dto/create-routes-batch.dto';
import type { RouteSearchQueryString } from '../dto/list-all-routes.dto';
import type { UpdateRouteDTO } from '../dto/update-route.dto';

type CreateRoutesBatchResult = {
  message: string;
  createdCount: number;
  skippedCount: number;
  routes: ReturnType<typeof RouteVM.toViewModel>[];
  errors: Array<{ name?: string; sourceFileName?: string; message: string }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export class RouteService {
  private readonly routeRepository = new RouteRepository();

  /**
   * @description Create a new route
   * @param {CreateRouteDTO} data - The route data
   * @throws {AppError} If the farm or customer doesn't exist, or if route name already exists for the farm
   */
  public async createRoute({ name, geoJson, farmId, customerId }: CreateRouteDTO): Promise<void> {
    app.log.info('[RouteService] - Starting route creation for farm %s', farmId);

    // Validate that farm exists and belongs to customer
    const farm = await db.query.farms.findFirst({
      where: and(eq(farms.id, farmId), eq(farms.customerId, customerId)),
    });

    if (!farm) {
      app.log.warn(
        "[RouteService] - Route creation failed: Farm %s not found or doesn't belong to customer %s",
        farmId,
        customerId,
      );
      throw new AppError(
        'Fazenda não encontrada ou não pertence ao cliente especificado',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn('[RouteService] - Route creation failed: Customer %s not found', customerId);
      throw new AppError('Cliente não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
    }

    // Check if route name already exists for this farm
    const existingRoute = await db.query.routes.findFirst({
      where: and(eq(routes.name, name), eq(routes.farmId, farmId), isNull(routes.deletedAt)),
    });

    if (existingRoute) {
      app.log.warn(
        '[RouteService] - Route creation failed: Route name %s already exists for farm %s',
        name,
        farmId,
      );
      throw new AppError(
        'Já existe uma rota com este nome para esta fazenda',
        HTTP_STATUS_CODES.CONFLICT,
      );
    }

    const route = await this.routeRepository.createRoute({
      name,
      geoJson,
      farmId,
      customerId,
    });

    app.log.info('[RouteService] - Route created successfully with ID %s', route.id);
  }

  /**
   * @description Create many routes for the same farm
   * @param {CreateRoutesBatchDTO} data - The batch route data
   * @returns {Promise<CreateRoutesBatchResult>} The batch creation result
   */
  public async createRoutesBatch({
    farmId,
    customerId,
    routes: routesToCreate,
    duplicateStrategy = 'rename',
  }: CreateRoutesBatchDTO): Promise<CreateRoutesBatchResult> {
    app.log.info(
      '[RouteService] - Starting batch route creation for farm %s with %d routes',
      farmId,
      routesToCreate.length,
    );

    const [customer, farm] = await Promise.all([
      db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      }),
      db.query.farms.findFirst({
        where: and(eq(farms.id, farmId), eq(farms.customerId, customerId)),
      }),
    ]);

    if (!customer) {
      app.log.warn(
        '[RouteService] - Batch route creation failed: Customer %s not found',
        customerId,
      );
      throw new AppError('Cliente não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
    }

    if (!farm) {
      app.log.warn(
        '[RouteService] - Batch route creation failed: Farm %s not found or does not belong to customer %s',
        farmId,
        customerId,
      );
      throw new AppError(
        'Fazenda não encontrada ou não pertence ao cliente especificado',
        HTTP_STATUS_CODES.NOT_FOUND,
      );
    }

    const existingRouteNames = await this.routeRepository.getActiveRouteNamesByFarmId(farmId);
    const usedRouteNames = new Set(existingRouteNames);
    const errors: CreateRoutesBatchResult['errors'] = [];
    let skippedCount = 0;

    const routeItems = routesToCreate.flatMap((route) => {
      const baseName = route.name.trim();
      const isDuplicate = usedRouteNames.has(baseName);

      if (isDuplicate && duplicateStrategy === 'fail') {
        throw new AppError(
          `Já existe uma rota com o nome "${baseName}" para esta fazenda`,
          HTTP_STATUS_CODES.CONFLICT,
        );
      }

      if (isDuplicate && duplicateStrategy === 'skip') {
        skippedCount++;
        errors.push({
          name: baseName,
          sourceFileName: route.sourceFileName,
          message: 'Rota duplicada ignorada',
        });
        return [];
      }

      const finalName =
        duplicateStrategy === 'rename'
          ? this.getUniqueRouteName(baseName, usedRouteNames)
          : baseName;
      usedRouteNames.add(finalName);

      return [
        {
          name: finalName,
          geoJson: this.enrichRouteGeoJson(
            route.geoJson,
            finalName,
            route.externalId,
            route.sourceFileName,
          ),
          farmId,
          customerId,
        },
      ];
    });

    const createdRoutes =
      routeItems.length > 0 ? await this.routeRepository.createRoutesBatch(routeItems) : [];

    app.log.info(
      '[RouteService] - Batch route creation finished for farm %s: created=%d skipped=%d',
      farmId,
      createdRoutes.length,
      skippedCount,
    );

    return {
      message: 'Routes batch created successfully',
      createdCount: createdRoutes.length,
      skippedCount,
      routes: createdRoutes.map((route) => RouteVM.toViewModel(route)),
      errors,
    };
  }

  /**
   * @description Get all routes with optional search and filters
   * @param {RouteSearchQueryString} query - The query string
   * @returns {Promise<PaginatedRequest<typeof RouteViewModelSchema>>} The list of routes
   */
  public async listRoutes({
    page,
    limit,
    search,
    customerId,
    farmId,
    includeFarm,
    includeCustomer,
    includeGeoJson,
    orderBy,
    orderType,
  }: RouteSearchQueryString): Promise<PaginatedRequest<typeof RouteViewModelSchema>> {
    app.log.info('[RouteService] - Listing all routes');

    const queryResult = await this.routeRepository.getAllRoutesWithRelations(
      page,
      limit,
      search,
      customerId,
      farmId,
      includeFarm,
      includeCustomer,
      includeGeoJson,
      orderBy,
      orderType,
    );
    const totalCount = await this.routeRepository.getRoutesCount(search, customerId, farmId);

    app.log.info('[RouteService] - Retrieved %d routes', totalCount);

    return {
      data: queryResult.map((route) => {
        if (includeFarm && includeCustomer) {
          return RouteVM.toViewModelWithFarmAndCustomer(route as RouteWithFarmAndCustomer);
        } else if (includeFarm) {
          return RouteVM.toViewModelWithFarm(route as RouteWithFarm);
        } else if (includeCustomer) {
          return RouteVM.toViewModelWithCustomer(route as RouteWithCustomer);
        } else {
          return RouteVM.toViewModel(route as Route);
        }
      }),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  /**
   * @description Get all routes
   * @param {boolean} includeFarm - Include farm data
   * @param {boolean} includeCustomer - Include customer data
   * @param {boolean} includeGeoJson - Include geoJson data
   * @param {string} routeId - Optional route ID to filter by
   * @param {string} farmId - Optional farm ID to filter by
   * @param {string} customerId - Optional customer ID to filter by
   * @param {RouteOrderBy} orderBy - Order by field
   * @param {RouteOrderType} orderType - Order type
   * @returns {Promise<Route[] | RouteWithFarm[] | RouteWithCustomer[] | RouteWithFarmAndCustomer[]>} The routes list
   */
  public async getAllRoutes(
    includeFarm: boolean,
    includeCustomer: boolean,
    includeGeoJson: boolean,
    routeId?: string,
    farmId?: string,
    customerId?: string,
    orderBy?: RouteOrderBy,
    orderType?: RouteOrderType,
  ): Promise<Route[] | RouteWithFarm[] | RouteWithCustomer[] | RouteWithFarmAndCustomer[]> {
    app.log.info('[RouteService] - Listing all routes');

    const queryResult = await this.routeRepository.getAllRoutes(
      routeId,
      farmId,
      customerId,
      includeFarm,
      includeCustomer,
      includeGeoJson,
      orderBy,
      orderType,
    );

    if (routeId && customerId && queryResult.length === 0) {
      app.log.warn(
        '[RouteService] - The route does not belong to this customer: %s : %s',
        routeId,
        customerId,
      );
      throw new AppError('A rota não pertence a este cliente', HTTP_STATUS_CODES.BAD_REQUEST);
    }

    if (customerId && queryResult.length === 0) {
      app.log.warn('[RouteService] - Customer not found: %s', customerId);
      throw new AppError('Cliente não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
    }

    if (farmId && queryResult.length === 0) {
      app.log.warn('[RouteService] - Farm not found: %s', farmId);
      throw new AppError('Fazenda não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    if (routeId && !customerId && !farmId && queryResult.length === 0) {
      app.log.warn('[RouteService] - Route not found: %s', routeId);
      throw new AppError('Rota não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    return queryResult;
  }

  /**
   * @description Get route by ID with optional relations
   * @param {string} routeId - The route's ID
   * @param {boolean} includeFarm - Include farm data
   * @param {boolean} includeCustomer - Include customer data
   * @param {boolean} includeGeoJson - Include geoJson data
   * @returns {Promise<Route | RouteWithFarm | RouteWithCustomer | RouteWithFarmAndCustomer>} The route details
   * @throws {AppError} If the route is not found
   */
  public async getRouteById(
    routeId: string,
    includeFarm: boolean,
    includeCustomer: boolean,
    _includeGeoJson: boolean,
  ): Promise<Route | RouteWithFarm | RouteWithCustomer | RouteWithFarmAndCustomer> {
    app.log.info('[RouteService] - Fetching route details for route %s', routeId);

    const route = await this.routeRepository.getRouteWithRelationsById(
      routeId,
      includeFarm,
      includeCustomer,
    );

    if (!route) {
      app.log.warn('[RouteService] - Route not found: %s', routeId);
      throw new AppError('Rota não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    app.log.info('[RouteService] - Successfully retrieved route details for %s', routeId);
    return route;
  }

  /**
   * @description Get routes by farm ID
   * @param {string} farmId - The farm's ID
   * @returns {Promise<Route[]>} The list of routes for the farm
   */
  public async getRoutesByFarmId(farmId: string): Promise<Route[]> {
    app.log.info('[RouteService] - Fetching routes for farm %s', farmId);

    // Validate that farm exists
    const farm = await db.query.farms.findFirst({
      where: eq(farms.id, farmId),
    });

    if (!farm) {
      app.log.warn('[RouteService] - Farm not found: %s', farmId);
      throw new AppError('Fazenda não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    const routes = await this.routeRepository.getRoutesByFarmId(farmId);

    app.log.info('[RouteService] - Retrieved %d routes for farm %s', routes.length, farmId);
    return routes;
  }

  /**
   * @description Get routes by customer ID
   * @param {string} customerId - The customer's ID
   * @returns {Promise<Route[]>} The list of routes for the customer
   */
  public async getRoutesByCustomerId(customerId: string): Promise<Route[]> {
    app.log.info('[RouteService] - Fetching routes for customer %s', customerId);

    // Validate that customer exists
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    });

    if (!customer) {
      app.log.warn('[RouteService] - Customer not found: %s', customerId);
      throw new AppError('Cliente não encontrado', HTTP_STATUS_CODES.NOT_FOUND);
    }

    const routes = await this.routeRepository.getRoutesByCustomerId(customerId);

    app.log.info('[RouteService] - Retrieved %d routes for customer %s', routes.length, customerId);
    return routes;
  }

  /**
   * @description Update route by ID
   * @param {string} routeId - The route's ID
   * @param {UpdateRouteDTO} data - The route data to update
   * @returns {Promise<Route>} The updated route
   * @throws {AppError} If the route is not found or validation fails
   */
  public async updateRoute(routeId: string, data: UpdateRouteDTO): Promise<Route> {
    app.log.info('[RouteService] - Starting route update for route %s', routeId);

    const existingRoute = await this.routeRepository.getRouteById(routeId);

    if (!existingRoute) {
      app.log.warn('[RouteService] - Route update failed: Route %s not found', routeId);
      throw new AppError('Rota não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    if (data.farmId || data.customerId) {
      const farmId = data.farmId || existingRoute.farmId;
      const customerId = data.customerId || existingRoute.customerId;

      const farm = await db.query.farms.findFirst({
        where: and(eq(farms.id, farmId), eq(farms.customerId, customerId)),
      });

      if (!farm) {
        app.log.warn(
          "[RouteService] - Route update failed: Farm %s not found or doesn't belong to customer %s",
          farmId,
          customerId,
        );
        throw new AppError(
          'Fazenda não encontrada ou não pertence ao cliente especificado',
          HTTP_STATUS_CODES.NOT_FOUND,
        );
      }
    }

    if (data.name && data.name !== existingRoute.name) {
      const farmId = data.farmId || existingRoute.farmId;
      const nameExists = await db.query.routes.findFirst({
        where: and(eq(routes.name, data.name), eq(routes.farmId, farmId), isNull(routes.deletedAt)),
      });

      if (nameExists) {
        app.log.warn(
          '[RouteService] - Route update failed: Route name %s already exists for farm %s',
          data.name,
          farmId,
        );
        throw new AppError(
          'Já existe uma rota com este nome para esta fazenda',
          HTTP_STATUS_CODES.CONFLICT,
        );
      }
    }

    const updateData: {
      name?: string;
      geoJson?: Record<string, unknown>;
      farmId?: string;
      customerId?: string;
    } = {};
    if (data.name) updateData.name = data.name;
    if (data.geoJson) updateData.geoJson = data.geoJson;
    if (data.farmId) updateData.farmId = data.farmId;
    if (data.customerId) updateData.customerId = data.customerId;

    if (Object.keys(updateData).length > 0) {
      await this.routeRepository.updateRoute(routeId, updateData);
    }

    const updatedRoute = await this.routeRepository.getRouteById(routeId);

    if (!updatedRoute) {
      app.log.error(
        '[RouteService] - Route update failed: Unable to retrieve updated route %s',
        routeId,
      );
      throw new AppError('Falha ao atualizar a rota', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
    }

    app.log.info('[RouteService] - Route updated successfully with ID %s', routeId);
    return updatedRoute;
  }

  /**
   * @description Soft Delete a route
   * @param {string} routeId - The route's ID to delete
   * @returns {Promise<void>}
   * @throws {AppError} If the route is not found
   */
  public async deleteRoute(routeId: string): Promise<void> {
    app.log.info('[RouteService] - Starting route deletion for route %s', routeId);

    // Check if route exists
    const existingRoute = await this.routeRepository.getRouteById(routeId);

    if (!existingRoute) {
      app.log.warn('[RouteService] - Route deletion failed: Route %s not found', routeId);
      throw new AppError('Rota não encontrada', HTTP_STATUS_CODES.NOT_FOUND);
    }

    await this.routeRepository.deleteRoute(routeId);

    app.log.info('[RouteService] - Route deleted successfully with ID %s', routeId);
  }

  private getUniqueRouteName(name: string, usedRouteNames: Set<string>): string {
    if (!usedRouteNames.has(name)) return name;

    let index = 2;
    let candidateName = `${name} (${index})`;

    while (usedRouteNames.has(candidateName)) {
      index++;
      candidateName = `${name} (${index})`;
    }

    return candidateName;
  }

  private enrichRouteGeoJson(
    geoJson: Record<string, unknown>,
    routeName: string,
    externalId?: string,
    sourceFileName?: string,
  ): Record<string, unknown> {
    const enrichProperties = (properties: unknown) => ({
      ...(isRecord(properties) ? properties : {}),
      route_name: routeName,
      ...(sourceFileName ? { source_file: sourceFileName } : {}),
      ...(externalId ? { externalId } : {}),
    });

    if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
      return {
        ...geoJson,
        features: geoJson.features.map((feature) => {
          if (!isRecord(feature)) return feature;

          return {
            ...feature,
            properties: enrichProperties(feature.properties),
          };
        }),
      };
    }

    if (geoJson.type === 'Feature') {
      return {
        ...geoJson,
        properties: enrichProperties(geoJson.properties),
      };
    }

    return geoJson;
  }
}
