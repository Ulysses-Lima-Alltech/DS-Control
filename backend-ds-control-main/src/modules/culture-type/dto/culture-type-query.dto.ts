import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import { z } from "zod";

// Extended query string schema for culture type search and filters
export const CultureTypeQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter culture types by name"),
  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("Filter by culture type status (active = not deleted, inactive = deleted)"),
});

export type CultureTypeQueryString = z.infer<typeof CultureTypeQueryStringSchema>; 