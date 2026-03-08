import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import z from "zod";
import { ServiceOrderBy, ServiceOrderType } from "@repositories/service-order/service-order.types";

// Extended query string schema for service order search and filters
export const GetServiceOrderQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter service orders by number, observation, or customer name"),
  status: z
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
  includePlots: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Include plots in the response"),
  includeGeoJson: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Include geojson in the response"),
  includePilots: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Include pilots in the response"),
  includeFarms: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Include farms in the response"),
  includeContracts: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Include contracts in the response"),
  includeCustomers: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Include customers in the response"),
  orderBy: z
      .nativeEnum(ServiceOrderBy)
      .optional()
      .describe("Fiel to order the users by"),
  orderType: z
      .nativeEnum(ServiceOrderType)
      .optional()
      .describe("Order type (ascending or descending)"),
});


export type GetServiceOrderQueryString = z.infer<typeof GetServiceOrderQueryStringSchema>;