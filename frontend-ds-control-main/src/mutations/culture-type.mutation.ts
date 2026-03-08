import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as CultureTypeService from '@/services/culture-type.service';

export const useRegisterNewCultureType = (
  options?: UseMutationOptions<
    CultureTypeService.RegisterNewCultureTypeResponse,
    Error,
    CultureTypeService.RegisterNewCultureTypeParams
  >
) => {
  return useMutation({
    mutationFn: (data: CultureTypeService.RegisterNewCultureTypeParams) =>
      CultureTypeService.registerNewCultureType(data),
    ...options,
  });
};

export const useUpdateCultureTypeById = (
  options?: UseMutationOptions<
    CultureTypeService.UpdateCultureTypeByIdResponse,
    Error,
    CultureTypeService.UpdateCultureTypeByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: CultureTypeService.UpdateCultureTypeByIdParams) =>
      CultureTypeService.updateCultureTypeById(data),
    ...options,
  });
};

export const useDeleteCultureTypeById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (cultureTypeId: string) => CultureTypeService.deleteCultureTypeById(cultureTypeId),
    ...options,
  });
};
