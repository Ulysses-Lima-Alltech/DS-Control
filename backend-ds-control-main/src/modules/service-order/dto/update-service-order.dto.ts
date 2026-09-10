import z from 'zod';
import { normalizeServiceOrderPlannedDate } from '../service-order-planned-date';

const UniqueUuidArraySchema = z.array(z.string().uuid()).transform((ids) => [...new Set(ids)]);
const PlannedDateSchema = z.string().transform((value, ctx) => {
  try {
    return normalizeServiceOrderPlannedDate(value);
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Data planejada invalida. Use YYYY-MM-DD.',
    });
    return z.NEVER;
  }
});

export const UpdateServiceOrderSchema = z.object({
  farmsIds: UniqueUuidArraySchema.pipe(
    z.array(z.string().uuid()).min(1, 'At least one farm is required'),
  ).optional(),
  contractId: z.string().uuid().optional(),
  observation: z.string().optional(),
  plannedDate: PlannedDateSchema.optional(),
  pilotsIds: UniqueUuidArraySchema.optional(),
  plotsIds: UniqueUuidArraySchema.optional(),
});

export type UpdateServiceOrderDTO = z.infer<typeof UpdateServiceOrderSchema>;
