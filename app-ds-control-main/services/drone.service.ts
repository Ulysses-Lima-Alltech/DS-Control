import { api } from '@/services/api.service';

import { Drone } from '@/types/drone.type';

export type GetAllDronesResponse = {
  data: Drone[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  page: number;
  limit: number;
};

export type GetAllDronesParams = {
  search?: string;
  page?: string;
  limit?: string;
};

export async function getAllDrones(params?: GetAllDronesParams): Promise<GetAllDronesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);

  const url = `/drones${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Drone Service] Erro ao buscar drones: ${error.message}`);
  }

  return await response.json();
}
