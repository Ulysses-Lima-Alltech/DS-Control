/**
 * Esqueleto para futuro cliente HTTP/SDK DJI Cloud — sem chamadas reais.
 */

import { getDjiConfig } from "./config";

export class DjiCloudClientPlaceholder {
  /** Reservado para autenticação futura. */
  async connect(): Promise<void> {
    return Promise.resolve();
  }

  /** Reservado para chamadas REST futuras. */
  async request(_path: string, _init?: RequestInit): Promise<unknown> {
    return Promise.resolve(undefined);
  }
}

function maskHttpBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) {
      u.password = "***";
    }
    if (u.username) {
      u.username = "***";
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Pré-visualização de config HTTP DJI (sem request real). */
export function getDjiHttpClientConfigPreview(): {
  baseUrl: string | null;
  baseUrlMasked: string | null;
  logLevel: string | null;
} {
  const c = getDjiConfig();
  return {
    baseUrl: c.httpBaseUrl ?? null,
    baseUrlMasked: c.httpBaseUrl ? maskHttpBaseUrl(c.httpBaseUrl) : null,
    logLevel: c.logLevel ?? null,
  };
}
