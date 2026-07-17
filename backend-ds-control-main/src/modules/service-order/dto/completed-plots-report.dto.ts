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
  realCoveragePercent: z.string(),
  displayedAppliedHectares: z.string(),
  displayedCoveragePercent: z.string(),
  status: z.literal('COMPLETED'),
});

export const CompletedPlotsReportResponseSchema = z.object({
  areaMode: CompletedPlotsReportAreaModeSchema,
  completionThresholdPercent: z.number(),
  coverageSource: z.literal('maximum_registered_application_area'),
  rows: z.array(CompletedPlotsReportRowSchema),
  totalDisplayedHectares: z.string(),
});

export type CompletedPlotsReportRequestDTO = z.infer<typeof CompletedPlotsReportRequestSchema>;
export type CompletedPlotsReportResponseDTO = z.infer<typeof CompletedPlotsReportResponseSchema>;
