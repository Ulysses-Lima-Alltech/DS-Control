import { z } from 'zod';
import { FarmOrderBy, FarmOrderType } from '@repositories/farms/farm.types';

export const GetAllFarmsQueryStringSchema = z.object({
  customerId: z.string().optional().describe("Customer ID to filter farms by customer"),
  farmId: z.string().optional().describe("Farm ID to filter farms by farm"),
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

export type GetAllFarmsQueryString = z.infer<typeof GetAllFarmsQueryStringSchema>;
