import z from "zod";

export const CreatePlotSchema = z.object({
  name: z.string().min(1, "Name is required"),
  farmId: z.string().uuid("Farm ID must be a valid UUID"),
  customerId: z.string().uuid("Customer ID must be a valid UUID"),
  externalId: z.string().min(1, "External ID is required"),
  geoJson: z.record(z.string(), z.unknown()),
  hectare: z.string().min(1, "Hectare is required"),
});

export type CreatePlotDTO = z.infer<typeof CreatePlotSchema>; 