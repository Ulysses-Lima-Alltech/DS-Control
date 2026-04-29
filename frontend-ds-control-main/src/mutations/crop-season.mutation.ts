import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as CropSeasonService from '@/services/crop-season.service';

export const useRegisterNewCropSeason = (
  options?: UseMutationOptions<
    CropSeasonService.RegisterNewCropSeasonResponse,
    Error,
    CropSeasonService.RegisterNewCropSeasonParams
  >
) => {
  return useMutation({
    mutationFn: (data: CropSeasonService.RegisterNewCropSeasonParams) =>
      CropSeasonService.registerNewCropSeason(data),
    ...options,
  });
};

export const useUpdateCropSeasonById = (
  options?: UseMutationOptions<
    CropSeasonService.UpdateCropSeasonByIdResponse,
    Error,
    CropSeasonService.UpdateCropSeasonByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: CropSeasonService.UpdateCropSeasonByIdParams) =>
      CropSeasonService.updateCropSeasonById(data),
    ...options,
  });
};

export const useDeleteCropSeasonById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (cropSeasonId: string) => CropSeasonService.deleteCropSeasonById(cropSeasonId),
    ...options,
  });
};

