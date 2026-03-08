import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as DroneService from '@/services/drone.service';

export const useRegisterNewDrone = (
  options?: UseMutationOptions<
    DroneService.RegisterNewDroneResponse,
    Error,
    DroneService.RegisterNewDroneParams
  >
) => {
  return useMutation({
    mutationFn: (data: DroneService.RegisterNewDroneParams) => DroneService.registerNewDrone(data),
    ...options,
  });
};

export const useUpdateDroneById = (
  options?: UseMutationOptions<
    DroneService.UpdateDroneByIdResponse,
    Error,
    DroneService.UpdateDroneByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: DroneService.UpdateDroneByIdParams) => DroneService.updateDroneById(data),
    ...options,
  });
};

export const useDeleteDroneById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (droneId: string) => DroneService.deleteDroneById(droneId),
    ...options,
  });
};
