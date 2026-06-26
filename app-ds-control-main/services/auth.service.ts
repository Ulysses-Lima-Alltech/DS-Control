import { z } from 'zod';

import { LoginSchema } from '@/schemas/auth.schema';
import { api } from '@/services/api.service';
import { clearOfflineAuthSession } from '@/offline/offlineAuth';
import { removeOfflineModeData } from '@/offline/offlineSync';
import {
  removeStoredAccessToken,
  setStoredAccessToken,
} from '@/services/auth-token-storage.service';

export type LoginParams = z.infer<typeof LoginSchema>;

export async function login(data: LoginParams): Promise<void> {
  try {
    LoginSchema.parse(data);

    const body = JSON.stringify(data);

    const response = await api(`/auth/login`, {
      method: 'POST',
      body: body,
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

    await setStoredAccessToken(parsedResponse.accessToken);
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

    try {
      await removeOfflineModeData();
    } catch (offlineCleanupError) {
      console.warn('[Auth Service] Erro ao limpar dados offline:', offlineCleanupError);
    }
    await clearOfflineAuthSession({ removeSecureToken: true });
    await removeStoredAccessToken();
  } catch (error) {
    console.error(`[Auth Service] Erro ao fazer logout: ${error}`);
    try {
      await removeOfflineModeData();
    } catch (offlineCleanupError) {
      console.warn('[Auth Service] Erro ao limpar dados offline:', offlineCleanupError);
    }
    await clearOfflineAuthSession({ removeSecureToken: true });
    await removeStoredAccessToken();
    throw error;
  }
}
