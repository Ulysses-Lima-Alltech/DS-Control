CREATE UNIQUE INDEX IF NOT EXISTS "service_order_farm_service_order_farm_unique_index"
ON "service_order_farms" USING btree ("service_order_id", "farm_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "service_order_pilot_service_order_pilot_unique_index"
ON "service_order_pilots" USING btree ("service_order_id", "pilot_id");
