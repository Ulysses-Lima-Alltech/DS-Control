import z from "zod";
import { PlotSchema } from "./plot.vm";

export const FarmSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  customerId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  deletedAt: z.date().nullable(),
});

export const FarmViewModelSchema = FarmSchema.extend({
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
});

export const FarmWithPlotsViewModelSchema = FarmViewModelSchema.extend({
  plots: z.array(PlotSchema),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullish(),
});

export type Farm = z.infer<typeof FarmSchema>;
export type FarmViewModel = z.infer<typeof FarmViewModelSchema>;
export type FarmWithPlotsViewModel = z.infer<typeof FarmWithPlotsViewModelSchema>;

export const FarmVM = {
  toViewModel: (farm: Farm) => {
    return FarmViewModelSchema.parse(farm);
  },
  toViewModelWithPlots: (farm: Farm & {
    customer: {
      id: string;
      name: string;
    };
    plots: Array<{
      id: string;
      name: string;
      farmId: string;
      customerId: string;
      geoJson?: Record<string, unknown>;
      createdAt: Date;
      updatedAt: Date | null;
      deletedAt: Date | null;
    }>;
  }) => {
    return FarmWithPlotsViewModelSchema.parse(farm);
  },
}; 