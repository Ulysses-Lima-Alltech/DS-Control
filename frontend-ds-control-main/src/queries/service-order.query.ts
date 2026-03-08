import {
    useInfiniteQuery,
    UseInfiniteQueryOptions,
    useQuery,
    UseQueryOptions,
} from '@tanstack/react-query';

import * as ServiceOrderService from '@/services/service-order.service';
import { ServiceOrder } from '@/types/service-order.type';

export const useGetAllServiceOrders = (
  params?: ServiceOrderService.GetAllServiceOrdersParams,
  options?: Omit<
    UseQueryOptions<ServiceOrderService.GetAllServiceOrdersResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ServiceOrderService.GetAllServiceOrdersResponse, Error>({
    queryKey: ['service-orders', params],
    queryFn: () => ServiceOrderService.getAllServiceOrders(params),
    ...options,
  });
};

export const useGetAllServiceOrdersInfinite = (
  params?: Omit<ServiceOrderService.GetAllServiceOrdersParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<ServiceOrderService.GetAllServiceOrdersResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  const queryKey = options?.queryKey || [
    'service-orders',
    'infinite',
    params?.limit,
    params?.search,
  ];

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      ServiceOrderService.getAllServiceOrders({
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

export const useGetServiceOrderById = (
  serviceOrderId?: string,
  params?: ServiceOrderService.GetServiceOrderByIdParams,
  options?: Omit<UseQueryOptions<ServiceOrder, Error>, 'queryFn'>
) => {
  const queryKey = options?.queryKey || ['service-orders', serviceOrderId, params];

  return useQuery<ServiceOrder, Error>({
    queryKey,
    queryFn: () => ServiceOrderService.getServiceOrderById(serviceOrderId as string, params),
    enabled: !!serviceOrderId,
    ...options,
  });
};

export const useGetStatsServiceorders = (
  params?: ServiceOrderService.GetStatsServiceordersParams,
  options?: Omit<
    UseQueryOptions<ServiceOrderService.GetStatsServiceordersResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ServiceOrderService.GetStatsServiceordersResponse, Error>({
    queryKey: ['service-orders', 'stats', params],
    queryFn: () => ServiceOrderService.getStatsServiceorders(params),
    ...options,
  });
};
