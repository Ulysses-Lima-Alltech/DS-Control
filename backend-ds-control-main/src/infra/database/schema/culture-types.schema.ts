import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const cultureTypes = pgTable("culture_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("culture_type_name_index").on(table.name),
]);