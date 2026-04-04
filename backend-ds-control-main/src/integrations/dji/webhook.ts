/**
 * Esqueleto para futura ingestão HTTP (webhook) DJI.
 */

import type { DjiRawIntegrationPayload } from "./types";

export type DjiWebhookPlaceholderContext = {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
};

/** Placeholder: futura validação de assinatura e parse. */
export async function handleDjiWebhookPlaceholder(
  _ctx: DjiWebhookPlaceholderContext,
): Promise<DjiRawIntegrationPayload> {
  return { placeholder: true };
}
