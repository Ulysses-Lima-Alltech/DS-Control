import z from "zod";

export interface ServiceOrderStatsDTO {
  openOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
  farmsCount: number;
  plotsCount: number;
  totalAreaHectares: number;
  pilotsWithOpenOrders: number;
  invalidApplications: number;
  openOrdersAreaHectares: number;
  completedOrdersAreaHectares: number;
  cancelledOrdersAreaHectares: number;
  openOrdersAppliedHectares: number;
  completedOrdersAppliedHectares: number;
  cancelledOrdersAppliedHectares: number;
}

export interface ServiceOrderStatsByCustomerDTO extends ServiceOrderStatsDTO {
  customerId: string;
  customerName: string;
}

// Query string schema for filtered statistics
export const ServiceOrderStatsQueryStringSchema = z.object({
  status: z
    .enum(["open", "completed", "cancelled"])
    .optional()
    .describe("Filter by service order status"),
  farmId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by farm ID"),
  pilotId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by pilot ID"),
  customerId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by customer ID"),
  startDate: z
    .string()
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: "Data Inicial no formato incorreto. Use YYYY-MM-DD. \n"} )
    .refine(val =>  !isNaN(Date.parse(val)), {message: "Data inválida"})
    .optional()
    .describe("Filter application start date"),
  endDate: z
    .string()
    .refine(val => /^\d{4}-\d{2}-\d{2}$/.test(val), {message: " Data Final no formato incorreto. Use YYYY-MM-DD."} )  
    .refine(val =>  !isNaN(Date.parse(val)), {message: "invalid date"})
    .optional()
    .describe("Filter application end date"),
});

export type ServiceOrderStatsQueryString = z.infer<typeof ServiceOrderStatsQueryStringSchema>; 