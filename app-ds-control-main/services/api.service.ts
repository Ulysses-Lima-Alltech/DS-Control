import { getConfig } from '@/lib/config';
import {
  AUTH_ACCESS_TOKEN_KEY,
  getStoredAccessToken,
  setStoredAccessToken,
} from '@/services/auth-token-storage.service';

export { AUTH_ACCESS_TOKEN_KEY };

export async function api(
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<Response> {
  const defaultHeaders: Record<string, string> = {};

  const storedAccessToken = await getStoredAccessToken();

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

    await setStoredAccessToken(refreshedAccessToken);

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
