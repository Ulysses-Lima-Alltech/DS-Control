import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import z from "zod";

export const GetCropSeasonQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z.string().optional().describe("Search term to filter crop seasons by name"),
  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("Filter by crop season status"),
});

export type GetCropSeasonQueryString = z.infer<typeof GetCropSeasonQueryStringSchema>;

