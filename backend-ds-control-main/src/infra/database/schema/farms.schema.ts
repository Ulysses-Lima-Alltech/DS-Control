import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer.schema";
import { plots } from "./plot.schema";
import { serviceOrders } from "./service_order.schema";

export const farms = pgTable("farms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("farm_customer_id_index").on(table.customerId),
  index("farm_name_index").on(table.name),
])

export const farmsRelations = relations(farms, ({ one, many }) => ({
  customer: one(customers, {
    fields: [farms.customerId],
    references: [customers.id],
  }),
  plots: many(plots),
  serviceOrders: many(serviceOrders),
}));

