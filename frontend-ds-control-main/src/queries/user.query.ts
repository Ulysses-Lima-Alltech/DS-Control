import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as UserService from '@/services/user.service';
import { User } from '@/types/user.type';

export const useGetAllUsers = (
  params?: UserService.GetAllUsersParams,
  options?: Omit<UseQueryOptions<UserService.GetAllUsersResponse, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery<UserService.GetAllUsersResponse, Error>({
    queryKey: ['users', params],
    queryFn: () => UserService.getAllUsers(params),
    ...options,
  });
};

export const useGetUserById = (
  id: string,
  options?: Omit<UseQueryOptions<User, Error>, 'queryFn'>
) => {
  return useQuery<User, Error>({
    queryKey: options?.queryKey || ['users', id],
    queryFn: () => UserService.getUserById(id),
    ...options,
  });
};

export const useGetAllUsersInfinite = (
  params?: Omit<UserService.GetAllUsersParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<UserService.GetAllUsersResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  const queryKey = options?.queryKey || [
    'users',
    'infinite',
    params?.type,
    params?.status,
    params?.limit,
    params?.search,
  ];

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      UserService.getAllUsers({
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
