import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as DroneService from '@/services/drone.service';

export const useGetAllDrones = (
  params?: DroneService.GetAllDronesParams,
  options?: Omit<UseQueryOptions<DroneService.GetAllDronesResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<DroneService.GetAllDronesResponse, Error>({
    queryKey: ['drones', params],
    queryFn: () => DroneService.getAllDrones(params),
    ...options,
  });
};

export const useGetAllDronesInfinite = (
  params?: Omit<DroneService.GetAllDronesParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<DroneService.GetAllDronesResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  const queryKey = options?.queryKey ?? [
    'drones',
    'infinite',
    params?.limit,
    params?.search,
    params?.status,
  ];

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      DroneService.getAllDrones({
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

export const useGetDroneById = (
  droneId: string,
  options?: Omit<UseQueryOptions<DroneService.GetDroneByIdResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<DroneService.GetDroneByIdResponse, Error>({
    queryKey: ['drones', droneId],
    queryFn: () => DroneService.getDroneById(droneId),
    ...options,
  });
};

export const useGetDronesOperation = (
  params: DroneService.GetDronesOperationParams,
  options?: Omit<
    UseQueryOptions<DroneService.GetDronesOperationResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<DroneService.GetDronesOperationResponse, Error>({
    queryKey: ['drones', 'operation', params],
    queryFn: () => DroneService.getDronesOperation(params),
    ...options,
  });
};
