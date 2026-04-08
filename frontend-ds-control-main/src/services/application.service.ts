import { z } from 'zod';

import {
  RegisterNewApplicationSchema,
  UpdateApplicationByIdSchema,
} from '@/schemas/application.schema';
import {
  Application,
  ApplicationIssueFilter,
  ApplicationOrderBy,
  ApplicationOrderType,
  ApplicationStats,
} from '@/types/applications.type';
import { ServiceOrderStatus } from '@/types/service-order.type';

import { api } from './api.service';

export type GetAllApplicationsResponse = {
  data: Application[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllApplicationsParams = {
  page?: string;
  limit?: string;
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  productId?: string;
  customerId?: string;
  serviceOrderId?: string;
  invalidApplication?: string;
  applicationIssue?: ApplicationIssueFilter;
  startDate?: string;
  endDate?: string;
  orderBy?: ApplicationOrderBy;
  orderType?: ApplicationOrderType;
};

export async function getAllApplications(
  params?: GetAllApplicationsParams
): Promise<GetAllApplicationsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.serviceOrderStatus)
    searchParams.append('serviceOrderStatus', params.serviceOrderStatus);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.productId) searchParams.append('productId', params.productId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication)
    searchParams.append('invalidApplication', params.invalidApplication);
  if (params?.applicationIssue)
    searchParams.append('applicationIssue', params.applicationIssue);
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy);
  if (params?.orderType) searchParams.append('orderType', params.orderType);
  const url = `/applications${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationByIdResponse = {
  application: Application;
};

export async function getApplicationById(
  applicationId: string
): Promise<GetApplicationByIdResponse> {
  const response = await api(`/applications/${applicationId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicação: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsByCustomerIdResponse = {
  data: Application[];
};

export async function getApplicationsByCustomerId(
  customerId: string
): Promise<GetApplicationsByCustomerIdResponse> {
  const response = await api(`/applications/customer/${customerId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações do cliente: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsByPilotIdResponse = {
  data: Application[];
};

export async function getApplicationsByPilotId(
  pilotId: string
): Promise<GetApplicationsByPilotIdResponse> {
  const response = await api(`/applications/pilot/${pilotId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações do piloto: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsByFarmIdResponse = {
  data: Application[];
};

export async function getApplicationsByFarmId(
  farmId: string
): Promise<GetApplicationsByFarmIdResponse> {
  const response = await api(`/applications/farm/${farmId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações da fazenda: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsByServiceOrderIdResponse = {
  data: Application[];
};

export async function getApplicationsByServiceOrderId(
  serviceOrderId: string
): Promise<GetApplicationsByServiceOrderIdResponse> {
  const limit = 1000;
  const url = `/applications/service-order/${serviceOrderId}?limit=${limit}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar aplicações da ordem de serviço: ${error.message}`
    );
  }

  return await response.json();
}

export type RegisterNewApplicationParams = z.infer<typeof RegisterNewApplicationSchema>;

export type RegisterNewApplicationResponse = {
  message: string;
};

export async function registerNewApplication(
  data: RegisterNewApplicationParams
): Promise<RegisterNewApplicationResponse> {
  try {
    RegisterNewApplicationSchema.parse(data);

    const response = await api(`/applications`, {
      method: 'POST',
      body: JSON.stringify({ ...data, plotId: data.plotId ? data.plotId : null }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Application Service] Erro ao criar aplicação: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Application Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar aplicação');
    }

    console.error(`[Application Service] Erro ao criar aplicação: ${error}`);
    throw error;
  }
}

export type UpdateApplicationByIdParams = z.infer<typeof UpdateApplicationByIdSchema> & {
  id: string;
};

export type UpdateApplicationByIdResponse = {
  message: string;
};

export async function updateApplicationById(
  data: UpdateApplicationByIdParams
): Promise<UpdateApplicationByIdResponse> {
  try {
    UpdateApplicationByIdSchema.parse(data);

    const response = await api(`/applications/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        serviceOrderId: data.serviceOrderId,
        farmId: data.farmId,
        pilotId: data.pilotId,
        assistantId: data.assistantId,
        droneId: data.droneId,
        cultureId: data.cultureId,
        hectares: data.hectares,
        flowRate: data.flowRate,
        altitude: data.altitude,
        routeSpacing: data.routeSpacing,
        dropletSize: data.dropletSize,
        date: data.date,
        productId: data.productId,
        plotId: data.plotId ? data.plotId : null,
        observations: data.observations,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Application Service] Erro ao atualizar aplicação: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Application Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar aplicação');
    }

    console.error(`[Application Service] Erro ao atualizar aplicação: ${error}`);
    throw error;
  }
}

export async function deleteApplicationById(applicationId: string): Promise<void> {
  const response = await api(`/applications/${applicationId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao deletar aplicação: ${error.message}`);
  }
}

export type GetStatsApplicationsParams = {
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  productId?: string;
  customerId?: string;
  serviceOrderId?: string;
  invalidApplication?: boolean;
  startDate?: string;
  endDate?: string;
};

export type GetStatsApplicationsResponse = {
  message: string;
  stats: ApplicationStats;
};

export type TopFarmStat = {
  farmId: string | null;
  farmName: string;
  applicationsCount: number;
  totalAreaHectares: number;
};

export type GetTopFarmsApplicationsParams = GetStatsApplicationsParams & {
  limit?: number;
};

export type GetTopFarmsApplicationsResponse = {
  message: string;
  topFarms: TopFarmStat[];
};

export type ApplicationsEvolutionItem = {
  yearMonth: string;
  applicationsCount: number;
};

export type EvolutionGranularity = 'day' | 'month' | 'year';

export type GetApplicationsEvolutionParams = GetStatsApplicationsParams & {
  months?: number;
  granularity?: EvolutionGranularity;
};

export type GetApplicationsEvolutionResponse = {
  message: string;
  evolution: ApplicationsEvolutionItem[];
};

export async function getStatsApplications(
  params?: GetStatsApplicationsParams
): Promise<GetStatsApplicationsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.serviceOrderStatus)
    searchParams.append('serviceOrderStatus', params.serviceOrderStatus);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.productId) searchParams.append('productId', params.productId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication !== undefined)
    searchParams.append('invalidApplication', params.invalidApplication.toString());
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);

  const url = `/applications/stats${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar estatísticas das aplicações: ${error.message}`
    );
  }

  return await response.json();
}

export async function getTopFarmsApplications(
  params?: GetTopFarmsApplicationsParams
): Promise<GetTopFarmsApplicationsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.serviceOrderStatus)
    searchParams.append('serviceOrderStatus', params.serviceOrderStatus);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.productId) searchParams.append('productId', params.productId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication !== undefined)
    searchParams.append('invalidApplication', params.invalidApplication.toString());
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const url = `/applications/stats/top-farms${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar ranking de fazendas: ${error.message}`
    );
  }

  return await response.json();
}

export async function getApplicationsEvolution(
  params?: GetApplicationsEvolutionParams
): Promise<GetApplicationsEvolutionResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.serviceOrderStatus)
    searchParams.append('serviceOrderStatus', params.serviceOrderStatus);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.productId) searchParams.append('productId', params.productId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication !== undefined)
    searchParams.append('invalidApplication', params.invalidApplication.toString());
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.months) searchParams.append('months', params.months.toString());
  if (params?.granularity) searchParams.append('granularity', params.granularity);

  const url = `/applications/stats/evolution${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar evolução de aplicações: ${error.message}`
    );
  }

  return await response.json();
}

export type GetApplicationsSummaryParams = {
  startDate: string;
  endDate: string;
};

export type ApplicationSummary = {
  avgDaily: number;
  avgHectarebyApplication: number;
  cancelledOrdersCount: number;
  comparisonLastMonths: Array<{
    day: string;
    hectares: number;
    month: string;
    totalApplications: number;
  }>;
  completedOrdersCount: number;
  openOrdersCount: number;
  totalHectares: number;
  openOrdersAreaHectares: number;
  completedOrdersAreaHectares: number;
  cancelledOrdersAreaHectares: number;
  openOrdersAppliedHectares: number;
  completedOrdersAppliedHectares: number;
  cancelledOrdersAppliedHectares: number;
};

export type GetApplicationsSummaryResponse = {
  message: string;
  summary: ApplicationSummary;
};

export async function getApplicationsSummary(
  params: GetApplicationsSummaryParams
): Promise<GetApplicationsSummaryResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('startDate', params.startDate);
  searchParams.append('endDate', params.endDate);

  const response = await api(`/applications/summary?${searchParams.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar resumo das aplicações: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsPerformanceParams = {
  startDate: string;
  endDate: string;
};

export type PilotsPerformance = {
  avgHectaresByPilot: number;
  avgDailyByPilot: number;
  totalHectares: number;
  comparelaLastMonth: Array<{
    pilotName: string;
    day: string;
    month: string;
    applications: number;
    hectares: number;
  }>;
};

export type GetApplicationsPerformanceResponse = {
  message: string;
  pilots: PilotsPerformance;
};

export async function getApplicationsPerformance(
  params: GetApplicationsPerformanceParams
): Promise<GetApplicationsPerformanceResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('startDate', params.startDate);
  searchParams.append('endDate', params.endDate);

  const response = await api(`/applications/performance?${searchParams.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar desempenho dos pilotos: ${error.message}`
    );
  }

  return await response.json();
}

// Dashboard Metrics Types
export type GetDashboardMetricsParams = {
  contractIds?: string[];
  customerIds?: string[];
  farmIds?: string[];
  startDate: string; // Required - first day of selected period (YYYY-MM-DD format)
};

export type MonthlySprayedArea = {
  month: string;
  yearMonth: string;
  hectares: number;
};

export type YesterdayStats = {
  totalArea: number;
  dronesCount: number;
  areaPerDrone: number;
};

export type DashboardMetrics = {
  totalAreaHectares: number;
  daysSinceStart: number;
  averageDailyArea: number;
  yesterdayStats: YesterdayStats;
  monthlySprayedArea: MonthlySprayedArea[];
};

export type GetDashboardMetricsResponse = {
  message: string;
  metrics: DashboardMetrics;
};

export async function getDashboardMetrics(
  params: GetDashboardMetricsParams
): Promise<GetDashboardMetricsResponse> {
  const searchParams = new URLSearchParams();

  const startDateObj = new Date(params.startDate + 'T00:00:00');
  startDateObj.setDate(startDateObj.getDate() - 1);
  const adjustedStartDate = startDateObj.toISOString().split('T')[0];

  searchParams.append('startDate', adjustedStartDate);

  if (params.contractIds && params.contractIds.length > 0) {
    params.contractIds.forEach((id) => searchParams.append('contractIds', id));
  }
  if (params.customerIds && params.customerIds.length > 0) {
    params.customerIds.forEach((id) => searchParams.append('customerIds', id));
  }
  if (params.farmIds && params.farmIds.length > 0) {
    params.farmIds.forEach((id) => searchParams.append('farmIds', id));
  }

  const url = `/applications/dashboard-metrics?${searchParams.toString()}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar métricas do dashboard: ${error.message}`);
  }

  return await response.json();
}
