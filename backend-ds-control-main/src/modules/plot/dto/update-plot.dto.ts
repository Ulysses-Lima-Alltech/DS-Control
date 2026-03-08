import z from "zod";

export const UpdatePlotSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  farmId: z.string().uuid("Farm ID must be a valid UUID").optional(),
  customerId: z.string().uuid("Customer ID must be a valid UUID").optional(),
  externalId: z.string().min(1, "External ID is required").optional(),
  geoJson: z.record(z.string(), z.unknown()).optional(),
  hectare: z.string().min(1, "Hectare is required").optional(),
});

export type UpdatePlotDTO = z.infer<typeof UpdatePlotSchema>; 