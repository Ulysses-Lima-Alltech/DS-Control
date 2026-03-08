-- Custom SQL migration file, put your code below! --
ALTER TABLE "applications" ALTER COLUMN "flow_rate" SET NOT NULL;
ALTER TABLE "applications" ALTER COLUMN "altitude" SET NOT NULL;
ALTER TABLE "applications" ALTER COLUMN "route_spacing" SET NOT NULL;
ALTER TABLE "applications" ALTER COLUMN "droplet_size" SET NOT NULL;