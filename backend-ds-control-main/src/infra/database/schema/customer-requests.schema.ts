import { relations, sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { customers } from './customer.schema';
import { farms } from './farms.schema';
import { plots } from './plot.schema';
import { serviceOrders } from './service_order.schema';
import { users } from './user.schema';

export const customerRequestStatus = pgEnum('customer_request_status', [
  'DRAFT',
  'SUBMITTED',
  'PARSING',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

export const customerRequestType = pgEnum('customer_request_type', [
  'SERVICE_ORDER',
  'AREA_SUBMISSION',
]);

export const requestReviewEventType = pgEnum('request_review_event_type', [
  'CREATED',
  'UPDATED',
  'SUBMITTED',
  'PARSING_STARTED',
  'PARSING_COMPLETED',
  'PARSING_FAILED',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

export const areaSubmissionParseStatus = pgEnum('area_submission_parse_status', [
  'PENDING_UPLOAD',
  'UPLOADED',
  'PARSING',
  'PARSED',
  'FAILED',
]);

export const areaSubmissionPlotValidationStatus = pgEnum(
  'area_submission_plot_validation_status',
  ['PENDING', 'VALID', 'INVALID', 'EXCLUDED'],
);

export const serviceOrderRequests = pgTable(
  'service_order_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .references(() => customers.id, { onDelete: 'restrict' })
      .notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    requestedFarmIds: jsonb('requested_farm_ids').$type<string[]>().notNull().default([]),
    requestedDate: date('requested_date').notNull(),
    serviceType: text('service_type').notNull(),
    requestedPlotIds: jsonb('requested_plot_ids').$type<string[]>().notNull().default([]),
    observation: text('observation'),
    status: customerRequestStatus('status').notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    approvedServiceOrderId: uuid('approved_service_order_id').references(
      () => serviceOrders.id,
      { onDelete: 'restrict' },
    ),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('service_order_requests_customer_id_index').on(table.customerId),
    index('service_order_requests_status_index').on(table.status),
    index('service_order_requests_requested_date_index').on(table.requestedDate),
    index('service_order_requests_requested_by_index').on(table.requestedByUserId),
    index('service_order_requests_created_at_index').on(table.createdAt),
    uniqueIndex('service_order_requests_approved_order_unique')
      .on(table.approvedServiceOrderId)
      .where(sql`${table.approvedServiceOrderId} IS NOT NULL`),
    check(
      'service_order_requests_approval_consistency',
      sql`${table.status} <> 'APPROVED' OR ${table.approvedServiceOrderId} IS NOT NULL`,
    ),
  ],
);

export const areaSubmissionRequests = pgTable(
  'area_submission_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .references(() => customers.id, { onDelete: 'restrict' })
      .notNull(),
    requestedByUserId: uuid('requested_by_user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    suggestedFarmName: text('suggested_farm_name'),
    existingFarmId: uuid('existing_farm_id').references(() => farms.id, {
      onDelete: 'restrict',
    }),
    status: customerRequestStatus('status').notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    approvedFarmId: uuid('approved_farm_id').references(() => farms.id, {
      onDelete: 'restrict',
    }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('area_submission_requests_customer_id_index').on(table.customerId),
    index('area_submission_requests_status_index').on(table.status),
    index('area_submission_requests_requested_by_index').on(table.requestedByUserId),
    index('area_submission_requests_created_at_index').on(table.createdAt),
    check(
      'area_submission_requests_farm_target_check',
      sql`${table.existingFarmId} IS NOT NULL OR NULLIF(BTRIM(${table.suggestedFarmName}), '') IS NOT NULL`,
    ),
    check(
      'area_submission_requests_approval_consistency',
      sql`${table.status} <> 'APPROVED' OR ${table.approvedFarmId} IS NOT NULL`,
    ),
  ],
);

export const areaSubmissionFiles = pgTable(
  'area_submission_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .references(() => areaSubmissionRequests.id, { onDelete: 'cascade' })
      .notNull(),
    storageKey: text('storage_key').notNull(),
    originalFileName: text('original_file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    parseStatus: areaSubmissionParseStatus('parse_status').notNull().default('PENDING_UPLOAD'),
    parseError: text('parse_error'),
    uploadedAt: timestamp('uploaded_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('area_submission_files_request_id_index').on(table.requestId),
    index('area_submission_files_parse_status_index').on(table.parseStatus),
    uniqueIndex('area_submission_files_storage_key_unique').on(table.storageKey),
    uniqueIndex('area_submission_files_request_sha_unique').on(table.requestId, table.sha256),
    check('area_submission_files_size_positive', sql`${table.sizeBytes} > 0`),
    check('area_submission_files_sha256_format', sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const areaSubmissionPlots = pgTable(
  'area_submission_plots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .references(() => areaSubmissionRequests.id, { onDelete: 'cascade' })
      .notNull(),
    sourceFeatureIndex: integer('source_feature_index').notNull(),
    suggestedName: text('suggested_name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    geoJson: jsonb('geo_json').notNull(),
    calculatedAreaHa: numeric('calculated_area_ha', { precision: 14, scale: 4 }).notNull(),
    validationStatus: areaSubmissionPlotValidationStatus('validation_status')
      .notNull()
      .default('PENDING'),
    validationErrors: jsonb('validation_errors').notNull().default(sql`'[]'::jsonb`),
    approvedPlotId: uuid('approved_plot_id').references(() => plots.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('area_submission_plots_request_feature_unique').on(
      table.requestId,
      table.sourceFeatureIndex,
    ),
    uniqueIndex('area_submission_plots_approved_plot_unique')
      .on(table.approvedPlotId)
      .where(sql`${table.approvedPlotId} IS NOT NULL`),
    index('area_submission_plots_request_id_index').on(table.requestId),
    index('area_submission_plots_validation_status_index').on(table.validationStatus),
    check('area_submission_plots_feature_index_nonnegative', sql`${table.sourceFeatureIndex} >= 0`),
    check('area_submission_plots_area_nonnegative', sql`${table.calculatedAreaHa} >= 0`),
  ],
);

export const requestReviewEvents = pgTable(
  'request_review_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestType: customerRequestType('request_type').notNull(),
    requestId: uuid('request_id').notNull(),
    actorUserId: uuid('actor_user_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    eventType: requestReviewEventType('event_type').notNull(),
    fromStatus: customerRequestStatus('from_status'),
    toStatus: customerRequestStatus('to_status').notNull(),
    detailsJson: jsonb('details_json').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('request_review_events_request_index').on(table.requestType, table.requestId),
    index('request_review_events_actor_user_id_index').on(table.actorUserId),
    index('request_review_events_created_at_index').on(table.createdAt),
  ],
);

export const serviceOrderRequestsRelations = relations(serviceOrderRequests, ({ one }) => ({
  customer: one(customers, {
    fields: [serviceOrderRequests.customerId],
    references: [customers.id],
  }),
  requestedBy: one(users, {
    fields: [serviceOrderRequests.requestedByUserId],
    references: [users.id],
    relationName: 'serviceOrderRequestRequestedBy',
  }),
  reviewedBy: one(users, {
    fields: [serviceOrderRequests.reviewedByUserId],
    references: [users.id],
    relationName: 'serviceOrderRequestReviewedBy',
  }),
  approvedServiceOrder: one(serviceOrders, {
    fields: [serviceOrderRequests.approvedServiceOrderId],
    references: [serviceOrders.id],
  }),
}));

export const areaSubmissionRequestsRelations = relations(
  areaSubmissionRequests,
  ({ one, many }) => ({
    customer: one(customers, {
      fields: [areaSubmissionRequests.customerId],
      references: [customers.id],
    }),
    requestedBy: one(users, {
      fields: [areaSubmissionRequests.requestedByUserId],
      references: [users.id],
      relationName: 'areaSubmissionRequestedBy',
    }),
    reviewedBy: one(users, {
      fields: [areaSubmissionRequests.reviewedByUserId],
      references: [users.id],
      relationName: 'areaSubmissionReviewedBy',
    }),
    existingFarm: one(farms, {
      fields: [areaSubmissionRequests.existingFarmId],
      references: [farms.id],
      relationName: 'areaSubmissionExistingFarm',
    }),
    approvedFarm: one(farms, {
      fields: [areaSubmissionRequests.approvedFarmId],
      references: [farms.id],
      relationName: 'areaSubmissionApprovedFarm',
    }),
    files: many(areaSubmissionFiles),
    submittedPlots: many(areaSubmissionPlots),
  }),
);

export const areaSubmissionFilesRelations = relations(areaSubmissionFiles, ({ one }) => ({
  request: one(areaSubmissionRequests, {
    fields: [areaSubmissionFiles.requestId],
    references: [areaSubmissionRequests.id],
  }),
}));

export const areaSubmissionPlotsRelations = relations(areaSubmissionPlots, ({ one }) => ({
  request: one(areaSubmissionRequests, {
    fields: [areaSubmissionPlots.requestId],
    references: [areaSubmissionRequests.id],
  }),
  approvedPlot: one(plots, {
    fields: [areaSubmissionPlots.approvedPlotId],
    references: [plots.id],
  }),
}));
