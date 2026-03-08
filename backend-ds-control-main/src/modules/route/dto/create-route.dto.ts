import z from "zod";

export const CreateRouteSchema = z.object({
  name: z.string().min(1, "Route name is required"),
  geoJson: z.record(z.string(), z.unknown()),
  farmId: z.string().uuid("Farm ID must be a valid UUID"),
  customerId: z.string().uuid("Customer ID must be a valid UUID"),
});

export type CreateRouteDTO = z.infer<typeof CreateRouteSchema>;
