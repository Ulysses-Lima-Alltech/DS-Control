import { relations } from "drizzle-orm";
import { index, pgTable, uuid } from "drizzle-orm/pg-core";
import { farms } from "./farms.schema";
import { serviceOrders } from "./service_order.schema";

export const serviceOrderFarms = pgTable("service_order_farms", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceOrderId: uuid("service_order_id").references(() => serviceOrders.id, { onDelete: "cascade" }).notNull(),
  farmId: uuid("farm_id").references(() => farms.id).notNull(),
}, (table) => [
  index("service_order_farm_service_order_id_index").on(table.serviceOrderId),
  index("service_order_farm_farm_id_index").on(table.farmId),
]);

export const serviceOrderFarmsRelations = relations(serviceOrderFarms, ({ one }) => ({
  serviceOrder: one(serviceOrders, {
    fields: [serviceOrderFarms.serviceOrderId],
    references: [serviceOrders.id],
  }),
  farm: one(farms, {
    fields: [serviceOrderFarms.farmId],
    references: [farms.id],
  }),
}));