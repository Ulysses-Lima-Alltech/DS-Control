import { z } from "zod";

// Helper to normalize array query params (can be string or array)
// Fastify can send arrays as strings when there's only one value, or as arrays when multiple
const arrayQueryParam = z.union([
  z.string().uuid(),
  z.array(z.string().uuid()),
]).optional().transform((val) => {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) return val;
  return [val];
});

// Query string schema for dashboard metrics endpoint
export const DashboardMetricsQueryStringSchema = z.object({
  contractIds: arrayQueryParam,
  customerIds: arrayQueryParam,
  farmIds: arrayQueryParam,
  pilotId: z.string().uuid().optional(),
  search: z.string().optional(),
  currentSeason: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true"),
  startDate: z.string()
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), { message: "Data no formato incorreto. Use YYYY-MM-DD." }),
});

export type DashboardMetricsQueryString = z.infer<typeof DashboardMetricsQueryStringSchema>;

// Monthly sprayed area data for chart
export interface MonthlySprayedArea {
  month: string;       // "abr. de 2025"
  yearMonth: string;   // "2025-04"
  hectares: number;
}

// Yesterday statistics
export interface YesterdayStats {
  totalArea: number;
  dronesCount: number;
  areaPerDrone: number;
}

// Dashboard metrics response
export interface DashboardMetricsDTO {
  totalAreaHectares: number;
  daysSinceStart: number;
  averageDailyArea: number;
  yesterdayStats: YesterdayStats;
  monthlySprayedArea: MonthlySprayedArea[];
}

// Response schema for OpenAPI documentation
export const DashboardMetricsResponseSchema = z.object({
  message: z.string(),
  metrics: z.object({
    totalAreaHectares: z.number(),
    daysSinceStart: z.number(),
    averageDailyArea: z.number(),
    yesterdayStats: z.object({
      totalArea: z.number(),
      dronesCount: z.number(),
      areaPerDrone: z.number(),
    }),
    monthlySprayedArea: z.array(z.object({
      month: z.string(),
      yearMonth: z.string(),
      hectares: z.number(),
    })),
  }),
});
