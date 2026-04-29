import { z } from "zod";
import { toOperationalDateYMD } from "@common/utils/operational-date";

export const UpdateApplicationSchema = z.object({
  serviceOrderId: z.string().uuid("Service order ID must be a valid UUID").optional().nullable(),
  farmId: z.string().uuid("Farm ID must be a valid UUID").optional().nullable(),
  pilotId: z.string().uuid("Pilot ID must be a valid UUID").optional(),
  assistantId: z.string().uuid("Assistant ID must be a valid UUID").optional(),
  droneId: z.string().uuid("Drone ID must be a valid UUID").optional(),
  cultureId: z.string().uuid("Culture ID must be a valid UUID").optional(),
  hectares: z.string().min(1, "Hectares is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Hectares must be a positive number"
  ).optional(),
  flowRate: z.string().min(1, "Flow rate is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Flow Rate must be a positive number"
  ).optional(),
  altitude: z.string().min(1, "Altitude is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Altitude must be a positive number"
  ).optional(),
  routeSpacing: z.string().min(1, "Route spacing is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Route spacing must be a positive number"
  ).optional(),
  dropletSize: z.string().min(1, "Droplet Size is required").refine(
    (val) => !Number.isNaN(Number(val)) && Number(val) > 0,
    "Droplet size must be a positive number"
  ).optional(),
  date: z
    .union([z.string(), z.number(), z.date()])
    .refine((value) => {
      try {
        toOperationalDateYMD(value);
        return true;
      } catch {
        return false;
      }
    }, "Date must be a valid operational date (YYYY-MM-DD, ISO or timestamp)")
    .optional(),
  productId: z.string().uuid("Product ID must be a valid UUID").optional(),
  plotId: z.string().uuid("Plot ID must be a valid UUID").optional().nullable(),
  observations: z.string().max(1000, "Observations is too long").optional(),
});

export type UpdateApplicationDTO = z.infer<typeof UpdateApplicationSchema>; 
