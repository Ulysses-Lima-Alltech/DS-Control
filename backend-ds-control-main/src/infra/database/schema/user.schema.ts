import { relations, sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customer.schema";
import { userTokens } from './user-tokens.schema';

export const UserType = pgEnum('user_type', ['backoffice', 'pilot', 'farmer']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  type: UserType('type').notNull().default('backoffice'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  updatedAt: timestamp('updated_at', { mode: 'date' }).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
}, (table) => [
  index('user_id_index').on(table.id),
  index('user_email_index').on(table.email)
]);

export const usersRelations = relations(users, ({ many, one }) => ({
  tokens: many(userTokens),
  customer: one(customers),
}));
