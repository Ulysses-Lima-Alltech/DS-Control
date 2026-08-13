import { api } from '@/services/api.service';
import { Contract } from '@/types/contracts.type';

export type GetContractsByCustomerIdResponse = {
  data: Contract[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export async function getContractsByCustomerId(
  customerId: string,
  params?: { page?: string; limit?: string }
): Promise<GetContractsByCustomerIdResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);

  const url = `/contracts/customer/${customerId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch contracts by customer: ' + response.statusText);
  }

  return await response.json();
}
