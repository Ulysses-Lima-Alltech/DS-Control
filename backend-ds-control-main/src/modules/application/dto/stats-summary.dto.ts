import z from "zod";

export const ApplicationSummaryStatsSchema = z.object({
  openOrdersCount: z.number(),
  completedOrdersCount: z.number(),
  cancelledOrdersCount: z.number(),
  avgHectarebyApplication: z.number(),
  avgDaily: z.number(),
  totalHectares: z.number(),
  openOrdersAreaHectares: z.number(),
  completedOrdersAreaHectares: z.number(),
  cancelledOrdersAreaHectares: z.number(),
  openOrdersAppliedHectares: z.number(),
  completedOrdersAppliedHectares: z.number(),
  cancelledOrdersAppliedHectares: z.number(),
  comparisonLastMonths: z.array(
    z.object({
      day: z.string(),
      month: z.string(),
      totalApplications: z.number(),
      hectares: z.number(),
    })
  )
})

export type ApplicationSummaryStatsDTO = z.infer<typeof ApplicationSummaryStatsSchema>;
