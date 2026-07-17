import z from 'zod';

export const CompletedPlotsReportAreaModeSchema = z.enum(['plot_area', 'applied_area']);

export const CompletedPlotsReportRequestSchema = z.object({
  areaMode: CompletedPlotsReportAreaModeSchema,
});

export const CompletedPlotsReportRowSchema = z.object({
  plotId: z.string().uuid(),
  farmId: z.string().uuid(),
  applicationId: z.string().uuid().nullable(),
  registeredAreaHectares: z.string(),
  effectiveAppliedHectares: z.string(),
  realAppliedHectares: z.string(),
  realCoveragePercent: z.string(),
  displayedAppliedHectares: z.string(),
  displayedCoveragePercent: z.string(),
  accountedAreaHectares: z.string(),
  accountedCoveragePercent: z.string(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  applicationsCount: z.number(),
});

export const CompletedPlotsReportTotalsSchema = z.object({
  plannedAreaHa: z.string(),
  grossAppliedAreaHa: z.string(),
  registeredCompletedAreaHa: z.string(),
  inProgressAppliedAreaHa: z.string(),
  consolidatedPlotAreaHa: z.string(),
  registeredProgressPercent: z.string(),
  grossAppliedProgressPercent: z.string(),
  consolidatedProgressPercent: z.string(),
  completedPlotsCount: z.number(),
  inProgressPlotsCount: z.number(),
  notStartedPlotsCount: z.number(),
  applicationsCount: z.number(),
});

export const CompletedPlotsReportResponseSchema = z.object({
  areaMode: CompletedPlotsReportAreaModeSchema,
  completionThresholdPercent: z.number(),
  coverageSource: z.literal('maximum_registered_application_area'),
  rows: z.array(CompletedPlotsReportRowSchema),
  totals: CompletedPlotsReportTotalsSchema,
  totalDisplayedHectares: z.string(),
});

export type CompletedPlotsReportRequestDTO = z.infer<typeof CompletedPlotsReportRequestSchema>;
export type CompletedPlotsReportResponseDTO = z.infer<typeof CompletedPlotsReportResponseSchema>;
