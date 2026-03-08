import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as ApplicationService from '@/services/application.service';

export const useRegisterNewApplication = (
  options?: UseMutationOptions<
    ApplicationService.RegisterNewApplicationResponse,
    Error,
    ApplicationService.RegisterNewApplicationParams
  >
) => {
  return useMutation({
    mutationFn: (data: ApplicationService.RegisterNewApplicationParams) =>
      ApplicationService.registerNewApplication(data),
    ...options,
  });
};

export const useUpdateApplicationById = (
  options?: UseMutationOptions<
    ApplicationService.UpdateApplicationByIdResponse,
    Error,
    ApplicationService.UpdateApplicationByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: ApplicationService.UpdateApplicationByIdParams) =>
      ApplicationService.updateApplicationById(data),
    ...options,
  });
};

export const useDeleteApplicationById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (applicationId: string) => ApplicationService.deleteApplicationById(applicationId),
    ...options,
  });
};
