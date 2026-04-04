CREATE TABLE "integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text,
	"raw_payload" jsonb NOT NULL,
	"source" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "integration_events_provider_index" ON "integration_events" USING btree ("provider");
--> statement-breakpoint
CREATE TABLE "flight_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_event_id" uuid,
	"provider" text NOT NULL,
	"normalized" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "flight_records_provider_index" ON "flight_records" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX "flight_records_integration_event_id_index" ON "flight_records" USING btree ("integration_event_id");
--> statement-breakpoint
ALTER TABLE "flight_records" ADD CONSTRAINT "flight_records_integration_event_id_integration_events_id_fk" FOREIGN KEY ("integration_event_id") REFERENCES "public"."integration_events"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
