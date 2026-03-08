-- Custom SQL migration file, put your code below! --

UPDATE applications a
SET farm_id = p.farm_id
FROM plots p
WHERE a.plot_id = p.id
  AND a.farm_id IS NULL;
