/**
 * Tipos de fundação para payloads DJI / registros normalizados (sem contrato de API real ainda).
 */

export type DjiProvider = "dji";

/** Payload bruto genérico recebido de integrações (MQTT, webhook, etc.). */
export type DjiRawIntegrationPayload = Record<string, unknown>;

/**
 * Estrutura normalizada mínima para futura persistência em `flight_records`.
 * Campos opcionais até haver contrato com DJI Cloud.
 */
export type DjiNormalizedFlightRecord = {
  schemaVersion: 1;
  provider: DjiProvider;
  /** Identificador lógico do voo na origem, quando existir. */
  externalFlightId?: string;
  /** Metadados livres até definir o modelo final. */
  meta?: Record<string, unknown>;
};

export type DjiTestEventPayload = {
  kind: "dji_foundation_test";
  message: string;
  createdAt: string;
};
