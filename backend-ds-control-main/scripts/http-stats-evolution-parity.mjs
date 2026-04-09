/**
 * Prova HTTP: GET /v1/applications/stats e /stats/evolution (Bearer JWT).
 *
 * Uso (com API local e ACCESS_TOKEN_SECRET igual à do servidor):
 *   node scripts/http-stats-evolution-parity.mjs
 *
 * Variáveis opcionais: API_BASE (default http://127.0.0.1:3099), ACCESS_TOKEN_SECRET, START, END
 */
import { SignJWT } from "jose";
import { exit } from "node:process";

const BASE = process.env.API_BASE || "http://127.0.0.1:3099";
const SECRET = process.env.ACCESS_TOKEN_SECRET || "parity-http-test-secret";
const START = process.env.START || "2026-03-20";
const END = process.env.END || "2026-03-20";

async function makeToken() {
  return new SignJWT({
    userId: "11111111-1111-1111-1111-111111111111",
    email: "parity@test.local",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(SECRET));
}

function mergeChart(bucketKeys, evolution) {
  const by = new Map();
  for (const item of evolution) {
    const k = (item.date || "").slice(0, 10);
    if (k.length === 10) by.set(k, Number(item.applicationsCount || 0));
  }
  return bucketKeys.map((name) => ({ name, value: by.get(name) ?? 0 }));
}

const token = await makeToken();
const auth = { Authorization: `Bearer ${token}` };

const qStats = new URLSearchParams({ startDate: START, endDate: END });
const qEv = new URLSearchParams({
  startDate: START,
  endDate: END,
  granularity: "day",
  months: "1",
});

const urlStats = `${BASE}/v1/applications/stats?${qStats}`;
const urlEv = `${BASE}/v1/applications/stats/evolution?${qEv}`;

const [resStats, resEv] = await Promise.all([
  fetch(urlStats, { headers: auth }),
  fetch(urlEv, { headers: auth }),
]);

const bodyStats = await resStats.json();
const bodyEv = await resEv.json();

if (!resStats.ok || !resEv.ok) {
  console.error(
    JSON.stringify(
      {
        error: "HTTP error",
        statsStatus: resStats.status,
        evolutionStatus: resEv.status,
        bodyStats,
        bodyEv,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const applicationCount = bodyStats.stats?.applicationCount;
const evolution = bodyEv.evolution ?? [];
const bucketKeys = [START];
const chartData = mergeChart(bucketKeys, evolution);
const chartValue = chartData[0]?.value;
const evoBucket = evolution.find((r) => (r.date || "").startsWith(START));

const ok =
  typeof applicationCount === "number" &&
  evoBucket &&
  applicationCount === evoBucket.applicationsCount &&
  chartValue === applicationCount;

console.log(
  JSON.stringify(
    {
      scenario: { startDate: START, endDate: END, granularity: "day", months: 1 },
      requestStats: `GET ${urlStats}`,
      requestEvolution: `GET ${urlEv}`,
      responseStatsSummary: {
        applicationCount,
        message: bodyStats.message,
      },
      responseEvolutionSummary: evolution,
      bucketMatchingStartDate: evoBucket,
      chartDataForPeriod: chartData,
      parityOk: ok,
    },
    null,
    2,
  ),
);

/** Evita assert do libuv no encerramento do fetch nativo no Windows. */
setTimeout(() => exit(ok ? 0 : 1), 10);
