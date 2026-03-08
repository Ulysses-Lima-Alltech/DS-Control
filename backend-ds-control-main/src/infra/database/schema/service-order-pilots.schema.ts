import { relations } from "drizzle-orm";
import { index, pgTable, uuid } from "drizzle-orm/pg-core";
import { serviceOrders } from "./service_order.schema";
import { users } from "./user.schema";

export const serviceOrderPilots = pgTable("service_order_pilots", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceOrderId: uuid("service_order_id").references(() => serviceOrders.id, { onDelete: "cascade" }).notNull(),
  pilotId: uuid("pilot_id").references(() => users.id).notNull(),
}, (table) => [
  index("service_order_pilot_service_order_id_index").on(table.serviceOrderId),
  index("service_order_pilot_pilot_id_index").on(table.pilotId),
]);

export const serviceOrderPilotsRelations = relations(serviceOrderPilots, ({ one }) => ({
  serviceOrder: one(serviceOrders, {
    fields: [serviceOrderPilots.serviceOrderId],
    references: [serviceOrders.id],
  }),
  pilot: one(users, {
    fields: [serviceOrderPilots.pilotId],
    references: [users.id],
  }),
}));