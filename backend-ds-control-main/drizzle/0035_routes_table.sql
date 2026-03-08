CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"geo_json" jsonb NOT NULL,
	"farm_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routes_farm_id_index" ON "routes" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "routes_customer_id_index" ON "routes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "routes_name_index" ON "routes" USING btree ("name");