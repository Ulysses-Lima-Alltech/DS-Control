import { z } from 'zod';

import { RegisterNewCustomerSchema, UpdateCustomerByIdSchema } from '@/schemas/customer.schema';
import { api } from '@/services/api.service';
import { Customer, CustomerOrderBy, CustomerOrderType } from '@/types/customer.type';
import { documentCleaner } from '@/utils/document-formatter';
import { phoneCleaner } from '@/utils/phone-formatter';

export type GetAllCustomersResponse = {
  data: Customer[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllCustomersParams = {
  page?: string;
  limit?: string;
  search?: string;
  orderBy?: CustomerOrderBy;
  orderType?: CustomerOrderType;
};

export async function getAllCustomers(
  params?: GetAllCustomersParams
): Promise<GetAllCustomersResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy);
  if (params?.orderType) searchParams.append('orderType', params.orderType);

  const url = `/customers${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Customer Service] Erro ao buscar clientes: ${error.message}`);
  }

  return await response.json();
}

export type RegisterNewCustomerParams = z.infer<typeof RegisterNewCustomerSchema>;

export type RegisterNewCustomerResponse = {
  message: string;
};

export async function registerNewCustomer(
  data: RegisterNewCustomerParams
): Promise<RegisterNewCustomerResponse> {
  try {
    RegisterNewCustomerSchema.parse(data);

    const response = await api(`/customers`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        document_number: documentCleaner(data.document_number),
        phone: phoneCleaner(data.phone),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Customer Service] Erro ao criar cliente: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`[Customer Service] Erro ao criar cliente: ${error.message}`);
    }

    throw new Error(`[Customer Service] Erro ao criar cliente: ${error}`);
  }
}

export type DeleteCustomerByIdResponse = {
  message: string;
};

export async function deleteCustomerById(id: string): Promise<DeleteCustomerByIdResponse> {
  try {
    const response = await api(`/customers/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Customer Service] Erro ao deletar cliente: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`[Customer Service] Erro ao deletar cliente: ${error}`);
  }
}

export type GetCustomerByIdResponse = {
  message: string;
  customer: Customer;
};

export async function getCustomerById(customerId: string): Promise<GetCustomerByIdResponse> {
  try {
    const response = await api(`/customers/${customerId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Customer Service] Erro ao buscar cliente: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`[Customer Service] Erro ao buscar cliente: ${error}`);
  }
}

export type UpdateCustomerByIdParams = {
  id: string;
  data: z.infer<typeof UpdateCustomerByIdSchema>;
};

export type UpdateCustomerByIdResponse = {
  message: string;
  customer: Customer;
};

export async function updateCustomerById(
  params: UpdateCustomerByIdParams
): Promise<UpdateCustomerByIdResponse> {
  try {
    UpdateCustomerByIdSchema.parse(params.data);

    const response = await api(`/customers/${params.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...params.data,
        document_number: documentCleaner(params.data.document_number),
        phone: phoneCleaner(params.data.phone),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Customer Service] Erro ao atualizar cliente: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`[Customer Service] Erro ao atualizar cliente: ${error.message}`);
    }

    throw new Error(`[Customer Service] Erro ao atualizar cliente: ${error}`);
  }
}
