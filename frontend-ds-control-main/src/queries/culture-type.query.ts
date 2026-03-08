import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as CultureTypeService from '@/services/culture-type.service';

export const useGetAllCultureTypes = (
  params?: CultureTypeService.GetAllCultureTypesParams,
  options?: Omit<
    UseQueryOptions<CultureTypeService.GetAllCultureTypesResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<CultureTypeService.GetAllCultureTypesResponse, Error>({
    queryKey: ['culture-types', params],
    queryFn: () => CultureTypeService.getAllCultureTypes(params),
    ...options,
  });
};

export const useGetAllCultureTypesInfinite = (
  params?: Omit<CultureTypeService.GetAllCultureTypesParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<CultureTypeService.GetAllCultureTypesResponse, Error>,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  const queryKey = ['culture-types', 'infinite', params?.limit, params?.search, params?.status];

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      CultureTypeService.getAllCultureTypes({
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

export const useGetCultureTypeById = (
  cultureTypeId: string,
  options?: Omit<UseQueryOptions<CultureTypeService.GetCultureTypeByIdResponse, Error>, 'queryFn'>
) => {
  const queryKey = options?.queryKey || ['culture-types', cultureTypeId];

  return useQuery<CultureTypeService.GetCultureTypeByIdResponse, Error>({
    queryKey,
    queryFn: () => CultureTypeService.getCultureTypeById(cultureTypeId),
    ...options,
  });
};

export const useGetCultureTypesStats = (
  params: CultureTypeService.GetCultureTypesStatsParams,
  options?: Omit<
    UseQueryOptions<CultureTypeService.GetCultureTypesStatsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<CultureTypeService.GetCultureTypesStatsResponse, Error>({
    queryKey: ['culture-types', 'stats', params],
    queryFn: () => CultureTypeService.getCultureTypesStats(params),
    ...options,
  });
};
