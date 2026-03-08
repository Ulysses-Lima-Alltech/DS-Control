import { api } from '@/services/api.service';

import { Assistant } from '@/types/assistant.type';

export type GetAllAssistantsResponse = {
  data: Assistant[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllAssistantsParams = {
  page?: string;
  limit?: string;
  search?: string;
};

export async function getAllAssistants(
  params?: GetAllAssistantsParams
): Promise<GetAllAssistantsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);

  const url = `/assistants${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Assistant Service] Erro ao buscar ajudantes: ${error.message}`);
  }

  return await response.json();
}
