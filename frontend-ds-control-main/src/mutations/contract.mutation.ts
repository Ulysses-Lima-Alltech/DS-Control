import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as ContractService from '@/services/contract.service';

export const useRegisterNewContract = (
  options?: UseMutationOptions<
    ContractService.RegisterNewContractResponse,
    Error,
    ContractService.RegisterNewContractParams
  >
) => {
  return useMutation({
    mutationFn: (data: ContractService.RegisterNewContractParams) =>
      ContractService.registerNewContract(data),
    ...options,
  });
};

export const useUpdateContractById = (
  options?: UseMutationOptions<
    ContractService.UpdateContractByIdResponse,
    Error,
    ContractService.UpdateContractByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: ContractService.UpdateContractByIdParams) =>
      ContractService.updateContractById(data),
    ...options,
  });
};

export const useDeleteContractById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (contractId: string) => ContractService.deleteContractById(contractId),
    ...options,
  });
};
