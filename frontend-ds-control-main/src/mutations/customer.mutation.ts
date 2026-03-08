import { useMutation, UseMutationOptions } from '@tanstack/react-query';

import * as CustomerService from '@/services/customer.service';

export const useRegisterNewCustomer = (
  options?: UseMutationOptions<
    CustomerService.RegisterNewCustomerResponse,
    Error,
    CustomerService.RegisterNewCustomerParams
  >
) => {
  return useMutation({
    mutationFn: (data: CustomerService.RegisterNewCustomerParams) =>
      CustomerService.registerNewCustomer(data),
    ...options,
  });
};

export const useDeleteCustomerById = (
  options?: UseMutationOptions<CustomerService.DeleteCustomerByIdResponse, Error, string>
) => {
  return useMutation({
    mutationFn: (id: string) => CustomerService.deleteCustomerById(id),
    ...options,
  });
};

export const useUpdateCustomerById = (
  options?: UseMutationOptions<
    CustomerService.UpdateCustomerByIdResponse,
    Error,
    CustomerService.UpdateCustomerByIdParams
  >
) => {
  return useMutation({
    mutationFn: (params: CustomerService.UpdateCustomerByIdParams) =>
      CustomerService.updateCustomerById(params),
    ...options,
  });
};
