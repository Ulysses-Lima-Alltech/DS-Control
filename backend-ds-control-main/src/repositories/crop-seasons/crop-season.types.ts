import type { cropSeasons } from "@infra/database/schema";

export type CropSeason = typeof cropSeasons.$inferSelect;

export type CropSeasonProductSummary = {
  id: string;
  name: string;
};

export type CropSeasonWithProducts = CropSeason & {
  products: CropSeasonProductSummary[];
};

export type CropSeasonStatus = "active" | "inactive";

export type CreateCropSeason = {
  name: string;
  startDate: string;
  endDate: string;
  productIds: string[];
};

export type UpdateCropSeason = {
  name: string;
  startDate: string;
  endDate: string;
  productIds: string[];
};

