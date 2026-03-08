import { useQuery, UseQueryOptions } from '@tanstack/react-query';

import * as ServiceOrderService from '@/services/service-order.service';
import { ServiceOrder } from '@/types/service-order.type';

export const useGetAllMyOpenServiceOrders = (
  params?: ServiceOrderService.GetAllMyOpenServiceOrdersParams,
  options?: Omit<
    UseQueryOptions<ServiceOrderService.GetAllMyOpenServiceOrdersResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ServiceOrderService.GetAllMyOpenServiceOrdersResponse, Error>({
    queryKey: ['service-orders', 'my-open', params],
    queryFn: () => ServiceOrderService.getAllMyOpenServiceOrders(params),
    ...options,
  });
};

export const useGetServiceOrderById = (
  params: ServiceOrderService.GetServiceOrderByIdParams,
  options?: Omit<UseQueryOptions<ServiceOrder, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<ServiceOrder, Error>({
    queryKey: ['service-orders', params.serviceOrderId],
    queryFn: () => ServiceOrderService.getServiceOrderById(params),
    enabled: !!params.serviceOrderId,
    ...options,
  });
};

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
