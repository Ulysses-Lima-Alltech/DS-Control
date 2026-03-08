import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer.schema";
import { serviceOrders } from "./service_order.schema";

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id),
  name: text("name").notNull(),
  date_start: timestamp("date_start").notNull(),
  date_end: timestamp("date_end").notNull(),
  observation: text("observation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("contract_customer_id_index").on(table.customerId),
  index("contract_name_index").on(table.name),
  index("contract_date_start_index").on(table.date_start),
  index("contract_date_end_index").on(table.date_end),
]);

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  customer: one(customers, {
    fields: [contracts.customerId],
    references: [customers.id],
  }),
  serviceOrders: many(serviceOrders),
}));