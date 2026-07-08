import { z } from 'zod';

import {
  CreateRouteSchema,
  CreateRoutesBatchSchema,
  UpdateRouteSchema,
} from '@/schemas/route.schema';
import { api } from '@/services/api.service';
import { Route, RouteOrderBy, RouteOrderType } from '@/types/route.type';

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

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch routes');
  }

  return await response.json();
}

export type DeleteRouteByIdResponse = {
  message: string;
};

export async function deleteRouteById(id: string): Promise<DeleteRouteByIdResponse> {
  const response = await api(`/routes/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete route');
  }

  return await response.json();
}

export type CreateRouteResponse = {
  message: string;
};

export type CreateRouteParams = z.infer<typeof CreateRouteSchema>;

export async function createRoute(data: CreateRouteParams): Promise<CreateRouteResponse> {
  try {
    CreateRouteSchema.parse(data);

    const response = await api(`/routes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('[Route Service] Response error: ' + response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('[Route Service] Validation error: ' + error.message);
    }
    throw new Error('[Route Service] Unknown error: ' + error);
  }
}

export type CreateRoutesBatchResponse = {
  message: string;
  createdCount: number;
  skippedCount: number;
  routes: Route[];
  errors: Array<{ name?: string; sourceFileName?: string; message: string }>;
};

export type CreateRoutesBatchParams = z.infer<typeof CreateRoutesBatchSchema>;

export async function createRoutesBatch(
  data: CreateRoutesBatchParams
): Promise<CreateRoutesBatchResponse> {
  try {
    CreateRoutesBatchSchema.parse(data);

    const response = await api(`/routes/batch`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('[Route Service] Response error: ' + response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('[Route Service] Validation error: ' + error.message);
    }
    throw new Error('[Route Service] Unknown error: ' + error);
  }
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

export type UpdateRouteByIdResponse = {
  message: string;
};

export type UpdateRouteByIdParams = z.infer<typeof UpdateRouteSchema>;

export async function updateRouteById(
  routeId: string,
  data: UpdateRouteByIdParams
): Promise<UpdateRouteByIdResponse> {
  try {
    UpdateRouteSchema.parse(data);

    const response = await api(`/routes/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('[Route Service] Response error: ' + response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('[Route Service] Validation error: ' + error.message);
    }
    throw new Error('[Route Service] Unknown error: ' + error);
  }
}
