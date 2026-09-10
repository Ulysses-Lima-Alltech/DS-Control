import z from 'zod';

const UniqueUuidArraySchema = z.array(z.string().uuid()).transform((ids) => [...new Set(ids)]);

export const UpdateServiceOrderSchema = z.object({
  farmsIds: UniqueUuidArraySchema.pipe(
    z.array(z.string().uuid()).min(1, 'At least one farm is required'),
  ).optional(),
  contractId: z.string().uuid().optional(),
  observation: z.string().optional(),
  plannedDate: z.string().date().optional(),
  pilotsIds: UniqueUuidArraySchema.optional(),
  plotsIds: UniqueUuidArraySchema.optional(),
});

export type UpdateServiceOrderDTO = z.infer<typeof UpdateServiceOrderSchema>;
