CREATE TABLE "crop_season_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crop_season_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "crop_season_products" ADD CONSTRAINT "crop_season_products_crop_season_id_crop_seasons_id_fk" FOREIGN KEY ("crop_season_id") REFERENCES "public"."crop_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_season_products" ADD CONSTRAINT "crop_season_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crop_season_products_crop_season_id_index" ON "crop_season_products" USING btree ("crop_season_id");--> statement-breakpoint
CREATE INDEX "crop_season_products_product_id_index" ON "crop_season_products" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crop_season_products_unique_pair_index" ON "crop_season_products" USING btree ("crop_season_id","product_id");--> statement-breakpoint
CREATE INDEX "crop_seasons_name_index" ON "crop_seasons" USING btree ("name");--> statement-breakpoint
CREATE INDEX "crop_seasons_start_date_index" ON "crop_seasons" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "crop_seasons_end_date_index" ON "crop_seasons" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "crop_seasons_deleted_at_index" ON "crop_seasons" USING btree ("deleted_at");
