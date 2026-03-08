ALTER TABLE "applications" ADD COLUMN "farm_id" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_farm_id_index" ON "applications" USING btree ("farm_id");