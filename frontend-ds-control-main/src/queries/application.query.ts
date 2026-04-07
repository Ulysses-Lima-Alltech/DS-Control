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

export const useGetApplicationsByCustomerId = (
  customerId: string,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsByCustomerIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsByCustomerIdResponse, Error>({
    queryKey: ['applications', 'customer', customerId],
    queryFn: () => ApplicationService.getApplicationsByCustomerId(customerId),
    enabled: !!customerId,
    ...options,
  });
};

export const useGetApplicationsByPilotId = (
  pilotId: string,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsByPilotIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsByPilotIdResponse, Error>({
    queryKey: ['applications', 'pilot', pilotId],
    queryFn: () => ApplicationService.getApplicationsByPilotId(pilotId),
    enabled: !!pilotId,
    ...options,
  });
};

export const useGetApplicationsByFarmId = (
  farmId: string,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsByFarmIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsByFarmIdResponse, Error>({
    queryKey: ['applications', 'farm', farmId],
    queryFn: () => ApplicationService.getApplicationsByFarmId(farmId),
    enabled: !!farmId,
    ...options,
  });
};

export const useGetApplicationsByServiceOrderId = (
  serviceOrderId: string,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsByServiceOrderIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsByServiceOrderIdResponse, Error>({
    queryKey: ['applications', 'service-order', serviceOrderId],
    queryFn: () => ApplicationService.getApplicationsByServiceOrderId(serviceOrderId),
    enabled: !!serviceOrderId,
    ...options,
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

export const useGetApplicationsSummary = (
  params: ApplicationService.GetApplicationsSummaryParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsSummaryResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsSummaryResponse, Error>({
    queryKey: ['applications', 'summary', params],
    queryFn: () => ApplicationService.getApplicationsSummary(params),
    enabled: !!(params.startDate && params.endDate),
    ...options,
  });
};

export const useGetApplicationsTopFarms = (
  params?: ApplicationService.GetTopFarmsApplicationsParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetTopFarmsApplicationsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetTopFarmsApplicationsResponse, Error>({
    queryKey: ['applications', 'stats', 'top-farms', params],
    queryFn: () => ApplicationService.getTopFarmsApplications(params),
    ...options,
  });
};

export const useGetApplicationsEvolution = (
  params?: ApplicationService.GetApplicationsEvolutionParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsEvolutionResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsEvolutionResponse, Error>({
    queryKey: ['applications', 'stats', 'evolution', params],
    queryFn: () => ApplicationService.getApplicationsEvolution(params),
    ...options,
  });
};

export const useGetApplicationsPerformance = (
  params: ApplicationService.GetApplicationsPerformanceParams,
  options?: Omit<
    UseQueryOptions<ApplicationService.GetApplicationsPerformanceResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ApplicationService.GetApplicationsPerformanceResponse, Error>({
    queryKey: ['applications', 'performance', params],
    queryFn: () => ApplicationService.getApplicationsPerformance(params),
    enabled: !!(params.startDate && params.endDate),
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
