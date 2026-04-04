import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { integrationEvents } from "./integration-events.schema";

export const flightRecords = pgTable(
  "flight_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    integrationEventId: uuid("integration_event_id").references(() => integrationEvents.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    normalized: jsonb("normalized").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("flight_records_provider_index").on(table.provider),
    index("flight_records_integration_event_id_index").on(table.integrationEventId),
  ],
);
