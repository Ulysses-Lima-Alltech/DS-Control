import { relations } from "drizzle-orm";
import { date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { cropSeasonProducts } from "./crop-season-products.schema";

export const cropSeasons = pgTable("crop_seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("crop_seasons_name_index").on(table.name),
  index("crop_seasons_start_date_index").on(table.startDate),
  index("crop_seasons_end_date_index").on(table.endDate),
  index("crop_seasons_deleted_at_index").on(table.deletedAt),
]);

export const cropSeasonsRelations = relations(cropSeasons, ({ many }) => ({
  cropSeasonProducts: many(cropSeasonProducts),
}));

