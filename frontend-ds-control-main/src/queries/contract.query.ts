import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as ContractService from '@/services/contract.service';

export const useGetAllContracts = (
  params?: ContractService.GetAllContractsParams,
  options?: Omit<
    UseQueryOptions<ContractService.GetAllContractsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ContractService.GetAllContractsResponse, Error>({
    queryKey: ['contracts', params],
    queryFn: () => ContractService.getAllContracts(params),
    ...options,
  });
};

export const useGetAllContractsInfinite = (
  params?: Omit<ContractService.GetAllContractsParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<ContractService.GetAllContractsResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  const queryKey = options?.queryKey || ['contracts', 'infinite', params?.limit, params?.search];

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      ContractService.getAllContracts({
        ...params,
        page: (pageParam as number).toString(),
        limit: params?.limit || '10',
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    ...options,
  });
};

export const useGetContractsByCustomerId = (
  customerId: string,
  params?: Omit<ContractService.GetAllContractsParams, 'customerId'>,
  options?: Omit<
    UseQueryOptions<ContractService.GetAllContractsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ContractService.GetAllContractsResponse, Error>({
    queryKey: ['contracts', 'customer', customerId, params],
    queryFn: () => ContractService.getContractsByCustomerId(customerId, params),
    enabled: !!customerId,
    ...options,
  });
};
