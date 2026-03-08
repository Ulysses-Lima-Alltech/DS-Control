import { api } from '@/services/api.service';

import { Product } from '@/types/product.type';

export type GetAllProductsResponse = {
  data: Product[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllProductsParams = {
  search?: string;
  page?: string;
  limit?: string;
};

export async function getAllProducts(
  params?: GetAllProductsParams
): Promise<GetAllProductsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);

  const url = `/products${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Product Service] Erro ao buscar produtos: ${error.message}`);
  }

  return await response.json();
}
