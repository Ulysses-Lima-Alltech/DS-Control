import { useMutation, type UseMutationOptions } from '@tanstack/react-query';

import * as PlotService from '@/services/plot.service';

export const useRenamePlot = (
  options?: UseMutationOptions<
    PlotService.RenamePlotResponse,
    Error,
    { plotId: string; data: PlotService.RenamePlotParams }
  >
) =>
  useMutation({
    mutationFn: ({ plotId, data }) => PlotService.renamePlot(plotId, data),
    ...options,
  });
