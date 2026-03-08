import { api } from '@/services/api.service';
import { Farm } from '@/types/farm.type';

export type GetAllFarmsResponse = {
  farms: Farm[];
  message: string;
};

export type GetAllFarmsParams = {
  customerId?: string;
  includePlots?: string;
  includeGeoJson?: string;
  includeCustomer?: string;
};

export async function getAllFarms(
  customerId?: string,
  params?: GetAllFarmsParams
): Promise<GetAllFarmsResponse> {
  const searchParams = new URLSearchParams();
  if (customerId) searchParams.append('customerId', customerId);
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots);
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);
  if (params?.includeCustomer) searchParams.append('includeCustomer', params.includeCustomer);

  const baseUrl = `/farms/allfarms`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch all farms: ' + response.statusText);
  }

  const data = await response.json();
  return data;
}

export type GetAllFarmsPaginatedResponse = {
  data: Farm[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllFarmsPaginatedParams = {
  customerId?: string;
  page?: string;
  limit?: string;
  search?: string;
  includePlots?: string;
  includeGeoJson?: string;
  includeCustomer?: string;
};

export async function getAllFarmsPaginated(
  customerId?: string,
  params?: GetAllFarmsPaginatedParams
): Promise<GetAllFarmsPaginatedResponse> {
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

  const baseUrl = `/farms`;
  const url = `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch all farms paginated: ' + response.statusText);
  }

  const data = await response.json();
  return data;
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
      throw new Error('Failed to fetch farm by id: ' + response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Farm Service] Unknown error: ', error);
    throw new Error('[Farm Service] Unknown error');
  }
}
