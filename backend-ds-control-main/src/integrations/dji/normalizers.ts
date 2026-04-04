/**
 * Normalização placeholder de payload bruto → registro de voo.
 */

import type { DjiNormalizedFlightRecord, DjiRawIntegrationPayload } from "./types";

export function normalizeDjiRawPayloadPlaceholder(
  raw: DjiRawIntegrationPayload,
): DjiNormalizedFlightRecord {
  return {
    schemaVersion: 1,
    provider: "dji",
    meta: { rawKeys: Object.keys(raw) },
  };
}
