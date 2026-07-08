import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as RouteService from '@/services/route.service';

export const useGetAllRoutes = (
  params?: RouteService.GetAllRoutesParams,
  options?: Omit<UseQueryOptions<RouteService.GetAllRoutesResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<RouteService.GetAllRoutesResponse, Error>({
    queryKey: ['routes', params],
    queryFn: () => RouteService.getAllRoutes(params),
    ...options,
  });
};

export const useGetRoutesGroupedByFarm = (
  params?: RouteService.GetRoutesGroupedByFarmParams,
  options?: Omit<
    UseQueryOptions<RouteService.GetRoutesGroupedByFarmResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<RouteService.GetRoutesGroupedByFarmResponse, Error>({
    queryKey: ['routes', 'grouped-by-farm', params],
    queryFn: () => RouteService.getRoutesGroupedByFarm(params),
    ...options,
  });
};

export const useGetAllRoutesInfinite = (
  params?: Omit<RouteService.GetAllRoutesParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<RouteService.GetAllRoutesResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  const queryKey = options?.queryKey || [
    'routes',
    'infinite',
    params?.customerId,
    params?.farmId,
    params?.limit,
    params?.search,
  ];

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      RouteService.getAllRoutes({
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

export const useGetRouteById = (
  routeId: string | null,
  params?: RouteService.GetRouteByIdParams,
  options?: Omit<UseQueryOptions<RouteService.GetRouteByIdResponse, Error>, 'queryFn'>
) => {
  return useQuery<RouteService.GetRouteByIdResponse, Error>({
    queryKey: options?.queryKey || ['route', routeId, params],
    enabled: !!routeId,
    queryFn: () => RouteService.getRouteById(routeId as string, params),
    ...options,
  });
};
