import z from 'zod';

export const ServiceOrderPlotStatusSchema = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);

export const UpdateServiceOrderPlotStatusSchema = z.object({
  status: ServiceOrderPlotStatusSchema,
});

export const ServiceOrderPlotStatusResponseSchema = z.object({
  id: z.string().uuid(),
  serviceOrderId: z.string().uuid(),
  plotId: z.string().uuid(),
  status: ServiceOrderPlotStatusSchema,
  completedAt: z.union([z.string(), z.date()]).nullable(),
  completedBy: z.string().uuid().nullable(),
  updatedAt: z.union([z.string(), z.date()]),
});

export type UpdateServiceOrderPlotStatusDTO = z.infer<typeof UpdateServiceOrderPlotStatusSchema>;
