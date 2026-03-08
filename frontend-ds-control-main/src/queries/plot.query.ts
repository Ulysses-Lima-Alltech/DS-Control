import { useQuery, UseQueryOptions } from '@tanstack/react-query';

import * as PlotService from '@/services/plot.service';

export const useGetPlotById = (
  plotId: string,
  options?: Omit<UseQueryOptions<PlotService.GetPlotByIdResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<PlotService.GetPlotByIdResponse, Error>({
    queryKey: ['plots', plotId],
    queryFn: () => PlotService.getPlotById(plotId),
    ...options,
  });
};
