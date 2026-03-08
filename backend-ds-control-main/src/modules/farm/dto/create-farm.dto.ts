import z from "zod";

const PlotDataSchema = z.object({
  name: z.string().min(1, "Plot name is required"),
  externalId: z.string().min(1, "Plot external ID is required"),
  geoJson: z.record(z.string(), z.unknown()),
  hectare: z.string().min(1, "Hectare is required"),
});

export const CreateFarmSchema = z.object({
  name: z.string().min(1, "Farm name is required"),
  customerId: z.string().uuid("Customer ID must be a valid UUID"),
  plots: z.array(PlotDataSchema).optional().default([]),
});

export type CreateFarmDTO = z.infer<typeof CreateFarmSchema>; 
export type CreateFarmPlotDTO = z.infer<typeof PlotDataSchema>;