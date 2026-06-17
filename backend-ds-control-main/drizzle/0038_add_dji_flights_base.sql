CREATE TABLE "dji_flights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_number" text NOT NULL,
	"flight_date" timestamp NOT NULL,
	"start_time" text,
	"end_time" text,
	"aircraft_name" text,
	"drone_serial" text,
	"pilot_name" text,
	"task_area_ha" numeric(12, 4),
	"estimated_applied_area_ha" numeric(12, 4),
	"route_spacing_m" numeric(10, 4),
	"route_distance_km" numeric(12, 4),
	"coordinate_count" integer,
	"bbox" jsonb,
	"center" jsonb,
	"raw_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dji_flight_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dji_flight_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"region" text NOT NULL,
	"raw_kml_s3_key" text NOT NULL,
	"png_s3_key" text NOT NULL,
	"route_geojson_s3_key" text NOT NULL,
	"buffer_geojson_s3_key" text NOT NULL,
	"metadata_s3_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dji_application_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"dji_flight_id" uuid NOT NULL,
	"record_number" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"confidence_score" numeric(5, 2),
	"match_type" text,
	"score_reasons" jsonb,
	"approved_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dji_flight_assets" ADD CONSTRAINT "dji_flight_assets_dji_flight_id_dji_flights_id_fk" FOREIGN KEY ("dji_flight_id") REFERENCES "public"."dji_flights"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dji_application_links" ADD CONSTRAINT "dji_application_links_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dji_application_links" ADD CONSTRAINT "dji_application_links_dji_flight_id_dji_flights_id_fk" FOREIGN KEY ("dji_flight_id") REFERENCES "public"."dji_flights"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "dji_flights_record_number_unique_index" ON "dji_flights" USING btree ("record_number");
--> statement-breakpoint
CREATE INDEX "dji_flights_record_number_index" ON "dji_flights" USING btree ("record_number");
--> statement-breakpoint
CREATE INDEX "dji_flights_flight_date_index" ON "dji_flights" USING btree ("flight_date");
--> statement-breakpoint
CREATE INDEX "dji_flights_aircraft_name_index" ON "dji_flights" USING btree ("aircraft_name");
--> statement-breakpoint
CREATE INDEX "dji_flights_pilot_name_index" ON "dji_flights" USING btree ("pilot_name");
--> statement-breakpoint
CREATE UNIQUE INDEX "dji_flight_assets_dji_flight_id_unique_index" ON "dji_flight_assets" USING btree ("dji_flight_id");
--> statement-breakpoint
CREATE INDEX "dji_flight_assets_dji_flight_id_index" ON "dji_flight_assets" USING btree ("dji_flight_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "dji_application_links_application_flight_unique_index" ON "dji_application_links" USING btree ("application_id","dji_flight_id");
--> statement-breakpoint
CREATE INDEX "dji_application_links_application_id_index" ON "dji_application_links" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "dji_application_links_dji_flight_id_index" ON "dji_application_links" USING btree ("dji_flight_id");
--> statement-breakpoint
CREATE INDEX "dji_application_links_record_number_index" ON "dji_application_links" USING btree ("record_number");
--> statement-breakpoint
CREATE INDEX "dji_application_links_status_index" ON "dji_application_links" USING btree ("status");
