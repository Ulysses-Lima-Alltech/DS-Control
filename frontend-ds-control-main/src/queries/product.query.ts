import {
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';

import * as ProductService from '@/services/product.service';

export const useGetAllProducts = (
  params?: ProductService.GetAllProductsParams,
  options?: Omit<
    UseQueryOptions<ProductService.GetAllProductsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ProductService.GetAllProductsResponse, Error>({
    queryKey: ['products', params],
    queryFn: () => ProductService.getAllProducts(params),
    ...options,
  });
};

export const useGetAllProductsInfinite = (
  params?: Omit<ProductService.GetAllProductsParams, 'page'>,
  options?: Omit<
    UseInfiniteQueryOptions<ProductService.GetAllProductsResponse, Error>,
    'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) => {
  return useInfiniteQuery({
    queryKey: options?.queryKey ?? [
      'products',
      'infinite',
      params?.limit,
      params?.search,
      params?.status,
    ],
    queryFn: ({ pageParam }) =>
      ProductService.getAllProducts({
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

export const useGetProductById = (
  productId: string,
  options?: Omit<
    UseQueryOptions<ProductService.GetProductByIdResponse, Error>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery<ProductService.GetProductByIdResponse, Error>({
    queryKey: ['products', productId],
    queryFn: () => ProductService.getProductById(productId),
    ...options,
  });
};
