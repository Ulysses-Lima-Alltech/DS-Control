import { api } from './api.service';

export type PilotSummary = {
  pilotId: string;
  historicalAppliedAreaHa: number;
  applicationsCount: number;
  lastApplicationAt: string | null;
  metricVersion: 1;
};

export async function getMyPilotSummary(): Promise<PilotSummary> {
  const response = await api('/mobile/me/pilot-summary', { method: 'GET' });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || 'Não foi possível carregar o resumo do piloto');
  }

  return response.json();
}
