import { relations, sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from './user.schema';

export const TokenContext = pgEnum('token_context', [
  'PASSWORD_RESET', 
  'ACCESS_TOKEN', 
  'REFRESH_TOKEN', 
]);

export const userTokens = pgTable('user_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(), 
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(), 
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(), 
  context: TokenContext('context').notNull()
}, (table) => [
  index('user_token_id_index').on(table.id)
]);

export const userTokensRelations = relations(userTokens, ({ one }) => ({
  user: one(users, {
    fields: [userTokens.userId],
    references: [users.id],
  }),
}));

