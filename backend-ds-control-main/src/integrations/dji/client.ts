/**
 * Esqueleto para futuro cliente HTTP/SDK DJI Cloud — sem chamadas reais.
 */

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
