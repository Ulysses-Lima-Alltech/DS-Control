-- Custom SQL migration file, put your code below! --
UPDATE "applications"
SET 
  "flow_rate" = 20.00,
  "altitude" = 8.00,
  "route_spacing" = 7.00,
  "droplet_size" = 250.00;