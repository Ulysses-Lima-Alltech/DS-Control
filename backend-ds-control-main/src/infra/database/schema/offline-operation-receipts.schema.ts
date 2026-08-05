import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';

export const offlineOperationReceipts = pgTable(
  'offline_operation_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    operationType: varchar('operation_type', { length: 64 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    status: text('status').notNull().default('PROCESSING'),
    responseJson: jsonb('response_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('offline_operation_receipts_user_key_unique').on(
      table.userId,
      table.idempotencyKey,
    ),
    index('offline_operation_receipts_user_created_index').on(table.userId, table.createdAt),
  ],
);
