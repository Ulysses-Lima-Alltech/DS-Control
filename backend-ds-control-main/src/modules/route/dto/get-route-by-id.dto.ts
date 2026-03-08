import { z } from 'zod';

export const GetRouteByIdQueryStringSchema = z.object({
  includeFarm: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include farm in the response"),
  includeCustomer: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include customer in the response"),
  includeGeoJson: z.enum(["true", "false"]).optional().default("false").transform((val) => val === "true").describe("Include geoJson in the response"),
});

export type GetRouteByIdQueryString = z.infer<typeof GetRouteByIdQueryStringSchema>;
