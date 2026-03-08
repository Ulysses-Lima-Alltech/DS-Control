import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import { UserOrderBy, UserOrderType } from "@repositories/users/user.types";
import z from "zod";

export const GetUserQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter users by name or email"),
  type: z
    .enum(["backoffice", "pilot", "farmer"])
    .optional()
    .describe("Filter by user type"),
  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("Filter by user status (active = not deleted, inactive = deleted)"),
    orderBy: z
        .nativeEnum(UserOrderBy)
        .optional()
        .describe("Fiel to order the users by"),
    orderType: z
        .nativeEnum(UserOrderType)
        .optional()
        .describe("Order type (ascending or descending)"),
});

export type GetUserQueryString = z.infer<typeof GetUserQueryStringSchema>