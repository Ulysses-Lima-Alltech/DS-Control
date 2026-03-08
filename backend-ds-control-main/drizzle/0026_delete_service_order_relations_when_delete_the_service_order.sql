ALTER TABLE "applications" DROP CONSTRAINT "applications_service_order_id_service_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "service_order_farms" DROP CONSTRAINT "service_order_farms_service_order_id_service_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "service_order_pilots" DROP CONSTRAINT "service_order_pilots_service_order_id_service_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "service_order_plots" DROP CONSTRAINT "service_order_plots_service_order_id_service_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_farms" ADD CONSTRAINT "service_order_farms_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_pilots" ADD CONSTRAINT "service_order_pilots_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_plots" ADD CONSTRAINT "service_order_plots_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;