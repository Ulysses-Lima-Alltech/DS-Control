import { api } from '@/services/api.service';
import { Customer } from '@/types/customer.type';

export type GetAllCustomersResponse = {
  data: Customer[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllCustomersParams = {
  page?: string;
  limit?: string;
  search?: string;
};

export async function getAllCustomers(
  params?: GetAllCustomersParams
): Promise<GetAllCustomersResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);

  const url = `/customers${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Customer Service] Erro ao buscar clientes: ${error.message}`);
  }

  return await response.json();
}
