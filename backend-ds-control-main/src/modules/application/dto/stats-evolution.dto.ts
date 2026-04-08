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

/** `yearMonth` mantém o nome por compatibilidade; valor = bucket YYYY-MM-DD | YYYY-MM | YYYY. */
export const ApplicationEvolutionItemSchema = z.object({
  yearMonth: z.string(),
  applicationsCount: z.number(),
});
