import z from "zod";

// Extended query string schema for service order search and filters
export const ServiceOrderDetailsQueryStringSchema = z.object({
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
});


export type ServiceOrderDetailsQueryString = z.infer<typeof ServiceOrderDetailsQueryStringSchema>;