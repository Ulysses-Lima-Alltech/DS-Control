import { z } from 'zod';

import {
  RegisterNewServiceOrderSchema,
  UpdateServiceOrderByIdSchema,
} from '@/schemas/service-order.schema';
import {
  CompletedPlotsReportAreaMode,
  ServiceOrder,
  ServiceOrderBy,
  ServiceOrderPlotStatus,
  ServiceOrderStatus,
  ServiceOrderType,
  StatsServiceOrders,
} from '@/types/service-order.type';

import { api } from './api.service';

export type GetAllServiceOrdersResponse = {
  data: ServiceOrder[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllServiceOrdersParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  includePlots?: string;
  includeGeoJson?: string;
  includeCustomers?: string;
  includePilots?: string;
  includeFarms?: string;
  includeContracts?: string;
  orderBy?: ServiceOrderBy;
  orderType?: ServiceOrderType;
};

export async function getAllServiceOrders(
  params?: GetAllServiceOrdersParams
): Promise<GetAllServiceOrdersResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.startDate) searchParams.append('startDate', params.startDate.toString());
  if (params?.endDate) searchParams.append('endDate', params.endDate.toString());
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots.toString());
  if (params?.includeGeoJson)
    searchParams.append('includeGeoJson', params.includeGeoJson.toString());
  if (params?.includeCustomers)
    searchParams.append('includeCustomers', params.includeCustomers.toString());
  if (params?.includePilots) searchParams.append('includePilots', params.includePilots.toString());
  if (params?.includeFarms) searchParams.append('includeFarms', params.includeFarms.toString());
  if (params?.includeContracts)
    searchParams.append('includeContracts', params.includeContracts.toString());
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy.toString());
  if (params?.orderType) searchParams.append('orderType', params.orderType.toString());

  const url = `/service-orders${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Service Order Service] Erro ao buscar ordens de serviço: ${error.message}`);
  }

  return await response.json();
}

export type RegisterNewServiceOrderParams = z.infer<typeof RegisterNewServiceOrderSchema>;

export type RegisterNewServiceOrderResponse = {
  message: string;
};

export type GetServiceOrderByIdParams = {
  includePlots?: string;
  includeGeoJson?: string;
  includePilots?: string;
  includeFarms?: string;
  includeContracts?: string;
  includeCustomers?: string;
};

export async function getServiceOrderById(
  serviceOrderId: string,
  params?: GetServiceOrderByIdParams
): Promise<ServiceOrder> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.includePlots) searchParams.append('includePlots', params.includePlots.toString());
    if (params?.includeGeoJson)
      searchParams.append('includeGeoJson', params.includeGeoJson.toString());
    if (params?.includePilots)
      searchParams.append('includePilots', params.includePilots.toString());
    if (params?.includeFarms) searchParams.append('includeFarms', params.includeFarms.toString());
    if (params?.includeContracts)
      searchParams.append('includeContracts', params.includeContracts.toString());
    if (params?.includeCustomers)
      searchParams.append('includeCustomers', params.includeCustomers.toString());

    const url = `/service-orders/${serviceOrderId}${
      searchParams.toString() ? `?${searchParams.toString()}` : ''
    }`;

    const response = await api(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Service Order Service] Erro ao buscar ordem de serviço: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`[Service Order Service] Erro ao buscar ordem de serviço: ${error}`);
  }
}

export async function registerNewServiceOrder(
  data: RegisterNewServiceOrderParams
): Promise<RegisterNewServiceOrderResponse> {
  try {
    RegisterNewServiceOrderSchema.parse(data);

    const response = await api(`/service-orders`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Service Order Service] Erro ao criar ordem de serviço: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Service Order Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar ordem de serviço');
    }

    console.error(`[Service Order Service] Erro ao criar ordem de serviço: ${error}`);
    throw error;
  }
}

export type UpdateServiceOrderByIdParams = z.infer<typeof UpdateServiceOrderByIdSchema> & {
  id: string;
};

export type UpdateServiceOrderByIdResponse = {
  message: string;
};

export async function updateServiceOrderById(
  data: UpdateServiceOrderByIdParams
): Promise<UpdateServiceOrderByIdResponse> {
  try {
    UpdateServiceOrderByIdSchema.parse(data);

    const response = await api(`/service-orders/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        customerId: data.customerId,
        contractId: data.contractId,
        farmsIds: data.farmsIds,
        pilotsIds: data.pilotsIds,
        plotsIds: data.plotsIds,
        plannedDate: data.plannedDate,
        observation: data.observation,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `[Service Order Service] Erro ao atualizar ordem de serviço: ${error.message}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Service Order Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar ordem de serviço');
    }

    console.error(`[Service Order Service] Erro ao atualizar ordem de serviço: ${error}`);
    throw error;
  }
}

export async function cancelServiceOrderById(serviceOrderId: string): Promise<ServiceOrder> {
  const response = await api(`/service-orders/${serviceOrderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'cancelled',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Service Order Service] Erro ao cancelar ordem de serviço: ${error.message}`);
  }

  return await response.json();
}

export async function reopenServiceOrderById(serviceOrderId: string): Promise<ServiceOrder> {
  const response = await api(`/service-orders/${serviceOrderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'open',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Service Order Service] Erro ao reabrir ordem de serviço: ${error.message}`);
  }

  return await response.json();
}

export async function completeServiceOrderById(serviceOrderId: string): Promise<ServiceOrder> {
  const response = await api(`/service-orders/${serviceOrderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'completed',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Service Order Service] Erro ao concluir ordem de serviço: ${error.message}`);
  }

  return await response.json();
}

export type UpdateServiceOrderPlotStatusParams = {
  serviceOrderId: string;
  plotId: string;
  status: ServiceOrderPlotStatus;
};

export type ServiceOrderPlotStatusResponse = UpdateServiceOrderPlotStatusParams & {
  id: string;
  completedAt: string | null;
  completedBy: string | null;
  updatedAt: string;
};

export async function updateServiceOrderPlotStatus({
  serviceOrderId,
  plotId,
  status,
}: UpdateServiceOrderPlotStatusParams): Promise<ServiceOrderPlotStatusResponse> {
  const response = await api(`/service-orders/${serviceOrderId}/plots/${plotId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao atualizar o status do talhÃ£o');
  }

  return response.json();
}

export type CompletedPlotsReportRow = {
  plotId: string;
  farmId: string;
  applicationId: string | null;
  registeredAreaHectares: string;
  effectiveAppliedHectares: string;
  realCoveragePercent: string;
  displayedAppliedHectares: string;
  displayedCoveragePercent: string;
  status: 'COMPLETED';
};

export type CompletedPlotsReportResponse = {
  areaMode: CompletedPlotsReportAreaMode;
  completionThresholdPercent: number;
  coverageSource: 'maximum_registered_application_area';
  rows: CompletedPlotsReportRow[];
  totalDisplayedHectares: string;
};

export async function getCompletedPlotsReport(
  serviceOrderId: string,
  areaMode: CompletedPlotsReportAreaMode
): Promise<CompletedPlotsReportResponse> {
  const response = await api(`/service-orders/${serviceOrderId}/reports/completed-plots`, {
    method: 'POST',
    body: JSON.stringify({ areaMode }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Erro ao preparar o relatório de talhões concluídos');
  }

  return response.json();
}

export type GetStatsServiceordersParams = {
  status?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
};

export type GetStatsServiceordersResponse = {
  message: string;
  stats: StatsServiceOrders;
};

export async function getStatsServiceorders(
  params?: GetStatsServiceordersParams
): Promise<GetStatsServiceordersResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);

  const url = `/service-orders/stats${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Service Order Service] Erro ao buscar estatísticas: ${error.message}`);
  }

  return await response.json();
}
