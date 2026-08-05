import { api } from '@/services/api.service';
import type {
  CustomerRequestPage,
  FarmerAreaRequest,
  FarmerServiceOrderRequest,
  PreparedKmlUpload,
} from '@/types/customer-request.type';

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.message || data?.error || `Falha na solicitação (${response.status})`);
  return data as T;
}

export const listServiceOrderRequests = async () =>
  parseResponse<CustomerRequestPage<FarmerServiceOrderRequest>>(
    await api('/customer-requests/service-orders?limit=100', { method: 'GET' })
  );
export const getServiceOrderRequest = async (id: string) =>
  parseResponse<FarmerServiceOrderRequest>(
    await api(`/customer-requests/service-orders/${id}`, { method: 'GET' })
  );
export const createServiceOrderRequest = async (payload: {
  farmId: string;
  requestedDate: string;
  serviceType: string;
  observation?: string;
}) =>
  parseResponse<{ data: FarmerServiceOrderRequest }>(
    await api('/customer-requests/service-orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
export const submitServiceOrderRequest = async (id: string) =>
  parseResponse(
    await api(`/customer-requests/service-orders/${id}/submit`, { method: 'POST', body: '{}' })
  );
export const cancelServiceOrderRequest = async (id: string) =>
  parseResponse(
    await api(`/customer-requests/service-orders/${id}/cancel`, { method: 'POST', body: '{}' })
  );

export const listAreaRequests = async () =>
  parseResponse<CustomerRequestPage<FarmerAreaRequest>>(
    await api('/customer-requests/areas?limit=100', { method: 'GET' })
  );
export const getAreaRequest = async (id: string) =>
  parseResponse<FarmerAreaRequest>(await api(`/customer-requests/areas/${id}`, { method: 'GET' }));
export const createAreaRequest = async (payload: {
  suggestedFarmName?: string;
  existingFarmId?: string;
}) =>
  parseResponse<{ data: FarmerAreaRequest }>(
    await api('/customer-requests/areas', { method: 'POST', body: JSON.stringify(payload) })
  );
export const prepareKmlUpload = async (
  id: string,
  payload: {
    originalFileName: string;
    contentType: 'application/vnd.google-earth.kml+xml' | 'application/xml' | 'text/xml';
    sizeBytes: number;
    sha256: string;
  }
) =>
  parseResponse<PreparedKmlUpload>(
    await api(`/customer-requests/areas/${id}/upload`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  );
export async function uploadKmlToSignedUrl(prepared: PreparedKmlUpload, bytes: ArrayBuffer) {
  const response = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: prepared.requiredHeaders,
    body: bytes,
  });
  if (!response.ok) throw new Error(`Falha no envio seguro do KML (${response.status})`);
}
export const completeKmlUpload = async (id: string, fileId: string) =>
  parseResponse<{ fileId: string; plotsCount: number; featureErrors: unknown[] }>(
    await api(`/customer-requests/areas/${id}/upload/complete`, {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    })
  );
export const updateAreaRequestPlot = async (
  requestId: string,
  plotId: string,
  payload: { suggestedName?: string; excluded?: boolean }
) =>
  parseResponse(
    await api(`/customer-requests/areas/${requestId}/plots/${plotId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  );
export const submitAreaRequest = async (id: string) =>
  parseResponse(await api(`/customer-requests/areas/${id}/submit`, { method: 'POST', body: '{}' }));
export const cancelAreaRequest = async (id: string) =>
  parseResponse(await api(`/customer-requests/areas/${id}/cancel`, { method: 'POST', body: '{}' }));
