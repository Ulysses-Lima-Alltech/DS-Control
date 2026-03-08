import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as RouteService from '@/services/route.service';

export const useCreateRoute = (
  options?: UseMutationOptions<
    RouteService.CreateRouteResponse,
    Error,
    RouteService.CreateRouteParams
  >
) => {
  return useMutation({
    mutationFn: (data: RouteService.CreateRouteParams) => RouteService.createRoute(data),
    ...options,
  });
};

export const useDeleteRouteById = (
  options?: UseMutationOptions<RouteService.DeleteRouteByIdResponse, Error, string>
) => {
  return useMutation({
    mutationFn: (id: string) => RouteService.deleteRouteById(id),
    ...options,
  });
};

export const useUpdateRouteById = (
  options?: UseMutationOptions<
    RouteService.UpdateRouteByIdResponse,
    Error,
    { routeId: string; data: RouteService.UpdateRouteByIdParams }
  >
) => {
  return useMutation({
    mutationFn: ({
      routeId,
      data,
    }: {
      routeId: string;
      data: RouteService.UpdateRouteByIdParams;
    }) => RouteService.updateRouteById(routeId, data),
    ...options,
  });
};
