ALTER TABLE "service_orders"
  ALTER COLUMN "planned_date" TYPE date
  USING "planned_date"::date;
