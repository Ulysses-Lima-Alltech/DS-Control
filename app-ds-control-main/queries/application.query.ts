import { useQuery, UseQueryOptions } from '@tanstack/react-query';

import * as ApplicationService from '@/services/application.service';

export const useGetAllApplications = (
  params?: ApplicationService.GetAllApplicationsParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetAllApplicationsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetAllApplicationsResponse, Error>({
    queryKey: ['applications', params],
    queryFn: () => ApplicationService.getAllApplications(params),
    ...options,
  });
};

export const useGetApplicationById = (
  applicationId: string,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationByIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationByIdResponse, Error>({
    queryKey: ['applications', applicationId],
    queryFn: () => ApplicationService.getApplicationById(applicationId),
    enabled: !!applicationId,
    ...options,
  });
};

export const useGetApplicationsByServiceOrderId = (
  serviceOrderId: string,
  params?: ApplicationService.GetApplicationsByServiceOrderIdParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsByServiceOrderIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsByServiceOrderIdResponse, Error>({
    queryKey: ['applications', 'service-order', serviceOrderId, params],
    queryFn: () => ApplicationService.getApplicationsByServiceOrderId(serviceOrderId, params),
    enabled: !!serviceOrderId,
    ...options,
  });
};

export const useGetApplicationsByPilotId = (
  pilotId: string,
  options?: ApplicationService.GetAllApplicationsParams
) => {
  return useQuery<ApplicationService.GetApplicationsByPilotIdResponse, Error>({
    queryKey: ['applications', 'pilot', pilotId],
    queryFn: () => ApplicationService.getApplicationsByPilotId(pilotId, options),
    enabled: !!pilotId,
  });
};

export const useGetApplicationsByPlotId = (
  plotId: string,
  options?: ApplicationService.GetApplicationsByPlotIdParams
) => {
  return useQuery<ApplicationService.GetApplicationsByPlotIdResponse, Error>({
    queryKey: ['applications', 'plot', plotId],
    queryFn: () => ApplicationService.getApplicationsByPlotId({ plotId, ...options }),
    enabled: !!plotId,
  });
};

export const useGetStatsApplications = (
  params?: ApplicationService.GetStatsApplicationsParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetStatsApplicationsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetStatsApplicationsResponse, Error>({
    queryKey: ['applications', 'stats', params],
    queryFn: () => ApplicationService.getStatsApplications(params),
    ...options,
  });
};

export const useGetApplicationsByPilotStats = (
  params?: ApplicationService.GetByPilotApplicationsParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetByPilotApplicationsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetByPilotApplicationsResponse, Error>({
    queryKey: ['applications', 'stats', 'by-pilot', params],
    queryFn: () => ApplicationService.getByPilotApplications(params),
    ...options,
  });
};

export const useGetDashboardMetrics = (
  params?: ApplicationService.GetDashboardMetricsParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetDashboardMetricsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetDashboardMetricsResponse, Error>({
    queryKey: ['applications', 'dashboard-metrics', params],
    queryFn: () => ApplicationService.getDashboardMetrics(params!),
    enabled: !!params?.startDate,
    ...options,
  });
};
