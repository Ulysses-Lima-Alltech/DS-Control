import { api } from '@/services/api.service';
import { CultureType } from '@/types/culture-types.type';

export type GetAllCultureTypesResponse = {
  data: CultureType[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllCultureTypesParams = {
  search?: string;
  page?: string;
  limit?: string;
};

export async function getAllCultureTypes(
  params?: GetAllCultureTypesParams
): Promise<GetAllCultureTypesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);

  const url = `/culture-types${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Culture Type Service] Erro ao buscar tipos de cultura: ${error.message}`);
  }

  return await response.json();
}
