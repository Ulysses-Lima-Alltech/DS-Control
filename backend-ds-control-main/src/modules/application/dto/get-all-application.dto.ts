import { PaginatedRequestQueryStringSchema } from "@common/types/paginated-request.types";
import { ApplicationOrderBy, ApplicationOrderType } from "@repositories/applications/application.types";
import z from "zod";

/** Alinhado às métricas de stats (pendências / OS aberta sem talhão). */
export const ApplicationIssueFilterSchema = z.enum([
  "invalid_open_os",
  "structural_pending",
  /** Pendência estrutural exceto o recorte sem talhão em OS aberta (composição disjunta com invalid_open_os). */
  "structural_pending_other",
  "structural_missing_plot",
  "structural_missing_farm",
]);

export type ApplicationIssueFilter = z.infer<typeof ApplicationIssueFilterSchema>;

export const GetApplicationQueryStringSchema = PaginatedRequestQueryStringSchema.extend({
  search: z
    .string()
    .optional()
    .describe("Search term to filter applications by observations, customer name, pilot name, or farm name"),
  serviceOrderStatus: z
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
  productId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by product ID"),
  customerId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by customer ID"),
  serviceOrderId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by service order ID"),
  assistantId: z.string().uuid().optional().describe("Filter by assistant ID"),
  droneId: z.string().uuid().optional().describe("Filter by drone ID"),
  cultureId: z.string().uuid().optional().describe("Filter by culture ID"),
  plotId: z.string().uuid().optional().describe("Filter by plot ID"),
  customerName: z.string().optional().describe("Filter by customer name"),
  farmName: z.string().optional().describe("Filter by farm name"),
  pilotName: z.string().optional().describe("Filter by pilot name"),
  assistantName: z.string().optional().describe("Filter by assistant name"),
  droneName: z.string().optional().describe("Filter by drone name"),
  cultureName: z.string().optional().describe("Filter by culture name"),
  plotName: z.string().optional().describe("Filter by plot name"),
  productName: z.string().optional().describe("Filter by product name"),
  observations: z.string().optional().describe("Filter by observations"),
  serviceOrderNumber: z.string().optional().describe("Filter by service order number text"),
  hectaresMin: z.coerce.number().optional().describe("Filter minimum hectares"),
  hectaresMax: z.coerce.number().optional().describe("Filter maximum hectares"),
  flowRateMin: z.coerce.number().optional().describe("Filter minimum flow rate"),
  flowRateMax: z.coerce.number().optional().describe("Filter maximum flow rate"),
  altitudeMin: z.coerce.number().optional().describe("Filter minimum altitude"),
  altitudeMax: z.coerce.number().optional().describe("Filter maximum altitude"),
  routeSpacingMin: z.coerce.number().optional().describe("Filter minimum route spacing"),
  routeSpacingMax: z.coerce.number().optional().describe("Filter maximum route spacing"),
  dropletSizeMin: z.coerce.number().optional().describe("Filter minimum droplet size"),
  dropletSizeMax: z.coerce.number().optional().describe("Filter maximum droplet size"),
  invalidApplication: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true")
    .describe("Filter to invalid applications"),
  applicationIssue: ApplicationIssueFilterSchema.optional().describe(
    "Filter by inconsistency category (matches application stats); takes precedence over invalidApplication",
  ),
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
    orderBy: z
        .nativeEnum(ApplicationOrderBy)
        .optional()
        .describe("Fiel to order the users by"),
    orderType: z
        .nativeEnum(ApplicationOrderType)
        .optional()
        .describe("Order type (ascending or descending)"),
});

export type GetApplicationQueryString = z.infer<typeof GetApplicationQueryStringSchema>;