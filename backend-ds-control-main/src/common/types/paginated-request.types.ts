import z from "zod";

export const PaginatedRequestSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  data: z.array(dataSchema),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(15),
  totalPages: z.number(),
  totalCount: z.number(),
});

export type PaginatedRequest<T extends z.ZodType> = z.infer<ReturnType<typeof PaginatedRequestSchema<T>>>;

export const PaginatedRequestQueryStringSchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Number.parseInt(val))
    .describe("Page number for pagination"),
  limit: z
    .string()
    .optional()
    .default("100")
    .transform((val) => Number.parseInt(val))
    .describe("Number of messages per page"),
});

export type PaginatedRequestQueryString = z.infer<typeof PaginatedRequestQueryStringSchema>;
