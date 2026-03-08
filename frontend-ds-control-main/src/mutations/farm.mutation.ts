import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as FarmService from '@/services/farm.service';

export const useRegisterNewFarm = (
  options?: UseMutationOptions<
    FarmService.RegisterNewFarmResponse,
    Error,
    FarmService.RegisterNewFarmParams
  >
) => {
  return useMutation({
    mutationFn: (data: FarmService.RegisterNewFarmParams) => FarmService.registerNewFarm(data),
    ...options,
  });
};

export const useDeleteFarmById = (
  options?: UseMutationOptions<FarmService.DeleteFarmByIdResponse, Error, string>
) => {
  return useMutation({
    mutationFn: (id: string) => FarmService.deleteFarmById(id),
    ...options,
  });
};

export const useEditFarmById = (
  options?: UseMutationOptions<
    FarmService.EditFarmByIdResponse,
    Error,
    { farmId: string; data: FarmService.EditFarmByIdParams }
  >
) => {
  return useMutation({
    mutationFn: ({ farmId, data }: { farmId: string; data: FarmService.EditFarmByIdParams }) =>
      FarmService.editFarmById(farmId, data),
    ...options,
  });
};
