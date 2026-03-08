import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as ProductService from '@/services/product.service';

export const useRegisterNewProduct = (
  options?: UseMutationOptions<
    ProductService.RegisterNewProductResponse,
    Error,
    ProductService.RegisterNewProductParams
  >
) => {
  return useMutation({
    mutationFn: (data: ProductService.RegisterNewProductParams) =>
      ProductService.registerNewProduct(data),
    ...options,
  });
};

export const useUpdateProductById = (
  options?: UseMutationOptions<
    ProductService.UpdateProductByIdResponse,
    Error,
    ProductService.UpdateProductByIdParams
  >
) => {
  return useMutation({
    mutationFn: (data: ProductService.UpdateProductByIdParams) =>
      ProductService.updateProductById(data),
    ...options,
  });
};

export const useDeleteProductById = (options?: UseMutationOptions<void, Error, string>) => {
  return useMutation({
    mutationFn: (productId: string) => ProductService.deleteProductById(productId),
    ...options,
  });
};
