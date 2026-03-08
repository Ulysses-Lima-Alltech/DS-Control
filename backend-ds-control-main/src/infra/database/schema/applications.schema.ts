import { relations } from "drizzle-orm";
import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { farms } from ".";
import { assistants } from "./assistants.schema";
import { cultureTypes } from "./culture-types.schema";
import { drones } from "./drone.schema";
import { plots } from "./plot.schema";
import { products } from "./products.schema";
import { serviceOrders } from "./service_order.schema";
import { users } from "./user.schema";

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceOrderId: uuid("service_order_id").references(() => serviceOrders.id, { onDelete: "cascade" }),
  pilotId: uuid("pilot_id").references(() => users.id).notNull(),
  assistantId: uuid("assistant_id").references(() => assistants.id),
  droneId: uuid("drone_id").references(() => drones.id).notNull(),
  cultureId: uuid("culture_id").references(() => cultureTypes.id).notNull(),
  hectares: numeric("hectares", { precision: 10, scale: 2 }).notNull().default("0.00"),
  flowRate: numeric("flow_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  altitude: numeric("altitude", { precision: 5, scale: 2 }).notNull().default("0.00"),
  routeSpacing: numeric("route_spacing", { precision: 5, scale: 2 }).notNull().default("0.00"), 
  dropletSize: numeric("droplet_size", { precision: 10, scale:2 }).notNull().default("0.00"),
  date: timestamp("date").notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  plotId: uuid("plot_id").references(() => plots.id),
  farmId: uuid("farm_id").references(() => farms.id),
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("application_service_order_id_index").on(table.serviceOrderId),
  index("application_pilot_id_index").on(table.pilotId),
  index("application_assistant_id_index").on(table.assistantId),
  index("application_drone_id_index").on(table.droneId),
  index("application_culture_id_index").on(table.cultureId),
  index("application_product_id_index").on(table.productId),
  index("application_plot_id_index").on(table.plotId),
  index("application_farm_id_index").on(table.farmId),
  index("application_date_index").on(table.date),
]);

export const applicationsRelations = relations(applications, ({ one }) => ({
  serviceOrder: one(serviceOrders, {
    fields: [applications.serviceOrderId],
    references: [serviceOrders.id],
  }),
  pilot: one(users, {
    fields: [applications.pilotId],
    references: [users.id],
  }),
  assistant: one(assistants, {
    fields: [applications.assistantId],
    references: [assistants.id],
  }),
  drone: one(drones, {
    fields: [applications.droneId],
    references: [drones.id],
  }),
  culture: one(cultureTypes, {
    fields: [applications.cultureId],
    references: [cultureTypes.id],
  }),
  product: one(products, {
    fields: [applications.productId],
    references: [products.id],
  }),
  plot: one(plots, {
    fields: [applications.plotId],
    references: [plots.id],
  }),
  farm: one(farms, {
    fields: [applications.farmId],
    references: [farms.id],
  }),
}));
