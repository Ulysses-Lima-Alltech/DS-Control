ALTER TABLE "farms"
  ADD CONSTRAINT "farms_map_color_format_check"
  CHECK ("map_color" ~ '^#[0-9A-Fa-f]{6}$') NOT VALID;

ALTER TABLE "farms"
  VALIDATE CONSTRAINT "farms_map_color_format_check";

ALTER TABLE "farms"
  ALTER COLUMN "map_color" SET NOT NULL;
