import { z } from 'zod';

import { EditFarmParamsSchema, RegisterNewFarmParamsSchema } from '@/schemas/farm.schema';
import { api } from '@/services/api.service';
import { Farm, FarmOrderBy, FarmOrderType } from '@/types/farm.type';

export type GetAllFarmsResponse = {
  data: Farm[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetLiterallyAllFarmsResponse = {
  farms: Farm[];
};

export type GetLiterallyAllFarmsParams = {
  customerId?: string;
};

export async function getLiterallyAllFarms(
  params?: GetLiterallyAllFarmsParams
): Promise<GetLiterallyAllFarmsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.customerId) searchParams.append('customerId', params.customerId);

  const baseUrl = `/farms/allfarms`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch all farms');
  }

  return await response.json();
}

export type GetAllFarmsParams = {
  customerId?: string;
  page?: string;
  limit?: string;
  search?: string;
  includePlots?: string;
  includeGeoJson?: string;
  includeCustomer?: string;
  orderBy?: FarmOrderBy;
  orderType?: FarmOrderType;
};

export async function getAllFarms(
  customerId?: string,
  params?: GetAllFarmsParams
): Promise<GetAllFarmsResponse> {
  const searchParams = new URLSearchParams();
  if (customerId) searchParams.append('customerId', customerId);
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots.toString());
  if (params?.includeGeoJson)
    searchParams.append('includeGeoJson', params.includeGeoJson.toString());
  if (params?.includeCustomer)
    searchParams.append('includeCustomer', params.includeCustomer.toString());
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy.toString());
  if (params?.orderType) searchParams.append('orderType', params.orderType.toString());

  const baseUrl = `/farms`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch farms');
  }

  return await response.json();
}

export type DeleteFarmByIdResponse = {
  message: string;
};

export async function deleteFarmById(id: string): Promise<DeleteFarmByIdResponse> {
  const response = await api(`/farms/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete farm');
  }

  return await response.json();
}

export type RegisterNewFarmResponse = {
  message: string;
};

export type RegisterNewFarmParams = z.infer<typeof RegisterNewFarmParamsSchema>;

export async function registerNewFarm(
  data: RegisterNewFarmParams
): Promise<RegisterNewFarmResponse> {
  try {
    RegisterNewFarmParamsSchema.parse(data);

    const response = await api(`/farms`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('[Farm Service] Response error: ' + response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('[Farm Service] Validation error: ' + error.message);
    }
    throw new Error('[Farm Service] Unknown error: ' + error);
  }
}

export type GetFarmByIdParams = {
  includePlots?: string;
  includeGeoJson?: string;
  includeCustomer?: string;
};

export type GetFarmByIdResponse = {
  message: string;
  farm: Farm;
};

export async function getFarmById(
  farmId: string,
  params?: GetFarmByIdParams
): Promise<GetFarmByIdResponse> {
  const searchParams = new URLSearchParams();
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots);
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);
  if (params?.includeCustomer) searchParams.append('includeCustomer', params.includeCustomer);

  const baseUrl = `/farms/${farmId}`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  try {
    const response = await api(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch farm');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Farm Service] Unknown error: ', error);
    throw new Error('[Farm Service] Unknown error');
  }
}

export type EditFarmByIdResponse = {
  message: string;
};

export type EditFarmByIdParams = z.infer<typeof EditFarmParamsSchema>;

export async function editFarmById(
  farmId: string,
  data: EditFarmByIdParams
): Promise<EditFarmByIdResponse> {
  try {
    EditFarmParamsSchema.parse(data);

    const response = await api(`/farms/${farmId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('[Farm Service] Response error: ' + response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('[Farm Service] Validation error: ' + error.message);
    }
    throw new Error('[Farm Service] Unknown error: ' + error);
  }
}
