import { CreateApplicationSchema } from '@modules/application/dto/create-application.dto';
import { z } from 'zod';

export const SyncOfflineOperationSchema = z.object({
  idempotencyKey: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/),
  operationType: z.literal('CREATE_APPLICATION'),
  payload: CreateApplicationSchema.extend({
    plotCompleted: z.boolean().optional().default(false),
  }),
});

export const SyncOfflineOperationsSchema = z.object({
  operations: z.array(SyncOfflineOperationSchema).min(1).max(20),
});

export type SyncOfflineOperationDTO = z.infer<typeof SyncOfflineOperationSchema>;
export type SyncOfflineOperationsDTO = z.infer<typeof SyncOfflineOperationsSchema>;
