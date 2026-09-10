ALTER TABLE "service_orders"
  ALTER COLUMN "planned_date" TYPE timestamp
  USING "planned_date"::timestamp;
