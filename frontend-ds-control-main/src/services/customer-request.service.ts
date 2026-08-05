import type {
  AdminCustomerRequestDetail,
  ApproveCustomerRequestPayload,
  CustomerRequestPage,
  CustomerRequestPathType,
  CustomerRequestStatus,
  CustomerRequestType,
} from '@/types/customer-request.type';

import { api } from './api.service';

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.message || data?.error || `Falha na solicitação (${response.status})`);
  return data as T;
}

export async function getAdminCustomerRequests(params: {
  page?: number;
  limit?: number;
  type?: CustomerRequestType;
  status?: CustomerRequestStatus;
  customerId?: string;
}): Promise<CustomerRequestPage> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.type) search.set('type', params.type);
  if (params.status) search.set('status', params.status);
  if (params.customerId) search.set('customerId', params.customerId);
  return parseResponse<CustomerRequestPage>(
    await api(`/admin/customer-requests/?${search.toString()}`, { method: 'GET' })
  );
}

export async function getAdminCustomerRequest(
  type: CustomerRequestPathType,
  id: string
): Promise<AdminCustomerRequestDetail> {
  return parseResponse<AdminCustomerRequestDetail>(
    await api(`/admin/customer-requests/${type}/${id}`, { method: 'GET' })
  );
}

async function reviewRequest(
  type: CustomerRequestPathType,
  id: string,
  action: 'request-changes' | 'reject',
  reason: string
) {
  return parseResponse(
    await api(`/admin/customer-requests/${type}/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  );
}

export const requestCustomerRequestChanges = (
  type: CustomerRequestPathType,
  id: string,
  reason: string
) => reviewRequest(type, id, 'request-changes', reason);
export const rejectCustomerRequest = (type: CustomerRequestPathType, id: string, reason: string) =>
  reviewRequest(type, id, 'reject', reason);

export async function approveCustomerRequest(
  type: CustomerRequestPathType,
  id: string,
  payload: ApproveCustomerRequestPayload
) {
  return parseResponse(
    await api(`/admin/customer-requests/${type}/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
}
