import { z } from "zod";

import { ApplicationStatsQueryStringSchema } from "./stats.dto";

export const ApplicationEvolutionQueryStringSchema = ApplicationStatsQueryStringSchema.extend({
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});

export type ApplicationEvolutionQueryString = z.infer<typeof ApplicationEvolutionQueryStringSchema>;

export const ApplicationEvolutionItemSchema = z.object({
  yearMonth: z.string(),
  applicationsCount: z.number(),
});
