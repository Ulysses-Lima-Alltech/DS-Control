import z from 'zod';

export const CreateRouteBatchItemSchema = z.object({
  name: z.string().min(1),
  geoJson: z.record(z.string(), z.unknown()),
  externalId: z.string().optional(),
  sourceFileName: z.string().optional(),
});

export const CreateRoutesBatchSchema = z.object({
  farmId: z.string().uuid(),
  customerId: z.string().uuid(),
  routes: z.array(CreateRouteBatchItemSchema).min(1).max(100),
  duplicateStrategy: z.enum(['skip', 'rename', 'fail']).default('rename').optional(),
});

export type CreateRoutesBatchDTO = z.infer<typeof CreateRoutesBatchSchema>;
