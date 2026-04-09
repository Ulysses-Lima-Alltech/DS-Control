/**
 * Prova runtime: mesmo recorte 2026-03-20..2026-03-20 — count vs evolution bucket.
 * node scripts/run-stats-evolution-parity.mjs
 */
import pg from "pg";

const client = new pg.Client({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "ds-drones",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "ds-drones",
});

const START = "2026-03-20";
const END = "2026-03-20";

await client.connect();

const statsRes = await client.query(
  `SELECT COUNT(*)::int AS application_count
   FROM applications
   WHERE deleted_at IS NULL
     AND (date)::date >= $1::date
     AND (date)::date <= $2::date`,
  [START, END],
);

/** Aproximação do filtro antigo (início UTC + fim exclusivo no dia seguinte em UTC). */
const legacyEndExcl = new Date(`${END}T00:00:00.000Z`);
legacyEndExcl.setUTCDate(legacyEndExcl.getUTCDate() + 1);
const legacyCountRes = await client.query(
  `SELECT COUNT(*)::int AS application_count
   FROM applications
   WHERE deleted_at IS NULL
     AND date >= $1::timestamptz
     AND date < $2::timestamptz`,
  [`${START}T00:00:00.000Z`, legacyEndExcl.toISOString()],
);

const evoRes = await client.query(
  `SELECT TO_CHAR(DATE(date), 'YYYY-MM-DD') AS bucket_date,
          COUNT(DISTINCT id)::int AS applications_count
   FROM applications
   WHERE deleted_at IS NULL
     AND (date)::date >= $1::date
     AND (date)::date <= $2::date
   GROUP BY DATE(date)
   ORDER BY bucket_date`,
  [START, END],
);

const statsCount = statsRes.rows[0]?.application_count;
const legacyApproxCount = legacyCountRes.rows[0]?.application_count;
const evoRow = evoRes.rows.find((r) => r.bucket_date === START);
const evoCount = evoRow ? evoRow.applications_count : null;

console.log(
  JSON.stringify(
    {
      scenario: { startDate: START, endDate: END, granularity: "day" },
      requestStats: `GET /applications/stats?startDate=${START}&endDate=${END}`,
      requestEvolution: `GET /applications/stats/evolution?startDate=${START}&endDate=${END}&granularity=day&months=1`,
      responseStatsSummary: { applicationCount: statsCount },
      legacyTimestampFilterApproxCount_note:
        "Contagem com date >= UTC start e date < UTC end (podia divergir do dia civil em timestamp sem TZ).",
      legacyTimestampFilterApproxCount: legacyApproxCount,
      responseEvolutionSummary: evoRes.rows,
      bucket20260320: { applicationsCountFromEvolution: evoCount, matchesStats: evoCount === statsCount },
      chartDataExpectedFor20260320: evoCount,
    },
    null,
    2,
  ),
);

await client.end();
process.exit(statsCount === evoCount ? 0 : 1);
