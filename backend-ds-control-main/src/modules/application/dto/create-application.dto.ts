import { z } from "zod";

export const CreateApplicationSchema = z.object({
  serviceOrderId: z.string().uuid("Service order ID must be a valid UUID").nullish(),
  farmId: z.string().uuid("Farm ID must be a valid UUID").nullish(),
  pilotId: z.string().uuid("Pilot ID must be a valid UUID"),
  assistantId: z.string().uuid("Assistant ID must be a valid UUID").nullish(),
  droneId: z.string().uuid("Drone ID must be a valid UUID"),
  cultureId: z.string().uuid("Culture ID must be a valid UUID"),
  hectares: z.string().min(1, "Hectares is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Hectares must be a positive number"
  ),
  flowRate: z.string().min(1, "Flow rate is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Flow rate must be a positive number"
  ),
  altitude: z.string().min(1, "Altitude is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Altitude must be a positive number"
  ),
  routeSpacing: z.string().min(1, "Route spacing is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Route spacing must be a positive number"
  ),
  dropletSize: z.string().min(1, "Droplet Size is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Droplet Size must be a positive number"
  ),
  date: z.coerce.date(),
  productId: z.string().uuid("Product ID must be a valid UUID"),
  plotId: z.string().uuid("Plot ID must be a valid UUID").nullable(),
  observations: z.string().max(1000, "Observations is too long").nullish(),
});

export type CreateApplicationDTO = z.infer<typeof CreateApplicationSchema>; 