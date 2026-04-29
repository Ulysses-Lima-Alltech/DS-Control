import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as CropSeasonService from '@/services/crop-season.service';

export const useGetAllCropSeasons = (
  params?: CropSeasonService.GetAllCropSeasonsParams,
  options?: Omit<
    UseQueryOptions<CropSeasonService.GetAllCropSeasonsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<CropSeasonService.GetAllCropSeasonsResponse, Error>({
    queryKey: ['crop-seasons', params],
    queryFn: () => CropSeasonService.getAllCropSeasons(params),
    ...options,
  });
};

export const useGetAllCropSeasonsInfinite = (
  params?: Omit<CropSeasonService.GetAllCropSeasonsParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<CropSeasonService.GetAllCropSeasonsResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  return useInfiniteQuery({
    queryKey: options?.queryKey ?? [
      'crop-seasons',
      'infinite',
      params?.limit,
      params?.search,
      params?.status,
    ],
    queryFn: ({ pageParam }) =>
      CropSeasonService.getAllCropSeasons({
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

export const useGetCropSeasonById = (
  cropSeasonId: string,
  options?: Omit<
    UseQueryOptions<CropSeasonService.GetCropSeasonByIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<CropSeasonService.GetCropSeasonByIdResponse, Error>({
    queryKey: ['crop-seasons', cropSeasonId],
    queryFn: () => CropSeasonService.getCropSeasonById(cropSeasonId),
    enabled: !!cropSeasonId,
    ...options,
  });
};

export const useGetCurrentCropSeason = (
  options?: Omit<
    UseQueryOptions<CropSeasonService.GetCurrentCropSeasonResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<CropSeasonService.GetCurrentCropSeasonResponse, Error>({
    queryKey: ['crop-seasons', 'current'],
    queryFn: () => CropSeasonService.getCurrentCropSeason(),
    ...options,
  });
};

