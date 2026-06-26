import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const AUTH_ACCESS_TOKEN_KEY = 'ds-control-access-token';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const canUseSecureStore = async () => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export async function getStoredAccessToken(): Promise<string | null> {
  const secureStoreAvailable = await canUseSecureStore();

  if (secureStoreAvailable) {
    const secureToken = await SecureStore.getItemAsync(AUTH_ACCESS_TOKEN_KEY, secureOptions);
    if (secureToken) return secureToken;
  }

  const legacyToken = await AsyncStorage.getItem(AUTH_ACCESS_TOKEN_KEY);

  if (legacyToken && secureStoreAvailable) {
    await SecureStore.setItemAsync(AUTH_ACCESS_TOKEN_KEY, legacyToken, secureOptions);
  }

  return legacyToken;
}

export async function setStoredAccessToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_ACCESS_TOKEN_KEY, token);

  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(AUTH_ACCESS_TOKEN_KEY, token, secureOptions);
  }
}

export async function removeStoredAccessToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
  await removeSecureAccessToken();
}

export async function removeSecureAccessToken(): Promise<void> {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(AUTH_ACCESS_TOKEN_KEY, secureOptions);
  }
}
