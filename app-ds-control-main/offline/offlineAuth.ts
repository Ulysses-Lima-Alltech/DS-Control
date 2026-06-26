import * as SecureStore from 'expo-secure-store';

import type { OfflineBootstrap } from '@/offline/offlineTypes';
import { removeSecureAccessToken } from '@/services/auth-token-storage.service';

const OFFLINE_SESSION_KEY = 'ds-control-offline-session';
const OFFLINE_VALIDITY_DAYS = 30;

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export type OfflineAuthSession = {
  user: OfflineBootstrap['user'];
  tenant: OfflineBootstrap['tenant'];
  permissions: string[];
  lastOnlineAuthAt: string;
  offlineExpiresAt: string;
  offlineReady: boolean;
};

const addDays = (value: Date, days: number) => {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
};

const canUseSecureStore = async () => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export function calculateOfflineExpiration(lastOnlineAuthAt: string | Date): string {
  const baseDate = lastOnlineAuthAt instanceof Date ? lastOnlineAuthAt : new Date(lastOnlineAuthAt);
  return addDays(baseDate, OFFLINE_VALIDITY_DAYS).toISOString();
}

export async function saveOfflineAuthSession(input: {
  user: OfflineBootstrap['user'];
  tenant: OfflineBootstrap['tenant'];
  permissions: string[];
  lastOnlineAuthAt?: string;
  offlineReady?: boolean;
}): Promise<OfflineAuthSession> {
  const lastOnlineAuthAt = input.lastOnlineAuthAt ?? new Date().toISOString();
  const session: OfflineAuthSession = {
    user: input.user,
    tenant: input.tenant,
    permissions: input.permissions,
    lastOnlineAuthAt,
    offlineExpiresAt: calculateOfflineExpiration(lastOnlineAuthAt),
    offlineReady: input.offlineReady ?? true,
  };

  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(OFFLINE_SESSION_KEY, JSON.stringify(session), secureOptions);
  }

  return session;
}

export async function getOfflineAuthSession(): Promise<OfflineAuthSession | null> {
  if (!(await canUseSecureStore())) return null;

  const rawSession = await SecureStore.getItemAsync(OFFLINE_SESSION_KEY, secureOptions);
  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession) as OfflineAuthSession;
  } catch {
    return null;
  }
}

export async function getValidOfflineAuthSession(): Promise<{
  session: OfflineAuthSession | null;
  isValid: boolean;
  reason?: 'missing' | 'not-ready' | 'expired';
}> {
  const session = await getOfflineAuthSession();

  if (!session) {
    return { session: null, isValid: false, reason: 'missing' };
  }

  if (!session.offlineReady) {
    return { session, isValid: false, reason: 'not-ready' };
  }

  if (new Date(session.offlineExpiresAt).getTime() <= Date.now()) {
    return { session, isValid: false, reason: 'expired' };
  }

  return { session, isValid: true };
}

export async function clearOfflineAuthSession(options?: {
  removeSecureToken?: boolean;
}): Promise<void> {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(OFFLINE_SESSION_KEY, secureOptions);
  }

  if (options?.removeSecureToken) {
    await removeSecureAccessToken();
  }
}
