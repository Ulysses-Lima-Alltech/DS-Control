BEGIN;

ALTER TABLE "service_order_requests"
  ADD COLUMN IF NOT EXISTS "requested_farm_id" uuid;
--> statement-breakpoint

UPDATE "service_order_requests"
  SET "requested_farm_id" = ("requested_farm_ids"->>0)::uuid
  WHERE jsonb_array_length("requested_farm_ids") > 0;
--> statement-breakpoint

ALTER TABLE "service_order_requests"
  ALTER COLUMN "requested_farm_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "service_order_requests"
  ADD CONSTRAINT "service_order_requests_requested_farm_id_farms_id_fk"
  FOREIGN KEY ("requested_farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;
--> statement-breakpoint

ALTER TABLE "service_order_requests"
  DROP COLUMN IF EXISTS "requested_farm_ids";
--> statement-breakpoint

COMMIT;
