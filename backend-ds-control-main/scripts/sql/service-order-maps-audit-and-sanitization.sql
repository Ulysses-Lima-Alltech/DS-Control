-- IControl - Auditoria e saneamento de dados de mapas de OS
-- Banco alvo: PostgreSQL
-- Objetivo:
-- A) Relatorio de vinculos service_order_plots com plots soft-deleted
-- B) Relatorio por OS com quantidade de plots deletados vinculados
-- C) Relatorio de aplicacoes com farmId/plotId fora da OS
-- D) Comandos de correcao comentados
-- E) Dry-run/select antes de qualquer update/delete
--
-- IMPORTANTE:
-- 1) Rode primeiro em homologacao
-- 2) Execute backup antes de qualquer correcao
-- 3) Revise os resultados com o time funcional

-- ============================================================
-- E) DRY-RUN BASE (CTEs reutilizaveis)
-- ============================================================
WITH active_service_order_plots AS (
  SELECT
    sop.service_order_id,
    sop.plot_id,
    p.farm_id
  FROM service_order_plots sop
  INNER JOIN plots p ON p.id = sop.plot_id
  WHERE p.deleted_at IS NULL
),
service_order_farm_scope AS (
  SELECT
    sof.service_order_id,
    sof.farm_id
  FROM service_order_farms sof
),
invalid_applications AS (
  SELECT
    a.id AS application_id,
    a.service_order_id,
    so.number AS service_order_number,
    a.farm_id AS application_farm_id,
    f.name AS application_farm_name,
    a.plot_id AS application_plot_id,
    p.name AS application_plot_name,
    p.deleted_at AS application_plot_deleted_at,
    CASE
      WHEN a.farm_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM service_order_farm_scope sfs
         WHERE sfs.service_order_id = a.service_order_id
           AND sfs.farm_id = a.farm_id
       ) THEN TRUE
      ELSE FALSE
    END AS farm_outside_service_order,
    CASE
      WHEN a.plot_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM active_service_order_plots asop
         WHERE asop.service_order_id = a.service_order_id
           AND asop.plot_id = a.plot_id
       ) THEN TRUE
      ELSE FALSE
    END AS plot_outside_service_order
  FROM applications a
  LEFT JOIN service_orders so ON so.id = a.service_order_id
  LEFT JOIN farms f ON f.id = a.farm_id
  LEFT JOIN plots p ON p.id = a.plot_id
  WHERE a.deleted_at IS NULL
    AND a.service_order_id IS NOT NULL
)
SELECT
  COUNT(*) AS total_invalid_applications
FROM invalid_applications
WHERE farm_outside_service_order = TRUE
   OR plot_outside_service_order = TRUE;

-- ============================================================
-- A) Vinculos service_order_plots com plots soft-deleted
-- ============================================================
SELECT
  sop.service_order_id,
  so.number AS service_order_number,
  sop.plot_id,
  p.name AS plot_name,
  p.farm_id,
  f.name AS farm_name,
  p.deleted_at AS plot_deleted_at
FROM service_order_plots sop
INNER JOIN plots p ON p.id = sop.plot_id
LEFT JOIN service_orders so ON so.id = sop.service_order_id
LEFT JOIN farms f ON f.id = p.farm_id
WHERE p.deleted_at IS NOT NULL
ORDER BY so.number NULLS LAST, p.deleted_at DESC;

-- ============================================================
-- B) Quantidade de plots deletados vinculados por OS
-- ============================================================
SELECT
  sop.service_order_id,
  so.number AS service_order_number,
  COUNT(*) AS deleted_plots_linked
FROM service_order_plots sop
INNER JOIN plots p ON p.id = sop.plot_id
LEFT JOIN service_orders so ON so.id = sop.service_order_id
WHERE p.deleted_at IS NOT NULL
GROUP BY sop.service_order_id, so.number
ORDER BY deleted_plots_linked DESC, so.number;

-- ============================================================
-- C) Aplicacoes cujo farmId/plotId nao pertence a OS
-- ============================================================
WITH active_service_order_plots AS (
  SELECT
    sop.service_order_id,
    sop.plot_id,
    p.farm_id
  FROM service_order_plots sop
  INNER JOIN plots p ON p.id = sop.plot_id
  WHERE p.deleted_at IS NULL
),
service_order_farm_scope AS (
  SELECT
    sof.service_order_id,
    sof.farm_id
  FROM service_order_farms sof
)
SELECT
  a.id AS application_id,
  a.service_order_id,
  so.number AS service_order_number,
  a.farm_id AS application_farm_id,
  f.name AS application_farm_name,
  a.plot_id AS application_plot_id,
  p.name AS application_plot_name,
  p.deleted_at AS application_plot_deleted_at,
  CASE
    WHEN a.farm_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM service_order_farm_scope sfs
       WHERE sfs.service_order_id = a.service_order_id
         AND sfs.farm_id = a.farm_id
     ) THEN TRUE
    ELSE FALSE
  END AS farm_outside_service_order,
  CASE
    WHEN a.plot_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM active_service_order_plots asop
       WHERE asop.service_order_id = a.service_order_id
         AND asop.plot_id = a.plot_id
     ) THEN TRUE
    ELSE FALSE
  END AS plot_outside_service_order
FROM applications a
LEFT JOIN service_orders so ON so.id = a.service_order_id
LEFT JOIN farms f ON f.id = a.farm_id
LEFT JOIN plots p ON p.id = a.plot_id
WHERE a.deleted_at IS NULL
  AND a.service_order_id IS NOT NULL
  AND (
    (a.farm_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM service_order_farm_scope sfs
      WHERE sfs.service_order_id = a.service_order_id
        AND sfs.farm_id = a.farm_id
    ))
    OR
    (a.plot_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM active_service_order_plots asop
      WHERE asop.service_order_id = a.service_order_id
        AND asop.plot_id = a.plot_id
    ))
  )
ORDER BY so.number NULLS LAST, a.id;

-- ============================================================
-- D) EXECUTAR SOMENTE APOS BACKUP
-- ============================================================
-- 1) Remover vinculos de plots soft-deleted da tabela service_order_plots
-- BEGIN;
-- DELETE FROM service_order_plots sop
-- USING plots p
-- WHERE p.id = sop.plot_id
--   AND p.deleted_at IS NOT NULL;
-- COMMIT;

-- 2) Opcional: neutralizar aplicacoes fora do escopo da OS (nao remove aplicacao)
--    Estrategia conservadora: limpar farm_id/plot_id invalidos para forcar tratamento manual.
-- BEGIN;
-- WITH active_service_order_plots AS (
--   SELECT sop.service_order_id, sop.plot_id
--   FROM service_order_plots sop
--   INNER JOIN plots p ON p.id = sop.plot_id
--   WHERE p.deleted_at IS NULL
-- ),
-- service_order_farm_scope AS (
--   SELECT sof.service_order_id, sof.farm_id
--   FROM service_order_farms sof
-- ),
-- targets AS (
--   SELECT
--     a.id,
--     CASE
--       WHEN a.farm_id IS NOT NULL
--        AND NOT EXISTS (
--          SELECT 1 FROM service_order_farm_scope sfs
--          WHERE sfs.service_order_id = a.service_order_id
--            AND sfs.farm_id = a.farm_id
--        ) THEN TRUE
--       ELSE FALSE
--     END AS bad_farm,
--     CASE
--       WHEN a.plot_id IS NOT NULL
--        AND NOT EXISTS (
--          SELECT 1 FROM active_service_order_plots asop
--          WHERE asop.service_order_id = a.service_order_id
--            AND asop.plot_id = a.plot_id
--        ) THEN TRUE
--       ELSE FALSE
--     END AS bad_plot
--   FROM applications a
--   WHERE a.deleted_at IS NULL
--     AND a.service_order_id IS NOT NULL
-- )
-- UPDATE applications a
-- SET
--   farm_id = CASE WHEN t.bad_farm THEN NULL ELSE a.farm_id END,
--   plot_id = CASE WHEN t.bad_plot THEN NULL ELSE a.plot_id END,
--   updated_at = NOW()
-- FROM targets t
-- WHERE a.id = t.id
--   AND (t.bad_farm OR t.bad_plot);
-- COMMIT;

-- 3) Dry-run das linhas que seriam alteradas no passo 2
-- WITH active_service_order_plots AS (
--   SELECT sop.service_order_id, sop.plot_id
--   FROM service_order_plots sop
--   INNER JOIN plots p ON p.id = sop.plot_id
--   WHERE p.deleted_at IS NULL
-- ),
-- service_order_farm_scope AS (
--   SELECT sof.service_order_id, sof.farm_id
--   FROM service_order_farms sof
-- )
-- SELECT
--   a.id AS application_id,
--   a.service_order_id,
--   a.farm_id,
--   a.plot_id
-- FROM applications a
-- WHERE a.deleted_at IS NULL
--   AND a.service_order_id IS NOT NULL
--   AND (
--     (a.farm_id IS NOT NULL AND NOT EXISTS (
--       SELECT 1 FROM service_order_farm_scope sfs
--       WHERE sfs.service_order_id = a.service_order_id
--         AND sfs.farm_id = a.farm_id
--     ))
--     OR
--     (a.plot_id IS NOT NULL AND NOT EXISTS (
--       SELECT 1 FROM active_service_order_plots asop
--       WHERE asop.service_order_id = a.service_order_id
--         AND asop.plot_id = a.plot_id
--     ))
--   )
-- ORDER BY a.service_order_id, a.id;
