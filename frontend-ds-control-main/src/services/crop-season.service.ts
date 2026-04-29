import { z } from 'zod';

import {
  RegisterNewCropSeasonSchema,
  UpdateCropSeasonByIdSchema,
} from '@/schemas/crop-season.schema';
import { CropSeason } from '@/types/crop-season.type';

import { api } from './api.service';

export type GetAllCropSeasonsResponse = {
  data: CropSeason[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllCropSeasonsParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: 'active' | 'inactive';
};

export async function getAllCropSeasons(
  params?: GetAllCropSeasonsParams
): Promise<GetAllCropSeasonsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);

  const url = `/crop-seasons${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Crop Season Service] Erro ao buscar safras: ${error.message}`);
  }

  return await response.json();
}

export type GetCropSeasonByIdResponse = {
  message: string;
  cropSeason: CropSeason;
};

export async function getCropSeasonById(cropSeasonId: string): Promise<GetCropSeasonByIdResponse> {
  const response = await api(`/crop-seasons/${cropSeasonId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Crop Season Service] Erro ao buscar safra: ${error.message}`);
  }

  return await response.json();
}

export type GetCurrentCropSeasonResponse = {
  message: string;
  cropSeason: CropSeason | null;
};

export async function getCurrentCropSeason(): Promise<GetCurrentCropSeasonResponse> {
  const response = await api(`/crop-seasons/current`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Crop Season Service] Erro ao buscar safra atual: ${error.message}`);
  }

  return await response.json();
}

export type RegisterNewCropSeasonParams = z.infer<typeof RegisterNewCropSeasonSchema>;

export type RegisterNewCropSeasonResponse = {
  message: string;
};

export async function registerNewCropSeason(
  data: RegisterNewCropSeasonParams
): Promise<RegisterNewCropSeasonResponse> {
  try {
    RegisterNewCropSeasonSchema.parse(data);

    const response = await api(`/crop-seasons`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Crop Season Service] Erro ao criar safra: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Erro de validação ao criar safra');
    }

    throw error;
  }
}

export type UpdateCropSeasonByIdParams = z.infer<typeof UpdateCropSeasonByIdSchema> & {
  id: string;
};

export type UpdateCropSeasonByIdResponse = {
  message: string;
};

export async function updateCropSeasonById(
  data: UpdateCropSeasonByIdParams
): Promise<UpdateCropSeasonByIdResponse> {
  try {
    UpdateCropSeasonByIdSchema.parse(data);

    const response = await api(`/crop-seasons/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        productIds: data.productIds,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Crop Season Service] Erro ao atualizar safra: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Erro de validação ao atualizar safra');
    }

    throw error;
  }
}

export async function deleteCropSeasonById(cropSeasonId: string): Promise<void> {
  const response = await api(`/crop-seasons/${cropSeasonId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Crop Season Service] Erro ao deletar safra: ${error.message}`);
  }
}

