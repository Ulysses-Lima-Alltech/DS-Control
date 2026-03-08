import { z } from 'zod';

import { api } from '@/services/api.service';
import type { User } from '@/types/user.type';
import { ForgotPasswordSchema } from '@/schemas/user.schema';

export async function getMe(): Promise<User> {
  try {
    const response = await api(`/users/me`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao buscar usuário: ${error.message}`);
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error(`[User Service] Erro ao buscar usuário: ${error}`);
    throw error;
  }
}

export type ChangeCurrentUserPasswordParams = {
  oldPassword: string;
  newPassword: string;
};

export type ChangeCurrentUserPasswordResponse = {
  message: string;
};

export async function changeCurrentUserPassword(
  data: ChangeCurrentUserPasswordParams
): Promise<ChangeCurrentUserPasswordResponse> {
  try {
    const response = await api(`/users/me/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao alterar senha: ${error.message}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[User Service] Erro de validação: ${error.errors.map((err) => err.message).join(', ')}`
      );
      throw new Error('Erro ao alterar senha');
    }

    console.error(`[User Service] Erro ao alterar senha: ${error}`);
    throw error;
  }
}

export type ForgotPasswordParams = z.infer<typeof ForgotPasswordSchema>;

export async function forgotPassword(data: ForgotPasswordParams): Promise<void> {
  try {
    ForgotPasswordSchema.parse(data);

    const body = JSON.stringify(data);

    const response = await api(`/users/request-password-reset`, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[User Service] Erro ao solicitar redefinição de senha: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[User Service] Erro de validação: ${error.message}`);
      throw new Error('[User Service] Erro de validação');
    }

    console.error(`[User Service] Erro ao solicitar redefinição de senha: ${error}`);
    throw error;
  }
}
