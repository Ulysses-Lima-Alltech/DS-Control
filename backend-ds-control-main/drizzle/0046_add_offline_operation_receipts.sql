CREATE TABLE "offline_operation_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "operation_type" varchar(64) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "status" text DEFAULT 'PROCESSING' NOT NULL,
  "response_json" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "offline_operation_receipts_status_check"
    CHECK ("status" IN ('PROCESSING', 'SUCCEEDED')),
  CONSTRAINT "offline_operation_receipts_hash_check"
    CHECK ("request_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "offline_operation_receipts"
  ADD CONSTRAINT "offline_operation_receipts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX "offline_operation_receipts_user_key_unique"
  ON "offline_operation_receipts" ("user_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX "offline_operation_receipts_user_created_index"
  ON "offline_operation_receipts" ("user_id", "created_at");
