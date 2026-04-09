-- Paridade stats vs evolution (um único dia civil). Executar com:
-- docker exec -i ds-drones-database psql -U ds-drones -d ds-drones -f - < scripts/parity-verify-evolution.sql

BEGIN;

DELETE FROM applications WHERE pilot_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM drones WHERE id = '22222222-2222-2222-2222-222222222222';
DELETE FROM culture_types WHERE id = '33333333-3333-3333-3333-333333333333';
DELETE FROM products WHERE id = '44444444-4444-4444-4444-444444444444';
DELETE FROM users WHERE id = '11111111-1111-1111-1111-111111111111';

INSERT INTO users (id, name, email, password, type)
VALUES ('11111111-1111-1111-1111-111111111111', 'Pilot Parity', 'parity@test.local', 'x', 'pilot');

INSERT INTO drones (id, name, model, aircraft_rid)
VALUES ('22222222-2222-2222-2222-222222222222', 'Drone P', 'M1', 'RID-PARITY');

INSERT INTO culture_types (id, name)
VALUES ('33333333-3333-3333-3333-333333333333', 'Culture P');

INSERT INTO products (id, name)
VALUES ('44444444-4444-4444-4444-444444444444', 'Product P');

INSERT INTO applications (pilot_id, drone_id, culture_id, product_id, date, hectares, flow_rate, altitude, route_spacing, droplet_size, plot_id)
SELECT
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '2026-03-20 14:30:00'::timestamp,
  1,
  0,
  0,
  0,
  0,
  NULL
FROM generate_series(1, 6);

COMMIT;

\echo '--- stats-style count (date::date range, mesmo recorte do backend atual) ---'
SELECT COUNT(*) AS application_count
FROM applications
WHERE deleted_at IS NULL
  AND (date)::date >= '2026-03-20'::date
  AND (date)::date <= '2026-03-20'::date;

\echo '--- evolution-style bucket (DATE trunc + distinct) ---'
SELECT TO_CHAR(DATE(date), 'YYYY-MM-DD') AS bucket_date, COUNT(DISTINCT id) AS applications_count
FROM applications
WHERE deleted_at IS NULL
  AND (date)::date >= '2026-03-20'::date
  AND (date)::date <= '2026-03-20'::date
GROUP BY DATE(date)
ORDER BY bucket_date;
