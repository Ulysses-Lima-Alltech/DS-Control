import { api } from '@/services/api.service';
import { Plot } from '@/types/plot.type';

export type GetPlotByIdResponse = {
  message: string;
  plot: Plot;
};

export async function getPlotById(plotId: string): Promise<GetPlotByIdResponse> {
  const response = await api(`/plots/${plotId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch plot');
  }

  const data = await response.json();
  return data;
}
