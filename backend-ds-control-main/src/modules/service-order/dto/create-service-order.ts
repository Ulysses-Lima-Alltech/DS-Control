import { z } from 'zod';

const UniqueUuidArraySchema = z.array(z.string().uuid()).transform((ids) => [...new Set(ids)]);

export const CreateServiceOrderSchema = z.object({
  farmsIds: UniqueUuidArraySchema.pipe(
    z.array(z.string().uuid()).min(1, 'At least one farm is required'),
  ),
  customerId: z.string().uuid(),
  contractId: z.string().uuid(),
  observation: z.string().optional(),
  plannedDate: z.string().date(),
  pilotsIds: UniqueUuidArraySchema,
  plotsIds: UniqueUuidArraySchema,
});

export type CreateServiceOrderDTO = z.infer<typeof CreateServiceOrderSchema>;
