import z from "zod";

export const PlotSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  farmId: z.string().uuid(),
  customerId: z.string().uuid(),
  geoJson: z.record(z.string(), z.unknown()).nullish(),
  externalId: z.string(),
  hectare: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const PlotViewModelSchema = PlotSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
});

export type Plot = z.infer<typeof PlotSchema>;
export type PlotViewModel = z.infer<typeof PlotViewModelSchema>;

export const PlotVM = {
  toViewModel: (plot: Plot) => {
    return PlotViewModelSchema.parse(plot);
  },
}; 