import NetInfo from '@react-native-community/netinfo';

import { getOfflineRoutesByFarmId } from '@/offline/offlineStorage';
import { api } from '@/services/api.service';
import { type Route, RouteOrderBy, RouteOrderType } from '@/types/route.type';

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
