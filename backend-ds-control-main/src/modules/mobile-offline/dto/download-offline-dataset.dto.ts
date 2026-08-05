import { z } from 'zod';

export const DownloadOfflineDatasetSchema = z.object({
  serviceOrderIds: z
    .array(z.string().uuid())
    .min(1)
    .max(25)
    .refine((ids) => new Set(ids).size === ids.length, 'Service order IDs must be unique'),
});

export type DownloadOfflineDatasetDTO = z.infer<typeof DownloadOfflineDatasetSchema>;
