import z from 'zod';

export const ServiceOrderPlotStatusSchema = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

export const MANUAL_OVERRIDE_REASON_MIN_LENGTH = 10;

export const UpdateServiceOrderPlotStatusSchema = z.object({
  status: ServiceOrderPlotStatusSchema,
  // Required only when the requested status disagrees with the coverage-based canonical
  // status. Backoffice-only escalation path for plots the automatic 70% coverage rule
  // can't correctly classify (e.g. a plot sprayed across multiple passes / "mapa dividido").
  reason: z.string().trim().min(MANUAL_OVERRIDE_REASON_MIN_LENGTH).max(500).optional(),
});

export const ServiceOrderPlotStatusResponseSchema = z.object({
  id: z.string().uuid(),
  serviceOrderId: z.string().uuid(),
  plotId: z.string().uuid(),
  status: ServiceOrderPlotStatusSchema,
  completedAt: z.union([z.string(), z.date()]).nullable(),
  completedBy: z.string().uuid().nullable(),
  manualOverride: z.boolean(),
  overrideReason: z.string().nullable(),
  updatedAt: z.union([z.string(), z.date()]),
});

export type UpdateServiceOrderPlotStatusDTO = z.infer<typeof UpdateServiceOrderPlotStatusSchema>;
