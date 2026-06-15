const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const zlib = require("zlib");

const DJI_BASE_URL = "https://www.djiag.com/records";

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

const OS_ID = getArg("--os-id", "134");
const TARGET_DATE = getArg("--date", process.argv[2] || "2026/05/20");
const FILTER_START_DATE = getArg("--start", TARGET_DATE);
const FILTER_END_DATE = getArg("--end", TARGET_DATE);
const HEADLESS = !hasFlag("--headed");
const CAPTURE_IMAGES = !hasFlag("--no-images");
const LIMIT = Number.parseInt(getArg("--limit", "0"), 10) || 0;
const CAPTURE_MODE = getArg("--capture-mode", "map-crop").toLowerCase();
const DEBUG_CAPTURE = hasFlag("--debug-capture");
const CLEAN_EXISTING = hasFlag("--clean-existing");
const EXPECTED_FLIGHTS_ARG = parseNumber(getArg("--expected-flights", ""));
const EXPECTED_AREA_HA_ARG = parseNumber(getArg("--expected-area-ha", ""));
const EXPECTED_PAYLOAD_L_ARG = parseNumber(getArg("--expected-payload-l", ""));
const DJI_USERNAME = getArg("--username", process.env.DJI_USERNAME || "");
const DJI_PASSWORD = getArg("--password", process.env.DJI_PASSWORD || "");

const OUTPUT_ROOT = path.resolve(__dirname, "downloads-dji", `os-${OS_ID}-v2`);
const APPLICATION_IMAGE_DIR = path.join(
  OUTPUT_ROOT,
  "dji-application-images",
  dateToFilePart(TARGET_DATE),
);
const USER_DATA_DIR = path.resolve(__dirname, ".chrome-dji-profile");
const NAVIGATION_TEXT_REGEX =
  /Cloud Reconstruction|Task History|Field Management|Device Management|Settings/i;
const STRICT_TIME_RANGE_REGEX = /\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2}/;
const STRICT_ROW_REGEX =
  /(?<timeRange>\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2})\s+(?<area>[0-9]+(?:[,.][0-9]+)?)\s*ha\s+(?<payload>[0-9]+(?:[,.][0-9]+)?)\s*L\b/i;
const VALID_CAPTURE_MODES = new Set([
  "auto",
  "official",
  "map-only",
  "map-crop",
  "map-crop-centered",
]);

if (!VALID_CAPTURE_MODES.has(CAPTURE_MODE)) {
  throw new Error(
    `--capture-mode invalido: ${CAPTURE_MODE}. Use auto, official, map-only, map-crop ou map-crop-centered.`,
  );
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (match) return `${match[1]}/${match[2]}/${match[3]}`;

  match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  return text.replace(/-/g, "/");
}

function dateToFilePart(value) {
  return normalizeDate(value).replace(/\//g, "_");
}

function normalizeDateToQuery(value) {
  return normalizeDate(value).replace(/\//g, "-");
}

function buildRecordsUrl() {
  const startDate = normalizeDateToQuery(FILTER_START_DATE);
  const endDate = normalizeDateToQuery(FILTER_END_DATE);
  return `${DJI_BASE_URL}?start_date=${startDate}&end_date=${endDate}`;
}

function safeFileName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 140);
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
}

function parseNumber(value) {
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

function splitTimeRange(value) {
  const match = String(value || "").match(
    /(\d{2}:\d{2}(?::\d{2})?)\s*[-~]\s*(\d{2}:\d{2}(?::\d{2})?)/,
  );

  if (!match) return { timeRange: null, startTime: null, endTime: null };

  return {
    timeRange: `${match[1]}-${match[2]}`,
    startTime: match[1],
    endTime: match[2],
  };
}

function parseDayCardSummary(text) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  const areaMatch = normalized.match(/([0-9]+(?:[,.][0-9]+)?)\s*(?:ha|mu)\b/i);
  const flightsMatch = normalized.match(/(\d+)\s*times\b/i);
  const payloadMatch = normalized.match(/([0-9]+(?:[,.][0-9]+)?)\s*L\b/i);
  const durationMatch = normalized.match(
    /(\d+\s*Hour\d+\s*min\d+\s*s|\d+\s*Hour\d+\s*min|\d+\s*min\d+\s*s)/i,
  );

  return {
    expectedFlightsFromDayCard:
      EXPECTED_FLIGHTS_ARG ?? parseNumber(flightsMatch?.[1]),
    expectedAreaHaFromDayCard:
      EXPECTED_AREA_HA_ARG ?? parseNumber(areaMatch?.[1]),
    expectedPayloadLFromDayCard:
      EXPECTED_PAYLOAD_L_ARG ?? parseNumber(payloadMatch?.[1]),
    expectedDurationFromDayCard: durationMatch
      ? durationMatch[1].replace(/\s+/g, "")
      : null,
    rawDayCardText: normalized || null,
  };
}

function parseDaySummaryForDate(text, djiDate = TARGET_DATE) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  const dateText = normalizeDate(djiDate);
  const escapedDate = dateText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dateSummaryRegex = new RegExp(
    `${escapedDate}\\s*[A-Za-z]+\\s+Agriculture\\s+([0-9]+(?:[,.][0-9]+)?)\\s*(?:ha|mu)\\s+(\\d+)\\s*times\\s+([0-9]+(?:[,.][0-9]+)?)\\s*L\\s*-\\s*([^\\n\\r]+?)(?=\\s+\\d{4}/\\d{2}/\\d{2}|\\s+Collapse|\\s+\\d{2}:\\d{2}:\\d{2}|$)`,
    "i",
  );
  const match = normalized.match(dateSummaryRegex);

  if (!match) {
    return parseDayCardSummary(normalized);
  }

  return {
    expectedFlightsFromDayCard: EXPECTED_FLIGHTS_ARG ?? parseNumber(match[2]),
    expectedAreaHaFromDayCard: EXPECTED_AREA_HA_ARG ?? parseNumber(match[1]),
    expectedPayloadLFromDayCard:
      EXPECTED_PAYLOAD_L_ARG ?? parseNumber(match[3]),
    expectedDurationFromDayCard: match[4].replace(/\s+/g, ""),
    rawDayCardText: match[0],
  };
}

function inferExpectedSummaryFromInventory(inventory) {
  const sourceText = [
    inventory.rawDayCardText,
    ...(inventory.flights || []).flatMap((flight) => [
      flight.rawRowText || "",
      flight.rawDetailsText || "",
    ]),
  ].join("\n");

  const inferred = parseDaySummaryForDate(
    sourceText,
    inventory.djiDate || TARGET_DATE,
  );

  return {
    expectedFlightsFromDayCard:
      inventory.expectedFlightsFromDayCard ??
      inferred.expectedFlightsFromDayCard,
    expectedAreaHaFromDayCard:
      inventory.expectedAreaHaFromDayCard ?? inferred.expectedAreaHaFromDayCard,
    expectedPayloadLFromDayCard:
      inventory.expectedPayloadLFromDayCard ??
      inferred.expectedPayloadLFromDayCard,
    expectedDurationFromDayCard:
      inventory.expectedDurationFromDayCard ??
      inferred.expectedDurationFromDayCard,
    rawDayCardText: inventory.rawDayCardText ?? inferred.rawDayCardText,
  };
}

function percent(actual, expected) {
  if (!expected || expected <= 0) return null;
  return Number(((actual / expected) * 100).toFixed(1));
}

async function waitVisible(locator, timeout = 2500) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

async function pageText(page) {
  try {
    return await page.locator("body").innerText({ timeout: 5000 });
  } catch {
    return "";
  }
}

async function saveDebug(page, label) {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  const pngPath = path.join(
    OUTPUT_ROOT,
    `debug_${safeFileName(label)}_${timestamp()}.png`,
  );
  const txtPath = path.join(
    OUTPUT_ROOT,
    `debug_${safeFileName(label)}_${timestamp()}.txt`,
  );

  await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});
  fs.writeFileSync(txtPath, await pageText(page), "utf8");

  console.log(`[DEBUG] Screenshot: ${pngPath}`);
  console.log(`[DEBUG] Texto: ${txtPath}`);
}

async function isRecordsPageLoaded(page) {
  const text = await pageText(page);
  const hasMenu =
    /Task History|Field Management|Device Management|Cloud Reconstruction/i.test(
      text,
    );
  const hasControls = /Map|List|Filter|Screenshot/i.test(text);
  const hasAgriculture = /Agriculture/i.test(text);

  return hasMenu && (hasControls || hasAgriculture);
}

async function isLoginPage(page) {
  const text = await pageText(page);
  return /login|log in|sign in|entrar|senha|password|account|e-mail|email/i.test(
    text,
  );
}

async function findVisibleInFrames(page, selectors, timeout = 1500) {
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      try {
        const locator = frame.locator(selector).first();
        await locator.waitFor({ state: "visible", timeout });
        return locator;
      } catch {}
    }
  }

  return null;
}

async function clickTextInFrames(page, regex, label) {
  for (const frame of page.frames()) {
    const locators = [
      frame.getByRole("button", { name: regex }),
      frame.locator("button").filter({ hasText: regex }),
      frame.locator('[role="button"]').filter({ hasText: regex }),
      frame.getByText(regex),
    ];

    for (const locator of locators) {
      try {
        if (await waitVisible(locator, 1000)) {
          await locator.first().click({ timeout: 3000, force: true });
          console.log(`[OK] Clique em ${label}`);
          await page.waitForTimeout(1200);
          return true;
        }
      } catch {}
    }
  }

  return false;
}

async function dismissCookies(page) {
  return await clickTextInFrames(
    page,
    /Accept All Cookies|Reject All Cookies|Accept|Agree|Aceitar|Rejeitar|Concordo|Permitir/i,
    "banner de cookies",
  );
}

async function detectBlockingVerification(page) {
  const text = await pageText(page);
  return /captcha|verification|verify|security|two-factor|2fa|codigo|verificacao|autenticacao|security check/i.test(
    text,
  );
}

async function waitForManualLogin(page) {
  if (HEADLESS) {
    throw new Error(
      "DJI pediu login e nao ha credenciais. Rode com --headed ou informe DJI_USERNAME/DJI_PASSWORD.",
    );
  }

  console.log("");
  console.log("======================================================");
  console.log("A DJI pediu login. Faca login manualmente no Chrome.");
  console.log("Depois volte aqui no terminal e pressione ENTER.");
  console.log("======================================================");
  console.log("");

  await ask("Pressione ENTER para continuar...");
  await page
    .waitForLoadState("networkidle", { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(5000);
}

async function loginIfNeeded(page) {
  console.log("[INFO] Verificando sessao DJI...");

  await page.waitForTimeout(5000);
  await dismissCookies(page);

  if (await isRecordsPageLoaded(page)) {
    console.log("[OK] Records ja carregado.");
    return;
  }

  if (!(await isLoginPage(page))) {
    await page.goto(buildRecordsUrl(), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(8000);
    await dismissCookies(page);

    if (await isRecordsPageLoaded(page)) {
      console.log("[OK] Records carregado apos nova navegacao.");
      return;
    }
  }

  if (!(await isLoginPage(page))) {
    await saveDebug(page, "estado_desconhecido_antes_login");
    throw new Error(
      "Nao consegui identificar se a DJI esta em login ou Records.",
    );
  }

  if (!DJI_USERNAME || !DJI_PASSWORD) {
    await waitForManualLogin(page);

    if (await isRecordsPageLoaded(page)) return;

    await page.goto(buildRecordsUrl(), {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: 30000 })
      .catch(() => {});
    await page.waitForTimeout(8000);

    if (await isRecordsPageLoaded(page)) return;
    throw new Error("Login manual nao confirmou a tela Records.");
  }

  console.log("[INFO] Tentando login automatico...");

  const usernameInput = await findVisibleInFrames(
    page,
    [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[name="account"]',
      'input[placeholder*="Email" i]',
      'input[placeholder*="Account" i]',
      'input[type="text"]',
    ],
    3500,
  );

  if (!usernameInput) {
    await saveDebug(page, "login_sem_usuario");
    throw new Error("Nao encontrei campo de usuario/e-mail.");
  }

  await usernameInput.fill(DJI_USERNAME);

  let passwordInput = await findVisibleInFrames(
    page,
    [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="Password" i]',
      'input[placeholder*="Senha" i]',
    ],
    2500,
  );

  if (!passwordInput) {
    await clickTextInFrames(
      page,
      /Next|Continue|Proximo|Avancar|Continuar/i,
      "Next/Continue",
    );
    await page.waitForTimeout(3000);
    passwordInput = await findVisibleInFrames(
      page,
      ['input[type="password"]'],
      5000,
    );
  }

  if (!passwordInput) {
    await saveDebug(page, "login_sem_senha");
    throw new Error("Nao encontrei campo de senha.");
  }

  await passwordInput.fill(DJI_PASSWORD);

  const clickedLogin = await clickTextInFrames(
    page,
    /Log in|Login|Sign in|Entrar|Acessar|Submit/i,
    "botao de login",
  );

  if (!clickedLogin) {
    await passwordInput.press("Enter");
  }

  await page
    .waitForLoadState("networkidle", { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(10000);

  if (await detectBlockingVerification(page)) {
    await saveDebug(page, "login_verificacao");
    throw new Error(
      "DJI pediu captcha/codigo/verificacao. Faca login manual no perfil persistente.",
    );
  }

  await page.goto(buildRecordsUrl(), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .waitForLoadState("networkidle", { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(10000);

  if (!(await isRecordsPageLoaded(page))) {
    await saveDebug(page, "login_nao_confirmado");
    throw new Error("Login nao confirmado ou Records nao carregou.");
  }
}

async function ensureRecordsPage(page) {
  const recordsUrl = buildRecordsUrl();
  console.log(`[INFO] Abrindo Records: ${recordsUrl}`);

  await page.goto(recordsUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .waitForLoadState("networkidle", { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(8000);
  await dismissCookies(page);
  await loginIfNeeded(page);

  if (!(await isRecordsPageLoaded(page))) {
    await saveDebug(page, "records_nao_carregado");
    throw new Error("Records nao carregou corretamente.");
  }
}

async function clickMapTab(page) {
  console.log("[INFO] Selecionando aba Map...");

  const locators = [
    page.getByRole("button", { name: /^Map$/i }),
    page.getByText(/^Map$/i),
    page.locator("button").filter({ hasText: /^Map$/i }),
    page.locator("div").filter({ hasText: /^Map$/i }),
  ];

  for (const locator of locators) {
    try {
      if (await waitVisible(locator, 2000)) {
        await locator.first().click({ timeout: 4000, force: true });
        await page.waitForTimeout(2500);
        return true;
      }
    } catch {}
  }

  console.log("[WARN] Nao consegui clicar em Map. Seguindo mesmo assim.");
  return false;
}

async function findAndClickDateCard(page, targetDate) {
  console.log(`[INFO] Procurando cartao do dia: ${targetDate}`);
  const normalizedTarget = normalizeDate(targetDate).replace(/\s+/g, "");

  for (let attempt = 1; attempt <= 18; attempt++) {
    const result = await page.evaluate((normalizedTarget) => {
      function isVisible(el) {
        const style = window.getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0
        );
      }

      const candidates = Array.from(document.querySelectorAll("body *"))
        .filter(isVisible)
        .map((el) => {
          const box = el.getBoundingClientRect();
          const text = (el.innerText || el.textContent || "")
            .replace(/\s+/g, "")
            .trim();
          return { el, box, text, area: box.width * box.height };
        })
        .filter(
          (item) =>
            item.box.left < 620 &&
            item.box.width > 80 &&
            item.box.height > 20 &&
            item.text.includes(normalizedTarget),
        )
        .sort((a, b) => a.area - b.area);

      if (!candidates.length) return { ok: false };

      let target = candidates[0].el;
      for (let i = 0; i < 12 && target.parentElement; i++) {
        const box = target.getBoundingClientRect();
        const text = (target.innerText || target.textContent || "")
          .replace(/\s+/g, "")
          .trim();
        const looksLikeCard =
          box.left >= 0 &&
          box.left < 620 &&
          box.width >= 220 &&
          box.width <= 460 &&
          box.height >= 70 &&
          box.height <= 340 &&
          text.includes(normalizedTarget);

        if (looksLikeCard) break;
        target = target.parentElement;
      }

      target.scrollIntoView({ block: "center", inline: "nearest" });
      const box = target.getBoundingClientRect();

      return {
        ok: true,
        x: box.left + box.width / 2,
        y: box.top + Math.min(box.height * 0.45, 85),
        text: (target.innerText || target.textContent || "").slice(0, 500),
        box: {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          bottom: box.bottom,
        },
      };
    }, normalizedTarget);

    if (result.ok) {
      console.log("[OK] Cartao encontrado:");
      console.log(result.text.replace(/\n+/g, " | "));
      await page.mouse.click(result.x, result.y);
      await page.waitForTimeout(5000);
      return result;
    }

    await page.mouse.move(280, 500);
    await page.mouse.wheel(0, attempt === 1 ? -4000 : 750);
    await page.waitForTimeout(1500);
  }

  await saveDebug(page, `card_nao_encontrado_${targetDate}`);
  throw new Error(`Nao encontrei o cartao do dia ${targetDate}.`);
}

async function expandDateCard(page, dateCardInfo) {
  console.log("[INFO] Expandindo cartao do dia...");

  const clicked = await page.evaluate(() => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const x = Math.min(
        Math.max(box.left + box.width / 2, 0),
        window.innerWidth - 1,
      );
      const y = Math.min(
        Math.max(box.top + box.height / 2, 0),
        window.innerHeight - 1,
      );
      const elementAtPoint = document.elementFromPoint(x, y);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0.05 &&
        box.width > 0 &&
        box.height > 0 &&
        box.right > 0 &&
        box.bottom > 0 &&
        box.left < window.innerWidth &&
        box.top < window.innerHeight &&
        Boolean(
          elementAtPoint &&
            (el === elementAtPoint || el.contains(elementAtPoint)),
        )
      );
    }

    const candidates = Array.from(document.querySelectorAll("body *")).filter(
      (el) => {
        if (!isVisible(el)) return false;
        const box = el.getBoundingClientRect();
        const text = (el.innerText || el.textContent || "").trim();
        return box.left < 620 && /^Expand$/i.test(text);
      },
    );

    if (!candidates.length) return false;
    candidates[0].click();
    return true;
  });

  if (clicked) {
    await page.waitForTimeout(3000);
    return;
  }

  if (dateCardInfo?.box) {
    await page.mouse.click(
      dateCardInfo.box.left + dateCardInfo.box.width / 2,
      dateCardInfo.box.bottom - 22,
    );
    await page.waitForTimeout(3000);
    return;
  }

  await saveDebug(page, "expand_falhou");
  throw new Error("Nao consegui expandir o cartao.");
}

async function extractFlightRows(page) {
  return await page.evaluate(() => {
    const navigationTextRegex =
      /Cloud Reconstruction|Task History|Field Management|Device Management|Settings/i;
    const strictRowRegex =
      /(?<timeRange>\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2})\s+(?<area>[0-9]+(?:[,.][0-9]+)?)\s*ha\s+(?<payload>[0-9]+(?:[,.][0-9]+)?)\s*L\b/i;
    const timeRangeRegex = /\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2}/g;

    function normalize(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0 &&
        box.right > 0 &&
        box.bottom > 0 &&
        box.left < window.innerWidth &&
        box.top < window.innerHeight
      );
    }

    const candidates = Array.from(document.querySelectorAll("body *"))
      .filter(isVisible)
      .map((el) => {
        const box = el.getBoundingClientRect();
        const text = normalize(el.innerText || el.textContent || "");
        const rowMatch = text.match(strictRowRegex);
        const timeMatches = text.match(timeRangeRegex) || [];

        return {
          element: el,
          box: {
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          },
          area: box.width * box.height,
          rowMatch,
          timeMatches,
          rawRowText: text,
        };
      })
      .filter((item) => {
        return (
          item.rowMatch &&
          item.timeMatches.length === 1 &&
          item.box.left < 620 &&
          item.box.top > 120 &&
          item.box.width >= 120 &&
          item.box.width <= 620 &&
          item.box.height >= 16 &&
          item.box.height <= 96
        );
      })
      .sort((a, b) => a.area - b.area);

    const accepted = [];
    const ignored = [];
    const seen = new Set();

    for (const item of candidates) {
      const groups = item.rowMatch.groups || {};
      const timeRange = String(groups.timeRange || "").replace(/\s+/g, "");
      const area = `${groups.area} ha`;
      const payload = `${groups.payload}L`;
      const key = `${timeRange}|${area}|${payload}`;

      if (navigationTextRegex.test(item.rawRowText)) {
        ignored.push({
          reason: "navigation_text",
          rawRowText: item.rawRowText,
        });
        continue;
      }

      if (seen.has(key)) {
        ignored.push({
          reason: "duplicate_dom_candidate",
          timeRange,
          area,
          payload,
          rawRowText: item.rawRowText,
        });
        continue;
      }

      seen.add(key);
      accepted.push({
        rowIndex: accepted.length + 1,
        timeRange,
        area,
        payload,
        rawRowText: item.rawRowText,
        clickPoint: {
          x: item.box.left + Math.min(35, Math.max(12, item.box.width / 2)),
          y: item.box.top + item.box.height / 2,
        },
      });
    }

    accepted.sort((a, b) => a.clickPoint.y - b.clickPoint.y);

    return {
      rows: accepted.map((row, index) => ({
        ...row,
        rowIndex: index + 1,
      })),
      ignoredRows: ignored,
      totalRowsDetected: accepted.length + ignored.length,
    };
  });
}

function flightRowKey(row) {
  return `${row.timeRange}|${row.area}|${row.payload}`;
}

async function clickMoreFlightsIfAvailable(page) {
  const targetPoint = await page.evaluate(() => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    }

    const candidates = Array.from(
      document.querySelectorAll("button, [role='button'], div, span"),
    )
      .filter(isVisible)
      .filter((el) => {
        const box = el.getBoundingClientRect();
        const text = (el.innerText || el.textContent || "").trim();
        return box.left < 620 && /^More$/i.test(text);
      })
      .sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top,
      );

    if (!candidates.length) return null;

    const target =
      candidates[0].closest("button, [role='button']") || candidates[0];
    target.scrollIntoView({ block: "center", inline: "nearest" });
    const box = target.getBoundingClientRect();

    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    };
  });

  if (!targetPoint) return false;

  await page.mouse.click(targetPoint.x, targetPoint.y);
  await page.waitForTimeout(2200);
  return true;
}

async function scrollFlightList(page) {
  const moved = await page.evaluate(() => {
    const strictRowRegex =
      /\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2}\s+[0-9]+(?:[,.][0-9]+)?\s*ha\s+[0-9]+(?:[,.][0-9]+)?\s*L\b/i;

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    }

    const containers = Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        if (!isVisible(el)) return false;
        const box = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const canScroll = el.scrollHeight > el.clientHeight + 20;
        const text = el.innerText || el.textContent || "";
        const overflowY = `${style.overflowY} ${style.overflow}`.toLowerCase();

        return (
          canScroll &&
          box.left < 700 &&
          box.width >= 180 &&
          box.height >= 80 &&
          /auto|scroll|overlay/.test(overflowY) &&
          (strictRowRegex.test(text) || /\bMore\b/i.test(text))
        );
      })
      .sort((a, b) => {
        const aBox = a.getBoundingClientRect();
        const bBox = b.getBoundingClientRect();
        return aBox.width * aBox.height - bBox.width * bBox.height;
      });

    for (const container of containers) {
      const before = container.scrollTop;
      container.scrollTop = Math.min(
        container.scrollHeight,
        container.scrollTop + Math.max(120, container.clientHeight * 0.85),
      );

      if (container.scrollTop > before + 4) {
        return true;
      }
    }

    return false;
  });

  if (moved) {
    await page.waitForTimeout(1200);
    return true;
  }

  await page.mouse.move(430, 560);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(1000);

  return false;
}

async function loadAllFlightRows(page, options = {}) {
  const expectedFlights = options.expectedFlights || null;
  const rowsByKey = new Map();
  const ignoredRows = [];
  let totalRowsDetected = 0;
  let stagnantRounds = 0;

  for (let attempt = 1; attempt <= 40; attempt++) {
    const extraction = await extractFlightRows(page);
    totalRowsDetected = Math.max(
      totalRowsDetected,
      extraction.totalRowsDetected,
    );
    ignoredRows.push(...extraction.ignoredRows);

    const before = rowsByKey.size;
    for (const row of extraction.rows) {
      rowsByKey.set(flightRowKey(row), row);
    }

    const newRows = rowsByKey.size - before;
    console.log(
      `[INFO] Varredura lista DJI ${attempt}: ${rowsByKey.size} linhas unicas (${newRows} novas).`,
    );

    if (expectedFlights && rowsByKey.size >= expectedFlights) {
      break;
    }

    const clickedMore = await clickMoreFlightsIfAvailable(page);
    const scrolled = clickedMore ? false : await scrollFlightList(page);

    if (newRows === 0 && !clickedMore && !scrolled) {
      stagnantRounds += 1;
    } else {
      stagnantRounds = 0;
    }

    if (stagnantRounds >= 3) {
      break;
    }
  }

  const dedupedIgnored = [];
  const ignoredKeys = new Set();

  for (const ignored of ignoredRows) {
    const key = `${ignored.reason}|${ignored.timeRange || ""}|${ignored.area || ""}|${ignored.payload || ""}|${String(
      ignored.rawRowText || "",
    ).slice(0, 120)}`;
    if (ignoredKeys.has(key)) continue;
    ignoredKeys.add(key);
    dedupedIgnored.push(ignored);
  }

  return {
    rows: Array.from(rowsByKey.values()).map((row, index) => ({
      ...row,
      rowIndex: index + 1,
    })),
    ignoredRows: dedupedIgnored,
    totalRowsDetected: Math.max(
      totalRowsDetected,
      rowsByKey.size + dedupedIgnored.length,
    ),
  };
}

function extractRowDataFromText(rawRowText) {
  if (NAVIGATION_TEXT_REGEX.test(rawRowText)) return null;

  const matches = Array.from(
    String(rawRowText || "").matchAll(new RegExp(STRICT_ROW_REGEX, "gi")),
  );
  if (matches.length !== 1) return null;

  const groups = matches[0].groups || {};
  const timeRange = String(groups.timeRange || "").replace(/\s+/g, "");

  return {
    timeRange,
    ...splitTimeRange(timeRange),
    area: `${groups.area} ha`,
    areaValue: parseNumber(groups.area),
    payload: `${groups.payload}L`,
    payloadValue: parseNumber(groups.payload),
  };
}

function dedupeFlights(flights) {
  const byKey = new Map();
  const duplicateRows = [];

  function completenessScore(flight) {
    return [
      flight.flightRecordNumber,
      flight.timeRange,
      flight.area,
      flight.payload,
      flight.drone,
      flight.pilot,
      flight.rawDetailsText,
      flight.imagePath || flight.mapImagePath || flight.officialImagePath,
    ].filter(Boolean).length;
  }

  for (const flight of flights) {
    const key = flight.flightRecordNumber
      ? `record:${flight.flightRecordNumber}`
      : `row:${flight.timeRange}|${flight.area}|${flight.payload}`;

    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, flight);
      continue;
    }

    duplicateRows.push({
      reason: "duplicate_flight",
      duplicateKey: key,
      keptRowIndex: current.sourceRowIndex ?? current.rowIndex ?? null,
      ignoredRowIndex: flight.sourceRowIndex ?? flight.rowIndex ?? null,
      flightRecordNumber: flight.flightRecordNumber || null,
      timeRange: flight.timeRange || null,
      area: flight.area || null,
      payload: flight.payload || null,
    });

    if (completenessScore(flight) > completenessScore(current)) {
      byKey.set(key, flight);
    }
  }

  return {
    flights: Array.from(byKey.values()).map((flight, index) => ({
      ...flight,
      cleanIndex: index + 1,
    })),
    duplicateRows,
  };
}

function buildSummary(
  totalRowsDetected,
  validFlights,
  ignoredRows,
  expectedSummary = {},
) {
  const uniqueFlightRecordNumbers = Array.from(
    new Set(
      validFlights.map((flight) => flight.flightRecordNumber).filter(Boolean),
    ),
  );

  const totalAreaHa = validFlights.reduce(
    (sum, flight) => sum + (flight.areaValue || 0),
    0,
  );

  const totalPayloadL = validFlights.reduce(
    (sum, flight) => sum + (flight.payloadValue || 0),
    0,
  );
  const actualValidFlights = validFlights.length;
  const actualAreaHa = Number(totalAreaHa.toFixed(2));
  const actualPayloadL = Number(totalPayloadL.toFixed(1));
  const expectedFlightsFromDayCard =
    expectedSummary.expectedFlightsFromDayCard ?? null;
  const expectedAreaHaFromDayCard =
    expectedSummary.expectedAreaHaFromDayCard ?? null;
  const expectedPayloadLFromDayCard =
    expectedSummary.expectedPayloadLFromDayCard ?? null;

  return {
    totalRowsDetected,
    totalValidFlights: actualValidFlights,
    totalIgnoredRows: ignoredRows.length,
    totalAreaHa: actualAreaHa,
    actualValidFlights,
    actualAreaHa,
    actualPayloadL,
    expectedFlightsFromDayCard,
    expectedAreaHaFromDayCard,
    expectedPayloadLFromDayCard,
    expectedDurationFromDayCard:
      expectedSummary.expectedDurationFromDayCard ?? null,
    coverageByFlightsPercent: percent(
      actualValidFlights,
      expectedFlightsFromDayCard,
    ),
    coverageByAreaPercent: percent(actualAreaHa, expectedAreaHaFromDayCard),
    coverageByPayloadPercent: percent(
      actualPayloadL,
      expectedPayloadLFromDayCard,
    ),
    uniqueFlightRecordNumbers,
    uniqueFlightRecordNumberCount: uniqueFlightRecordNumbers.length,
  };
}

function normalizeFlightForCleanInventory(flight) {
  const rawDetailsText = String(flight.rawDetailsText || "");
  const rowData = extractRowDataFromText(flight.rawRowText);
  const parsedDetails = parseFlightDetailsText(rawDetailsText);

  return {
    imageScope: "application",
    source: flight.source || "DJI SmartFarm",
    djiDate: normalizeDate(flight.djiDate || TARGET_DATE),
    sourceRowIndex: flight.rowIndex ?? flight.sourceRowIndex ?? null,
    flightRecordNumber:
      parsedDetails.flightRecordNumber || flight.flightRecordNumber || null,
    timeRange:
      parsedDetails.timeRange || rowData?.timeRange || flight.timeRange || null,
    startTime:
      parsedDetails.startTime || rowData?.startTime || flight.startTime || null,
    endTime:
      parsedDetails.endTime || rowData?.endTime || flight.endTime || null,
    area: parsedDetails.area || rowData?.area || flight.area || null,
    areaValue: parseNumber(parsedDetails.area || rowData?.area || flight.area),
    payload:
      parsedDetails.payload || rowData?.payload || flight.payload || null,
    payloadValue: parseNumber(
      parsedDetails.payload || rowData?.payload || flight.payload,
    ),
    duration: parsedDetails.duration || flight.duration || null,
    drone: parsedDetails.drone || null,
    device: parsedDetails.drone || null,
    operator: parsedDetails.pilot || null,
    pilot: parsedDetails.pilot || null,
    field: parsedDetails.field || null,
    plot: parsedDetails.plot || null,
    taskType: parsedDetails.taskType || null,
    flightMode: parsedDetails.flightMode || null,
    taskLocation: parsedDetails.taskLocation || null,
    rawRowText: flight.rawRowText || "",
    rawDetailsText,
    imagePath: flight.imagePath || null,
    mapImagePath: flight.mapImagePath || null,
    mapOnlyImagePath: flight.mapOnlyImagePath || null,
    officialImagePath: flight.officialImagePath || null,
    imageCaptureMode: flight.imageCaptureMode || null,
    imageContainsSidebar:
      typeof flight.imageContainsSidebar === "boolean"
        ? flight.imageContainsSidebar
        : null,
    screenshotStatus: flight.screenshotStatus || null,
    rejectionReason: flight.rejectionReason || null,
    cropMode: flight.cropMode || null,
    centerStatus: flight.centerStatus || null,
    applicationBBox: flight.applicationBBox || null,
    centerAttempts: Number.isFinite(flight.centerAttempts)
      ? flight.centerAttempts
      : null,
    reviewRequired:
      typeof flight.reviewRequired === "boolean" ? flight.reviewRequired : null,
    debugCaptureMetadataPath: flight.debugCaptureMetadataPath || null,
    capturedAt: flight.capturedAt || null,
  };
}

function getIgnoredReason(flight, normalizedFlight) {
  if (NAVIGATION_TEXT_REGEX.test(flight.rawRowText || "")) {
    return "navigation_text";
  }

  if (!STRICT_TIME_RANGE_REGEX.test(normalizedFlight.timeRange || "")) {
    return "missing_strict_time_range";
  }

  if (!normalizedFlight.area || normalizedFlight.areaValue === null) {
    return "missing_area_ha";
  }

  if (!normalizedFlight.payload || normalizedFlight.payloadValue === null) {
    return "missing_payload_l";
  }

  if (!/Flight Details/i.test(normalizedFlight.rawDetailsText || "")) {
    return "missing_flight_details";
  }

  return null;
}

function cleanInventory(inventory) {
  const ignoredRows = [...(inventory.ignoredRows || [])];
  const normalizedFlights = [];

  for (const flight of inventory.flights || []) {
    const normalizedFlight = normalizeFlightForCleanInventory(flight);
    const ignoredReason = getIgnoredReason(flight, normalizedFlight);

    if (ignoredReason) {
      ignoredRows.push({
        reason: ignoredReason,
        rowIndex: flight.rowIndex ?? flight.sourceRowIndex ?? null,
        timeRange: flight.timeRange || null,
        area: flight.area || null,
        payload: flight.payload || null,
        flightRecordNumber: flight.flightRecordNumber || null,
        rawRowText: flight.rawRowText || "",
      });
      continue;
    }

    normalizedFlights.push(normalizedFlight);
  }

  const deduped = dedupeFlights(normalizedFlights);
  ignoredRows.push(...deduped.duplicateRows);

  const totalRowsDetected =
    Number.isFinite(inventory.totalRowsDetected) &&
    inventory.totalRowsDetected > 0
      ? inventory.totalRowsDetected
      : (inventory.flights || []).length + (inventory.ignoredRows || []).length;

  const expectedSummary = inferExpectedSummaryFromInventory(inventory);
  const summary = buildSummary(
    totalRowsDetected,
    deduped.flights,
    ignoredRows,
    expectedSummary,
  );

  return {
    ...inventory,
    generatedAt: inventory.generatedAt || new Date().toISOString(),
    cleanedAt: new Date().toISOString(),
    cleanVersion: 1,
    totalRowsDetected,
    totalValidFlights: summary.totalValidFlights,
    totalIgnoredRows: summary.totalIgnoredRows,
    totalAreaHa: summary.totalAreaHa,
    actualValidFlights: summary.actualValidFlights,
    actualAreaHa: summary.actualAreaHa,
    actualPayloadL: summary.actualPayloadL,
    expectedFlightsFromDayCard: summary.expectedFlightsFromDayCard,
    expectedAreaHaFromDayCard: summary.expectedAreaHaFromDayCard,
    expectedPayloadLFromDayCard: summary.expectedPayloadLFromDayCard,
    expectedDurationFromDayCard: summary.expectedDurationFromDayCard,
    rawDayCardText: expectedSummary.rawDayCardText,
    coverageByFlightsPercent: summary.coverageByFlightsPercent,
    coverageByAreaPercent: summary.coverageByAreaPercent,
    coverageByPayloadPercent: summary.coverageByPayloadPercent,
    uniqueFlightRecordNumbers: summary.uniqueFlightRecordNumbers,
    uniqueFlightRecordNumberCount: summary.uniqueFlightRecordNumberCount,
    summary,
    ignoredRows,
    flights: deduped.flights,
  };
}

function cleanInventoryPath() {
  return path.join(
    OUTPUT_ROOT,
    `dji_inventory_${dateToFilePart(TARGET_DATE)}_clean.json`,
  );
}

function saveCleanInventory(inventory) {
  const clean = cleanInventory(inventory);
  const outPath = cleanInventoryPath();
  fs.writeFileSync(outPath, JSON.stringify(clean, null, 2), "utf8");

  console.log("[RESUMO CLEAN]");
  console.log(`totalRowsDetected: ${clean.summary.totalRowsDetected}`);
  console.log(`totalValidFlights: ${clean.summary.totalValidFlights}`);
  console.log(`totalIgnoredRows: ${clean.summary.totalIgnoredRows}`);
  console.log(`totalAreaHa: ${clean.summary.totalAreaHa}`);
  console.log(
    `expectedFlightsFromDayCard: ${clean.summary.expectedFlightsFromDayCard}`,
  );
  console.log(
    `expectedAreaHaFromDayCard: ${clean.summary.expectedAreaHaFromDayCard}`,
  );
  console.log(
    `expectedPayloadLFromDayCard: ${clean.summary.expectedPayloadLFromDayCard}`,
  );
  console.log(
    `coverageByFlightsPercent: ${clean.summary.coverageByFlightsPercent}`,
  );
  console.log(`coverageByAreaPercent: ${clean.summary.coverageByAreaPercent}`);
  console.log(
    `uniqueFlightRecordNumbers: ${clean.summary.uniqueFlightRecordNumbers.length}`,
  );
  console.log(`[OK] Inventario limpo: ${outPath}`);

  return { clean, outPath };
}

async function scrollFlightListToTop(page) {
  const moved = await page.evaluate(() => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    }

    const rowRegex =
      /\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2}\s+[0-9]+(?:[,.][0-9]+)?\s*ha\s+[0-9]+(?:[,.][0-9]+)?\s*L\b/i;
    const containers = Array.from(document.querySelectorAll("body *"))
      .filter(isVisible)
      .filter((el) => {
        const box = el.getBoundingClientRect();
        const text = el.innerText || el.textContent || "";
        const style = window.getComputedStyle(el);
        return (
          box.left < 620 &&
          box.width >= 180 &&
          box.height >= 180 &&
          el.scrollHeight > el.clientHeight + 24 &&
          /(auto|scroll)/.test(`${style.overflowY}${style.overflow}`) &&
          (rowRegex.test(text) || /More/i.test(text))
        );
      })
      .sort((a, b) => b.clientHeight - a.clientHeight);

    for (const container of containers) {
      const before = container.scrollTop;
      container.scrollTop = 0;
      if (before > 4) return true;
    }

    return false;
  });

  if (moved) {
    await page.waitForTimeout(1000);
    return true;
  }

  await page.mouse.move(430, 560);
  await page.mouse.wheel(0, -6000);
  await page.waitForTimeout(1000);
  return false;
}

async function findVisibleFlightRowPoint(page, row) {
  return await page.evaluate((row) => {
    const strictRowRegex =
      /(?<timeRange>\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2})\s+(?<area>[0-9]+(?:[,.][0-9]+)?)\s*ha\s+(?<payload>[0-9]+(?:[,.][0-9]+)?)\s*L\b/i;

    function normalize(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    }

    const candidates = Array.from(document.querySelectorAll("body *"))
      .filter(isVisible)
      .map((el) => {
        const box = el.getBoundingClientRect();
        const text = normalize(el.innerText || el.textContent || "");
        const match = text.match(strictRowRegex);
        return {
          el,
          box,
          text,
          match,
          area: box.width * box.height,
        };
      })
      .filter((item) => {
        if (!item.match?.groups) return false;
        const groups = item.match.groups;
        const timeRange = String(groups.timeRange || "").replace(/\s+/g, "");
        const area = `${groups.area} ha`;
        const payload = `${groups.payload}L`;

        return (
          item.box.left < 620 &&
          item.box.width >= 120 &&
          item.box.width <= 620 &&
          item.box.height >= 16 &&
          item.box.height <= 96 &&
          timeRange === row.timeRange &&
          area === row.area &&
          payload === row.payload
        );
      })
      .sort((a, b) => a.area - b.area);

    if (!candidates.length) return null;

    const target = candidates[0].el;
    target.scrollIntoView({ block: "center", inline: "nearest" });

    const box = target.getBoundingClientRect();
    const leftX = box.left + Math.min(35, Math.max(12, box.width / 2));
    const centerX = box.left + box.width / 2;
    const rightX = box.left + Math.max(16, box.width - 24);
    const y = box.top + box.height / 2;

    return {
      x: leftX,
      y,
      fallbackPoints: [
        { x: centerX, y },
        { x: rightX, y },
      ],
    };
  }, row);
}

async function isFlightDetailsDrawerOpen(page) {
  return await page
    .locator(".ant-drawer")
    .filter({ hasText: /Flight Details/i })
    .first()
    .isVisible({ timeout: 700 })
    .catch(() => false);
}

async function clickFlightRow(page, row) {
  let stagnantRounds = 0;

  for (let attempt = 1; attempt <= 45; attempt++) {
    const targetPoint = await findVisibleFlightRowPoint(page, row);
    if (targetPoint) {
      const clickPoints = [
        { x: targetPoint.x, y: targetPoint.y },
        ...(targetPoint.fallbackPoints || []),
      ];

      for (const point of clickPoints) {
        await page.mouse.click(point.x, point.y);
        await page.waitForTimeout(1400);

        if (await isFlightDetailsDrawerOpen(page)) {
          await page.waitForTimeout(2500);
          return;
        }
      }
    }

    const moved =
      attempt === 1
        ? await scrollFlightListToTop(page)
        : await scrollFlightList(page);

    if (moved) {
      stagnantRounds = 0;
    } else {
      stagnantRounds += 1;
    }

    if (stagnantRounds >= 3) break;
  }

  throw new Error(
    `Linha de voo nao encontrada para clique: ${flightRowKey(row)}`,
  );
}

function normalizeDetailLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

const KNOWN_DETAIL_LABELS = [
  "Area Covered",
  "Operation Area",
  "Application Rate/Payload",
  "Payload",
  "Volume",
  "Spray Amount",
  "Takeoff & Landing Time",
  "Flight Duration",
  "Flight Route Type",
  "Task Type",
  "Flight Mode",
  "Task Location",
  "Flight Record Number",
  "Task Number",
  "Location Services",
  "Device Name",
  "Aircraft Name",
  "Drone Name",
  "UAV Name",
  "Flight Controller SN",
  "Battery SN",
  "Pilot Name",
  "Operator Name",
  "Field Name",
  "Plot Name",
  "Farmland Name",
  "Team",
  "Tel",
  "Playback",
].map(normalizeDetailLabel);

function isKnownDetailLabel(value) {
  return KNOWN_DETAIL_LABELS.includes(normalizeDetailLabel(value));
}

function detailValue(rawText, labels) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim());
  const normalizedLabels = labels.map(normalizeDetailLabel);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const lineLabel = normalizeDetailLabel(line);
    const labelIndex = normalizedLabels.findIndex(
      (label) => label === lineLabel,
    );
    if (labelIndex === -1) continue;

    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (!next) continue;
      if (isKnownDetailLabel(next)) return null;
      return next;
    }
  }

  return null;
}

function parseFlightRecordNumber(value) {
  const match = String(value || "").match(/\bR[0-9A-Z-]+\b/i);
  return match ? match[0] : null;
}

function parseFlightDetailsText(rawText) {
  const text = String(rawText || "");
  const timeValue = detailValue(text, ["Takeoff & Landing Time"]) || "";
  const timeParts = splitTimeRange(timeValue);
  const area = detailValue(text, ["Area Covered", "Operation Area", "Area"]);
  const payload = detailValue(text, [
    "Application Rate/Payload",
    "Payload",
    "Volume",
    "Spray Amount",
  ]);

  return {
    flightRecordNumber: parseFlightRecordNumber(
      detailValue(text, ["Flight Record Number"]),
    ),
    timeRange: timeParts.timeRange,
    startTime: timeParts.startTime,
    endTime: timeParts.endTime,
    area,
    areaValue: parseNumber(area),
    payload,
    payloadValue: parseNumber(payload),
    duration: detailValue(text, [
      "Flight Duration",
      "Duration",
      "Operation Time",
    ]),
    drone: detailValue(text, [
      "Device Name",
      "Aircraft Name",
      "Drone Name",
      "UAV Name",
    ]),
    pilot: detailValue(text, ["Pilot Name", "Operator Name"]),
    field: detailValue(text, ["Field Name", "Farmland Name"]),
    plot: detailValue(text, ["Plot Name"]),
    taskType: detailValue(text, ["Task Type", "Operation Type"]),
    flightMode: detailValue(text, ["Flight Mode", "Mode"]),
    taskLocation: detailValue(text, ["Task Location"]),
  };
}

async function readFlightDetails(page, row) {
  const drawer = page
    .locator(".ant-drawer")
    .filter({ hasText: /Flight Details/i })
    .first();
  const drawerVisible = await drawer
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  const text = drawerVisible ? await drawer.innerText() : await pageText(page);
  const parsedDetails = parseFlightDetailsText(text);
  const rowData = extractRowDataFromText(row.rawRowText) || row;
  const timeParts = splitTimeRange(
    parsedDetails.timeRange || rowData.timeRange,
  );
  const area = parsedDetails.area || rowData.area || null;
  const payload = parsedDetails.payload || rowData.payload || null;

  return {
    imageScope: "application",
    source: "DJI SmartFarm",
    djiDate: normalizeDate(TARGET_DATE),
    rowIndex: row.rowIndex,
    flightRecordNumber: parsedDetails.flightRecordNumber,
    timeRange: timeParts.timeRange,
    startTime: timeParts.startTime,
    endTime: timeParts.endTime,
    area,
    areaValue: parseNumber(area),
    payload,
    payloadValue: parseNumber(payload),
    duration: parsedDetails.duration || row.duration || null,
    drone: parsedDetails.drone,
    device: parsedDetails.drone,
    operator: parsedDetails.pilot,
    pilot: parsedDetails.pilot,
    field: parsedDetails.field,
    plot: parsedDetails.plot,
    taskType: parsedDetails.taskType,
    flightMode: parsedDetails.flightMode,
    taskLocation: parsedDetails.taskLocation,
    rawRowText: row.rawRowText,
    rawDetailsText: text,
    capturedAt: new Date().toISOString(),
  };
}

function applicationImagePath(metadata, suffix = "") {
  return path.join(
    APPLICATION_IMAGE_DIR,
    [
      String(metadata.rowIndex || "").padStart(2, "0"),
      safeFileName(
        metadata.timeRange || metadata.flightRecordNumber || "flight",
      ),
      safeFileName(metadata.flightRecordNumber || ""),
      suffix,
      timestamp(),
    ]
      .filter(Boolean)
      .join("_") + ".png",
  );
}

async function findOfficialScreenshotButtonPoint(page) {
  return await page.evaluate(() => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    }

    const candidates = Array.from(
      document.querySelectorAll('button, [role="button"], div, p, span'),
    )
      .filter(isVisible)
      .map((el) => {
        const box = el.getBoundingClientRect();
        const text = (el.innerText || el.textContent || "").trim();
        return { el, box, text };
      })
      .filter((item) => /(^|\s)Screenshot(\s|$)/i.test(item.text))
      .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);

    if (!candidates.length) return null;

    const target =
      candidates[0].el.closest("button, [role='button']") || candidates[0].el;
    target.scrollIntoView({ block: "center", inline: "nearest" });
    const box = target.getBoundingClientRect();

    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    };
  });
}

async function tryOfficialScreenshot(page, metadata) {
  if (!CAPTURE_IMAGES) return null;

  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });
  const outputPath = applicationImagePath(metadata, "official");
  const buttonPoint = await findOfficialScreenshotButtonPoint(page);
  if (!buttonPoint) return null;

  const downloadPromise = page
    .waitForEvent("download", { timeout: 20000 })
    .catch(() => null);
  await page.mouse.click(buttonPoint.x, buttonPoint.y);

  const download = await downloadPromise;
  if (!download) return null;

  await download.saveAs(outputPath);
  return outputPath;
}

async function leftSidebarLooksVisible(page) {
  const info = await detectLeftSidebar(page);
  return info.visible;
}

let lastKnownSidebarBox = null;

async function detectLeftSidebar(page) {
  const info = await page.evaluate(() => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0 &&
        box.right > 0 &&
        box.bottom > 0 &&
        box.left < window.innerWidth &&
        box.top < window.innerHeight
      );
    }

    const rowRegex =
      /\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2}\s+[0-9]+(?:[,.][0-9]+)?\s*ha\s+[0-9]+(?:[,.][0-9]+)?\s*L\b/i;
    const candidates = Array.from(document.querySelectorAll("body *"))
      .filter(isVisible)
      .map((el) => {
        const box = el.getBoundingClientRect();
        const text = (el.innerText || el.textContent || "").replace(
          /\s+/g,
          " ",
        );
        return {
          el,
          box,
          text,
          area: box.width * box.height,
        };
      })
      .filter((item) => {
        const textLooksLikeSidebar = rowRegex.test(item.text);
        return (
          item.box.left < 560 &&
          item.box.width > 160 &&
          item.box.width <= 700 &&
          item.box.height > 80 &&
          item.box.height < window.innerHeight &&
          textLooksLikeSidebar
        );
      })
      .sort((a, b) => b.area - a.area);

    if (!candidates.length) {
      return { visible: false, box: null, textSample: null };
    }

    const best = candidates[0];
    return {
      visible: true,
      box: {
        left: best.box.left,
        top: best.box.top,
        right: best.box.right,
        bottom: best.box.bottom,
        width: best.box.width,
        height: best.box.height,
      },
      textSample: best.text.slice(0, 240),
    };
  });

  if (info.visible && info.box) {
    lastKnownSidebarBox = info.box;
  }

  return info;
}

async function hideDjiLeftSidebar(page) {
  console.log("[INFO] Tentando ocultar sidebar");

  let sidebarInfo = await detectLeftSidebar(page);
  if (!sidebarInfo.visible) {
    console.log("[OK] Sidebar ocultada");
    return {
      hidden: true,
      before: sidebarInfo,
      after: sidebarInfo,
      attempts: [],
    };
  }

  const attempts = [];

  for (let attempt = 1; attempt <= 6; attempt++) {
    sidebarInfo = await detectLeftSidebar(page);
    const targetPoint = await page.evaluate((sidebarBox) => {
      function isVisible(el) {
        const style = window.getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0
        );
      }

      const candidates = Array.from(
        document.querySelectorAll(
          'button, [role="button"], [aria-label], [title], div, span, i',
        ),
      )
        .filter(isVisible)
        .map((el) => {
          const box = el.getBoundingClientRect();
          const text = [
            el.getAttribute("aria-label") || "",
            el.getAttribute("title") || "",
            el.getAttribute("class") || "",
          ]
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          const visibleText = (el.innerText || el.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
          const hasSvg = Boolean(el.querySelector("svg"));
          return { el, box, text, visibleText, hasSvg };
        })
        .filter((item) => {
          const isNamedCollapse =
            /collapse|hide|recolher|ocultar|fechar|left|sidebar|panel/i.test(
              item.text,
            );
          const sidebarRight = sidebarBox?.right ?? 360;
          const isLikelyEdgeControl =
            (item.hasSvg || item.box.width <= 56) &&
            item.box.left >= sidebarRight - 22 &&
            item.box.left <= sidebarRight + 72 &&
            item.box.top >= 80 &&
            item.box.top <= window.innerHeight - 80 &&
            item.box.width <= 80 &&
            item.box.height <= 120;

          return (
            (isNamedCollapse && !/^Collapse$/i.test(item.visibleText)) ||
            isLikelyEdgeControl
          );
        })
        .sort((a, b) => {
          const sidebarRight = sidebarBox?.right ?? 360;
          const aEdgeDistance = Math.abs(a.box.left - sidebarRight);
          const bEdgeDistance = Math.abs(b.box.left - sidebarRight);
          if (aEdgeDistance !== bEdgeDistance) {
            return aEdgeDistance - bEdgeDistance;
          }
          return b.box.left - a.box.left;
        });

      if (!candidates.length) return null;

      const target =
        candidates[0].el.closest("button, [role='button']") || candidates[0].el;
      const box = target.getBoundingClientRect();
      return {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        reason: "dom_candidate",
        text: candidates[0].text,
        visibleText: candidates[0].visibleText,
        box: {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        },
      };
    }, sidebarInfo.box);

    const fallbackPoints = [];
    if (sidebarInfo.box) {
      const x = Math.min(
        Math.max(sidebarInfo.box.right + 24, 280),
        page.viewportSize()?.width ? page.viewportSize().width - 20 : 1540,
      );
      const middleY = Math.max(
        110,
        sidebarInfo.box.top + sidebarInfo.box.height / 2,
      );
      fallbackPoints.push(
        { x, y: Math.max(100, sidebarInfo.box.top + 120), reason: "edge_top" },
        { x, y: middleY, reason: "edge_middle" },
        { x, y: Math.min(middleY + 180, 760), reason: "edge_lower" },
      );
    }

    const points = [targetPoint, ...fallbackPoints].filter(Boolean);
    if (!points.length) break;

    for (const point of points) {
      attempts.push(point);
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(1400);

      const after = await detectLeftSidebar(page);
      if (!after.visible) {
        console.log("[OK] Sidebar ocultada");
        return { hidden: true, before: sidebarInfo, after, attempts };
      }
    }
  }

  const after = await detectLeftSidebar(page);
  if (after.visible) {
    console.log("[WARN] Sidebar ainda visível");
  } else {
    console.log("[OK] Sidebar ocultada");
  }

  return {
    hidden: !after.visible,
    before: sidebarInfo,
    after,
    attempts,
  };
}

async function findOpenSidebarControlPoint(page, previousSidebarBox) {
  return await page.evaluate((previousSidebarBox) => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0.05 &&
        box.width > 0 &&
        box.height > 0 &&
        box.right > 0 &&
        box.bottom > 0 &&
        box.left < window.innerWidth &&
        box.top < window.innerHeight
      );
    }

    const previousRight = previousSidebarBox?.right ?? 360;
    const candidates = Array.from(
      document.querySelectorAll(
        'button, [role="button"], [aria-label], [title], div, span, i',
      ),
    )
      .filter(isVisible)
      .map((el) => {
        const box = el.getBoundingClientRect();
        const metadata = [
          el.getAttribute("aria-label") || "",
          el.getAttribute("title") || "",
          el.getAttribute("class") || "",
        ]
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const visibleText = (el.innerText || el.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const text = `${metadata} ${visibleText}`.trim();
        return {
          el,
          box,
          text,
          visibleText,
          hasSvg: Boolean(el.querySelector("svg")),
        };
      })
      .filter((item) => {
        const label = item.text.toLowerCase();
        const namedOpenControl =
          /expand|show|open|abrir|reabrir|exibir|mostrar|sidebar|panel|left|list|lista/.test(
            label,
          ) && !/^Collapse$/i.test(item.visibleText);
        const iconLike =
          item.hasSvg ||
          item.box.width <= 64 ||
          /anticon|icon|arrow|caret|chevron|collapse|expand|sidebar|panel|left/.test(
            label,
          );
        const nearLeftRail =
          item.box.left >= -8 &&
          item.box.left <= 132 &&
          item.box.top >= 72 &&
          item.box.top <= window.innerHeight - 60;
        const nearPreviousEdge =
          item.box.left >= previousRight - 90 &&
          item.box.left <= previousRight + 132 &&
          item.box.top >= 72 &&
          item.box.top <= window.innerHeight - 60;

        return (
          item.box.width <= 120 &&
          item.box.height <= 140 &&
          ((namedOpenControl && item.box.left < 720) ||
            (iconLike && (nearLeftRail || nearPreviousEdge)))
        );
      })
      .sort((a, b) => {
        const score = (item) => {
          const label = item.text.toLowerCase();
          const namedOpenControl =
            /expand|show|open|abrir|reabrir|exibir|mostrar|sidebar|panel|left|list|lista/.test(
              label,
            ) && !/^Collapse$/i.test(item.visibleText);
          const previousEdgeDistance = Math.abs(item.box.left - previousRight);
          const leftRailDistance = Math.abs(item.box.left);

          return (
            (namedOpenControl ? 0 : 1000) +
            Math.min(previousEdgeDistance, leftRailDistance) +
            item.box.top / 1000
          );
        };

        return score(a) - score(b);
      });

    if (!candidates.length) return null;

    const target =
      candidates[0].el.closest("button, [role='button']") || candidates[0].el;
    const box = target.getBoundingClientRect();
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      reason: "open_sidebar_control",
      text: candidates[0].text,
      visibleText: candidates[0].visibleText,
      box: {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      },
    };
  }, previousSidebarBox);
}

function sidebarOpenFallbackPoints(page) {
  const viewport = page.viewportSize() || { width: 1600, height: 900 };
  const previousBox = lastKnownSidebarBox;
  const points = [];

  if (previousBox) {
    const edgeX = Math.min(
      Math.max(previousBox.right + 24, 24),
      viewport.width - 20,
    );
    const insideEdgeX = Math.min(
      Math.max(previousBox.right - 12, 24),
      viewport.width - 20,
    );
    const middleY = Math.max(
      110,
      previousBox.top + previousBox.height / 2,
    );

    points.push(
      { x: edgeX, y: Math.max(100, previousBox.top + 120), reason: "edge_top" },
      { x: edgeX, y: middleY, reason: "edge_middle" },
      { x: insideEdgeX, y: middleY, reason: "inside_edge_middle" },
      {
        x: edgeX,
        y: Math.min(middleY + 180, viewport.height - 80),
        reason: "edge_lower",
      },
    );
  }

  points.push(
    { x: 28, y: 128, reason: "left_rail_top" },
    { x: 28, y: Math.min(360, viewport.height - 120), reason: "left_rail_mid" },
    {
      x: 56,
      y: Math.min(560, viewport.height - 120),
      reason: "left_rail_lower",
    },
  );

  return points;
}

async function ensureFlightListSidebarOpen(page) {
  console.log("[INFO] Garantindo sidebar aberta para seleção");

  for (let attempt = 1; attempt <= 5; attempt++) {
    const before = await detectLeftSidebar(page);
    if (before.visible) {
      console.log("[OK] Sidebar/lista aberta");
      return {
        opened: true,
        alreadyOpen: attempt === 1,
        before,
        after: before,
      };
    }

    const targetPoint = await findOpenSidebarControlPoint(
      page,
      lastKnownSidebarBox,
    );
    const points = [
      targetPoint,
      ...sidebarOpenFallbackPoints(page),
    ].filter(Boolean);

    for (const point of points) {
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(1500);

      const after = await detectLeftSidebar(page);
      if (after.visible) {
        console.log("[OK] Sidebar/lista aberta");
        return {
          opened: true,
          alreadyOpen: false,
          before,
          after,
          point,
          attempt,
        };
      }
    }
  }

  await saveDebug(page, "sidebar_lista_nao_abriu");
  throw new Error("Sidebar/lista de voos nao abriu para selecao.");
}

async function assertFlightListSidebarOpen(page) {
  console.log("[INFO] Garantindo sidebar aberta para seleção");

  const sidebarInfo = await detectLeftSidebar(page);
  if (sidebarInfo.visible) {
    console.log("[OK] Sidebar/lista aberta");
    return sidebarInfo;
  }

  throw new Error("Sidebar/lista de voos nao esta aberta para selecao.");
}

function captureDebugPath(name, ext = "png") {
  return path.join(APPLICATION_IMAGE_DIR, `${name}.${ext}`);
}

async function saveCaptureDebugImage(page, name, options = {}) {
  if (!DEBUG_CAPTURE) return null;

  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });
  const outputPath = captureDebugPath(name, "png");
  await page.screenshot({ path: outputPath, fullPage: false, ...options });
  return outputPath;
}

function saveCaptureDebugMetadata(metadata) {
  if (!DEBUG_CAPTURE) return null;

  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });
  const outputPath = captureDebugPath("debug_capture_metadata", "json");
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2), "utf8");
  return outputPath;
}

function saveCenterDebugMetadata(metadata) {
  if (!DEBUG_CAPTURE) return null;

  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });
  const outputPath = captureDebugPath("debug_center_metadata", "json");
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2), "utf8");
  return outputPath;
}

function captureCenterTempPath(metadata, name) {
  return path.join(
    APPLICATION_IMAGE_DIR,
    [
      "__tmp_center",
      process.pid,
      String(metadata.rowIndex || "").padStart(2, "0"),
      safeFileName(metadata.flightRecordNumber || metadata.timeRange || "flight"),
      name,
      timestamp(),
    ]
      .filter(Boolean)
      .join("_") + ".png",
  );
}

function removeFilesQuietly(filePaths) {
  for (const filePath of filePaths) {
    if (!filePath || DEBUG_CAPTURE) continue;
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Temporary capture cleanup must not affect the inventory flow.
    }
  }
}

async function captureMapCrop(page, clip, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, clip });
  return outputPath;
}

const OPTIONAL_IMAGE_MODULES = {};

function optionalRequire(name) {
  if (Object.prototype.hasOwnProperty.call(OPTIONAL_IMAGE_MODULES, name)) {
    return OPTIONAL_IMAGE_MODULES[name];
  }

  try {
    OPTIONAL_IMAGE_MODULES[name] = require(name);
  } catch {
    OPTIONAL_IMAGE_MODULES[name] = null;
  }

  return OPTIONAL_IMAGE_MODULES[name];
}

async function readPixelsWithSharp(imagePath) {
  const sharp = optionalRequire("sharp");
  if (!sharp) return null;

  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    channels: 4,
    reader: "sharp",
  };
}

async function readPixelsWithPngjs(imagePath) {
  const pngjs = optionalRequire("pngjs");
  const PNG = pngjs?.PNG || pngjs;
  if (!PNG) return null;

  return await new Promise((resolve, reject) => {
    fs.createReadStream(imagePath)
      .pipe(new PNG())
      .on("parsed", function parsed() {
        resolve({
          data: this.data,
          width: this.width,
          height: this.height,
          channels: 4,
          reader: "pngjs",
        });
      })
      .on("error", reject);
  });
}

async function readPixelsWithJimp(imagePath) {
  const jimpModule = optionalRequire("jimp");
  if (!jimpModule) return null;

  const Jimp = jimpModule.Jimp || jimpModule;
  const read = Jimp.read || jimpModule.read;
  if (typeof read !== "function") return null;

  const image = await read.call(Jimp, imagePath);
  if (!image?.bitmap?.data) return null;

  return {
    data: image.bitmap.data,
    width: image.bitmap.width,
    height: image.bitmap.height,
    channels: 4,
    reader: "jimp",
  };
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function reconstructPngFilterByte(filter, raw, left, up, upperLeft) {
  if (filter === 0) return raw;
  if (filter === 1) return (raw + left) & 0xff;
  if (filter === 2) return (raw + up) & 0xff;
  if (filter === 3) return (raw + Math.floor((left + up) / 2)) & 0xff;
  if (filter === 4) return (raw + paethPredictor(left, up, upperLeft)) & 0xff;
  throw new Error(`Filtro PNG nao suportado: ${filter}`);
}

function readPixelsWithBuiltinPngDecoder(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (!buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Arquivo nao parece ser PNG.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;

    if (chunkEnd + 4 > buffer.length) {
      throw new Error("PNG truncado ou invalido.");
    }

    if (type === "IHDR") {
      width = buffer.readUInt32BE(chunkStart);
      height = buffer.readUInt32BE(chunkStart + 4);
      bitDepth = buffer[chunkStart + 8];
      colorType = buffer[chunkStart + 9];
      interlace = buffer[chunkStart + 12];
    } else if (type === "IDAT") {
      idatChunks.push(buffer.subarray(chunkStart, chunkEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = chunkEnd + 4;
  }

  if (!width || !height || !idatChunks.length) {
    throw new Error("PNG sem cabecalho ou dados de imagem.");
  }

  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error("PNG com bit depth/interlace nao suportado no fallback.");
  }

  const channelsByColorType = {
    0: 1,
    2: 3,
    4: 2,
    6: 4,
  };
  const sourceChannels = channelsByColorType[colorType];

  if (!sourceChannels) {
    throw new Error(`PNG color type nao suportado no fallback: ${colorType}`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const rowLength = width * sourceChannels;
  const expectedLength = (rowLength + 1) * height;

  if (inflated.length < expectedLength) {
    throw new Error("Dados PNG descompactados menores que o esperado.");
  }

  const rgba = Buffer.alloc(width * height * 4);
  let inputOffset = 0;
  let previousRow = Buffer.alloc(rowLength);

  for (let y = 0; y < height; y++) {
    const filter = inflated[inputOffset++];
    const row = Buffer.alloc(rowLength);

    for (let index = 0; index < rowLength; index++) {
      const left = index >= sourceChannels ? row[index - sourceChannels] : 0;
      const up = previousRow[index] || 0;
      const upperLeft =
        index >= sourceChannels ? previousRow[index - sourceChannels] || 0 : 0;
      row[index] = reconstructPngFilterByte(
        filter,
        inflated[inputOffset + index],
        left,
        up,
        upperLeft,
      );
    }

    inputOffset += rowLength;

    for (let x = 0; x < width; x++) {
      const sourceIndex = x * sourceChannels;
      const targetIndex = (y * width + x) * 4;

      if (colorType === 0) {
        const gray = row[sourceIndex];
        rgba[targetIndex] = gray;
        rgba[targetIndex + 1] = gray;
        rgba[targetIndex + 2] = gray;
        rgba[targetIndex + 3] = 255;
      } else if (colorType === 2) {
        rgba[targetIndex] = row[sourceIndex];
        rgba[targetIndex + 1] = row[sourceIndex + 1];
        rgba[targetIndex + 2] = row[sourceIndex + 2];
        rgba[targetIndex + 3] = 255;
      } else if (colorType === 4) {
        const gray = row[sourceIndex];
        rgba[targetIndex] = gray;
        rgba[targetIndex + 1] = gray;
        rgba[targetIndex + 2] = gray;
        rgba[targetIndex + 3] = row[sourceIndex + 1];
      } else if (colorType === 6) {
        rgba[targetIndex] = row[sourceIndex];
        rgba[targetIndex + 1] = row[sourceIndex + 1];
        rgba[targetIndex + 2] = row[sourceIndex + 2];
        rgba[targetIndex + 3] = row[sourceIndex + 3];
      }
    }

    previousRow = row;
  }

  return {
    data: rgba,
    width,
    height,
    channels: 4,
    reader: "builtin_png",
  };
}

async function readImagePixels(imagePath) {
  const readers = [
    readPixelsWithSharp,
    readPixelsWithPngjs,
    readPixelsWithJimp,
  ];

  for (const reader of readers) {
    const result = await reader(imagePath).catch(() => null);
    if (result) return result;
  }

  return readPixelsWithBuiltinPngDecoder(imagePath);
}

function isApplicationHighlightPixel(r, g, b, a = 255) {
  if (a < 80) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max > 0 ? (max - min) / max : 0;

  if (max > 245 && min > 215) return false;
  if (g <= 120) return false;
  if (g - r <= 25) return false;
  if (g - b <= 25) return false;
  if (max - min < 45) return false;
  if (saturation < 0.28) return false;

  return true;
}

function componentDistance(a, b) {
  const horizontalGap = Math.max(
    0,
    Math.max(a.left, b.left) - Math.min(a.right, b.right),
  );
  const verticalGap = Math.max(
    0,
    Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom),
  );
  return Math.max(horizontalGap, verticalGap);
}

function detectApplicationHighlightBBoxFromPixels(image) {
  const { data, width, height, channels } = image;
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  let highlightPixelCount = 0;

  for (let index = 0; index < totalPixels; index++) {
    const dataIndex = index * channels;
    const r = data[dataIndex];
    const g = data[dataIndex + 1];
    const b = data[dataIndex + 2];
    const a = channels >= 4 ? data[dataIndex + 3] : 255;

    if (isApplicationHighlightPixel(r, g, b, a)) {
      mask[index] = 1;
      highlightPixelCount++;
    }
  }

  const minimumPixels = Math.max(60, Math.floor(totalPixels * 0.00008));
  if (highlightPixelCount < minimumPixels) return null;

  const components = [];
  const stack = [];

  for (let startIndex = 0; startIndex < totalPixels; startIndex++) {
    if (mask[startIndex] !== 1) continue;

    mask[startIndex] = 2;
    stack.push(startIndex);

    let pixelCount = 0;
    let left = width;
    let top = height;
    let right = 0;
    let bottom = 0;

    while (stack.length) {
      const current = stack.pop();
      const x = current % width;
      const y = Math.floor(current / width);

      pixelCount++;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;

      for (let yy = y - 1; yy <= y + 1; yy++) {
        if (yy < 0 || yy >= height) continue;

        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || xx >= width || (xx === x && yy === y)) continue;

          const neighborIndex = yy * width + xx;
          if (mask[neighborIndex] !== 1) continue;

          mask[neighborIndex] = 2;
          stack.push(neighborIndex);
        }
      }
    }

    const componentWidth = right - left + 1;
    const componentHeight = bottom - top + 1;
    if (
      pixelCount >= Math.max(20, Math.floor(minimumPixels * 0.35)) &&
      componentWidth >= 3 &&
      componentHeight >= 3
    ) {
      components.push({
        left,
        top,
        right,
        bottom,
        width: componentWidth,
        height: componentHeight,
        centerX: left + componentWidth / 2,
        centerY: top + componentHeight / 2,
        pixelCount,
      });
    }
  }

  if (!components.length) return null;

  components.sort((a, b) => b.pixelCount - a.pixelCount);
  const largest = components[0];
  const nearbyGap = Math.max(90, Math.min(width, height) * 0.08);
  const significantPixelCount = Math.max(20, largest.pixelCount * 0.08);
  const selectedComponents = components.filter(
    (component) =>
      component === largest ||
      (component.pixelCount >= significantPixelCount &&
        componentDistance(component, largest) <= nearbyGap),
  );

  const bbox = selectedComponents.reduce(
    (acc, component) => ({
      left: Math.min(acc.left, component.left),
      top: Math.min(acc.top, component.top),
      right: Math.max(acc.right, component.right),
      bottom: Math.max(acc.bottom, component.bottom),
      pixelCount: acc.pixelCount + component.pixelCount,
    }),
    {
      left: width,
      top: height,
      right: 0,
      bottom: 0,
      pixelCount: 0,
    },
  );

  const bboxWidth = bbox.right - bbox.left + 1;
  const bboxHeight = bbox.bottom - bbox.top + 1;

  if (bbox.pixelCount < minimumPixels || bboxWidth < 3 || bboxHeight < 3) {
    return null;
  }

  return {
    left: bbox.left,
    top: bbox.top,
    right: bbox.right,
    bottom: bbox.bottom,
    width: bboxWidth,
    height: bboxHeight,
    centerX: bbox.left + bboxWidth / 2,
    centerY: bbox.top + bboxHeight / 2,
    pixelCount: bbox.pixelCount,
  };
}

async function detectApplicationHighlightBBoxFromImage(imagePath) {
  try {
    const image = await readImagePixels(imagePath);
    return detectApplicationHighlightBBoxFromPixels(image);
  } catch (error) {
    if (DEBUG_CAPTURE) {
      console.log(
        `[WARN] Falha ao detectar bbox da aplicacao: ${error.message}`,
      );
    }
    return null;
  }
}

function calculateApplicationCenterDelta(clip, bbox) {
  const desiredCenterX = clip.width * 0.5;
  const desiredCenterY = clip.height * 0.52;
  const deltaX = desiredCenterX - bbox.centerX;
  const deltaY = desiredCenterY - bbox.centerY;

  return {
    desiredCenterX,
    desiredCenterY,
    deltaX,
    deltaY,
    absDeltaX: Math.abs(deltaX),
    absDeltaY: Math.abs(deltaY),
    distance: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
    centered: Math.abs(deltaX) <= 60 && Math.abs(deltaY) <= 60,
  };
}

async function centerMapOnDetectedApplication(page, clip, bbox) {
  const delta = calculateApplicationCenterDelta(clip, bbox);
  if (delta.centered) {
    return {
      ...delta,
      attempted: false,
    };
  }

  const startX = clip.x + clip.width / 2;
  const startY = clip.y + clip.height / 2;
  const endX = startX + delta.deltaX * 0.9;
  const endY = startY + delta.deltaY * 0.9;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1100);

  return {
    ...delta,
    attempted: true,
    startX,
    startY,
    endX,
    endY,
  };
}

async function findMapCaptureTarget(page, sidebarResult) {
  return await page.evaluate(() => {
    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width >= 300 &&
        box.height >= 250
      );
    }

    function rectFor(el) {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        area: box.width * box.height,
      };
    }

    function rightCaptureBoundary() {
      const drawerCandidates = Array.from(document.querySelectorAll("body *"))
        .filter((el) => {
          const style = window.getComputedStyle(el);
          const box = el.getBoundingClientRect();
          const text = (el.innerText || el.textContent || "").replace(
            /\s+/g,
            " ",
          );
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            box.width >= 240 &&
            box.height >= 400 &&
            box.left > window.innerWidth * 0.55 &&
            box.right <= window.innerWidth + 2 &&
            /Flight Details/i.test(text)
          );
        })
        .map((el) => el.getBoundingClientRect())
        .sort((a, b) => a.left - b.left);

      return drawerCandidates[0]?.left ?? window.innerWidth;
    }

    const rightBoundary = rightCaptureBoundary();

    function isCleanMapBox(box) {
      const effectiveWidth = Math.min(box.right, rightBoundary) - box.left;
      return (
        effectiveWidth >= 600 &&
        box.height >= 400 &&
        box.left >= 0 &&
        box.top >= 0 &&
        box.right <= window.innerWidth + 2 &&
        box.bottom <= window.innerHeight + 2
      );
    }

    const selectorCandidates = [".mapboxgl-map", ".amap-container"];

    for (const selector of selectorCandidates) {
      const elements = Array.from(document.querySelectorAll(selector))
        .filter(isVisible)
        .map((el, index) => ({ el, index, box: rectFor(el), selector }))
        .filter((item) => isCleanMapBox(item.box))
        .sort((a, b) => b.box.area - a.box.area);

      if (elements.length) {
        return {
          type: "selector",
          selector: elements[0].selector,
          index: elements[0].index,
          box: elements[0].box,
        };
      }
    }

    const canvases = Array.from(document.querySelectorAll("canvas"))
      .map((el, index) => {
        const box = el.getBoundingClientRect();
        return {
          el,
          index,
          box: rectFor(el),
          area: box.width * box.height,
          visible: isVisible(el),
        };
      })
      .filter((item) => item.visible && isCleanMapBox(item.box))
      .sort((a, b) => b.box.area - a.box.area);

    if (canvases.length) {
      return {
        type: "canvas",
        selector: "canvas",
        index: canvases[0].index,
        box: canvases[0].box,
      };
    }

    const genericMapSelectors = ['div[class*="map" i]', 'div[class*="Map" i]'];
    for (const selector of genericMapSelectors) {
      const elements = Array.from(document.querySelectorAll(selector))
        .filter(isVisible)
        .map((el, index) => ({ el, index, box: rectFor(el), selector }))
        .filter((item) => isCleanMapBox(item.box))
        .sort((a, b) => b.box.area - a.box.area);

      if (elements.length) {
        const box = elements[0].box;
        const left = Math.min(box.left + 40, box.right - 600);
        const right = Math.min(box.right, rightBoundary);
        return {
          type: "clip",
          selector: elements[0].selector,
          index: elements[0].index,
          box: {
            ...box,
            left,
            right,
            width: right - left,
            area: (right - left) * box.height,
          },
          clip: {
            x: Math.round(left),
            y: Math.round(box.top),
            width: Math.round(right - left),
            height: Math.round(box.height),
          },
        };
      }
    }

    const genericCandidates = Array.from(document.querySelectorAll("body *"))
      .filter(isVisible)
      .map((el) => {
        const box = rectFor(el);
        const text = (el.innerText || el.textContent || "").replace(
          /\s+/g,
          " ",
        );
        const hasUiText =
          /\bMap\s+List\b/i.test(text) ||
          /\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2}/.test(text) ||
          /\d{4}\/\d{2}\/\d{2}/.test(text);
        return { el, box, text, hasUiText };
      })
      .filter(
        (item) =>
          isCleanMapBox(item.box) && item.box.left >= 260 && !item.hasUiText,
      )
      .sort((a, b) => b.box.area - a.box.area);

    if (genericCandidates.length) {
      const box = genericCandidates[0].box;
      return {
        type: "clip",
        selector: null,
        index: null,
        box,
        clip: {
          x: Math.round(box.left),
          y: Math.round(box.top),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
      };
    }

    const leftBoundary = Math.max(0, window.innerWidth > 1000 ? 8 : 0);
    const topBoundary = 56;
    const bottomBoundary = window.innerHeight;
    const width = rightBoundary - leftBoundary;
    const height = bottomBoundary - topBoundary;

    if (width >= 600 && height >= 400) {
      return {
        type: "manual_clip",
        selector: null,
        index: null,
        box: {
          left: leftBoundary,
          top: topBoundary,
          right: rightBoundary,
          bottom: bottomBoundary,
          width,
          height,
          area: width * height,
        },
        clip: {
          x: Math.round(leftBoundary),
          y: Math.round(topBoundary),
          width: Math.round(width),
          height: Math.round(height),
        },
      };
    }

    return null;
  }, sidebarResult);
}

async function findMapCropTarget(page, sidebarInfo) {
  return await page.evaluate((sidebarInfo) => {
    const margin = 12;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const rowRegex =
      /\d{2}:\d{2}:\d{2}\s*[-~]\s*\d{2}:\d{2}:\d{2}\s+[0-9]+(?:[,.][0-9]+)?\s*ha\s+[0-9]+(?:[,.][0-9]+)?\s*L\b/i;
    const dateRegex = /\d{4}\/\d{2}\/\d{2}/;

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0.05 &&
        box.width > 0 &&
        box.height > 0 &&
        box.right > 0 &&
        box.bottom > 0 &&
        box.left < viewport.width &&
        box.top < viewport.height
      );
    }

    function rectFor(el) {
      const box = el.getBoundingClientRect();
      return {
        left: Math.max(0, box.left),
        top: Math.max(0, box.top),
        right: Math.min(viewport.width, box.right),
        bottom: Math.min(viewport.height, box.bottom),
        width: Math.min(viewport.width, box.right) - Math.max(0, box.left),
        height: Math.min(viewport.height, box.bottom) - Math.max(0, box.top),
        area:
          (Math.min(viewport.width, box.right) - Math.max(0, box.left)) *
          (Math.min(viewport.height, box.bottom) - Math.max(0, box.top)),
      };
    }

    function textFor(el) {
      return (el.innerText || el.textContent || "").replace(/\s+/g, " ");
    }

    const visibleElements = Array.from(document.querySelectorAll("body *"))
      .filter(isVisible)
      .map((el) => ({
        el,
        box: rectFor(el),
        text: textFor(el),
      }));

    const leftPanelBoxes = visibleElements
      .filter((item) => {
        const textLooksLikeFlightList =
          rowRegex.test(item.text) ||
          /\bMap\s+List\b/i.test(item.text) ||
          dateRegex.test(item.text);

        return (
          textLooksLikeFlightList &&
          item.box.left < viewport.width * 0.55 &&
          item.box.width >= 160 &&
          item.box.width <= 720 &&
          item.box.height >= 80
        );
      })
      .map((item) => item.box);

    if (sidebarInfo?.visible && sidebarInfo.box) {
      leftPanelBoxes.push(sidebarInfo.box);
    }

    const leftPanelRight = leftPanelBoxes.length
      ? Math.max(...leftPanelBoxes.map((box) => box.right))
      : null;

    const drawerBoxes = visibleElements
      .filter((item) => {
        return (
          /Flight Details/i.test(item.text) &&
          item.box.left > viewport.width * 0.45 &&
          item.box.width >= 240 &&
          item.box.height >= 300
        );
      })
      .map((item) => item.box)
      .sort((a, b) => a.left - b.left);

    const drawerLeft = drawerBoxes[0]?.left ?? null;

    const overlayTopBottom = (left, right) => {
      return visibleElements
        .filter((item) => {
          const horizontallyIntersects =
            item.box.left < right && item.box.right > left;
          const isTopOverlay =
            item.box.top < 120 &&
            item.box.height <= 90 &&
            (/\bMap\s+List\b/i.test(item.text) ||
              /^Map$/i.test(item.text.trim()) ||
              /^List$/i.test(item.text.trim()));

          return horizontallyIntersects && isTopOverlay;
        })
        .reduce((bottom, item) => Math.max(bottom, item.box.bottom), 0);
    };

    const mapSelectors = [
      ".mapboxgl-map",
      ".amap-container",
      "canvas",
      'div[class*="map" i]',
      'div[class*="Map" i]',
    ];
    const mapCandidates = [];
    const seen = new Set();

    for (const selector of mapSelectors) {
      for (const [index, el] of Array.from(
        document.querySelectorAll(selector),
      ).entries()) {
        if (!isVisible(el) || seen.has(el)) continue;
        seen.add(el);

        const box = rectFor(el);
        if (box.width < 300 || box.height < 250) continue;

        mapCandidates.push({
          selector,
          index,
          box,
          source: selector,
        });
      }
    }

    function buildClipFromBox(box, source) {
      let left = Math.max(box.left, 0);
      let right = Math.min(box.right, viewport.width);
      let top = Math.max(box.top, 56);
      let bottom = Math.min(box.bottom, viewport.height);

      if (leftPanelRight !== null) {
        left = Math.max(left, leftPanelRight + margin);
      }

      if (drawerLeft !== null) {
        right = Math.min(right, drawerLeft - margin);
      }

      const topOverlayBottom = overlayTopBottom(left, right);
      if (topOverlayBottom) {
        top = Math.max(top, topOverlayBottom + margin);
      }

      const width = right - left;
      const height = bottom - top;
      const clipX = Math.max(0, Math.ceil(left));
      const clipY = Math.max(0, Math.ceil(top));
      const clipRight = Math.min(viewport.width, Math.floor(right));
      const clipBottom = Math.min(viewport.height, Math.floor(bottom));

      return {
        source,
        box,
        boundaries: {
          leftPanelRight,
          drawerLeft,
          topOverlayBottom: topOverlayBottom || null,
        },
        clip: {
          x: clipX,
          y: clipY,
          width: Math.max(0, clipRight - clipX),
          height: Math.max(0, clipBottom - clipY),
        },
        area: width * height,
      };
    }

    const targets = mapCandidates
      .map((candidate) => buildClipFromBox(candidate.box, candidate.source))
      .filter(
        (target) =>
          target.clip.width >= 360 &&
          target.clip.height >= 280 &&
          target.clip.x >= 0 &&
          target.clip.y >= 0 &&
          target.clip.x + target.clip.width <= viewport.width + 1 &&
          target.clip.y + target.clip.height <= viewport.height + 1,
      )
      .sort((a, b) => b.area - a.area);

    if (targets.length) {
      return {
        ...targets[0],
        type: "map_crop",
        fallback: false,
      };
    }

    if (mapCandidates.length) {
      const largestMap = mapCandidates
        .slice()
        .sort((a, b) => b.box.area - a.box.area)[0];
      const fallbackTarget = buildClipFromBox(
        largestMap.box,
        `fallback:${largestMap.source}`,
      );

      if (
        fallbackTarget.clip.width >= 300 &&
        fallbackTarget.clip.height >= 240
      ) {
        return {
          ...fallbackTarget,
          type: "map_crop",
          fallback: true,
        };
      }
    }

    const manualLeft =
      leftPanelRight !== null ? leftPanelRight + margin : Math.round(viewport.width * 0.28);
    const manualRight =
      drawerLeft !== null ? drawerLeft - margin : viewport.width - margin;
    const manualTop = 64;
    const manualBottom = viewport.height;
    const manualWidth = manualRight - manualLeft;
    const manualHeight = manualBottom - manualTop;

    if (manualWidth >= 360 && manualHeight >= 280) {
      return {
        type: "map_crop",
        source: "manual_boundaries",
        fallback: true,
        box: {
          left: manualLeft,
          top: manualTop,
          right: manualRight,
          bottom: manualBottom,
          width: manualWidth,
          height: manualHeight,
          area: manualWidth * manualHeight,
        },
        boundaries: {
          leftPanelRight,
          drawerLeft,
          topOverlayBottom: null,
        },
        clip: {
          x: Math.max(0, Math.ceil(manualLeft)),
          y: Math.max(0, Math.ceil(manualTop)),
          width: Math.max(
            0,
            Math.min(viewport.width, Math.floor(manualRight)) -
              Math.max(0, Math.ceil(manualLeft)),
          ),
          height: Math.max(
            0,
            Math.min(viewport.height, Math.floor(manualBottom)) -
              Math.max(0, Math.ceil(manualTop)),
          ),
        },
        area: manualWidth * manualHeight,
      };
    }

    return {
      type: "map_crop",
      source: null,
      fallback: true,
      boundaries: {
        leftPanelRight,
        drawerLeft,
      },
      clip: null,
      reason: "map_crop_clip_not_found_or_too_small",
    };
  }, sidebarInfo);
}

async function captureMapCropScreenshot(page, metadata) {
  if (!CAPTURE_IMAGES) return null;

  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });
  console.log("[INFO] Capturando mapa por crop sem recolher sidebar");
  await saveCaptureDebugImage(page, "debug_before_map_crop");

  const sidebarInfo = await detectLeftSidebar(page);
  const target = await findMapCropTarget(page, sidebarInfo);

  if (
    !target ||
    !target.clip ||
    target.clip.width < 300 ||
    target.clip.height < 240
  ) {
    const debugMetadataPath = saveCaptureDebugMetadata({
      rowIndex: metadata.rowIndex,
      flightRecordNumber: metadata.flightRecordNumber,
      timeRange: metadata.timeRange,
      sidebarInfo,
      target,
      rejectedAt: "map_crop_clip_not_found_or_too_small",
    });

    console.log("[WARN] Captura rejeitada, seguindo próximo voo");
    return {
      imagePath: null,
      mapImagePath: null,
      mapOnlyImagePath: null,
      officialImagePath: null,
      imageCaptureMode: "map_crop_screenshot",
      imageContainsSidebar: null,
      sidebarHidden: false,
      screenshotStatus: "REJECTED_UI_CAPTURE",
      rejectionReason: "map_crop_clip_not_found_or_too_small",
      debugCaptureMetadataPath: debugMetadataPath,
    };
  }

  const outputPath = applicationImagePath(metadata, "map_crop");
  await captureMapCrop(page, target.clip, outputPath);
  await saveCaptureDebugImage(page, "debug_map_crop_clip", {
    clip: target.clip,
  });

  const debugMetadataPath = saveCaptureDebugMetadata({
    rowIndex: metadata.rowIndex,
    flightRecordNumber: metadata.flightRecordNumber,
    timeRange: metadata.timeRange,
    sidebarInfo,
    target,
    outputPath,
    ready: true,
  });

  console.log(`[OK] Captura map-crop salva: ${outputPath}`);

  return {
    imagePath: outputPath,
    mapImagePath: outputPath,
    mapOnlyImagePath: outputPath,
    officialImagePath: null,
    imageCaptureMode: "map_crop_screenshot",
    imageContainsSidebar: false,
    sidebarHidden: false,
    screenshotStatus: "READY",
    debugCaptureMetadataPath: debugMetadataPath,
  };
}

async function captureCenteredMapCropScreenshot(page, metadata) {
  if (!CAPTURE_IMAGES) return null;

  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });
  console.log("[INFO] Capturando mapa por crop centralizado sem recolher sidebar");
  await saveCaptureDebugImage(page, "debug_before_map_crop_centered");

  const sidebarInfo = await detectLeftSidebar(page);
  const target = await findMapCropTarget(page, sidebarInfo);

  if (
    !target ||
    !target.clip ||
    target.clip.width < 300 ||
    target.clip.height < 240
  ) {
    const debugMetadataPath = saveCenterDebugMetadata({
      rowIndex: metadata.rowIndex,
      flightRecordNumber: metadata.flightRecordNumber,
      timeRange: metadata.timeRange,
      sidebarInfo,
      target,
      rejectedAt: "map_crop_clip_not_found_or_too_small",
    });

    console.log("[WARN] Captura rejeitada, seguindo proximo voo");
    return {
      imagePath: null,
      mapImagePath: null,
      mapOnlyImagePath: null,
      officialImagePath: null,
      imageCaptureMode: "map_crop_centered_screenshot",
      imageContainsSidebar: null,
      sidebarHidden: false,
      screenshotStatus: "REJECTED_UI_CAPTURE",
      rejectionReason: "map_crop_clip_not_found_or_too_small",
      cropMode: null,
      centerStatus: null,
      applicationBBox: null,
      centerAttempts: 0,
      debugCaptureMetadataPath: debugMetadataPath,
    };
  }

  const outputPath = applicationImagePath(metadata, "map_crop_centered");
  const tempFiles = [];
  const attemptHistory = [];
  const maxCenterAttempts = 2;

  function probePath(debugName, tempName) {
    if (DEBUG_CAPTURE) return captureDebugPath(debugName, "png");

    const tempPath = captureCenterTempPath(metadata, tempName);
    tempFiles.push(tempPath);
    return tempPath;
  }

  try {
    const beforePath = probePath("debug_center_before", "before");
    await captureMapCrop(page, target.clip, beforePath);

    console.log("[INFO] Detectando bbox da aplica\u00e7\u00e3o no mapa");
    let applicationBBox =
      await detectApplicationHighlightBBoxFromImage(beforePath);

    if (!applicationBBox) {
      console.log(
        "[WARN] BBox n\u00e3o encontrado, usando map-crop fallback",
      );
      await captureMapCrop(page, target.clip, outputPath);

      if (DEBUG_CAPTURE) {
        fs.copyFileSync(outputPath, captureDebugPath("debug_center_final", "png"));
      }

      const debugMetadataPath = saveCenterDebugMetadata({
        rowIndex: metadata.rowIndex,
        flightRecordNumber: metadata.flightRecordNumber,
        timeRange: metadata.timeRange,
        sidebarInfo,
        target,
        outputPath,
        centerStatus: "BBOX_NOT_FOUND_FALLBACK",
        cropMode: "map_crop_fallback",
        applicationBBox: null,
        centerAttempts: 0,
        reviewRequired: true,
      });

      console.log(`[OK] Captura map-crop-centered fallback salva: ${outputPath}`);

      return {
        imagePath: outputPath,
        mapImagePath: outputPath,
        mapOnlyImagePath: outputPath,
        officialImagePath: null,
        imageCaptureMode: "map_crop_centered_screenshot",
        imageContainsSidebar: false,
        sidebarHidden: false,
        screenshotStatus: "READY",
        cropMode: "map_crop_fallback",
        centerStatus: "BBOX_NOT_FOUND_FALLBACK",
        applicationBBox: null,
        centerAttempts: 0,
        reviewRequired: true,
        debugCaptureMetadataPath: debugMetadataPath,
      };
    }

    console.log("[OK] BBox aplica\u00e7\u00e3o detectado");

    let currentPath = beforePath;
    let currentDelta = calculateApplicationCenterDelta(
      target.clip,
      applicationBBox,
    );
    let bestCapture = {
      path: currentPath,
      bbox: applicationBBox,
      delta: currentDelta,
      distance: currentDelta.distance,
      label: "before",
    };
    let centerAttempts = 0;
    let centeredLogged = false;

    for (let attempt = 1; attempt <= maxCenterAttempts; attempt++) {
      if (currentDelta.centered) {
        console.log("[OK] Aplica\u00e7\u00e3o centralizada");
        centeredLogged = true;
        break;
      }

      console.log("[INFO] Centralizando aplica\u00e7\u00e3o no mapa");
      const panResult = await centerMapOnDetectedApplication(
        page,
        target.clip,
        applicationBBox,
      );
      centerAttempts++;

      const afterPath = probePath(
        `debug_center_after_attempt_${attempt}`,
        `after_attempt_${attempt}`,
      );
      await captureMapCrop(page, target.clip, afterPath);

      console.log("[INFO] Detectando bbox da aplica\u00e7\u00e3o no mapa");
      const afterBBox = await detectApplicationHighlightBBoxFromImage(afterPath);
      const attemptMetadata = {
        attempt,
        bboxBefore: applicationBBox,
        deltaBefore: currentDelta,
        panResult,
        capturePath: DEBUG_CAPTURE ? afterPath : null,
        bboxAfter: afterBBox,
        deltaAfter: null,
      };

      if (!afterBBox) {
        attemptHistory.push(attemptMetadata);
        break;
      }

      console.log("[OK] BBox aplica\u00e7\u00e3o detectado");
      applicationBBox = afterBBox;
      currentPath = afterPath;
      currentDelta = calculateApplicationCenterDelta(target.clip, applicationBBox);
      attemptMetadata.deltaAfter = currentDelta;
      attemptHistory.push(attemptMetadata);

      if (currentDelta.distance < bestCapture.distance) {
        bestCapture = {
          path: currentPath,
          bbox: applicationBBox,
          delta: currentDelta,
          distance: currentDelta.distance,
          label: `after_attempt_${attempt}`,
        };
      }
    }

    const isCentered = currentDelta.centered;
    const centerStatus = isCentered
      ? "CENTERED"
      : "CENTERING_ATTEMPTED_FALLBACK";
    const finalBBox = isCentered ? applicationBBox : bestCapture.bbox;
    const finalDelta = isCentered ? currentDelta : bestCapture.delta;
    const reviewRequired = !isCentered;

    if (isCentered) {
      if (!centeredLogged) {
        console.log("[OK] Aplica\u00e7\u00e3o centralizada");
      }
      await captureMapCrop(page, target.clip, outputPath);
    } else if (bestCapture.path) {
      fs.copyFileSync(bestCapture.path, outputPath);
    } else {
      await captureMapCrop(page, target.clip, outputPath);
    }

    if (DEBUG_CAPTURE) {
      fs.copyFileSync(outputPath, captureDebugPath("debug_center_final", "png"));
    }

    const debugMetadataPath = saveCenterDebugMetadata({
      rowIndex: metadata.rowIndex,
      flightRecordNumber: metadata.flightRecordNumber,
      timeRange: metadata.timeRange,
      sidebarInfo,
      target,
      outputPath,
      centerStatus,
      cropMode: "centered_application",
      applicationBBox: finalBBox,
      centerAttempts,
      finalDelta,
      bestCapture: {
        label: bestCapture.label,
        distance: bestCapture.distance,
        capturePath: DEBUG_CAPTURE ? bestCapture.path : null,
      },
      attemptHistory,
      reviewRequired,
    });

    console.log(`[OK] Captura map-crop-centered salva: ${outputPath}`);

    return {
      imagePath: outputPath,
      mapImagePath: outputPath,
      mapOnlyImagePath: outputPath,
      officialImagePath: null,
      imageCaptureMode: "map_crop_centered_screenshot",
      imageContainsSidebar: false,
      sidebarHidden: false,
      screenshotStatus: "READY",
      cropMode: "centered_application",
      centerStatus,
      applicationBBox: finalBBox,
      centerAttempts,
      reviewRequired,
      debugCaptureMetadataPath: debugMetadataPath,
    };
  } finally {
    removeFilesQuietly(tempFiles);
  }
}

async function captureMapContainerScreenshot(page, metadata) {
  if (!CAPTURE_IMAGES) return null;

  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });
  await saveCaptureDebugImage(page, "debug_before_sidebar");
  console.log("[INFO] Ocultando sidebar para captura");
  const sidebarResult = await hideDjiLeftSidebar(page);
  await saveCaptureDebugImage(page, "debug_after_sidebar");
  const sidebarVisible = await leftSidebarLooksVisible(page);

  if (!sidebarResult.hidden || sidebarVisible) {
    const debugMetadataPath = saveCaptureDebugMetadata({
      rowIndex: metadata.rowIndex,
      flightRecordNumber: metadata.flightRecordNumber,
      timeRange: metadata.timeRange,
      sidebarResult,
      sidebarVisible,
      rejectedAt: "sidebar_visible_after_hide_attempt",
    });

    return {
      imagePath: null,
      mapImagePath: null,
      mapOnlyImagePath: null,
      officialImagePath: null,
      imageCaptureMode: "map_container_screenshot",
      imageContainsSidebar: true,
      sidebarHidden: false,
      screenshotStatus: "REJECTED_UI_CAPTURE",
      rejectionReason: "sidebar_visible_after_hide_attempt",
      debugCaptureMetadataPath: debugMetadataPath,
    };
  }

  const target = await findMapCaptureTarget(page, sidebarResult);

  if (
    !target ||
    !target.box ||
    target.box.width < 600 ||
    target.box.height < 400
  ) {
    const debugMetadataPath = saveCaptureDebugMetadata({
      rowIndex: metadata.rowIndex,
      flightRecordNumber: metadata.flightRecordNumber,
      timeRange: metadata.timeRange,
      sidebarResult,
      target,
      rejectedAt: "map_container_not_found_or_too_small",
    });

    return {
      imagePath: null,
      mapImagePath: null,
      mapOnlyImagePath: null,
      officialImagePath: null,
      imageCaptureMode: "map_container_screenshot",
      imageContainsSidebar: false,
      sidebarHidden: true,
      screenshotStatus: "REJECTED_UI_CAPTURE",
      rejectionReason: "map_container_not_found_or_too_small",
      debugCaptureMetadataPath: debugMetadataPath,
    };
  }

  const outputPath = applicationImagePath(metadata, "map_only");

  if (target.type === "selector") {
    await page.locator(target.selector).nth(target.index).screenshot({
      path: outputPath,
    });
  } else if (target.type === "canvas") {
    await page.locator("canvas").nth(target.index).screenshot({
      path: outputPath,
    });
  } else if (target.clip) {
    await page.screenshot({ path: outputPath, clip: target.clip });
  } else {
    throw new Error("Alvo de captura do mapa sem selector/canvas/clip.");
  }

  console.log(`[OK] Captura map-only salva: ${outputPath}`);

  await saveCaptureDebugImage(page, "debug_map_clip", {
    clip: target.clip || {
      x: Math.round(target.box.left),
      y: Math.round(target.box.top),
      width: Math.round(target.box.width),
      height: Math.round(target.box.height),
    },
  });
  const debugMetadataPath = saveCaptureDebugMetadata({
    rowIndex: metadata.rowIndex,
    flightRecordNumber: metadata.flightRecordNumber,
    timeRange: metadata.timeRange,
    sidebarResult,
    target,
    outputPath,
    ready: true,
  });

  return {
    imagePath: outputPath,
    mapImagePath: outputPath,
    mapOnlyImagePath: outputPath,
    officialImagePath: null,
    imageCaptureMode: "map_container_screenshot",
    imageContainsSidebar: false,
    sidebarHidden: true,
    screenshotStatus: "READY",
    debugCaptureMetadataPath: debugMetadataPath,
  };
}

async function captureApplicationImage(page, metadata) {
  if (!CAPTURE_IMAGES) {
    return {
      imagePath: null,
      mapImagePath: null,
      mapOnlyImagePath: null,
      officialImagePath: null,
      imageCaptureMode: null,
      imageContainsSidebar: null,
      screenshotStatus: "NOT_CAPTURED",
    };
  }

  if (CAPTURE_MODE === "map-crop") {
    return await captureMapCropScreenshot(page, metadata).catch((error) => {
      console.log(
        `[WARN] Falha na captura map-crop do voo ${metadata.rowIndex}: ${error.message}`,
      );
      console.log("[WARN] Captura rejeitada, seguindo próximo voo");
      return {
        imagePath: null,
        mapImagePath: null,
        mapOnlyImagePath: null,
        officialImagePath: null,
        imageCaptureMode: "map_crop_screenshot",
        imageContainsSidebar: null,
        sidebarHidden: false,
        screenshotStatus: "REJECTED_UI_CAPTURE",
        rejectionReason: error instanceof Error ? error.message : String(error),
      };
    });
  }

  if (CAPTURE_MODE === "map-crop-centered") {
    return await captureCenteredMapCropScreenshot(page, metadata).catch(
      (error) => {
        console.log(
          `[WARN] Falha na captura map-crop-centered do voo ${metadata.rowIndex}: ${error.message}`,
        );
        console.log("[WARN] Captura rejeitada, seguindo proximo voo");
        return {
          imagePath: null,
          mapImagePath: null,
          mapOnlyImagePath: null,
          officialImagePath: null,
          imageCaptureMode: "map_crop_centered_screenshot",
          imageContainsSidebar: null,
          sidebarHidden: false,
          screenshotStatus: "REJECTED_UI_CAPTURE",
          rejectionReason:
            error instanceof Error ? error.message : String(error),
          cropMode: null,
          centerStatus: null,
          applicationBBox: null,
          centerAttempts: 0,
        };
      },
    );
  }

  if (CAPTURE_MODE === "auto" || CAPTURE_MODE === "official") {
    const officialImagePath = await tryOfficialScreenshot(page, metadata).catch(
      (error) => {
        console.log(
          `[WARN] Falha no Screenshot oficial do voo ${metadata.rowIndex}: ${error.message}`,
        );
        return null;
      },
    );

    if (officialImagePath) {
      return {
        imagePath: officialImagePath,
        mapImagePath: null,
        mapOnlyImagePath: officialImagePath,
        officialImagePath,
        imageCaptureMode: "official_dji_screenshot",
        imageContainsSidebar: false,
        screenshotStatus: "READY",
      };
    }

    if (CAPTURE_MODE === "official") {
      return {
        imagePath: null,
        mapImagePath: null,
        mapOnlyImagePath: null,
        officialImagePath: null,
        imageCaptureMode: "official_dji_screenshot",
        imageContainsSidebar: null,
        screenshotStatus: "REJECTED_UI_CAPTURE",
        rejectionReason: "official_dji_screenshot_failed",
      };
    }
  }

  return await captureMapContainerScreenshot(page, metadata).catch((error) => {
    console.log(
      `[WARN] Falha na captura map-only do voo ${metadata.rowIndex}: ${error.message}`,
    );
    return {
      imagePath: null,
      mapImagePath: null,
      mapOnlyImagePath: null,
      officialImagePath: null,
      imageCaptureMode: "map_container_screenshot",
      imageContainsSidebar: null,
      screenshotStatus: "REJECTED_UI_CAPTURE",
      rejectionReason: error instanceof Error ? error.message : String(error),
    };
  });
}

async function closeFlightDetailsDrawer(page) {
  const drawer = page
    .locator(".ant-drawer")
    .filter({ hasText: /Flight Details/i })
    .first();
  const visible = await drawer.isVisible().catch(() => false);
  if (!visible) return;

  const closeButton = drawer.locator(".ant-drawer-close").first();
  try {
    await closeButton.click({ timeout: 4000, force: true });
  } catch {
    await page.keyboard.press("Escape");
  }

  await page.waitForTimeout(1800);
}

function inventoryPath() {
  return path.join(
    OUTPUT_ROOT,
    `dji_inventory_${dateToFilePart(TARGET_DATE)}.json`,
  );
}

async function collectInventory(page) {
  await ensureRecordsPage(page);
  await clickMapTab(page);

  const dateCardInfo = await findAndClickDateCard(page, TARGET_DATE);
  await expandDateCard(page, dateCardInfo);

  const daySummaryText = [dateCardInfo?.text || "", await pageText(page)].join(
    "\n",
  );
  const daySummary = parseDaySummaryForDate(daySummaryText, TARGET_DATE);
  console.log(
    `[INFO] Resumo do dia DJI: ${daySummary.expectedFlightsFromDayCard ?? "?"} voos, ${daySummary.expectedAreaHaFromDayCard ?? "?"} ha, ${daySummary.expectedPayloadLFromDayCard ?? "?"} L.`,
  );

  const extraction = await loadAllFlightRows(page, {
    expectedFlights: daySummary.expectedFlightsFromDayCard,
  });
  const rows = extraction.rows;
  const selectedRows = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;

  console.log(`[OK] Voos/aplicacoes encontrados no dia: ${rows.length}`);
  console.log(
    `[INFO] Linhas ignoradas na lista: ${extraction.ignoredRows.length}`,
  );
  if (LIMIT > 0) console.log(`[INFO] Limit aplicado: ${selectedRows.length}`);

  const flights = [];

  for (let selectedIndex = 0; selectedIndex < selectedRows.length; selectedIndex++) {
    const row = selectedRows[selectedIndex];
    const hasNextFlight = selectedIndex < selectedRows.length - 1;

    console.log(`[INFO] Coletando voo ${row.rowIndex}: ${row.timeRange}`);

    try {
      if (CAPTURE_MODE === "map-crop" || CAPTURE_MODE === "map-crop-centered") {
        await assertFlightListSidebarOpen(page);
      } else {
        await ensureFlightListSidebarOpen(page);
      }
      console.log(`[INFO] Selecionando voo ${row.rowIndex}`);
      await clickFlightRow(page, row);
      const metadata = await readFlightDetails(page, row);
      await page.waitForTimeout(1500);

      const imageCapture = await captureApplicationImage(page, metadata);

      flights.push({
        ...metadata,
        ...imageCapture,
      });
    } catch (error) {
      flights.push({
        imageScope: "application",
        source: "DJI SmartFarm",
        djiDate: normalizeDate(TARGET_DATE),
        rowIndex: row.rowIndex,
        timeRange: row.timeRange,
        area: row.area,
        areaValue: parseNumber(row.area),
        payload: row.payload,
        payloadValue: parseNumber(row.payload),
        duration: row.duration,
        rawRowText: row.rawRowText,
        imagePath: null,
        mapImagePath: null,
        mapOnlyImagePath: null,
        officialImagePath: null,
        imageCaptureMode: null,
        imageContainsSidebar: null,
        screenshotStatus: "REJECTED_UI_CAPTURE",
        error: error instanceof Error ? error.message : String(error),
        capturedAt: new Date().toISOString(),
      });

      await saveDebug(page, `erro_voo_${row.rowIndex}`);
    } finally {
      await closeFlightDetailsDrawer(page);

      if (
        hasNextFlight &&
        CAPTURE_MODE !== "map-crop" &&
        CAPTURE_MODE !== "map-crop-centered"
      ) {
        console.log("[INFO] Reabrindo sidebar para próximo voo");
        await ensureFlightListSidebarOpen(page);
      }
    }
  }

  return {
    osId: OS_ID,
    imageScope: "application_inventory",
    source: "DJI SmartFarm",
    djiDate: normalizeDate(TARGET_DATE),
    generatedAt: new Date().toISOString(),
    recordsUrl: buildRecordsUrl(),
    captureImages: CAPTURE_IMAGES,
    captureMode: CAPTURE_MODE,
    expectedFlightsFromDayCard: daySummary.expectedFlightsFromDayCard,
    expectedAreaHaFromDayCard: daySummary.expectedAreaHaFromDayCard,
    expectedPayloadLFromDayCard: daySummary.expectedPayloadLFromDayCard,
    expectedDurationFromDayCard: daySummary.expectedDurationFromDayCard,
    rawDayCardText: daySummary.rawDayCardText,
    totalRowsDetected: extraction.totalRowsDetected,
    totalRowsSelected: selectedRows.length,
    totalIgnoredRows: extraction.ignoredRows.length,
    totalFlightsCaptured: flights.length,
    ignoredRows: extraction.ignoredRows,
    flights,
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  fs.mkdirSync(APPLICATION_IMAGE_DIR, { recursive: true });

  console.log("[INFO] Coletando inventario DJI por data...");
  console.log(`[INFO] OS: ${OS_ID}`);
  console.log(`[INFO] Data: ${normalizeDate(TARGET_DATE)}`);
  console.log(`[INFO] Headless: ${HEADLESS}`);
  console.log(`[INFO] Capturar imagens individuais: ${CAPTURE_IMAGES}`);
  console.log(`[INFO] Modo de captura: ${CAPTURE_MODE}`);
  console.log(`[INFO] Debug captura: ${DEBUG_CAPTURE}`);
  console.log(`[INFO] Saida: ${OUTPUT_ROOT}`);

  if (CLEAN_EXISTING) {
    const sourcePath = inventoryPath();
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Inventario bruto nao encontrado: ${sourcePath}`);
    }

    const inventory = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    saveCleanInventory(inventory);
    return;
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: "chrome",
    headless: HEADLESS,
    acceptDownloads: true,
    downloadsPath: APPLICATION_IMAGE_DIR,
    viewport: { width: 1600, height: 900 },
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--window-size=1600,900",
    ],
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    const inventory = await collectInventory(page);
    const outPath = inventoryPath();
    fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2), "utf8");

    console.log("");
    console.log("[FINALIZADO] Inventario DJI salvo.");
    console.log(`[OK] Voos capturados: ${inventory.totalFlightsCaptured}`);
    console.log(`[OK] JSON: ${outPath}`);
    saveCleanInventory(inventory);
  } catch (error) {
    await saveDebug(page, "erro_final_inventario");
    throw error;
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error("[ERRO]", error.message);
  process.exit(1);
});
