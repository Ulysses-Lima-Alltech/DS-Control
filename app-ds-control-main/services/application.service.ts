import { z } from 'zod';
import NetInfo from '@react-native-community/netinfo';

import {
  RegisterNewApplicationSchema,
  RegisterNewLooseApplicationSchema,
  UpdateApplicationByIdSchema,
  UpdateLooseApplicationSchema,
} from '@/schemas/application.schema';
import {
  Application,
  ApplicationIssueFilter,
  ApplicationOrderBy,
  ApplicationOrderType,
} from '@/types/applications.type';
import {
  getOfflineApplications as getOfflineStoredApplications,
  getOfflineApplicationsByPlotId as getOfflineStoredApplicationsByPlotId,
  getOfflineApplicationsByServiceOrderId as getOfflineStoredApplicationsByServiceOrderId,
} from '@/offline/offlineStorage';
import { ServiceOrderStatus } from '@/types/service-order.type';
import { toOperationalDateYMD } from '@/utils/operational-date';

import { api } from './api.service';

const shouldUseOfflineData = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected === false || state.isInternetReachable === false;
};

const paginateOfflineApplications = (applications: Application[], params?: GetAllApplicationsParams) => {
  const normalizedSearch = params?.search?.trim().toLowerCase();
  const page = Number(params?.page ?? '1') || 1;
  const limit = Number(params?.limit ?? '100') || 100;
  const filtered = applications.filter((application) => {
    const matchesPilot = !params?.pilotId || application.pilotId === params.pilotId;
    const matchesAssistant = !params?.assistantId || application.assistantId === params.assistantId;
    const matchesProduct = !params?.productId || application.productId === params.productId;
    const matchesDrone = !params?.droneId || application.droneId === params.droneId;
    const matchesCulture = !params?.cultureId || application.cultureId === params.cultureId;
    const matchesServiceOrder =
      !params?.serviceOrderId || application.serviceOrderId === params.serviceOrderId;
    const matchesFarm = !params?.farmId || application.farmId === params.farmId;
    const matchesPlot = !params?.plotId || application.plotId === params.plotId;
    const matchesSearch =
      !normalizedSearch ||
      application.product?.name?.toLowerCase().includes(normalizedSearch) ||
      application.farm?.name?.toLowerCase().includes(normalizedSearch) ||
      application.plot?.name?.toLowerCase().includes(normalizedSearch) ||
      application.pilot?.name?.toLowerCase().includes(normalizedSearch) ||
      application.observations?.toLowerCase().includes(normalizedSearch);

    return (
      matchesPilot &&
      matchesAssistant &&
      matchesProduct &&
      matchesDrone &&
      matchesCulture &&
      matchesServiceOrder &&
      matchesFarm &&
      matchesPlot &&
      matchesSearch
    );
  });
  const start = (page - 1) * limit;

  return {
    data: filtered.slice(start, start + limit),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    totalCount: filtered.length,
  };
};

export type GetAllApplicationsParams = {
  search?: string;
  pilotId?: string;
  assistantId?: string;
  productId?: string;
  droneId?: string;
  cultureId?: string;
  customerId?: string;
  serviceOrderId?: string;
  farmId?: string;
  plotId?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  status?: ServiceOrderStatus;
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
  applicationIssue?: ApplicationIssueFilter;
  invalidApplication?: string;
  currentSeason?: boolean;
  cropSeasonId?: string;
  cropSeasonIds?: string[];
  includePlots?: string;
  includeCustomer?: string;
  includeServiceOrder?: string;
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  limit?: string;
  orderBy?: ApplicationOrderBy;
  orderType?: ApplicationOrderType;
};

export type GetAllApplicationsResponse = {
  data: Application[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
  summary?: {
    totalFilteredHectares: number;
    yesterdayHectares: number;
    standaloneCount: number;
    standaloneHectares: number;
  };
};

export async function getAllApplications(
  params?: GetAllApplicationsParams
): Promise<GetAllApplicationsResponse> {
  if (await shouldUseOfflineData()) {
    return paginateOfflineApplications(await getOfflineStoredApplications(), params);
  }

  const toCivilYYYYMMDD = (value: string) => {
    if (!value) return '';
    return toOperationalDateYMD(value) ?? '';
  };

  const searchParams = new URLSearchParams();
  const normalizedServiceOrderStatus = params?.serviceOrderStatus ?? params?.status;

  if (params?.search) searchParams.append('search', params.search);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.assistantId) searchParams.append('assistantId', params.assistantId);
  if (params?.productId) searchParams.append('productId', params.productId);
  if (params?.droneId) searchParams.append('droneId', params.droneId);
  if (params?.cultureId) searchParams.append('cultureId', params.cultureId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.plotId) searchParams.append('plotId', params.plotId);
  if (normalizedServiceOrderStatus)
    searchParams.append('serviceOrderStatus', normalizedServiceOrderStatus);
  if (params?.customerName) searchParams.append('customerName', params.customerName);
  if (params?.farmName) searchParams.append('farmName', params.farmName);
  if (params?.pilotName) searchParams.append('pilotName', params.pilotName);
  if (params?.assistantName) searchParams.append('assistantName', params.assistantName);
  if (params?.droneName) searchParams.append('droneName', params.droneName);
  if (params?.cultureName) searchParams.append('cultureName', params.cultureName);
  if (params?.plotName) searchParams.append('plotName', params.plotName);
  if (params?.productName) searchParams.append('productName', params.productName);
  if (params?.observations) searchParams.append('observations', params.observations);
  if (params?.serviceOrderNumber)
    searchParams.append('serviceOrderNumber', params.serviceOrderNumber);
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
  if (params?.applicationIssue) searchParams.append('applicationIssue', params.applicationIssue);
  if (params?.invalidApplication)
    searchParams.append('invalidApplication', params.invalidApplication);
  appendCropSeasonParams(searchParams, params);
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots);
  if (params?.includeCustomer) searchParams.append('includeCustomer', params.includeCustomer);
  if (params?.includeServiceOrder)
    searchParams.append('includeServiceOrder', params.includeServiceOrder);
  const startDate = params?.startDate ?? params?.dateFrom;
  const endDate = params?.endDate ?? params?.dateTo;

  if (startDate) {
    const normalizedStartDate = toCivilYYYYMMDD(startDate);
    if (normalizedStartDate) searchParams.append('startDate', normalizedStartDate);
  }
  if (endDate) {
    const normalizedEndDate = toCivilYYYYMMDD(endDate);
    if (normalizedEndDate) searchParams.append('endDate', normalizedEndDate);
  }
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
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

  const data = await response.json();
  return data;
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

export type GetApplicationsByServiceOrderIdResponse = {
  data: Application[];
};

export type GetApplicationsByServiceOrderIdParams = {
  includeGeoJson?: string;
};

export async function getApplicationsByServiceOrderId(
  serviceOrderId: string,
  params?: GetApplicationsByServiceOrderIdParams
): Promise<GetApplicationsByServiceOrderIdResponse> {
  if (await shouldUseOfflineData()) {
    return { data: await getOfflineStoredApplicationsByServiceOrderId(serviceOrderId) };
  }

  const searchParams = new URLSearchParams();
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);

  const url = `/applications/service-order/${serviceOrderId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

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

export type RegisterNewApplicationWithoutPlotParams = z.infer<
  typeof RegisterNewLooseApplicationSchema
>;

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
      body: JSON.stringify(data),
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

export async function registerNewApplicationWithoutPlot(
  data: RegisterNewApplicationWithoutPlotParams
): Promise<RegisterNewApplicationResponse> {
  try {
    const schema = RegisterNewLooseApplicationSchema;
    schema.parse(data);

    const response = await api(`/applications`, {
      method: 'POST',
      body: JSON.stringify({ ...data }),
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
      body: JSON.stringify(data),
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

export type UpdateLooseApplicationByIdParams = z.infer<typeof UpdateLooseApplicationSchema> & {
  id: string;
};

export type UpdateLooseApplicationByIdResponse = {
  message: string;
};

export async function updateLooseApplicationById(
  data: UpdateLooseApplicationByIdParams
): Promise<UpdateLooseApplicationByIdResponse> {
  try {
    UpdateLooseApplicationSchema.parse(data);

    const response = await api(`/applications/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Application Service] Erro ao atualizar aplicação avulsa: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Application Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar aplicação avulsa');
    }

    console.error(`[Application Service] Erro ao atualizar aplicação avulsa: ${error}`);
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

export type GetApplicationsByPilotIdResponse = {
  data: Application[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export async function getApplicationsByPilotId(
  pilotId: string,
  params?: GetAllApplicationsParams
): Promise<GetApplicationsByPilotIdResponse> {
  if (await shouldUseOfflineData()) {
    const applications = await getOfflineStoredApplications();
    return paginateOfflineApplications(applications, { ...params, pilotId });
  }

  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);

  const url = `/applications/pilot/${pilotId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações do piloto: ${error.message}`);
  }

  return await response.json();
}

export type GetApplicationsByPlotIdParams = {
  plotId: string;
  page?: string;
  limit?: string;
};

export type GetApplicationsByPlotIdResponse = {
  data: Application[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export async function getApplicationsByPlotId(
  params: GetApplicationsByPlotIdParams
): Promise<GetApplicationsByPlotIdResponse> {
  if (await shouldUseOfflineData()) {
    const applications = await getOfflineStoredApplicationsByPlotId(params.plotId);
    return paginateOfflineApplications(applications, params);
  }

  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page);
  if (params.limit) searchParams.append('limit', params.limit);

  const url = `/applications/plot/${params.plotId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar aplicações do plot: ${error.message}`);
  }

  return await response.json();
}

export type ApplicationStats = {
  applicationCount: number;
  applicationCountByMonth: number;
  totalAreaHectares: number;
  averageApplicationArea: number;
  pilotsCount: number;
  dronesCount: number;
  culturesCount: number;
  averageApplicationByPilot: number;
  averageApplicationByDrone: number;
  averageAreaCoveredApplication: number;
  invalidApplication: number;
  totalHectaresByMonth: number;
  totalHectaresPerDay: number;
  totalHectaresByMonthPerDay: number;
  pendingApplicationsCount: number;
  pendingApplicationsTotalArea: number;
  pendingFarmsCount: number;
  pendingPlotsCount: number;
  pendingApplicationsMissingFarmCount: number;
  pendingApplicationsOtherThanInvalidOpenCount: number;
  operationalAverageHectaresPerDay: number;
  operationalAverageHectaresPerDrone: number;
  operationalAverageHectaresPerPilot: number;
};

export type GetStatsApplicationsParams = {
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  assistantId?: string;
  droneId?: string;
  productId?: string;
  customerId?: string;
  serviceOrderId?: string;
  invalidApplication?: boolean;
  applicationIssue?: ApplicationIssueFilter;
  currentSeason?: boolean;
  cropSeasonId?: string;
  cropSeasonIds?: string[];
  startDate?: string;
  endDate?: string;
  ignoreFilters?: boolean;
};

export type GetStatsApplicationsResponse = {
  message: string;
  stats: ApplicationStats;
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

export type GetDashboardMetricsParams = {
  contractIds?: string[];
  customerIds?: string[];
  farmIds?: string[];
  pilotId?: string;
  search?: string;
  currentSeason?: boolean;
  cropSeasonId?: string;
  cropSeasonIds?: string[];
  startDate: string;
};

export type YesterdayStats = {
  totalArea: number;
  dronesCount: number;
  areaPerDrone: number;
};

export type MonthlySprayedArea = {
  month: string;
  yearMonth: string;
  hectares: number;
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

const statsDateParamRegex = /^\d{4}-\d{2}-\d{2}$/;

const toStatsCivilYYYYMMDD = (value: string) => {
  if (!value) return '';
  return toOperationalDateYMD(value) ?? '';
};

const appendCropSeasonParams = (
  searchParams: URLSearchParams,
  params?: { currentSeason?: boolean; cropSeasonId?: string; cropSeasonIds?: string[] }
) => {
  if (params?.currentSeason !== undefined) {
    searchParams.append('currentSeason', params.currentSeason.toString());
  }

  if (params?.cropSeasonId) {
    searchParams.append('cropSeasonId', params.cropSeasonId);
  }

  if (params?.cropSeasonIds && params.cropSeasonIds.length > 0) {
    params.cropSeasonIds.forEach((id) => searchParams.append('cropSeasonIds', id));
  }
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
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication !== undefined)
    searchParams.append('invalidApplication', params.invalidApplication.toString());
  if (params?.applicationIssue) searchParams.append('applicationIssue', params.applicationIssue);
  appendCropSeasonParams(searchParams, params);
  if (params?.startDate) {
    const normalizedStartDate = toStatsCivilYYYYMMDD(params.startDate);
    if (normalizedStartDate) searchParams.append('startDate', normalizedStartDate);
  }
  if (params?.endDate) {
    const normalizedEndDate = toStatsCivilYYYYMMDD(params.endDate);
    if (normalizedEndDate) searchParams.append('endDate', normalizedEndDate);
  }
  if (params?.ignoreFilters !== undefined)
    searchParams.append('ignoreFilters', params.ignoreFilters.toString());

  const url = `/applications/stats${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar estatisticas das aplicacoes: ${error.message}`
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
  if (params?.assistantId) searchParams.append('assistantId', params.assistantId);
  if (params?.droneId) searchParams.append('droneId', params.droneId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.serviceOrderId) searchParams.append('serviceOrderId', params.serviceOrderId);
  if (params?.invalidApplication !== undefined)
    searchParams.append('invalidApplication', params.invalidApplication.toString());
  if (params?.applicationIssue) searchParams.append('applicationIssue', params.applicationIssue);
  appendCropSeasonParams(searchParams, params);
  if (params?.startDate) {
    const normalizedStartDate = toStatsCivilYYYYMMDD(params.startDate);
    if (normalizedStartDate) searchParams.append('startDate', normalizedStartDate);
  }
  if (params?.endDate) {
    const normalizedEndDate = toStatsCivilYYYYMMDD(params.endDate);
    if (normalizedEndDate) searchParams.append('endDate', normalizedEndDate);
  }
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const url = `/applications/stats/by-pilot${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `[Application Service] Erro ao buscar estatisticas por piloto: ${error.message}`
    );
  }

  return await response.json();
}

export async function getDashboardMetrics(
  params: GetDashboardMetricsParams
): Promise<GetDashboardMetricsResponse> {
  const searchParams = new URLSearchParams();
  const normalizedStartDate = toStatsCivilYYYYMMDD(params.startDate);

  if (!normalizedStartDate || !statsDateParamRegex.test(normalizedStartDate)) {
    throw new Error(
      `[Application Service] Erro ao buscar metricas do dashboard: startDate invalida (${params.startDate})`
    );
  }

  searchParams.append('startDate', normalizedStartDate);

  if (params.contractIds && params.contractIds.length > 0) {
    params.contractIds.forEach((id) => searchParams.append('contractIds', id));
  }
  if (params.customerIds && params.customerIds.length > 0) {
    params.customerIds.forEach((id) => searchParams.append('customerIds', id));
  }
  if (params.farmIds && params.farmIds.length > 0) {
    params.farmIds.forEach((id) => searchParams.append('farmIds', id));
  }
  if (params.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params.search) searchParams.append('search', params.search);
  if (params.currentSeason !== undefined) {
    searchParams.append('currentSeason', params.currentSeason.toString());
  }
  appendCropSeasonParams(searchParams, {
    cropSeasonId: params.cropSeasonId,
    cropSeasonIds: params.cropSeasonIds,
  });

  const url = `/applications/dashboard-metrics?${searchParams.toString()}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Application Service] Erro ao buscar metricas do dashboard: ${error.message}`);
  }

  return await response.json();
}
