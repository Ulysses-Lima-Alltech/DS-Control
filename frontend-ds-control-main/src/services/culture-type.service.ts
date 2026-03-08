import { z } from 'zod';

import {
    RegisterNewCultureTypeSchema,
    UpdateCultureTypeByIdSchema,
} from '@/schemas/culture-type.schema';
import { CultureType } from '@/types/culture-types.type';

import { api } from './api.service';

export type GetAllCultureTypesResponse = {
  data: CultureType[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllCultureTypesParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: 'active' | 'inactive';
};

export async function getAllCultureTypes(
  params?: GetAllCultureTypesParams
): Promise<GetAllCultureTypesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);

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

export type RegisterNewCultureTypeParams = z.infer<typeof RegisterNewCultureTypeSchema>;

export type RegisterNewCultureTypeResponse = {
  message: string;
};

export async function registerNewCultureType(
  data: RegisterNewCultureTypeParams
): Promise<RegisterNewCultureTypeResponse> {
  try {
    RegisterNewCultureTypeSchema.parse(data);

    const response = await api(`/culture-types`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Culture Type Service] Erro ao criar tipo de cultura: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Culture Type Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar tipo de cultura');
    }

    console.error(`[Culture Type Service] Erro ao criar tipo de cultura: ${error}`);
    throw error;
  }
}

export type UpdateCultureTypeByIdParams = z.infer<typeof UpdateCultureTypeByIdSchema> & {
  id: string;
};

export type UpdateCultureTypeByIdResponse = {
  message: string;
};

export async function updateCultureTypeById(
  data: UpdateCultureTypeByIdParams
): Promise<UpdateCultureTypeByIdResponse> {
  try {
    UpdateCultureTypeByIdSchema.parse(data);

    const response = await api(`/culture-types/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: data.name, description: data.description }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Culture Type Service] Erro ao atualizar tipo de cultura: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Culture Type Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar tipo de cultura');
    }

    console.error(`[Culture Type Service] Erro ao atualizar tipo de cultura: ${error}`);
    throw error;
  }
}

export async function deleteCultureTypeById(cultureTypeId: string): Promise<void> {
  const response = await api(`/culture-types/${cultureTypeId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Culture Type Service] Erro ao deletar tipo de cultura: ${error.message}`);
  }
}

export type GetCultureTypeByIdResponse = {
  message?: string;
  cultureType?: CultureType;
};

export async function getCultureTypeById(
  cultureTypeId: string
): Promise<GetCultureTypeByIdResponse> {
  const response = await api(`/culture-types/${cultureTypeId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Culture Type Service] Erro ao buscar tipo de cultura: ${error.message}`);
  }

  const data = await response.json();
  return data;
}

export type GetCultureTypesStatsParams = {
  startDate: string;
  endDate: string;
};

export type CultureTypeStatsData = {
  cultureTypeName: string;
  day: string;
  month: string;
  applications: number;
  hectares: number;
};

export type GetCultureTypesStatsResponse = {
  message: string;
  statsCulture: {
    totalHectares: number;
    compareLastMonth: CultureTypeStatsData[];
  };
};

export async function getCultureTypesStats(
  params: GetCultureTypesStatsParams
): Promise<GetCultureTypesStatsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('startDate', params.startDate);
  searchParams.append('endDate', params.endDate);

  const response = await api(`/culture-types/stats?${searchParams.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Culture Type Service] Erro ao buscar estatísticas dos tipos de cultura: ${error.message}`
    );
  }

  return await response.json();
}
