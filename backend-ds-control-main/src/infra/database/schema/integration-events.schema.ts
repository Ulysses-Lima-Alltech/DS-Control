import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const integrationEvents = pgTable(
  "integration_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id"),
    rawPayload: jsonb("raw_payload").notNull(),
    source: text("source"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("integration_events_provider_index").on(table.provider)],
);
