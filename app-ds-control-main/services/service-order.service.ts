import {
  ServiceOrder,
  ServiceOrderStatus,
  ServiceOrderBy,
  ServiceOrderType,
} from '@/types/service-order.type';
import { toOperationalDateYMD } from '@/utils/operational-date';

import { api } from './api.service';

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toCivilYYYYMMDD = (value: string) => {
  if (!value) return '';
  if (DATE_PARAM_REGEX.test(value)) return value;
  return toOperationalDateYMD(value) ?? '';
};

export type GetAllMyOpenServiceOrdersResponse = {
  data: ServiceOrder[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllMyOpenServiceOrdersParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  orderBy?: ServiceOrderBy;
  orderType?: ServiceOrderType;
  includePlots?: string;
  includeFarms?: string;
  includePilots?: string;
  includeCustomers?: string;
  includeContracts?: string;
  includeGeoJson?: string;
};

export async function getAllMyOpenServiceOrders(
  params?: GetAllMyOpenServiceOrdersParams
): Promise<GetAllMyOpenServiceOrdersResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.farmId) searchParams.append('farmId', params.farmId);
  if (params?.pilotId) searchParams.append('pilotId', params.pilotId);
  if (params?.customerId) searchParams.append('customerId', params.customerId);
  if (params?.startDate) {
    const normalizedStartDate = toCivilYYYYMMDD(params.startDate);
    if (normalizedStartDate) searchParams.append('startDate', normalizedStartDate);
  }
  if (params?.endDate) {
    const normalizedEndDate = toCivilYYYYMMDD(params.endDate);
    if (normalizedEndDate) searchParams.append('endDate', normalizedEndDate);
  }
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy.toString());
  if (params?.orderType) searchParams.append('orderType', params.orderType.toString());
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots);
  if (params?.includeFarms) searchParams.append('includeFarms', params.includeFarms);
  if (params?.includePilots) searchParams.append('includePilots', params.includePilots);
  if (params?.includeCustomers) searchParams.append('includeCustomers', params.includeCustomers);
  if (params?.includeContracts) searchParams.append('includeContracts', params.includeContracts);
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);

  const url = `/service-orders/my-open-orders${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Service Order Service] Erro ao buscar ordens de serviço: ${error.message}`);
  }

  return await response.json();
}

export type GetServiceOrderByIdParams = {
  serviceOrderId: string;
  includePlots?: string;
  includeFarms?: string;
  includePilots?: string;
  includeCustomers?: string;
  includeContracts?: string;
  includeGeoJson?: string;
};

export async function getServiceOrderById(
  params: GetServiceOrderByIdParams
): Promise<ServiceOrder> {
  const searchParams = new URLSearchParams();
  if (params?.includePlots) searchParams.append('includePlots', params.includePlots);
  if (params?.includeFarms) searchParams.append('includeFarms', params.includeFarms);
  if (params?.includePilots) searchParams.append('includePilots', params.includePilots);
  if (params?.includeCustomers) searchParams.append('includeCustomers', params.includeCustomers);
  if (params?.includeContracts) searchParams.append('includeContracts', params.includeContracts);
  if (params?.includeGeoJson) searchParams.append('includeGeoJson', params.includeGeoJson);
  const url = `/service-orders/${params.serviceOrderId}?${searchParams.toString()}`;

  try {
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
  if (params?.startDate) {
    const normalizedStartDate = toCivilYYYYMMDD(params.startDate);
    if (normalizedStartDate) searchParams.append('startDate', normalizedStartDate);
  }
  if (params?.endDate) {
    const normalizedEndDate = toCivilYYYYMMDD(params.endDate);
    if (normalizedEndDate) searchParams.append('endDate', normalizedEndDate);
  }
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
