import z from "zod";

export const CropSeasonProductViewModelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const CropSeasonSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  products: z.array(CropSeasonProductViewModelSchema),
});

export const CropSeasonViewModelSchema = CropSeasonSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  deletedAt: z.union([z.string(), z.date()]).nullable(),
});

export type CropSeason = z.infer<typeof CropSeasonSchema>;
export type CropSeasonViewModel = z.infer<typeof CropSeasonViewModelSchema>;

export const CropSeasonVM = {
  toViewModel: (cropSeason: CropSeason) => {
    return CropSeasonViewModelSchema.parse(cropSeason);
  },
};

