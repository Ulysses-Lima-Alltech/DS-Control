import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { contracts } from "./contract.schema";
import { farms } from "./farms.schema";
import { serviceOrders } from "./service_order.schema";
import { pgEnum } from "drizzle-orm/pg-core";

export const customerTypeEnum = pgEnum("type", [
  "PF",
  "PJ",
]);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  document_number: varchar("document_number", { length: 14 }).notNull(),
  entity_type: customerTypeEnum("type").notNull().default("PJ"),
  phone: varchar("phone", { length: 15 }).notNull(),
  name: text("name").notNull(),
  razaoSocial: text("razao_social"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("customer_document_number_index").on(table.document_number),
  index("customer_name_index").on(table.name),
  index("customer_phone_index").on(table.phone),
]);

export const customersRelations = relations(customers, ({ many }) => ({
  farms: many(farms),
  contracts: many(contracts),
  serviceOrders: many(serviceOrders),
}));