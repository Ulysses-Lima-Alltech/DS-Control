BEGIN;

ALTER TABLE "service_order_requests"
  ADD COLUMN IF NOT EXISTS "requested_farm_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint

UPDATE "service_order_requests"
  SET "requested_farm_ids" = jsonb_build_array("requested_farm_id")
  WHERE "requested_farm_id" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "service_order_requests"
  DROP CONSTRAINT IF EXISTS "service_order_requests_requested_farm_id_farms_id_fk";
--> statement-breakpoint

ALTER TABLE "service_order_requests"
  DROP COLUMN IF EXISTS "requested_farm_id";
--> statement-breakpoint

COMMIT;
