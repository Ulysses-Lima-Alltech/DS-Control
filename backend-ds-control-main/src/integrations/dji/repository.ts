import { db } from "@infra/database";
import { integrationEvents } from "@infra/database/schema";

export type InsertIntegrationEventInput = {
  provider: string;
  providerEventId?: string | null;
  rawPayload: Record<string, unknown>;
  source?: string | null;
};

export class DjiIntegrationRepository {
  async insertIntegrationEvent(
    input: InsertIntegrationEventInput,
  ): Promise<{ id: string }> {
    const [row] = await db
      .insert(integrationEvents)
      .values({
        provider: input.provider,
        providerEventId: input.providerEventId ?? null,
        rawPayload: input.rawPayload,
        source: input.source ?? null,
      })
      .returning({ id: integrationEvents.id });

    if (!row) {
      throw new Error("[DjiIntegrationRepository] Failed to insert integration_events row");
    }

    return row;
  }
}
