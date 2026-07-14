BEGIN;

CREATE TYPE "public"."service_order_plot_status" AS ENUM (
  'PENDING',
  'COMPLETED',
  'CANCELLED'
);
--> statement-breakpoint

ALTER TABLE "service_order_plots"
  ADD COLUMN "status" "service_order_plot_status" DEFAULT 'PENDING' NOT NULL,
  ADD COLUMN "completed_at" timestamp,
  ADD COLUMN "completed_by" uuid,
  ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint

ALTER TABLE "service_order_plots"
  ADD CONSTRAINT "service_order_plots_completed_by_users_id_fk"
  FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE INDEX "service_order_plot_status_index"
  ON "service_order_plots" USING btree ("status");
--> statement-breakpoint

DO $$
DECLARE
  total_links integer;
  links_with_valid_application integer;
  os_142_id uuid;
  confirmed_os_142_links integer;
BEGIN
  SELECT COUNT(*) INTO total_links FROM service_order_plots;

  SELECT COUNT(*) INTO links_with_valid_application
  FROM service_order_plots sop
  WHERE EXISTS (
    SELECT 1
    FROM applications a
    WHERE a.service_order_id = sop.service_order_id
      AND a.plot_id = sop.plot_id
      AND a.deleted_at IS NULL
  );

  RAISE NOTICE 'service_order_plots before backfill: %, with valid application: %',
    total_links, links_with_valid_application;

  SELECT id INTO os_142_id
  FROM service_orders
  WHERE number = 142;

  IF os_142_id IS NULL THEN
    RAISE EXCEPTION 'OS 142 was not found; migration aborted before backfill';
  END IF;

  SELECT COUNT(*) INTO confirmed_os_142_links
  FROM service_order_plots
  WHERE service_order_id = os_142_id
    AND plot_id = ANY (ARRAY[
      'f5059db2-8731-4785-9ae9-af220139f334'::uuid,
      '66db291c-22db-4a56-b1df-1cfcb650efdd'::uuid,
      '244c4cfa-420c-41d8-8509-a2a6be238b12'::uuid,
      'ad2638ba-439b-4da0-86db-6db6b86b189b'::uuid,
      '2278759c-210f-443d-9466-65c279cb5129'::uuid,
      'ade694ac-22a8-45b9-93ae-75b3b19b7988'::uuid,
      '37233200-1b51-45ca-b122-574ec0249781'::uuid,
      '1c4f4ceb-af5f-46aa-9acb-265a04fdcf18'::uuid,
      '49b23029-36ec-4409-aa29-6e7d6aa076ec'::uuid,
      'affef3b1-3545-40da-a2d1-238136bc9fb3'::uuid,
      '6bfe312f-3c69-4a32-9cda-416703ceef61'::uuid,
      '395fde74-59bf-42ba-8d0c-56e404353185'::uuid,
      'f9325b1c-3af6-47e7-8a09-a7abf08809a7'::uuid,
      'b7754df7-81d0-4274-8ad9-6f248270c22f'::uuid,
      'af2ac97d-4f8f-4449-82f2-3c305be62cf7'::uuid,
      '0735aa34-9e0b-406d-a0c2-e8eeac816afd'::uuid,
      '541a7561-8dee-4a7d-8c90-34176d105de4'::uuid,
      '071d19f0-9adb-4b03-a552-c797b58f0474'::uuid,
      '9335b52b-369c-4088-a3b1-285dffed4b29'::uuid,
      'd39d4245-3f07-43f7-a128-deb09109a214'::uuid,
      '8f787302-2d40-4b10-9b65-10793b843d38'::uuid,
      'ea2b12e3-08fd-4533-bb97-8c8da73a6f69'::uuid,
      'f47bd577-4856-4849-9295-17841d432008'::uuid,
      '390b92f5-97ac-47b9-ab69-a828affa740f'::uuid,
      '7e2ae4f3-72ff-418d-b00c-c6186fff2cb0'::uuid,
      'e2dd72fc-d919-4b29-9822-df491aef4260'::uuid,
      '99cbf95a-9e9f-4bc0-afd8-6d1343f11079'::uuid,
      '0fa23f92-0b70-4d8b-ac2d-2b2b9340214c'::uuid,
      '441cca7b-2f48-4976-af94-1dd0ebf3d7f0'::uuid,
      '6fda8950-9d1b-4f97-99b2-e45131df76a3'::uuid,
      'f1cd7351-dbe3-41c6-891e-57cefa7e54ad'::uuid
    ]);

  IF confirmed_os_142_links <> 31 THEN
    RAISE EXCEPTION 'Expected 31 confirmed plot links in OS 142, found %; migration aborted',
      confirmed_os_142_links;
  END IF;
END $$;
--> statement-breakpoint

UPDATE service_order_plots sop
SET status = 'COMPLETED',
    completed_at = application_dates.completed_at,
    updated_at = now()
FROM (
  SELECT service_order_id, plot_id, MAX(created_at) AS completed_at
  FROM applications
  WHERE plot_id IS NOT NULL
    AND service_order_id IS NOT NULL
    AND deleted_at IS NULL
  GROUP BY service_order_id, plot_id
) application_dates
WHERE sop.service_order_id = application_dates.service_order_id
  AND sop.plot_id = application_dates.plot_id;
--> statement-breakpoint

UPDATE service_order_plots
SET status = 'COMPLETED',
    completed_at = COALESCE(completed_at, now()),
    updated_at = now()
WHERE service_order_id = (SELECT id FROM service_orders WHERE number = 142)
  AND plot_id = ANY (ARRAY[
    'f5059db2-8731-4785-9ae9-af220139f334'::uuid,
    '66db291c-22db-4a56-b1df-1cfcb650efdd'::uuid,
    '244c4cfa-420c-41d8-8509-a2a6be238b12'::uuid,
    'ad2638ba-439b-4da0-86db-6db6b86b189b'::uuid,
    '2278759c-210f-443d-9466-65c279cb5129'::uuid,
    'ade694ac-22a8-45b9-93ae-75b3b19b7988'::uuid,
    '37233200-1b51-45ca-b122-574ec0249781'::uuid,
    '1c4f4ceb-af5f-46aa-9acb-265a04fdcf18'::uuid,
    '49b23029-36ec-4409-aa29-6e7d6aa076ec'::uuid,
    'affef3b1-3545-40da-a2d1-238136bc9fb3'::uuid,
    '6bfe312f-3c69-4a32-9cda-416703ceef61'::uuid,
    '395fde74-59bf-42ba-8d0c-56e404353185'::uuid,
    'f9325b1c-3af6-47e7-8a09-a7abf08809a7'::uuid,
    'b7754df7-81d0-4274-8ad9-6f248270c22f'::uuid,
    'af2ac97d-4f8f-4449-82f2-3c305be62cf7'::uuid,
    '0735aa34-9e0b-406d-a0c2-e8eeac816afd'::uuid,
    '541a7561-8dee-4a7d-8c90-34176d105de4'::uuid,
    '071d19f0-9adb-4b03-a552-c797b58f0474'::uuid,
    '9335b52b-369c-4088-a3b1-285dffed4b29'::uuid,
    'd39d4245-3f07-43f7-a128-deb09109a214'::uuid,
    '8f787302-2d40-4b10-9b65-10793b843d38'::uuid,
    'ea2b12e3-08fd-4533-bb97-8c8da73a6f69'::uuid,
    'f47bd577-4856-4849-9295-17841d432008'::uuid,
    '390b92f5-97ac-47b9-ab69-a828affa740f'::uuid,
    '7e2ae4f3-72ff-418d-b00c-c6186fff2cb0'::uuid,
    'e2dd72fc-d919-4b29-9822-df491aef4260'::uuid,
    '99cbf95a-9e9f-4bc0-afd8-6d1343f11079'::uuid,
    '0fa23f92-0b70-4d8b-ac2d-2b2b9340214c'::uuid,
    '441cca7b-2f48-4976-af94-1dd0ebf3d7f0'::uuid,
    '6fda8950-9d1b-4f97-99b2-e45131df76a3'::uuid,
    'f1cd7351-dbe3-41c6-891e-57cefa7e54ad'::uuid
  ]);
--> statement-breakpoint

COMMIT;
