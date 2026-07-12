import { z } from 'zod';

import { LoginSchema } from '@/schemas/auth.schema';
import { api, AUTH_ACCESS_TOKEN_KEY } from '@/services/api.service';
import { isBrowser } from '@/utils/platform';

export type LoginParams = z.infer<typeof LoginSchema>;

export async function login(data: LoginParams): Promise<{ mustChangePassword: boolean }> {
  try {
    LoginSchema.parse(data);

    const response = await api(`/auth/login`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Auth Service] Dados inválidos: ${error.message}`);
    }

    const parsedResponse = await response.json();

    if (!parsedResponse?.accessToken) {
      throw new Error('[Auth Service] Token de acesso não encontrado');
    }

    if (isBrowser) {
      window.localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, parsedResponse.accessToken);
    }
    return { mustChangePassword: parsedResponse.mustChangePassword === true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[Auth Service] Erro de validação: ${error.message}`);
      throw new Error('[Auth Service] Erro de validação');
    }

    console.error(`[Auth Service] Erro ao fazer login: ${error}`);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    const response = await api(`/auth/logout`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[Auth Service] Erro ao fazer logout: ${error.message}`);
    }

    if (isBrowser) {
      window.localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
      window.location.href = '/auth/login';
    }
  } catch (error) {
    console.error(`[Auth Service] Erro ao fazer logout: ${error}`);
    window.localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
    window.location.href = '/auth/login';
    throw error;
  }
}
