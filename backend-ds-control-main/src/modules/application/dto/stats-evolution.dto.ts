import { z } from "zod";

import { ApplicationStatsQueryStringSchema } from "./stats.dto";

/** Agregação temporal da série de evolução (mesmo endpoint `/stats/evolution`). */
export const EvolutionGranularitySchema = z.enum(["day", "month", "year"]);

export const ApplicationEvolutionQueryStringSchema = ApplicationStatsQueryStringSchema.extend({
  /**
   * Máximo de buckets retornados após agregação (aplicável por granularidade no serviço:
   * month ≤24, day ≤90, year ≤40).
   */
  months: z.coerce.number().int().min(1).max(90).optional().default(6),
  granularity: EvolutionGranularitySchema.optional().default("month"),
});

export type ApplicationEvolutionQueryString = z.infer<typeof ApplicationEvolutionQueryStringSchema>;

/** Bucket temporal padronizado para contrato único: sempre YYYY-MM-DD. */
export const ApplicationEvolutionItemSchema = z.object({
  date: z.string(),
  applicationsCount: z.number(),
});
