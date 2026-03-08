import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as ServiceOrderService from '@/services/service-order.service';
import { ServiceOrder } from '@/types/service-order.type';

export const useRegisterNewServiceOrder = (
  options?: UseMutationOptions<
    ServiceOrderService.RegisterNewServiceOrderResponse,
    Error,
    ServiceOrderService.RegisterNewServiceOrderParams
  >
) => {
  return useMutation({
    mutationFn: (data: ServiceOrderService.RegisterNewServiceOrderParams) =>
      ServiceOrderService.registerNewServiceOrder(data),
    ...options,
  });
};

export const useUpdateServiceOrderById = (
  options?: UseMutationOptions<
    ServiceOrderService.UpdateServiceOrderByIdResponse,
    Error,
    ServiceOrderService.UpdateServiceOrderByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: ServiceOrderService.UpdateServiceOrderByIdParams) =>
      ServiceOrderService.updateServiceOrderById(data),
    ...options,
  });
};

export const useCancelServiceOrderById = (
  options?: UseMutationOptions<ServiceOrder, Error, string>
) => {
  return useMutation({
    mutationFn: (serviceOrderId: string) =>
      ServiceOrderService.cancelServiceOrderById(serviceOrderId),
    ...options,
  });
};

export const useReopenServiceOrderById = (
  options?: UseMutationOptions<ServiceOrder, Error, string>
) => {
  return useMutation({
    mutationFn: (serviceOrderId: string) =>
      ServiceOrderService.reopenServiceOrderById(serviceOrderId),
    ...options,
  });
};

export const useCompleteServiceOrderById = (
  options?: UseMutationOptions<ServiceOrder, Error, string>
) => {
  return useMutation({
    mutationFn: (serviceOrderId: string) =>
      ServiceOrderService.completeServiceOrderById(serviceOrderId),
    ...options,
  });
};
