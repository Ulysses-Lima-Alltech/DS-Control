import z from "zod";

export const UpdateRouteSchema = z.object({
  name: z.string().min(1, "Route name is required").optional(),
  geoJson: z.record(z.string(), z.unknown()).optional(),
  farmId: z.string().uuid("Farm ID must be a valid UUID").optional(),
  customerId: z.string().uuid("Customer ID must be a valid UUID").optional(),
});

export type UpdateRouteDTO = z.infer<typeof UpdateRouteSchema>;
