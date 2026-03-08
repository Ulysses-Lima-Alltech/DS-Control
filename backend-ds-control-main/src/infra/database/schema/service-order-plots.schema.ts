import { relations } from "drizzle-orm";
import { index, pgTable, uuid } from "drizzle-orm/pg-core";
import { plots } from "./plot.schema";
import { serviceOrders } from "./service_order.schema";

export const serviceOrderPlots = pgTable("service_order_plots", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceOrderId: uuid("service_order_id").references(() => serviceOrders.id, { onDelete: "cascade" }).notNull(),
  plotId: uuid("plot_id").references(() => plots.id).notNull(),
}, (table) => [
  index("service_order_plot_service_order_id_index").on(table.serviceOrderId),
  index("service_order_plot_plot_id_index").on(table.plotId),
]);

export const serviceOrderPlotsRelations = relations(serviceOrderPlots, ({ one }) => ({
  serviceOrder: one(serviceOrders, {
    fields: [serviceOrderPlots.serviceOrderId],
    references: [serviceOrders.id],
  }),
  plot: one(plots, {
    fields: [serviceOrderPlots.plotId],
    references: [plots.id],
  }),
}));