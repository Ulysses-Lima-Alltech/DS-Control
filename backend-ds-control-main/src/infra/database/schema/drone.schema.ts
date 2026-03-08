import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const drones = pgTable("drones", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  model: text("model").notNull(),
  aircraftRid: text("aircraft_rid").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("drone_name_index").on(table.name),
  index("drone_aircraft_rid_index").on(table.aircraftRid),
  index("drone_model_index").on(table.model),
]);
