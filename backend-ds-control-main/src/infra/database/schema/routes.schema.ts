import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer.schema";
import { farms } from "./farms.schema";

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  geoJson: jsonb("geo_json").notNull(),
  farmId: uuid("farm_id").references(() => farms.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("routes_farm_id_index").on(table.farmId),
  index("routes_customer_id_index").on(table.customerId),
  index("routes_name_index").on(table.name),
])

export const routesRelations = relations(routes, ({ one }) => ({
  farm: one(farms, {
    fields: [routes.farmId],
    references: [farms.id],
  }),
  customer: one(customers, {
    fields: [routes.customerId],
    references: [customers.id],
  }),
}));