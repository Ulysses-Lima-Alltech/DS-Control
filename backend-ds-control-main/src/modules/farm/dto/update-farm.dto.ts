import z from "zod";

const PlotUpdateDataSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Plot name is required"),
  geoJson: z.record(z.string(), z.unknown()),
  externalId: z.string().min(1, "Plot external ID is required"),
  hectare: z.string().min(1, "Hectare is required"),
});

export const UpdateFarmSchema = z.object({
  name: z.string().min(1, "Farm name is required").optional(),
  customerId: z.string().uuid("Customer ID must be a valid UUID").optional(),
  plots: z.array(PlotUpdateDataSchema),
});

export type UpdateFarmDTO = z.infer<typeof UpdateFarmSchema>; 
export type UpdateFarmPlotDTO = z.infer<typeof PlotUpdateDataSchema>;