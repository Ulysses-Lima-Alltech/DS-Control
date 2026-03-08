import { getConfig } from '@/lib/config';
import { isBrowser } from '@/utils/platform';

export const AUTH_ACCESS_TOKEN_KEY = 'ds-control-access-token';

export async function api(
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<Response> {
  const localStorage = isBrowser
    ? window.localStorage
    : { getItem: () => null, setItem: () => null };

  const defaultHeaders: Record<string, string> = {
    Authorization: `Bearer ${localStorage.getItem(AUTH_ACCESS_TOKEN_KEY)}`,
  };

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

    const { accessToken } = await tokenResponse.json();

    if (!accessToken) {
      throw new Error("Can't refresh access token");
    }

    localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, accessToken);

    if (init?.body) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    response = await fetch(`${getConfig('apiUrl')}${input}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${localStorage.getItem(AUTH_ACCESS_TOKEN_KEY)}`,
      },
    });
  }

  return response;
}
