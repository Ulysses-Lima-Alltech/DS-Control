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
  summary: {
    totalFilteredHectares: number;
    yesterdayHectares: number;
    standaloneCount: number;
    standaloneHectares: number;
  };
};

export type GetAllApplicationsParams = {
  page?: string;
  limit?: string;
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  productId?: string;
  cropSeasonId?: string;
  cropSeasonIds?: string[];
  customerId?: string;
  serviceOrderId?: string;
  assistantId?: string;
  droneId?: string;
  cultureId?: string;
  plotId?: string;
  customerName?: string;
  farmName?: string;
  pilotName?: string;
  assistantName?: string;
  droneName?: string;
  cultureName?: string;
  plotName?: string;
  productName?: string;
  observations?: string;
  serviceOrderNumber?: string;
  hectaresMin?: string;
  hectaresMax?: string;
  flowRateMin?: string;
  flowRateMax?: string;
  altitudeMin?: string;
  altitudeMax?: string;
  routeSpacingMin?: string;
  routeSpacingMax?: string;
  dropletSizeMin?: string;
  dropletSizeMax?: string;
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
  if (params?.cropSeasonId) searchParams.append('cropSeasonId', params.cropSeasonId);
  if (params?.cropSeasonIds && params.cropSeasonIds.length > 0) {
    params.cropSeasonIds.forEach((cropSeasonId) => searchParams.append('cropSeasonIds', cropSeasonId));
  }
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.assistantId) searchParams.append('assistantId', params.assistantId);
  if (params?.droneId) searchParams.append('droneId', params.droneId);
  if (params?.cultureId) searchParams.append('cultureId', params.cultureId);
  if (params?.plotId) searchParams.append('plotId', params.plotId);
  if (params?.customerName) searchParams.append('customerName', params.customerName);
  if (params?.farmName) searchParams.append('farmName', params.farmName);
  if (params?.pilotName) searchParams.append('pilotName', params.pilotName);
  if (params?.assistantName) searchParams.append('assistantName', params.assistantName);
  if (params?.droneName) searchParams.append('droneName', params.droneName);
  if (params?.cultureName) searchParams.append('cultureName', params.cultureName);
  if (params?.plotName) searchParams.append('plotName', params.plotName);
  if (params?.productName) searchParams.append('productName', params.productName);
  if (params?.observations) searchParams.append('observations', params.observations);
  if (params?.serviceOrderNumber) searchParams.append('serviceOrderNumber', params.serviceOrderNumber);
  if (params?.hectaresMin) searchParams.append('hectaresMin', params.hectaresMin);
  if (params?.hectaresMax) searchParams.append('hectaresMax', params.hectaresMax);
  if (params?.flowRateMin) searchParams.append('flowRateMin', params.flowRateMin);
  if (params?.flowRateMax) searchParams.append('flowRateMax', params.flowRateMax);
  if (params?.altitudeMin) searchParams.append('altitudeMin', params.altitudeMin);
  if (params?.altitudeMax) searchParams.append('altitudeMax', params.altitudeMax);
  if (params?.routeSpacingMin) searchParams.append('routeSpacingMin', params.routeSpacingMin);
  if (params?.routeSpacingMax) searchParams.append('routeSpacingMax', params.routeSpacingMax);
  if (params?.dropletSizeMin) searchParams.append('dropletSizeMin', params.dropletSizeMin);
  if (params?.dropletSizeMax) searchParams.append('dropletSizeMax', params.dropletSizeMax);
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
  assistantId?: string;
  droneId?: string;
  productId?: string;
  cropSeasonId?: string;
  cropSeasonIds?: string[];
  customerId?: string;
  serviceOrderId?: string;
  invalidApplication?: boolean;
  applicationIssue?: ApplicationIssueFilter;
  currentSeason?: boolean;
  startDate?: string;
  endDate?: string;
  ignoreFilters?: boolean;
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

export type ByPilotStat = {
  pilotId: string | null;
  pilotName: string;
  applicationsCount: number;
  totalAreaHectares: number;
  averageAreaPerApplication: number;
};

export type GetByPilotApplicationsParams = GetStatsApplicationsParams & {
  limit?: number;
};

export type GetByPilotApplicationsResponse = {
  message: string;
  byPilot: ByPilotStat[];
};

export type ApplicationsEvolutionItem = {
  date: string;
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
  if (params?.assistantId) searchParams.append('assistantId', params.assistantId);
  if (params?.droneId) searchParams.append('droneId', params.droneId);
  if (params?.productId) searchParams.append('productId', params.productId);
  if (params?.cropSeasonId) searchParams.append('cropSeasonId', params.cropSeasonId);
  if (params?.cropSeasonIds && params.cropSeasonIds.length > 0) {
    params.cropSeasonIds.forEach((cropSeasonId) => searchParams.append('cropSeasonIds', cropSeasonId));
  }
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication !== undefined)
    searchParams.append('invalidApplication', params.invalidApplication.toString());
  if (params?.applicationIssue) searchParams.append('applicationIssue', params.applicationIssue);
  if (params?.currentSeason !== undefined)
    searchParams.append('currentSeason', params.currentSeason.toString());
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.ignoreFilters !== undefined)
    searchParams.append('ignoreFilters', params.ignoreFilters.toString());

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
  if (params?.cropSeasonId) searchParams.append('cropSeasonId', params.cropSeasonId);
  if (params?.cropSeasonIds && params.cropSeasonIds.length > 0) {
    params.cropSeasonIds.forEach((cropSeasonId) => searchParams.append('cropSeasonIds', cropSeasonId));
  }
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

export async function getByPilotApplications(
  params?: GetByPilotApplicationsParams
): Promise<GetByPilotApplicationsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append('search', params.search);
  if (params?.serviceOrderStatus)
    searchParams.append('serviceOrderStatus', params.serviceOrderStatus);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.productId) searchParams.append('productId', params.productId);
  if (params?.cropSeasonId) searchParams.append('cropSeasonId', params.cropSeasonId);
  if (params?.cropSeasonIds && params.cropSeasonIds.length > 0) {
    params.cropSeasonIds.forEach((cropSeasonId) => searchParams.append('cropSeasonIds', cropSeasonId));
  }
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication !== undefined)
    searchParams.append('invalidApplication', params.invalidApplication.toString());
  if (params?.currentSeason !== undefined)
    searchParams.append('currentSeason', params.currentSeason.toString());
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const url = `/applications/stats/by-pilot${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar estatísticas operacionais por piloto: ${error.message}`
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
  if (params?.cropSeasonId) searchParams.append('cropSeasonId', params.cropSeasonId);
  if (params?.cropSeasonIds && params.cropSeasonIds.length > 0) {
    params.cropSeasonIds.forEach((cropSeasonId) => searchParams.append('cropSeasonIds', cropSeasonId));
  }
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
  pilotId?: string;
  search?: string;
  currentSeason?: boolean;
  cropSeasonId?: string;
  cropSeasonIds?: string[];
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
  const dateParamRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateParamRegex.test(params.startDate)) {
    throw new Error(
      `[Application Service] Erro ao buscar métricas do dashboard: startDate inválida (${params.startDate})`
    );
  }

  const [year, month, day] = params.startDate.split('-').map(Number);
  const startDateObj = new Date(year, month - 1, day);
  const isStrictValid =
    startDateObj.getFullYear() === year &&
    startDateObj.getMonth() === month - 1 &&
    startDateObj.getDate() === day;
  if (!isStrictValid) {
    throw new Error(
      `[Application Service] Erro ao buscar métricas do dashboard: startDate inválida (${params.startDate})`
    );
  }
  searchParams.append('startDate', params.startDate);

  if (params.contractIds && params.contractIds.length > 0) {
    params.contractIds.forEach((id) => searchParams.append('contractIds', id));
  }
  if (params.customerIds && params.customerIds.length > 0) {
    params.customerIds.forEach((id) => searchParams.append('customerIds', id));
  }
  if (params.farmIds && params.farmIds.length > 0) {
    params.farmIds.forEach((id) => searchParams.append('farmIds', id));
  }
  if (params.pilotId) {
    searchParams.append('pilotId', params.pilotId);
  }
  if (params.search) {
    searchParams.append('search', params.search);
  }
  if (params.currentSeason !== undefined) {
    searchParams.append('currentSeason', params.currentSeason.toString());
  }
  if (params.cropSeasonId) {
    searchParams.append('cropSeasonId', params.cropSeasonId);
  }
  if (params.cropSeasonIds && params.cropSeasonIds.length > 0) {
    params.cropSeasonIds.forEach((cropSeasonId) => searchParams.append('cropSeasonIds', cropSeasonId));
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
