import z from "zod";


export const GetFarmByIdQueryStringSchema = z.object({
  includePlots: z
    .enum(['true', 'false'])
    .default('false')
    .optional()
    .transform((value) => value === 'true')
    .describe('Include plots in the response'),
  includeGeoJson: z
    .enum(['true', 'false'])
    .default('false')
    .optional()
    .transform((value) => value === 'true')
    .describe('Include the plots geojson in the response'),
  includeCustomer: z
    .enum(['true', 'false'])
    .default('false')
    .optional()
    .transform((value) => value === 'true')
    .describe('Include the customer in the response'),
});

export type GetFarmByIdQueryString = z.infer<typeof GetFarmByIdQueryStringSchema>;