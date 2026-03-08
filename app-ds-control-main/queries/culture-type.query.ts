import {
  useInfiniteQuery,
  useQuery,
  UseInfiniteQueryOptions,
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
  const queryKey = ['culture-types', 'infinite', params?.limit, params?.search];

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
