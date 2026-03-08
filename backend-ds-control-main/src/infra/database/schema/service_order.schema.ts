import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { serviceOrderFarms, serviceOrderPilots, serviceOrderPlots } from ".";
import { contracts } from "./contract.schema";
import { customers } from "./customer.schema";

export const serviceOrderStatus = pgEnum("service_order_status", [
  "open",
  "completed",
  "cancelled",
]);

export const serviceOrders = pgTable("service_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: serial("number").notNull(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  contractId: uuid("contract_id").references(() => contracts.id).notNull(),
  observation: text("observation"),
  plannedDate: timestamp("planned_date").notNull(),
  status: serviceOrderStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("service_order_customer_id_index").on(table.customerId),
  index("service_order_contract_id_index").on(table.contractId),
  index("service_order_status_index").on(table.status),
  index("service_order_planned_date_index").on(table.plannedDate),
  index("service_order_number_index").on(table.number),
]);

export const serviceOrdersRelations = relations(serviceOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [serviceOrders.customerId],
    references: [customers.id],
  }),
  contract: one(contracts, {
    fields: [serviceOrders.contractId],
    references: [contracts.id],
  }),
  serviceOrderPlots: many(serviceOrderPlots),
  serviceOrderFarms: many(serviceOrderFarms),
  serviceOrderPilots: many(serviceOrderPilots),
}));
