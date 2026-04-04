import get from 'lodash/get';

/** Evita URLs relativas inválidas quando o host vem sem esquema (ex.: copiado do .env.example). */
function normalizeApiUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const config = {
  apiUrl: normalizeApiUrl(process.env.NEXT_PUBLIC_DS_CONTROL_API_URL),
};

type Paths<T> = T extends object
  ? { [K in keyof T]: `${Exclude<K, symbol>}${'' | `.${Paths<T[K]>}`}` }[keyof T]
  : never;

type Key = Paths<typeof config>;

export function getConfig<T>(key: Key, defaultValue?: T): T {
  return get(config, key, defaultValue as T) as T;
}
