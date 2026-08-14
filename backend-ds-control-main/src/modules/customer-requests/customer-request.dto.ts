import { isOperationalDateString } from '@common/utils/operational-date';
import { z } from 'zod';

import { CUSTOMER_REQUEST_STATUSES } from './customer-request-status';
import { KML_LIMITS } from './kml/kml-parser';
import { KML_ALLOWED_CONTENT_TYPES } from './kml/kml-upload-policy';

export const CustomerRequestStatusSchema = z.enum(CUSTOMER_REQUEST_STATUSES);

export const CustomerRequestListQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1_000).optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: CustomerRequestStatusSchema.optional(),
  startDate: z.string().refine(isOperationalDateString).optional(),
  endDate: z.string().refine(isOperationalDateString).optional(),
});

export type CustomerRequestListQuery = z.infer<typeof CustomerRequestListQuerySchema>;

export const CreateServiceOrderRequestSchema = z.object({
  farmId: z.string().uuid(),
  requestedDate: z.string().refine(isOperationalDateString, 'Data deve usar YYYY-MM-DD'),
  serviceType: z.string().trim().min(1).max(120),
  requestedPlotIds: z.array(z.string().uuid()).max(500).optional(),
  observation: z.string().trim().max(4_000).optional(),
});

export type CreateServiceOrderRequestDTO = z.infer<typeof CreateServiceOrderRequestSchema>;

export const CreateAreaSubmissionRequestSchema = z
  .object({
    suggestedFarmName: z.string().trim().min(1).max(200).optional(),
    existingFarmId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    const targets =
      Number(Boolean(value.suggestedFarmName)) + Number(Boolean(value.existingFarmId));
    if (targets !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe exatamente uma fazenda existente ou um novo nome sugerido',
      });
    }
  });

export type CreateAreaSubmissionRequestDTO = z.infer<typeof CreateAreaSubmissionRequestSchema>;

export const PrepareKmlUploadSchema = z.object({
  originalFileName: z.string().trim().min(1).max(255),
  contentType: z.enum(KML_ALLOWED_CONTENT_TYPES),
  sizeBytes: z.number().int().positive().max(KML_LIMITS.maxBytes),
  sha256: z.string().regex(/^[0-9A-Fa-f]{64}$/),
});

export type PrepareKmlUploadDTO = z.infer<typeof PrepareKmlUploadSchema>;

export const CompleteKmlUploadSchema = z.object({
  fileId: z.string().uuid(),
});

export type CompleteKmlUploadDTO = z.infer<typeof CompleteKmlUploadSchema>;

export const UpdateAreaSubmissionPlotSchema = z
  .object({
    suggestedName: z.string().trim().min(1).max(200).optional(),
    excluded: z.boolean().optional(),
  })
  .refine((value) => value.suggestedName !== undefined || value.excluded !== undefined, {
    message: 'Nenhuma alteração informada',
  });

export type UpdateAreaSubmissionPlotDTO = z.infer<typeof UpdateAreaSubmissionPlotSchema>;

export const RequestIdParamSchema = z.object({ id: z.string().uuid() });
export const RequestPlotParamSchema = z.object({
  id: z.string().uuid(),
  plotId: z.string().uuid(),
});

export const AdminCustomerRequestListQuerySchema = CustomerRequestListQuerySchema.extend({
  type: z.enum(['SERVICE_ORDER', 'AREA_SUBMISSION']).optional(),
  customerId: z.string().uuid().optional(),
});

export type AdminCustomerRequestListQuery = z.infer<typeof AdminCustomerRequestListQuerySchema>;

export const AdminRequestParamSchema = z.object({
  type: z.enum(['service-orders', 'areas']),
  id: z.string().uuid(),
});

export type AdminRequestParams = z.infer<typeof AdminRequestParamSchema>;

export const ReviewReasonSchema = z.object({
  reason: z.string().trim().min(1).max(4_000),
});

export type ReviewReasonDTO = z.infer<typeof ReviewReasonSchema>;

export const ApproveCustomerRequestSchema = z.discriminatedUnion('approvalType', [
  z.object({
    approvalType: z.literal('SERVICE_ORDER'),
    contractId: z.string().uuid(),
    pilotIds: z.array(z.string().uuid()).min(1),
    plotIds: z.array(z.string().uuid()).min(1),
    plannedDate: z.string().refine(isOperationalDateString).optional(),
    observation: z.string().trim().max(4_000).optional(),
  }),
  z.object({
    approvalType: z.literal('AREA_SUBMISSION'),
    farmName: z.string().trim().min(1).max(200).optional(),
    mapColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
  }),
]);

export type ApproveCustomerRequestDTO = z.infer<typeof ApproveCustomerRequestSchema>;
