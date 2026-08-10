BEGIN;

ALTER TABLE "service_order_plots"
  ADD COLUMN IF NOT EXISTS "manual_override" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "override_reason" text;
--> statement-breakpoint

COMMIT;
