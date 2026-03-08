import AsyncStorage from '@react-native-async-storage/async-storage';

import { getConfig } from '@/lib/config';

export const AUTH_ACCESS_TOKEN_KEY = 'ds-control-access-token';

export async function api(
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<Response> {
  const defaultHeaders: Record<string, string> = {};

  const storedAccessToken = await AsyncStorage.getItem(AUTH_ACCESS_TOKEN_KEY);

  if (storedAccessToken) {
    defaultHeaders['Authorization'] = `Bearer ${storedAccessToken}`;
  }

  if (init?.body) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  let response = await fetch(`${getConfig('apiUrl')}${input}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...init?.headers,
    },
  });

  if (!response.ok && response.status === 401) {
    const tokenResponse = await fetch(`${getConfig('apiUrl')}/auth/refresh-token`, {
      credentials: 'include',
      method: 'POST',
    });

    const { accessToken: refreshedAccessToken } = await tokenResponse.json();

    if (!refreshedAccessToken) {
      throw new Error("Can't refresh access token");
    }

    await AsyncStorage.setItem(AUTH_ACCESS_TOKEN_KEY, refreshedAccessToken);

    if (init?.body) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    response = await fetch(`${getConfig('apiUrl')}${input}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${refreshedAccessToken}`,
      },
    });
  }

  return response;
}
