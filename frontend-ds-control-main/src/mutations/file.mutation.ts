import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import type { ApiResponse as RouteApiResponse } from '@/app/api/file-converter-route/route';
// eslint-disable-next-line import/order
import type { ApiResponse as FarmApiResponse } from '@/app/api/file-converter/route';
import * as FileService from '@/services/file.service';

export const useConvertKmlToGeoJson = <T extends FarmApiResponse | RouteApiResponse>(
  options?: UseMutationOptions<T, Error, FileService.ConvertKmlToGeoJsonParams>
) => {
  return useMutation({
    mutationFn: (data: FileService.ConvertKmlToGeoJsonParams) =>
      FileService.convertKmlToGeoJson(data) as Promise<T>,
    ...options,
  });
};
