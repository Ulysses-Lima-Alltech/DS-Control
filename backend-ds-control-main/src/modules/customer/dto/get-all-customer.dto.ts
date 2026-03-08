import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import { CustomerOrderBy, CustomerOrderType } from "@repositories/customers/customer.types";
import z from "zod";

export const GetCustomerQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
    search: z
        .string()
        .optional()
        .describe("Search term to filter customers by name or razao social"),
    orderBy: z
        .nativeEnum(CustomerOrderBy)
        .optional()
        .describe("Fiel to order the users by"),
    orderType: z
        .nativeEnum(CustomerOrderType)
        .optional()
        .describe("Order type (ascending or descending)"),
});

export type GetCustomerQueryString = z.infer<typeof GetCustomerQueryStringSchema>;