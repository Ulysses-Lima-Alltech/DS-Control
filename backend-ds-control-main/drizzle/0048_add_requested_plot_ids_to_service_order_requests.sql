BEGIN;

ALTER TABLE "service_order_requests"
  ADD COLUMN IF NOT EXISTS "requested_plot_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint

COMMIT;
