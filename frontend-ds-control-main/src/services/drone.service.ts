import { z } from 'zod';

import { RegisterNewDroneSchema, UpdateDroneByIdSchema } from '@/schemas/drone.schema';
import { Drone } from '@/types/drone.type';

import { api } from './api.service';

export type GetAllDronesResponse = {
  data: Drone[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

export type GetAllDronesParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: 'active' | 'inactive';
};

export async function getAllDrones(params?: GetAllDronesParams): Promise<GetAllDronesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);

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

export type RegisterNewDroneParams = z.infer<typeof RegisterNewDroneSchema>;

export type RegisterNewDroneResponse = {
  message: string;
};

export async function registerNewDrone(
  data: RegisterNewDroneParams
): Promise<RegisterNewDroneResponse> {
  try {
    RegisterNewDroneSchema.parse(data);

    const response = await api(`/drones`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Drone Service] Erro ao criar drone: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Drone Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar drone');
    }

    console.error(`[Drone Service] Erro ao criar drone: ${error}`);
    throw error;
  }
}

export type UpdateDroneByIdParams = z.infer<typeof UpdateDroneByIdSchema> & {
  id: string;
};

export type UpdateDroneByIdResponse = {
  message: string;
};

export async function updateDroneById(
  data: UpdateDroneByIdParams
): Promise<UpdateDroneByIdResponse> {
  try {
    UpdateDroneByIdSchema.parse(data);

    const response = await api(`/drones/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: data.name,
        model: data.model,
        aircraftRid: data.aircraftRid,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Drone Service] Erro ao atualizar drone: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Drone Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar drone');
    }

    console.error(`[Drone Service] Erro ao atualizar drone: ${error}`);
    throw error;
  }
}

export async function deleteDroneById(droneId: string): Promise<void> {
  const response = await api(`/drones/${droneId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Drone Service] Erro ao deletar drone: ${error.message}`);
  }
}

export type GetDroneByIdResponse = {
  drone: Drone;
  message: string;
};

export async function getDroneById(droneId: string): Promise<GetDroneByIdResponse> {
  const response = await api(`/drones/${droneId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Drone Service] Erro ao buscar drone: ${error.message}`);
  }

  const data = await response.json();
  return data;
}

export type GetDronesOperationParams = {
  startDate: string;
  endDate: string;
};

export type DroneOperationData = {
  droneName: string;
  droneRID: string;
  day: string;
  month: string;
  applications: number;
  hectares: number;
};

export type GetDronesOperationResponse = {
  message: string;
  operation: {
    avgHectareByDrones: number;
    avgDailyByDrones: number;
    totalHectares: number;
    compareLastMonth: DroneOperationData[];
  };
};

export async function getDronesOperation(
  params: GetDronesOperationParams
): Promise<GetDronesOperationResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('startDate', params.startDate);
  searchParams.append('endDate', params.endDate);

  const response = await api(`/drones/operation?${searchParams.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Drone Service] Erro ao buscar operações dos drones: ${error.message}`);
  }

  return await response.json();
}
