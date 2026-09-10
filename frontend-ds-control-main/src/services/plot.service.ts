import { api } from '@/services/api.service';
import { Plot } from '@/types/plot.type';
import { z } from 'zod';

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

const RenamePlotParamsSchema = z.object({
  name: z.string().trim().min(1, 'Nome do talhao e obrigatorio').max(120),
});

export type RenamePlotParams = z.infer<typeof RenamePlotParamsSchema>;

export type RenamePlotResponse = {
  message: string;
  plot: Plot;
};

export async function renamePlot(plotId: string, data: RenamePlotParams): Promise<RenamePlotResponse> {
  const payload = RenamePlotParamsSchema.parse(data);
  const response = await api(`/plots/${plotId}/name`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Nao foi possivel renomear o talhao');
  }

  return response.json();
}
