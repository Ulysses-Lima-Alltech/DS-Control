import { z } from "zod";

export interface ApplicationStatsDTO {
    applicationCount: number;
    applicationCountByMonth: number;
    totalAreaHectares: number;
    averageApplicationArea: number;
    typeOfProducts: {product: string, hectares: number}[];
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
  farmId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by farm ID"),
  pilotId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by pilot ID"),
  customerId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by customer ID"),
  serviceOrderId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by service order ID"),
  invalidApplication: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Filter to invalid applications"),
  startDate: z
    .string()
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: "Data Inicial no formato incorreto. Use YYYY-MM-DD. \n"} )
    .refine(val =>  !isNaN(Date.parse(val)), {message: "Data inválida"})
    .optional()
    .describe("Filter application start date"),
  endDate: z
    .string()
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: " Data Final no formato incorreto. Use YYYY-MM-DD."} )  
    .refine(val =>  !isNaN(Date.parse(val)), {message: "invalid date"})
    .optional()
    .describe("Filter application end date"),
});

export type ApplicationStatsQueryString = z.infer<typeof ApplicationStatsQueryStringSchema>;