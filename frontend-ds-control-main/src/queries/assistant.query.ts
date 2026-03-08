import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as AssistantService from '@/services/assistant.service';

export const useGetAllAssistants = (
  params?: AssistantService.GetAllAssistantsParams,
  options?: Omit<
    UseQueryOptions<AssistantService.GetAllAssistantsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<AssistantService.GetAllAssistantsResponse, Error>({
    queryKey: ['assistants', params],
    queryFn: () => AssistantService.getAllAssistants(params),
    ...options,
  });
};

export const useGetAllAssistantsInfinite = (
  params?: Omit<AssistantService.GetAllAssistantsParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<AssistantService.GetAllAssistantsResponse, Error>,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  const queryKey = ['assistants', 'infinite', params?.limit, params?.search, params?.status];

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      AssistantService.getAllAssistants({
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

export const useGetAssistantById = (
  assistantId: string,
  options?: Omit<UseQueryOptions<AssistantService.GetAssistantByIdResponse, Error>, 'queryFn'>
) => {
  const queryKey = options?.queryKey || ['assistants', assistantId];

  return useQuery<AssistantService.GetAssistantByIdResponse, Error>({
    queryKey,
    queryFn: () => AssistantService.getAssistantById(assistantId),
    ...options,
  });
};
