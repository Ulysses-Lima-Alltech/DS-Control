const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DEFAULT_OS_ID = "134";
const DEFAULT_OS_UUID = "6609d7f5-1279-4005-9c0e-91055159af49";
const DEFAULT_OS_URL =
  "https://dscontrol.dstechbrasil.com.br/dashboard/service-orders/6609d7f5-1279-4005-9c0e-91055159af49";
const DEFAULT_API_BASE = "https://control.dstechbrasil.com.br/v1";
const MANUAL_LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;

  return value;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function extractUuid(value) {
  const match = String(value || "").match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return match ? match[0] : "";
}

function normalizeBaseUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return withProtocol.replace(/\/+$/, "");
}

const OS_ID = getArg("--os-id", DEFAULT_OS_ID);
const OS_URL = getArg("--os-url", DEFAULT_OS_URL);
const OS_UUID =
  getArg("--service-order-id", "") || extractUuid(OS_URL) || DEFAULT_OS_UUID;
const HEADLESS = !hasFlag("--headed");
const API_BASE_ARG = normalizeBaseUrl(getArg("--api-base", ""));

const OUTPUT_ROOT = path.resolve(__dirname, "downloads-dji", `os-${OS_ID}-v2`);
const OUTPUT_JSON_PATH = path.join(
  OUTPUT_ROOT,
  `os_${OS_ID}_aplicacoes_v2.json`,
);
const OUTPUT_CSV_PATH = path.join(
  OUTPUT_ROOT,
  `os_${OS_ID}_aplicacoes_v2.csv`,
);
const DS_PROFILE_DIR = path.resolve(__dirname, ".chrome-dscontrol-profile");

const TOKEN_STORAGE_KEYS = [
  "accessToken",
  "token",
  "authToken",
  "access_token",
  "dscontrol-token",
  "ds-control-access-token",
  "user",
  "auth",
  "persist:auth",
];

const ENDPOINT_BUILDERS = [
  (baseUrl) =>
    `${baseUrl}/applications/service-order/${OS_UUID}?page=1&limit=1000`,
  (baseUrl) =>
    `${baseUrl}/applications?serviceOrderId=${OS_UUID}&page=1&limit=1000`,
];

function ensureDirs() {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function compactKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const match = String(value ?? "")
    .trim()
    .match(/-?\d+(?:[.,]\d+)*/);

  if (!match) return null;

  let numericText = match[0];
  const lastDot = numericText.lastIndexOf(".");
  const lastComma = numericText.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? "." : ",";
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    numericText = numericText
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (lastComma !== -1) {
    numericText = numericText.replace(",", ".");
  } else if ((numericText.match(/\./g) || []).length > 1) {
    const parts = numericText.split(".");
    const decimalPart = parts.pop();
    numericText = `${parts.join("")}.${decimalPart}`;
  }

  const parsed = Number.parseFloat(numericText);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function stripBearer(value) {
  return String(value || "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function looksLikeJwt(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
    stripBearer(value),
  );
}

function isLikelyToken(value, keyPath = "") {
  const token = stripBearer(value);
  const normalizedKeyPath = compactKey(keyPath);

  if (!token || /\s/.test(token)) return false;
  if (looksLikeJwt(token)) return true;

  const keySuggestsToken =
    normalizedKeyPath.includes("token") ||
    normalizedKeyPath.includes("authorization");

  if (keySuggestsToken && token.length >= 24) return true;

  return token.length >= 80 && /^[A-Za-z0-9._~+/=-]+$/.test(token);
}

function tryParseJson(value) {
  if (typeof value !== "string") return null;

  const text = value.trim();
  if (!text) return null;
  if (!/^[{["]/.test(text)) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tokenScore(candidate) {
  const keyPath = compactKey(candidate.keyPath);
  let score = 0;

  if (looksLikeJwt(candidate.token)) score += 100;
  if (keyPath.includes("accesstoken") || keyPath.includes("access_token")) {
    score += 60;
  }
  if (keyPath.includes("authtoken")) score += 50;
  if (keyPath.includes("token")) score += 35;
  if (keyPath.includes("refresh")) score -= 70;
  if (candidate.source === "localStorage") score += 12;
  if (candidate.source === "sessionStorage") score += 10;
  if (candidate.source === "cookie") score += 5;
  score += Math.min(stripBearer(candidate.token).length / 20, 20);

  return score;
}

function collectTokenCandidatesFromValue(value, context, candidates, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return;

  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== null) {
      collectTokenCandidatesFromValue(parsed, context, candidates, depth + 1);
    }

    if (isLikelyToken(value, context.keyPath)) {
      candidates.push({
        token: stripBearer(value),
        source: context.source,
        keyPath: context.keyPath,
      });
    }
    return;
  }

  if (typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    collectTokenCandidatesFromValue(
      nestedValue,
      {
        source: context.source,
        keyPath: `${context.keyPath}.${key}`,
      },
      candidates,
      depth + 1,
    );
  }
}

async function readBrowserAuthState(page, context) {
  const storage = await page
    .evaluate((storageKeys) => {
      function readStorage(kind, storageObject) {
        const entries = [];
        for (let index = 0; index < storageObject.length; index++) {
          const key = storageObject.key(index);
          entries.push({
            key,
            value: storageObject.getItem(key),
            common: storageKeys.some(
              (storageKey) =>
                storageKey.toLowerCase() === String(key || "").toLowerCase(),
            ),
          });
        }
        return entries.map((entry) => ({ ...entry, storage: kind }));
      }

      return {
        url: window.location.href,
        localStorage: readStorage("localStorage", window.localStorage),
        sessionStorage: readStorage("sessionStorage", window.sessionStorage),
      };
    }, TOKEN_STORAGE_KEYS)
    .catch(() => ({
      url: "",
      localStorage: [],
      sessionStorage: [],
    }));

  const cookies = await context.cookies().catch(() => []);

  return {
    ...storage,
    cookies,
  };
}

function extractTokenFromAuthState(authState) {
  const candidates = [];

  for (const entry of authState.localStorage || []) {
    collectTokenCandidatesFromValue(
      entry.value,
      {
        source: "localStorage",
        keyPath: entry.key,
      },
      candidates,
    );
  }

  for (const entry of authState.sessionStorage || []) {
    collectTokenCandidatesFromValue(
      entry.value,
      {
        source: "sessionStorage",
        keyPath: entry.key,
      },
      candidates,
    );
  }

  for (const cookie of authState.cookies || []) {
    collectTokenCandidatesFromValue(
      cookie.value,
      {
        source: "cookie",
        keyPath: cookie.name,
      },
      candidates,
    );
  }

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const token = stripBearer(candidate.token);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    deduped.push({ ...candidate, token, score: tokenScore(candidate) });
  }

  deduped.sort((a, b) => b.score - a.score);
  return deduped[0] || null;
}

async function launchDsControlContext({ headed }) {
  const profileExists = fs.existsSync(DS_PROFILE_DIR);
  const headless = headed ? false : HEADLESS && profileExists;

  fs.mkdirSync(DS_PROFILE_DIR, { recursive: true });

  console.log(
    `[INFO] Abrindo DS Control com perfil persistente: ${DS_PROFILE_DIR}`,
  );
  console.log(`[INFO] Browser headed: ${!headless}`);

  const context = await chromium.launchPersistentContext(DS_PROFILE_DIR, {
    channel: "chrome",
    headless,
    viewport: { width: 1440, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--window-size=1440,900",
    ],
  });
  const page = context.pages()[0] || (await context.newPage());

  return {
    context,
    page,
    headless,
  };
}

async function openServiceOrder(page) {
  console.log(`[INFO] Abrindo OS: ${OS_URL}`);
  await page.goto(OS_URL, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(2500);
}

async function findTokenInCurrentSession(page, context) {
  const authState = await readBrowserAuthState(page, context);
  const tokenInfo = extractTokenFromAuthState(authState);

  if (tokenInfo) {
    console.log(
      `[OK] Token encontrado em ${tokenInfo.source}:${tokenInfo.keyPath}`,
    );
  }

  return tokenInfo;
}

async function waitForManualLogin(page, context) {
  console.log("");
  console.log("[LOGIN] Sessao logada nao encontrada.");
  console.log("[LOGIN] Uma janela do Chrome foi aberta para login manual.");
  console.log("[LOGIN] Faca login no DS Control e abra/permaneca na OS.");
  console.log("[LOGIN] O script continuara automaticamente ao encontrar token.");
  console.log("");

  const startedAt = Date.now();
  while (Date.now() - startedAt < MANUAL_LOGIN_TIMEOUT_MS) {
    await page.waitForTimeout(2000);

    const tokenInfo = await findTokenInCurrentSession(page, context);
    if (tokenInfo) return tokenInfo;
  }

  throw new Error(
    "Token nao encontrado apos aguardar login manual no DS Control.",
  );
}

async function getTokenWithLoginFlow({ forceHeaded = false } = {}) {
  let browserState = await launchDsControlContext({ headed: forceHeaded });
  await openServiceOrder(browserState.page);

  let tokenInfo = await findTokenInCurrentSession(
    browserState.page,
    browserState.context,
  );

  if (tokenInfo) return { ...browserState, tokenInfo };

  if (browserState.headless) {
    await browserState.context.close();
    browserState = await launchDsControlContext({ headed: true });
    await openServiceOrder(browserState.page);
  }

  tokenInfo = await waitForManualLogin(
    browserState.page,
    browserState.context,
  );

  return { ...browserState, tokenInfo };
}

function getApiBaseCandidates() {
  return unique([API_BASE_ARG, DEFAULT_API_BASE].map(normalizeBaseUrl));
}

async function fetchJson(url, token) {
  if (typeof fetch !== "function") {
    throw new Error("Este script precisa de Node.js com fetch global.");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
    text: body ? "" : text.slice(0, 1000),
  };
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.applications)) return payload.applications;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.docs)) return payload.docs;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.applications)) {
    return payload.data.applications;
  }
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.docs)) return payload.data.docs;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  return null;
}

async function fetchApplicationsWithToken(token) {
  const attempts = [];
  const successfulEmpty = [];

  for (const baseUrl of getApiBaseCandidates()) {
    for (const buildEndpoint of ENDPOINT_BUILDERS) {
      const url = buildEndpoint(baseUrl);
      console.log(`[API] GET ${url}`);

      const response = await fetchJson(url, token).catch((error) => ({
        ok: false,
        status: 0,
        statusText: error.message,
        body: null,
        text: error.message,
      }));

      const applications = response.ok ? asArray(response.body) : null;
      attempts.push({
        url,
        status: response.status,
        ok: response.ok,
        count: Array.isArray(applications) ? applications.length : null,
        message:
          response.body?.message ||
          response.body?.error ||
          response.text ||
          response.statusText ||
          "",
      });

      if (!response.ok) continue;

      if (Array.isArray(applications) && applications.length > 0) {
        return {
          applications,
          sourceUrl: url,
          attempts,
        };
      }

      if (Array.isArray(applications)) {
        successfulEmpty.push({
          applications,
          sourceUrl: url,
          attempts: attempts.slice(),
        });
      }
    }
  }

  if (successfulEmpty.length) return successfulEmpty[0];

  const summary = attempts
    .map(
      (attempt) =>
        `${attempt.status || "ERR"} ${attempt.url} ${attempt.message || ""}`,
    )
    .join("\n");
  const authFailed = attempts.some(
    (attempt) => attempt.status === 401 || attempt.status === 403,
  );
  const error = new Error(`Nenhum endpoint retornou aplicacoes.\n${summary}`);
  error.authFailed = authFailed;
  error.attempts = attempts;
  throw error;
}

function relationText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return normalizeText(value);

  const direct = [
    value.name,
    value.fullName,
    value.displayName,
    value.label,
    value.title,
    value.code,
    value.description,
    value.number,
  ]
    .map(normalizeText)
    .find(Boolean);

  if (direct) return direct;

  return "";
}

function findDeepValue(source, keys, options = {}) {
  const wanted = new Set(keys.map(compactKey));
  const stack = [{ value: source, depth: 0 }];
  const seen = new Set();

  while (stack.length) {
    const { value, depth } = stack.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);

    for (const [key, nestedValue] of Object.entries(value)) {
      if (wanted.has(compactKey(key))) {
        const text = relationText(nestedValue);
        if (text) return text;
        if (
          nestedValue !== null &&
          nestedValue !== undefined &&
          typeof nestedValue !== "object"
        ) {
          return normalizeText(nestedValue);
        }
      }
    }

    if (depth >= (options.maxDepth ?? 5)) continue;

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === "object") {
        stack.push({ value: nestedValue, depth: depth + 1 });
      }
    }
  }

  return "";
}

function pickDeepNumber(source, keys) {
  const wanted = new Set(keys.map(compactKey));
  const stack = [{ value: source, depth: 0 }];
  const seen = new Set();

  while (stack.length) {
    const { value, depth } = stack.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);

    for (const [key, nestedValue] of Object.entries(value)) {
      if (!wanted.has(compactKey(key))) continue;

      const parsed = parseNumber(
        typeof nestedValue === "object" ? relationText(nestedValue) : nestedValue,
      );
      if (parsed !== null) return parsed;
    }

    if (depth >= 5) continue;
    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === "object") {
        stack.push({ value: nestedValue, depth: depth + 1 });
      }
    }
  }

  return null;
}

function normalizeDate(value) {
  const text = normalizeText(value);
  if (!text) return "";

  let match = text.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return text;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : text;
}

function normalizeApplication(application, index) {
  const serviceOrder = application?.serviceOrder || application?.order || {};
  const plotObject = application?.plot || application?.field || {};

  const applicationId =
    findDeepValue(application, ["applicationId", "id", "uuid", "_id"], {
      maxDepth: 2,
    }) || `application-${index + 1}`;
  const serviceOrderId =
    relationText(application?.serviceOrderId) ||
    relationText(serviceOrder?.id) ||
    relationText(serviceOrder?.uuid) ||
    OS_UUID;
  const osNumber =
    relationText(serviceOrder?.number) ||
    relationText(serviceOrder?.osNumber) ||
    findDeepValue(application, [
      "osNumber",
      "serviceOrderNumber",
      "orderNumber",
    ]) ||
    OS_ID;
  const date =
    normalizeDate(
      findDeepValue(application, [
        "date",
        "applicationDate",
        "dataAplicacao",
        "appliedAt",
        "startedAt",
        "startDate",
      ]) || application?.date,
    ) || "";
  const plot =
    relationText(plotObject) ||
    findDeepValue(application, [
      "plot",
      "plotCode",
      "field",
      "fieldName",
      "areaName",
      "talhao",
      "talhaoCode",
    ]);
  const farm =
    relationText(application?.farm) ||
    relationText(plotObject?.farm) ||
    findDeepValue(application, [
      "farm",
      "farmName",
      "fazenda",
      "property",
      "propertyName",
    ]);
  const pilot =
    relationText(application?.pilot) ||
    findDeepValue(application, ["pilot", "pilotName", "operator", "applicator"]);
  const drone =
    relationText(application?.drone) ||
    findDeepValue(application, [
      "drone",
      "droneName",
      "aircraft",
      "equipment",
    ]);
  const areaHa = pickDeepNumber(application, [
    "area",
    "areaHa",
    "hectares",
    "appliedArea",
  ]);
  const status =
    relationText(application?.status) ||
    findDeepValue(application, ["status", "situation"]);

  return {
    applicationId: normalizeText(applicationId),
    serviceOrderId: normalizeText(serviceOrderId),
    osNumber: normalizeText(osNumber),
    date,
    plot: normalizeText(plot),
    farm: normalizeText(farm),
    pilot: normalizeText(pilot),
    drone: normalizeText(drone),
    areaHa,
    status: normalizeText(status),
    raw: application,
  };
}

function csvEscape(value) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function saveJson(applications) {
  fs.writeFileSync(
    OUTPUT_JSON_PATH,
    `${JSON.stringify(applications, null, 2)}\n`,
    "utf8",
  );
}

function saveCsv(applications) {
  const headers = [
    "applicationId",
    "serviceOrderId",
    "osNumber",
    "date",
    "plot",
    "farm",
    "pilot",
    "drone",
    "areaHa",
    "status",
    "raw",
  ];
  const lines = [
    headers.join(";"),
    ...applications.map((application) =>
      headers.map((header) => csvEscape(application[header])).join(";"),
    ),
  ];

  fs.writeFileSync(OUTPUT_CSV_PATH, `${lines.join("\n")}\n`, "utf8");
}

function printSummary(applications) {
  const totalHectares = applications.reduce(
    (sum, application) => sum + (Number(application.areaHa) || 0),
    0,
  );
  const dates = unique(applications.map((application) => application.date));
  const applicationsByDate = applications.reduce((acc, application) => {
    const date = application.date || "sem_data";
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  console.log("");
  console.log("[RESUMO]");
  console.log(`total aplicacoes: ${applications.length}`);
  console.log(`total hectares: ${round(totalHectares, 2)}`);
  console.log(`datas encontradas: ${dates.join(", ") || "-"}`);
  console.log("aplicacoes por data:");
  for (const [date, count] of Object.entries(applicationsByDate).sort()) {
    console.log(`  ${date}: ${count}`);
  }
}

async function main() {
  ensureDirs();

  console.log("[INFO] Extraindo aplicacoes reais da OS no DS Control");
  console.log(`[INFO] OS ID: ${OS_ID}`);
  console.log(`[INFO] OS UUID: ${OS_UUID}`);
  console.log(`[INFO] Saida: ${OUTPUT_ROOT}`);

  let browserState = await getTokenWithLoginFlow();

  try {
    let apiResult;
    try {
      apiResult = await fetchApplicationsWithToken(browserState.tokenInfo.token);
    } catch (error) {
      if (!error.authFailed) throw error;

      console.log("[WARN] Token encontrado foi recusado pela API.");
      console.log("[WARN] Reabrindo em modo headed para renovar login.");
      await browserState.context.close();
      browserState = await getTokenWithLoginFlow({ forceHeaded: true });
      apiResult = await fetchApplicationsWithToken(browserState.tokenInfo.token);
    }

    const applications = apiResult.applications.map(normalizeApplication);

    saveJson(applications);
    saveCsv(applications);

    console.log(`[OK] Fonte API: ${apiResult.sourceUrl}`);
    console.log(`[OK] JSON: ${OUTPUT_JSON_PATH}`);
    console.log(`[OK] CSV: ${OUTPUT_CSV_PATH}`);
    printSummary(applications);
  } finally {
    await browserState.context.close();
  }
}

main().catch((error) => {
  console.error("[ERRO]", error.message);
  process.exit(1);
});
