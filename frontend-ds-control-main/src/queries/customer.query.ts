import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as CustomerService from '@/services/customer.service';

export const useGetAllCustomers = (
  params?: CustomerService.GetAllCustomersParams,
  options?: Omit<
    UseQueryOptions<CustomerService.GetAllCustomersResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<CustomerService.GetAllCustomersResponse, Error>({
    queryKey: ['customers', params],
    queryFn: () => CustomerService.getAllCustomers(params),
    ...options,
  });
};

export const useGetAllCustomersInfinite = (
  params?: Omit<CustomerService.GetAllCustomersParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<CustomerService.GetAllCustomersResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  return useInfiniteQuery({
    queryKey: options?.queryKey || ['customers', 'infinite', params],
    queryFn: ({ pageParam }) =>
      CustomerService.getAllCustomers({
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

export const useGetCustomerById = (
  id: string,
  options?: Omit<
    UseQueryOptions<CustomerService.GetCustomerByIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<CustomerService.GetCustomerByIdResponse, Error>({
    queryKey: ['customers', id],
    queryFn: () => CustomerService.getCustomerById(id),
    ...options,
  });
};
