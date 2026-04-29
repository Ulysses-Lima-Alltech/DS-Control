import { relations } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { cropSeasons } from "./crop-seasons.schema";
import { products } from "./products.schema";

export const cropSeasonProducts = pgTable("crop_season_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  cropSeasonId: uuid("crop_season_id").references(() => cropSeasons.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("crop_season_products_crop_season_id_index").on(table.cropSeasonId),
  index("crop_season_products_product_id_index").on(table.productId),
  uniqueIndex("crop_season_products_unique_pair_index").on(table.cropSeasonId, table.productId),
]);

export const cropSeasonProductsRelations = relations(cropSeasonProducts, ({ one }) => ({
  cropSeason: one(cropSeasons, {
    fields: [cropSeasonProducts.cropSeasonId],
    references: [cropSeasons.id],
  }),
  product: one(products, {
    fields: [cropSeasonProducts.productId],
    references: [products.id],
  }),
}));

