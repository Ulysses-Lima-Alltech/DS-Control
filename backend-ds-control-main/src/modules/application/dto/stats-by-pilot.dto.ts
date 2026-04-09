import { z } from "zod";

import { ApplicationStatsQueryStringSchema } from "./stats.dto";

export const ByPilotStatsItemSchema = z.object({
  pilotId: z.string().uuid().nullable(),
  pilotName: z.string(),
  applicationsCount: z.number(),
  totalAreaHectares: z.number(),
  averageAreaPerApplication: z.number(),
});

export const ByPilotStatsQueryStringSchema = ApplicationStatsQueryStringSchema.extend({
  limit: z.coerce.number().int().positive().max(50).optional().default(10),
});

export type ByPilotStatsQueryString = z.infer<typeof ByPilotStatsQueryStringSchema>;
