import get from 'lodash/get';

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_DS_CONTROL_API_URL,
};

type Paths<T> = T extends object
  ? { [K in keyof T]: `${Exclude<K, symbol>}${'' | `.${Paths<T[K]>}`}` }[keyof T]
  : never;

type Key = Paths<typeof config>;

export function getConfig<T>(key: Key, defaultValue?: T): T {
  console.log(config.apiUrl);
  return get(config, key, defaultValue as T) as T;
}
