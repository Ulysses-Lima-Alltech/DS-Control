CREATE TYPE "public"."customer_request_status" AS ENUM(
  'DRAFT',
  'SUBMITTED',
  'PARSING',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);
--> statement-breakpoint
CREATE TYPE "public"."customer_request_type" AS ENUM('SERVICE_ORDER', 'AREA_SUBMISSION');
--> statement-breakpoint
CREATE TYPE "public"."request_review_event_type" AS ENUM(
  'CREATED',
  'UPDATED',
  'SUBMITTED',
  'PARSING_STARTED',
  'PARSING_COMPLETED',
  'PARSING_FAILED',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);
--> statement-breakpoint
CREATE TYPE "public"."area_submission_parse_status" AS ENUM(
  'PENDING_UPLOAD',
  'UPLOADED',
  'PARSING',
  'PARSED',
  'FAILED'
);
--> statement-breakpoint
CREATE TYPE "public"."area_submission_plot_validation_status" AS ENUM(
  'PENDING',
  'VALID',
  'INVALID',
  'EXCLUDED'
);
--> statement-breakpoint
CREATE TABLE "service_order_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "requested_by_user_id" uuid NOT NULL,
  "requested_farm_id" uuid NOT NULL,
  "requested_date" date NOT NULL,
  "service_type" text NOT NULL,
  "observation" text,
  "status" "customer_request_status" DEFAULT 'DRAFT' NOT NULL,
  "submitted_at" timestamp,
  "reviewed_at" timestamp,
  "reviewed_by_user_id" uuid,
  "approved_service_order_id" uuid,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "service_order_requests_approval_consistency"
    CHECK ("status" <> 'APPROVED' OR "approved_service_order_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "area_submission_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "requested_by_user_id" uuid NOT NULL,
  "suggested_farm_name" text,
  "existing_farm_id" uuid,
  "status" "customer_request_status" DEFAULT 'DRAFT' NOT NULL,
  "submitted_at" timestamp,
  "reviewed_at" timestamp,
  "reviewed_by_user_id" uuid,
  "approved_farm_id" uuid,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "area_submission_requests_farm_target_check"
    CHECK ("existing_farm_id" IS NOT NULL OR NULLIF(BTRIM("suggested_farm_name"), '') IS NOT NULL),
  CONSTRAINT "area_submission_requests_approval_consistency"
    CHECK ("status" <> 'APPROVED' OR "approved_farm_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "area_submission_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL,
  "storage_key" text NOT NULL,
  "original_file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" text NOT NULL,
  "parse_status" "area_submission_parse_status" DEFAULT 'PENDING_UPLOAD' NOT NULL,
  "parse_error" text,
  "uploaded_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "area_submission_files_size_positive" CHECK ("size_bytes" > 0),
  CONSTRAINT "area_submission_files_sha256_format" CHECK ("sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "area_submission_plots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL,
  "source_feature_index" integer NOT NULL,
  "suggested_name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "geo_json" jsonb NOT NULL,
  "calculated_area_ha" numeric(14, 4) NOT NULL,
  "validation_status" "area_submission_plot_validation_status" DEFAULT 'PENDING' NOT NULL,
  "validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "approved_plot_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "area_submission_plots_feature_index_nonnegative" CHECK ("source_feature_index" >= 0),
  CONSTRAINT "area_submission_plots_area_nonnegative" CHECK ("calculated_area_ha" >= 0)
);
--> statement-breakpoint
CREATE TABLE "request_review_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_type" "customer_request_type" NOT NULL,
  "request_id" uuid NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "event_type" "request_review_event_type" NOT NULL,
  "from_status" "customer_request_status",
  "to_status" "customer_request_status" NOT NULL,
  "details_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_order_requests" ADD CONSTRAINT "service_order_requests_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "service_order_requests" ADD CONSTRAINT "service_order_requests_requested_by_users_id_fk"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "service_order_requests" ADD CONSTRAINT "service_order_requests_requested_farm_farms_id_fk"
  FOREIGN KEY ("requested_farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "service_order_requests" ADD CONSTRAINT "service_order_requests_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "service_order_requests" ADD CONSTRAINT "service_order_requests_approved_order_fk"
  FOREIGN KEY ("approved_service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "area_submission_requests" ADD CONSTRAINT "area_submission_requests_customer_id_customers_id_fk"
  FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "area_submission_requests" ADD CONSTRAINT "area_submission_requests_requested_by_users_id_fk"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "area_submission_requests" ADD CONSTRAINT "area_submission_requests_existing_farm_farms_id_fk"
  FOREIGN KEY ("existing_farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "area_submission_requests" ADD CONSTRAINT "area_submission_requests_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "area_submission_requests" ADD CONSTRAINT "area_submission_requests_approved_farm_farms_id_fk"
  FOREIGN KEY ("approved_farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "area_submission_files" ADD CONSTRAINT "area_submission_files_request_id_requests_id_fk"
  FOREIGN KEY ("request_id") REFERENCES "public"."area_submission_requests"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "area_submission_plots" ADD CONSTRAINT "area_submission_plots_request_id_requests_id_fk"
  FOREIGN KEY ("request_id") REFERENCES "public"."area_submission_requests"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "area_submission_plots" ADD CONSTRAINT "area_submission_plots_approved_plot_plots_id_fk"
  FOREIGN KEY ("approved_plot_id") REFERENCES "public"."plots"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "request_review_events" ADD CONSTRAINT "request_review_events_actor_user_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "service_order_requests_customer_id_index" ON "service_order_requests" ("customer_id");
--> statement-breakpoint
CREATE INDEX "service_order_requests_status_index" ON "service_order_requests" ("status");
--> statement-breakpoint
CREATE INDEX "service_order_requests_requested_date_index" ON "service_order_requests" ("requested_date");
--> statement-breakpoint
CREATE INDEX "service_order_requests_requested_by_index" ON "service_order_requests" ("requested_by_user_id");
--> statement-breakpoint
CREATE INDEX "service_order_requests_created_at_index" ON "service_order_requests" ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "service_order_requests_approved_order_unique"
  ON "service_order_requests" ("approved_service_order_id")
  WHERE "approved_service_order_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "area_submission_requests_customer_id_index" ON "area_submission_requests" ("customer_id");
--> statement-breakpoint
CREATE INDEX "area_submission_requests_status_index" ON "area_submission_requests" ("status");
--> statement-breakpoint
CREATE INDEX "area_submission_requests_requested_by_index" ON "area_submission_requests" ("requested_by_user_id");
--> statement-breakpoint
CREATE INDEX "area_submission_requests_created_at_index" ON "area_submission_requests" ("created_at");
--> statement-breakpoint
CREATE INDEX "area_submission_files_request_id_index" ON "area_submission_files" ("request_id");
--> statement-breakpoint
CREATE INDEX "area_submission_files_parse_status_index" ON "area_submission_files" ("parse_status");
--> statement-breakpoint
CREATE UNIQUE INDEX "area_submission_files_storage_key_unique" ON "area_submission_files" ("storage_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "area_submission_files_request_sha_unique" ON "area_submission_files" ("request_id", "sha256");
--> statement-breakpoint
CREATE UNIQUE INDEX "area_submission_plots_request_feature_unique"
  ON "area_submission_plots" ("request_id", "source_feature_index");
--> statement-breakpoint
CREATE UNIQUE INDEX "area_submission_plots_approved_plot_unique"
  ON "area_submission_plots" ("approved_plot_id")
  WHERE "approved_plot_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "area_submission_plots_request_id_index" ON "area_submission_plots" ("request_id");
--> statement-breakpoint
CREATE INDEX "area_submission_plots_validation_status_index" ON "area_submission_plots" ("validation_status");
--> statement-breakpoint
CREATE INDEX "request_review_events_request_index" ON "request_review_events" ("request_type", "request_id");
--> statement-breakpoint
CREATE INDEX "request_review_events_actor_user_id_index" ON "request_review_events" ("actor_user_id");
--> statement-breakpoint
CREATE INDEX "request_review_events_created_at_index" ON "request_review_events" ("created_at");
