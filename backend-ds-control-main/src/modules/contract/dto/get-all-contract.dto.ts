import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import { ContractOrderBy, ContractOrderType } from "@repositories/contracts/contract.types";
import z from "zod";

export const GetContractQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
    search: z
        .string()
        .optional()
        .describe("Search term to filter contracts by contract name or customer name"),
    orderBy: z
        .nativeEnum(ContractOrderBy)
        .optional()
        .describe("Fiel to order the users by"),
    orderType: z
        .nativeEnum(ContractOrderType)
        .optional()
        .describe("Order type (ascending or descending)"),
});

export type GetContractQueryString = z.infer<typeof GetContractQueryStringSchema>;