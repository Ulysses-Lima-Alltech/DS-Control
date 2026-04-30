import { z } from "zod";
import { isOperationalDateString } from "@common/utils/operational-date";

const CropSeasonIdsQuerySchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;

    const rawValues = Array.isArray(value) ? value : [value];
    const splitValues = rawValues
      .flatMap((item) => item.split(","))
      .map((item) => item.trim())
      .filter(Boolean);

    if (splitValues.length === 0) return undefined;

    const uniqueValues = Array.from(new Set(splitValues));
    for (const cropSeasonId of uniqueValues) {
      const parsed = z.string().uuid().safeParse(cropSeasonId);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "cropSeasonIds deve conter UUIDs válidos",
        });
        return z.NEVER;
      }
    }

    return uniqueValues;
  });

export interface ApplicationStatsDTO {
  applicationCount: number;
  applicationCountByMonth: number;
  totalAreaHectares: number;
  averageApplicationArea: number;
  typeOfProducts: { productId?: string; product: string; hectares: number }[];
  pilotsCount: number;
  dronesCount: number;
  culturesCount: number;
  averageApplicationByPilot: number;
  averageApplicationByDrone: number;
  averageAreaCoveredApplication: number;
  invalidApplication: number;
  totalHectaresByMonth: number;
  totalHectaresPerDay: number;
  totalHectaresByMonthPerDay: number;
  pendingApplicationsCount: number;
  pendingApplicationsTotalArea: number;
  pendingFarmsCount: number;
  pendingPlotsCount: number;
  /** Pendencias estruturais com fazenda nao informada (farmId nulo). */
  pendingApplicationsMissingFarmCount: number;
  /** Pendencias estruturais fora do recorte invalidApplication. */
  pendingApplicationsOtherThanInvalidOpenCount: number;
  /** Media operacional baseada em hectares totais / dias do recorte atual. */
  operationalAverageHectaresPerDay: number;
  /** Media operacional baseada em hectares totais / drones distintos no recorte atual. */
  operationalAverageHectaresPerDrone: number;
  /** Media operacional baseada em hectares totais / pilotos distintos no recorte atual. */
  operationalAverageHectaresPerPilot: number;
}

// Query string schema for filtered statistics
export const ApplicationStatsQueryStringSchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Search term to filter applications by observations, customer name, pilot name, or farm name"),
  serviceOrderStatus: z
    .enum(["open", "completed", "cancelled"])
    .optional()
    .describe("Filter by service order status"),
  farmId: z.string().uuid().optional().describe("Filter by farm ID"),
  pilotId: z.string().uuid().optional().describe("Filter by pilot ID"),
  productId: z.string().uuid().optional().describe("Filter by product ID"),
  cropSeasonId: z.string().uuid().optional().describe("Filter by crop season ID"),
  cropSeasonIds: CropSeasonIdsQuerySchema.describe(
    "Filter by multiple crop season IDs (CSV or repeated query param)"
  ),
  customerId: z.string().uuid().optional().describe("Filter by customer ID"),
  serviceOrderId: z.string().uuid().optional().describe("Filter by service order ID"),
  invalidApplication: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Filter to invalid applications"),
  startDate: z
    .string()
    .refine(isOperationalDateString, { message: "Data Inicial no formato incorreto. Use YYYY-MM-DD." })
    .optional()
    .describe("Filter application start date"),
  endDate: z
    .string()
    .refine(isOperationalDateString, { message: "Data Final no formato incorreto. Use YYYY-MM-DD." })
    .optional()
    .describe("Filter application end date"),
  ignoreFilters: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Ignore all filters and return global stats"),
  currentSeason: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Filter only applications linked to contracts active on the current date"),
});

export type ApplicationStatsQueryString = z.infer<typeof ApplicationStatsQueryStringSchema>;
