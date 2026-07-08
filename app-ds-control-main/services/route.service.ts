import NetInfo from '@react-native-community/netinfo';

import {
  getOfflineFarms,
  getOfflineRoutes,
  getOfflineRoutesByFarmId,
} from '@/offline/offlineStorage';
import { api } from '@/services/api.service';
import { type Route, RouteFarmGroup, RouteOrderBy, RouteOrderType } from '@/types/route.type';

export type GetAllRoutesResponse = {
  data: Route[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllRoutesParams = {
  customerId?: string;
  farmId?: string;
  page?: string;
  limit?: string;
  search?: string;
  includeFarm?: string;
  includeCustomer?: string;
  includeGeoJson?: string;
  orderBy?: RouteOrderBy;
  orderType?: RouteOrderType;
};

export type GetRoutesGroupedByFarmResponse = {
  data: RouteFarmGroup[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetRoutesGroupedByFarmParams = Omit<
  GetAllRoutesParams,
  'includeFarm' | 'includeCustomer'
>;

const shouldUseOfflineData = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected === false || state.isInternetReachable === false;
};

export async function getAllRoutes(params?: GetAllRoutesParams): Promise<GetAllRoutesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.includeFarm) searchParams.append('includeFarm', params.includeFarm.toString());
  if (params?.includeCustomer)
    searchParams.append('includeCustomer', params.includeCustomer.toString());
  if (params?.includeGeoJson)
    searchParams.append('includeGeoJson', params.includeGeoJson.toString());
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy.toString());
  if (params?.orderType) searchParams.append('orderType', params.orderType.toString());

  const baseUrl = `/routes`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  if (__DEV__) {
    console.warn('[Route Service][DEV] GET /routes request diagnostic', {
      method: 'GET',
      endpoint: baseUrl,
      url,
      params: Object.fromEntries(searchParams.entries()),
    });
  }

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch routes');
  }

  return await response.json();
}

const routeMatchesSearch = (route: Route, group: RouteFarmGroup, search?: string) => {
  if (!search?.trim()) return true;

  const normalizedSearch = search.trim().toLowerCase();

  return [route.name, group.farmName, group.customerName].some((value) =>
    value?.toLowerCase().includes(normalizedSearch)
  );
};

const buildOfflineRouteGroups = async (
  params?: GetRoutesGroupedByFarmParams
): Promise<GetRoutesGroupedByFarmResponse> => {
  const [routes, farms] = await Promise.all([getOfflineRoutes(), getOfflineFarms()]);
  const farmsById = new Map(farms.map((farm) => [farm.id, farm]));
  const groups = new Map<string, RouteFarmGroup>();

  routes.forEach((route) => {
    if (params?.customerId && route.customerId !== params.customerId) return;
    if (params?.farmId && route.farmId !== params.farmId) return;

    const farm = farmsById.get(route.farmId);
    const group = groups.get(route.farmId) ?? {
      farmId: route.farmId,
      farmName: farm?.name ?? 'Fazenda nao informada',
      customerId: route.customerId,
      customerName: farm?.customer?.name ?? 'Cliente nao informado',
      routeCount: 0,
      lastRouteUpdatedAt: null,
      routes: [],
    };

    if (!routeMatchesSearch(route, group, params?.search)) return;

    const routeWithRelations = {
      ...route,
      farm: {
        id: route.farmId,
        name: group.farmName,
      },
      customer: {
        id: route.customerId,
        name: group.customerName,
      },
    };
    const routeUpdatedAt = route.updatedAt ?? route.createdAt ?? null;

    if (
      routeUpdatedAt &&
      (!group.lastRouteUpdatedAt ||
        new Date(routeUpdatedAt).getTime() > new Date(group.lastRouteUpdatedAt).getTime())
    ) {
      group.lastRouteUpdatedAt = routeUpdatedAt;
    }

    group.routes.push(routeWithRelations);
    group.routeCount = group.routes.length;
    groups.set(route.farmId, group);
  });

  const orderType = params?.orderType ?? RouteOrderType.DESC;
  const direction = orderType === RouteOrderType.ASC ? 1 : -1;
  const sortedGroups = Array.from(groups.values()).sort((firstGroup, secondGroup) => {
    if (params?.orderBy === RouteOrderBy.CUSTOMER) {
      return firstGroup.customerName.localeCompare(secondGroup.customerName) * direction;
    }
    if (params?.orderBy === RouteOrderBy.FARM || params?.orderBy === RouteOrderBy.NAME) {
      return firstGroup.farmName.localeCompare(secondGroup.farmName) * direction;
    }

    return (
      ((new Date(firstGroup.lastRouteUpdatedAt ?? 0).getTime() || 0) -
        (new Date(secondGroup.lastRouteUpdatedAt ?? 0).getTime() || 0)) *
      direction
    );
  });

  const page = Number(params?.page ?? 1);
  const limit = Number(params?.limit ?? 10);
  const pageStart = (page - 1) * limit;
  const data = sortedGroups.slice(pageStart, pageStart + limit);

  return {
    data,
    page,
    limit,
    totalPages: Math.ceil(sortedGroups.length / limit),
    totalCount: sortedGroups.length,
  };
};

export async function getRoutesGroupedByFarm(
  params?: GetRoutesGroupedByFarmParams
): Promise<GetRoutesGroupedByFarmResponse> {
  if (await shouldUseOfflineData()) {
    return buildOfflineRouteGroups(params);
  }

  const searchParams = new URLSearchParams();
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.includeGeoJson)
    searchParams.append('includeGeoJson', params.includeGeoJson.toString());
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy.toString());
  if (params?.orderType) searchParams.append('orderType', params.orderType.toString());

  const baseUrl = `/routes/grouped-by-farm`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch routes grouped by farm');
  }

  return await response.json();
}

export type GetRouteByIdParams = {
  includeFarm?: string;
  includeCustomer?: string;
  includeGeoJson?: string;
};

export type GetRouteByIdResponse = {
  message: string;
  route: Route;
};

export async function getRouteById(
  routeId: string,
  params?: GetRouteByIdParams
): Promise<GetRouteByIdResponse> {
  const searchParams = new URLSearchParams();
  if (params?.includeFarm) searchParams.append('includeFarm', params.includeFarm);
  if (params?.includeCustomer) searchParams.append('includeCustomer', params.includeCustomer);
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);

  const baseUrl = `/routes/${routeId}`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  try {
    const response = await api(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch route');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Route Service] Unknown error: ', error);
    throw new Error('[Route Service] Unknown error');
  }
}

export type GetRouteByFarmIdParams = {
  includeFarm?: string;
  includeCustomer?: string;
  includeGeoJson?: string;
};

export type GetRouteByFarmIdResponse = {
  message: string;
  routes: Route[];
};

export type GetRoutesForNavigationByFarmIdResponse = {
  message: string;
  routes: Route[];
};

export async function getRouteByFarmId(
  farmId: string,
  params?: GetRouteByFarmIdParams
): Promise<GetRouteByFarmIdResponse> {
  if (await shouldUseOfflineData()) {
    return {
      message: 'Offline routes retrieved successfully',
      routes: await getOfflineRoutesByFarmId(farmId),
    };
  }

  const searchParams = new URLSearchParams();
  if (params?.includeFarm) searchParams.append('includeFarm', params.includeFarm);
  if (params?.includeCustomer) searchParams.append('includeCustomer', params.includeCustomer);
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);

  const baseUrl = `/routes/farm/${farmId}`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  try {
    const response = await api(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch routes by farm');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Route Service] Unknown error: ', error);
    throw new Error('[Route Service] Unknown error');
  }
}

export async function getRoutesForNavigationByFarmId(
  farmId: string
): Promise<GetRoutesForNavigationByFarmIdResponse> {
  if (await shouldUseOfflineData()) {
    return {
      message: 'Offline routes retrieved successfully',
      routes: await getOfflineRoutesByFarmId(farmId),
    };
  }

  const response = await getAllRoutes({
    farmId,
    page: '1',
    limit: '100',
    includeFarm: 'true',
    includeCustomer: 'true',
    includeGeoJson: 'true',
    orderBy: RouteOrderBy.CREATEDAT,
    orderType: RouteOrderType.DESC,
  });

  return {
    message: 'Routes retrieved successfully',
    routes: response.data,
  };
}
