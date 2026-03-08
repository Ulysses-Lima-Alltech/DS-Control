ALTER TABLE "plots" ADD COLUMN "external_id" text;
UPDATE "plots" SET "external_id" = "id";
ALTER TABLE "plots" ALTER COLUMN "external_id" SET NOT NULL;