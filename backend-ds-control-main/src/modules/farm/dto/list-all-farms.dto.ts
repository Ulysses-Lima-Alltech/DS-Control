import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import { FarmOrderBy, FarmOrderType } from "@repositories/farms/farm.types";
import { optional, z } from 'zod';

export const GetFarmQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter farms by farm name or customer name"),
  customerId: z.string().optional().describe("Customer ID to filter farms by customer"),
  includePlots: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include plots in the response"),
  includeGeoJson: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include the plots geojson in the response"),
  includeCustomer: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include the customer in the response"),
  orderBy: z
    .nativeEnum(FarmOrderBy)
    .optional()
    .describe("Fiel to order the users by"),
  orderType: z
    .nativeEnum(FarmOrderType)
    .optional()
    .describe("Order type (ascending or descending)"),
});

export type FarmSearchQueryString = z.infer<typeof GetFarmQueryStringSchema>;
