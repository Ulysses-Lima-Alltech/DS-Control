import { relations } from 'drizzle-orm';
import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { plots } from './plot.schema';
import { serviceOrders } from './service_order.schema';
import { users } from './user.schema';

export const ServiceOrderPlotStatus = pgEnum('service_order_plot_status', [
  'PENDING',
  'COMPLETED',
  'CANCELLED',
]);

export const serviceOrderPlots = pgTable(
  'service_order_plots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceOrderId: uuid('service_order_id')
      .references(() => serviceOrders.id, { onDelete: 'cascade' })
      .notNull(),
    plotId: uuid('plot_id')
      .references(() => plots.id)
      .notNull(),
    status: ServiceOrderPlotStatus('status').notNull().default('PENDING'),
    completedAt: timestamp('completed_at', { mode: 'date' }),
    completedBy: uuid('completed_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('service_order_plot_service_order_id_index').on(table.serviceOrderId),
    index('service_order_plot_plot_id_index').on(table.plotId),
    index('service_order_plot_status_index').on(table.status),
    uniqueIndex('service_order_plot_service_order_plot_unique_index').on(
      table.serviceOrderId,
      table.plotId,
    ),
  ],
);

export const serviceOrderPlotsRelations = relations(serviceOrderPlots, ({ one }) => ({
  serviceOrder: one(serviceOrders, {
    fields: [serviceOrderPlots.serviceOrderId],
    references: [serviceOrders.id],
  }),
  plot: one(plots, {
    fields: [serviceOrderPlots.plotId],
    references: [plots.id],
  }),
  completedByUser: one(users, {
    fields: [serviceOrderPlots.completedBy],
    references: [users.id],
  }),
}));
