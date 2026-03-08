import { z } from 'zod';

import { RegisterNewContractSchema, UpdateContractByIdSchema } from '@/schemas/contract.schema';
import { Contract, ContractOrderBy, ContractOrderType } from '@/types/contracts.type';

import { api } from './api.service';

export type GetAllContractsResponse = {
  data: Contract[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllContractsParams = {
  customerId?: string;
  page?: string;
  limit?: string;
  search?: string;
  orderBy?: ContractOrderBy;
  orderType?: ContractOrderType
};

export async function getAllContracts(
  params?: GetAllContractsParams
): Promise<GetAllContractsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.orderBy) searchParams.append('orderBy', params.orderBy);
  if (params?.orderType) searchParams.append('orderType', params.orderType);

  const url = `/contracts${params?.customerId ? `/customer/${params.customerId}` : ''}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Contract Service] Erro ao buscar contratos: ${error.message}`);
  }

  return await response.json();
}

export type RegisterNewContractParams = z.infer<typeof RegisterNewContractSchema>;

export type RegisterNewContractResponse = {
  message: string;
};

export async function registerNewContract(
  data: RegisterNewContractParams
): Promise<RegisterNewContractResponse> {
  try {
    RegisterNewContractSchema.parse(data);

    const response = await api(`/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Contract Service] Erro ao criar contrato: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Contract Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar contrato');
    }

    console.error(`[Contract Service] Erro ao criar contrato: ${error}`);
    throw error;
  }
}

export type UpdateContractByIdParams = z.infer<typeof UpdateContractByIdSchema> & {
  id: string;
};

export type UpdateContractByIdResponse = {
  message: string;
};

export async function updateContractById(
  data: UpdateContractByIdParams
): Promise<UpdateContractByIdResponse> {
  try {
    UpdateContractByIdSchema.parse(data);

    const response = await api(`/contracts/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        customerId: data.customerId,
        name: data.name,
        dateStart: data.dateStart,
        dateEnd: data.dateEnd,
        observation: data.observation,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Contract Service] Erro ao atualizar contrato: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Contract Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar contrato');
    }

    console.error(`[Contract Service] Erro ao atualizar contrato: ${error}`);
    throw error;
  }
}

export async function deleteContractById(contractId: string): Promise<void> {
  const response = await api(`/contracts/${contractId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Contract Service] Erro ao deletar contrato: ${error.message}`);
  }
}

export async function getContractsByCustomerId(
  customerId: string,
  params?: Omit<GetAllContractsParams, 'customerId'>
): Promise<GetAllContractsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);

  const url = `/contracts/customer/${customerId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Contract Service] Erro ao buscar contratos do cliente: ${error.message}`);
  }

  return await response.json();
}
