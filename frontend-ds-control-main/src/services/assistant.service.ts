import { z } from 'zod';

import { RegisterNewAssistantSchema, UpdateAssistantByIdSchema } from '@/schemas/assistant.schema';
import { Assistant } from '@/types/assistant.type';

import { api } from './api.service';

export type GetAllAssistantsResponse = {
  data: Assistant[];
  page: number;
  limit: number;
  totalPages: number;
  totalCount: number;
};

export type GetAllAssistantsParams = {
  page?: string;
  limit?: string;
  search?: string;
  status?: 'active' | 'inactive';
};

export async function getAllAssistants(
  params?: GetAllAssistantsParams
): Promise<GetAllAssistantsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append('page', params.page);
  if (params?.limit) searchParams.append('limit', params.limit);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.status) searchParams.append('status', params.status);

  const url = `/assistants${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await api(url, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Assistant Service] Erro ao buscar ajudantes: ${error.message}`);
  }

  return await response.json();
}

export type RegisterNewAssistantParams = z.infer<typeof RegisterNewAssistantSchema>;

export type RegisterNewAssistantResponse = {
  message: string;
};

export async function registerNewAssistant(
  data: RegisterNewAssistantParams
): Promise<RegisterNewAssistantResponse> {
  try {
    RegisterNewAssistantSchema.parse(data);

    const response = await api(`/assistants`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Assistant Service] Erro ao criar assistente: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Assistant Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao criar assistente');
    }

    console.error(`[Assistant Service] Erro ao criar assistente: ${error}`);
    throw error;
  }
}

export type UpdateAssistantByIdParams = z.infer<typeof UpdateAssistantByIdSchema> & {
  id: string;
};

export type UpdateAssistantByIdResponse = {
  message: string;
};

export async function updateAssistantById(
  data: UpdateAssistantByIdParams
): Promise<UpdateAssistantByIdResponse> {
  try {
    UpdateAssistantByIdSchema.parse(data);

    const response = await api(`/assistants/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: data.name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Assistant Service] Erro ao atualizar assistente: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Assistant Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao atualizar assistente');
    }

    console.error(`[Assistant Service] Erro ao atualizar assistente: ${error}`);
    throw error;
  }
}

export async function deleteAssistantById(assistantId: string): Promise<void> {
  const response = await api(`/assistants/${assistantId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Assistant Service] Erro ao deletar assistente: ${error.message}`);
  }
}

export type GetAssistantByIdResponse = {
  message?: string;
  assistant?: Assistant;
};

export async function getAssistantById(assistantId: string): Promise<GetAssistantByIdResponse> {
  const response = await api(`/assistants/${assistantId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[Assistant Service] Erro ao buscar assistente: ${error.message}`);
  }

  const data = await response.json();
  return data;
}
