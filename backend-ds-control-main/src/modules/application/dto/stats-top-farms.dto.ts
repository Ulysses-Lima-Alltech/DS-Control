import { z } from "zod";

import { ApplicationStatsQueryStringSchema } from "./stats.dto";

export const TopFarmsStatsQueryStringSchema = ApplicationStatsQueryStringSchema.extend({
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});

export type TopFarmsStatsQueryString = z.infer<typeof TopFarmsStatsQueryStringSchema>;

export const TopFarmStatsSchema = z.object({
  farmId: z.string().uuid().nullable(),
  farmName: z.string(),
  applicationsCount: z.number(),
  totalAreaHectares: z.number(),
});
