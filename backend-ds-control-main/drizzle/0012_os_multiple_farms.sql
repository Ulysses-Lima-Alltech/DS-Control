CREATE TABLE "service_order_farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_order_id" uuid NOT NULL,
	"farm_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_farm_id_farms_id_fk";
--> statement-breakpoint
ALTER TABLE "service_order_farms" ADD CONSTRAINT "service_order_farms_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_farms" ADD CONSTRAINT "service_order_farms_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" DROP COLUMN "farm_id";