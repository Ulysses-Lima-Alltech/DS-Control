import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import { RouteOrderBy, RouteOrderType } from "@repositories/routes/route.types";
import { z } from 'zod';

export const ListRoutesQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter routes by route name or farm name"),
  customerId: z.string().uuid().optional().describe("Customer ID to filter routes by customer"),
  farmId: z.string().uuid().optional().describe("Farm ID to filter routes by farm"),
  includeFarm: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include farm in the response"),
  includeCustomer: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include customer in the response"),
  includeGeoJson: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include geoJson in the response"),
  orderBy: z
    .nativeEnum(RouteOrderBy)
    .optional()
    .describe("Field to order the routes by"),
  orderType: z
    .nativeEnum(RouteOrderType)
    .optional()
    .describe("Order type (ascending or descending)"),
});

export type RouteSearchQueryString = z.infer<typeof ListRoutesQueryStringSchema>;
