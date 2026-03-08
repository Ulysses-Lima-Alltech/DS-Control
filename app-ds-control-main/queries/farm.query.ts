import {
  useQuery,
  UseQueryOptions,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';

import * as FarmService from '@/services/farm.service';

export const useGetAllFarms = (
  customerId?: string,
  params?: Omit<FarmService.GetAllFarmsParams, 'page'>,
  options?: Omit<UseQueryOptions<FarmService.GetAllFarmsResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<FarmService.GetAllFarmsResponse, Error>({
    queryKey: ['farms', customerId, params],
    queryFn: () => FarmService.getAllFarms(customerId, params),
    ...options,
  });
};

export const useGetAllFarmsInfinite = (
  customerId?: string,
  params?: Omit<FarmService.GetAllFarmsPaginatedParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<FarmService.GetAllFarmsPaginatedResponse, Error>,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  return useInfiniteQuery({
    queryKey: ['farms', 'infinite', customerId, params?.limit, params?.search],
    queryFn: ({ pageParam }) =>
      FarmService.getAllFarmsPaginated(customerId, {
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

export const useGetFarmById = (
  farmId: string | null,
  params?: FarmService.GetFarmByIdParams,
  options?: Omit<UseQueryOptions<FarmService.GetFarmByIdResponse, Error>, 'queryFn'>
) => {
  return useQuery<FarmService.GetFarmByIdResponse, Error>({
    queryKey: options?.queryKey || ['farm', farmId, params],
    enabled: !!farmId,
    queryFn: () => FarmService.getFarmById(farmId as string, params),
    ...options,
  });
};
