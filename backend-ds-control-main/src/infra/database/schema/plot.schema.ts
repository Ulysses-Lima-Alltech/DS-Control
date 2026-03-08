import { relations } from "drizzle-orm";
import { index, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer.schema";
import { farms } from "./farms.schema";

export const plots = pgTable("plots", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  hectare: numeric("hectare", { precision: 10, scale: 2 }).notNull().default("0.00"),
  geoJson: jsonb("geo_json").notNull(),
  farmId: uuid("farm_id").references(() => farms.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  externalId: text("external_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  unique("plot_farm_id_external_id_unique").on(table.farmId, table.externalId),
  index("plot_farm_id_index").on(table.farmId),
  index("plot_customer_id_index").on(table.customerId),
  index("plot_name_index").on(table.name),
  index("plot_external_id_index").on(table.externalId),
])

export const plotsRelations = relations(plots, ({ one }) => ({
  farm: one(farms, {
    fields: [plots.farmId],
    references: [farms.id],
  }),
  customer: one(customers, {
    fields: [plots.customerId],
    references: [customers.id],
  }),
}));