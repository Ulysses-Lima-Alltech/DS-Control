const fs = require("fs");
const path = require("path");

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;

  return value;
}

const OS_ID = getArg("--os-id", "134");
const TARGET_DATE = normalizeDate(
  getArg("--date", process.argv[2] || "2026/05/20"),
);
const BASE_DIR = path.resolve(__dirname, "downloads-dji", `os-${OS_ID}-v2`);
const DATE_FILE_PART = dateToFilePart(TARGET_DATE);
const APPLICATIONS_PATH = path.resolve(
  getArg(
    "--applications",
    path.join(BASE_DIR, `os_${OS_ID}_aplicacoes_v2.json`),
  ),
);
const INVENTORY_PATH = path.resolve(
  getArg(
    "--inventory",
    path.join(BASE_DIR, `dji_inventory_${DATE_FILE_PART}_clean.json`),
  ),
);
const OUTPUT_JSON_PATH = path.join(
  BASE_DIR,
  `dji_application_groups_${DATE_FILE_PART}.json`,
);
const OUTPUT_CSV_PATH = path.join(
  BASE_DIR,
  `dji_application_groups_${DATE_FILE_PART}.csv`,
);
const REVIEW_ROOT = path.join(BASE_DIR, "application-review", DATE_FILE_PART);
const STRONG_TOLERANCE_PERCENT = 5;
const CANDIDATE_TOLERANCE_PERCENT = 15;
const MAX_CANDIDATE_GROUPS = Number.parseInt(
  getArg("--max-candidates", "5"),
  10,
);

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
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function compact(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function safeFolderName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pickFirst(source, keys) {
  for (const key of keys) {
    if (
      source &&
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ""
    ) {
      return source[key];
    }
  }

  return null;
}

function findNestedValue(source, keyMatchers) {
  const stack = [source];
  const seen = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = compact(key);
      if (
        keyMatchers.some((matcher) =>
          typeof matcher === "string"
            ? normalizedKey === compact(matcher)
            : matcher.test(normalizedKey),
        ) &&
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        return value;
      }
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }

  return null;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.applications)) return value.applications;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function fallbackApplicationsForKnownOsDate() {
  if (String(OS_ID) !== "134" || TARGET_DATE !== "2026/05/20") return [];

  return [
    {
      applicationId: "os-134-2026-05-20-f78-t06",
      plot: "F78 T06",
      pilot: "André Lucas da Silva",
      drone: "DS 19",
      dsAreaHa: 19.93,
      applicationDate: "2026/05/20",
      source: "fallback_from_task_context",
    },
    {
      applicationId: "os-134-2026-05-20-f44-t38",
      plot: "F44 T38",
      pilot: "André Lucas da Silva",
      drone: "DS 19",
      dsAreaHa: 14.82,
      applicationDate: "2026/05/20",
      source: "fallback_from_task_context",
    },
    {
      applicationId: "os-134-2026-05-20-f44-t07",
      plot: "F44 T07",
      pilot: "André Lucas da Silva",
      drone: "DS 19",
      dsAreaHa: 2.55,
      applicationDate: "2026/05/20",
      source: "fallback_from_task_context",
    },
  ];
}

function normalizeApplication(application, index) {
  const applicationId =
    pickFirst(application, ["applicationId", "id", "_id", "uuid"]) ||
    findNestedValue(application, ["applicationId", "id"]);
  const plot =
    pickFirst(application, [
      "plot",
      "talhao",
      "field",
      "fieldName",
      "areaName",
    ]) ||
    findNestedValue(application, [
      "plot",
      "talhao",
      "fieldname",
      "areaname",
      /talh/,
    ]);
  const pilot =
    pickFirst(application, ["pilot", "pilotName", "operator", "applicator"]) ||
    findNestedValue(application, [
      "pilot",
      "pilotname",
      "operator",
      "applicator",
    ]);
  const drone =
    pickFirst(application, ["drone", "droneName", "aircraft", "device"]) ||
    findNestedValue(application, ["drone", "dronename", "aircraft", "device"]);
  const applicationDate =
    pickFirst(application, [
      "applicationDate",
      "date",
      "dataAplicacao",
      "appliedAt",
      "startedAt",
    ]) ||
    findNestedValue(application, [
      "applicationdate",
      "dataaplicacao",
      "appliedat",
      "startedat",
      "date",
    ]);
  const dsAreaHa =
    parseNumber(
      pickFirst(application, [
        "dsAreaHa",
        "areaHa",
        "hectares",
        "areaAplicada",
        "appliedArea",
        "applicationArea",
        "area",
      ]),
    ) ??
    parseNumber(
      findNestedValue(application, [
        "dsareaha",
        "areaha",
        "hectares",
        "areaaplicada",
        "appliedarea",
        "applicationarea",
      ]),
    );

  return {
    applicationId: String(applicationId || `application-${index + 1}`),
    plot: String(plot || `Aplicacao ${index + 1}`),
    pilot: pilot ? String(pilot) : null,
    drone: drone ? String(drone) : null,
    dsAreaHa,
    applicationDate: applicationDate ? normalizeDate(applicationDate) : null,
    rawApplication: application,
    source: application.source || "applications_json",
  };
}

function loadApplications() {
  if (!fs.existsSync(APPLICATIONS_PATH)) {
    const fallback = fallbackApplicationsForKnownOsDate();
    if (fallback.length) {
      console.log(
        `[WARN] JSON de aplicacoes nao encontrado: ${APPLICATIONS_PATH}`,
      );
      console.log(
        "[WARN] Usando fallback explicito informado para OS 134 em 2026/05/20.",
      );
      return fallback.map(normalizeApplication);
    }

    throw new Error(`JSON de aplicacoes nao encontrado: ${APPLICATIONS_PATH}`);
  }

  const raw = readJson(APPLICATIONS_PATH);
  const applications = asArray(raw).map(normalizeApplication);

  return applications.filter((application) => {
    if (!application.applicationDate) return true;
    return application.applicationDate === TARGET_DATE;
  });
}

function loadInventory() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error(`Inventario DJI limpo nao encontrado: ${INVENTORY_PATH}`);
  }

  const inventory = readJson(INVENTORY_PATH);
  const flights = asArray(inventory.flights)
    .filter(
      (flight) =>
        normalizeDate(flight.djiDate || inventory.djiDate) === TARGET_DATE,
    )
    .filter(
      (flight) =>
        flight.flightRecordNumber && parseNumber(flight.areaValue) !== null,
    )
    .sort((a, b) =>
      String(a.startTime || "").localeCompare(String(b.startTime || "")),
    );

  return { inventory, flights };
}

function confidenceFromDifference(areaDifferencePercent, status) {
  if (status === "strong") {
    return round(
      0.95 - (areaDifferencePercent / STRONG_TOLERANCE_PERCENT) * 0.1,
      2,
    );
  }

  return round(
    0.85 -
      ((areaDifferencePercent - STRONG_TOLERANCE_PERCENT) /
        (CANDIDATE_TOLERANCE_PERCENT - STRONG_TOLERANCE_PERCENT)) *
        0.25,
    2,
  );
}

function createCandidateGroup(
  application,
  groupFlights,
  selection = "area_window",
) {
  const targetArea = application.dsAreaHa;
  const totalArea = groupFlights.reduce(
    (sum, flight) => sum + (parseNumber(flight.areaValue) || 0),
    0,
  );
  const differenceHa = totalArea - targetArea;
  const differencePercent = Math.abs(differenceHa / targetArea) * 100;
  const status =
    differencePercent <= STRONG_TOLERANCE_PERCENT ? "strong" : "candidate";

  return {
    status,
    selection,
    startTime: groupFlights[0].startTime || null,
    endTime: groupFlights[groupFlights.length - 1].endTime || null,
    totalDjiAreaHa: round(totalArea, 2),
    areaDifferenceHa: round(differenceHa, 2),
    areaDifferencePercent: round(differencePercent, 2),
    flightCount: groupFlights.length,
    flightRecordNumbers: groupFlights.map((item) => item.flightRecordNumber),
    imagePaths: groupFlights
      .map(
        (item) => item.imagePath || item.mapImagePath || item.officialImagePath,
      )
      .filter(Boolean),
    djiFlights: groupFlights.map((item) => ({
      flightRecordNumber: item.flightRecordNumber,
      startTime: item.startTime,
      endTime: item.endTime,
      areaValue: item.areaValue,
      payloadValue: item.payloadValue,
      drone: item.drone || item.device || null,
      pilot: item.pilot || item.operator || null,
      imagePath:
        item.imagePath || item.mapImagePath || item.officialImagePath || null,
    })),
    matchConfidence: confidenceFromDifference(differencePercent, status),
    reviewRequired: true,
  };
}

function buildCandidateGroups(application, flights) {
  const groups = [];
  const targetArea = application.dsAreaHa;

  if (!targetArea || targetArea <= 0) return groups;

  for (let startIndex = 0; startIndex < flights.length; startIndex++) {
    let totalArea = 0;

    for (let endIndex = startIndex; endIndex < flights.length; endIndex++) {
      const groupFlights = flights.slice(startIndex, endIndex + 1);
      const flight = flights[endIndex];
      totalArea += parseNumber(flight.areaValue) || 0;

      const differenceHa = totalArea - targetArea;
      const differencePercent = Math.abs(differenceHa / targetArea) * 100;

      if (differencePercent > CANDIDATE_TOLERANCE_PERCENT) {
        if (totalArea > targetArea) break;
        continue;
      }

      groups.push(createCandidateGroup(application, groupFlights));
    }
  }

  return groups
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "strong" ? -1 : 1;
      if (a.areaDifferencePercent !== b.areaDifferencePercent) {
        return a.areaDifferencePercent - b.areaDifferencePercent;
      }
      return a.flightCount - b.flightCount;
    })
    .slice(0, MAX_CANDIDATE_GROUPS);
}

function permutations(items) {
  if (items.length <= 1) return [items];

  const result = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const permutation of permutations(rest)) {
      result.push([item, ...permutation]);
    }
  });

  return result;
}

function buildFlightPartitions(flights, groupCount) {
  const partitions = [];

  function walk(startIndex, remainingGroups, current) {
    if (remainingGroups === 1) {
      if (startIndex < flights.length) {
        partitions.push([...current, flights.slice(startIndex)]);
      }
      return;
    }

    const maxEndIndex = flights.length - remainingGroups + 1;
    for (let endIndex = startIndex + 1; endIndex <= maxEndIndex; endIndex++) {
      walk(endIndex, remainingGroups - 1, [
        ...current,
        flights.slice(startIndex, endIndex),
      ]);
    }
  }

  if (groupCount > 0 && flights.length >= groupCount) {
    walk(0, groupCount, []);
  }

  return partitions;
}

function findBestSequentialAssignment(applications, flights) {
  if (!applications.length || applications.length > 7) return null;

  const partitions = buildFlightPartitions(flights, applications.length);
  const applicationPermutations = permutations(applications);
  let best = null;

  for (const partition of partitions) {
    for (const orderedApplications of applicationPermutations) {
      const groups = orderedApplications.map((application, index) =>
        createCandidateGroup(
          application,
          partition[index],
          "non_overlapping_primary",
        ),
      );
      const maxDifferencePercent = Math.max(
        ...groups.map((group) => group.areaDifferencePercent),
      );
      const totalDifferencePercent = groups.reduce(
        (sum, group) => sum + group.areaDifferencePercent,
        0,
      );
      const strongCount = groups.filter(
        (group) => group.status === "strong",
      ).length;
      const score = {
        accepted: maxDifferencePercent <= CANDIDATE_TOLERANCE_PERCENT,
        maxDifferencePercent,
        totalDifferencePercent,
        strongCount,
      };
      const current = { orderedApplications, groups, score };

      if (!best) {
        best = current;
        continue;
      }

      if (Number(score.accepted) !== Number(best.score.accepted)) {
        if (score.accepted) best = current;
        continue;
      }

      if (score.maxDifferencePercent !== best.score.maxDifferencePercent) {
        if (score.maxDifferencePercent < best.score.maxDifferencePercent) {
          best = current;
        }
        continue;
      }

      if (score.totalDifferencePercent !== best.score.totalDifferencePercent) {
        if (score.totalDifferencePercent < best.score.totalDifferencePercent) {
          best = current;
        }
        continue;
      }

      if (score.strongCount > best.score.strongCount) {
        best = current;
      }
    }
  }

  if (!best) return null;

  const byApplicationId = new Map();
  best.orderedApplications.forEach((application, index) => {
    byApplicationId.set(application.applicationId, best.groups[index]);
  });

  return {
    ...best.score,
    byApplicationId,
  };
}

function sameFlightSet(a, b) {
  if (!a || !b) return false;
  return a.flightRecordNumbers.join("|") === b.flightRecordNumbers.join("|");
}

function copyReviewImages(application, candidateGroup) {
  const reviewFolder = path.join(REVIEW_ROOT, safeFolderName(application.plot));
  fs.mkdirSync(reviewFolder, { recursive: true });

  for (const existingFile of fs.readdirSync(reviewFolder)) {
    if (/\.png$/i.test(existingFile)) {
      fs.unlinkSync(path.join(reviewFolder, existingFile));
    }
  }

  if (!candidateGroup) return { reviewFolder, copiedPaths: [] };

  const copiedPaths = [];

  for (const sourcePath of candidateGroup.imagePaths || []) {
    if (!sourcePath || !fs.existsSync(sourcePath)) continue;

    const destinationPath = path.join(reviewFolder, path.basename(sourcePath));
    fs.copyFileSync(sourcePath, destinationPath);
    copiedPaths.push(destinationPath);
  }

  return { reviewFolder, copiedPaths };
}

function toCsvValue(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(applications) {
  const headers = [
    "applicationId",
    "plot",
    "pilot",
    "drone",
    "dsAreaHa",
    "groupRank",
    "selection",
    "status",
    "startTime",
    "endTime",
    "flightCount",
    "totalDjiAreaHa",
    "areaDifferenceHa",
    "areaDifferencePercent",
    "matchConfidence",
    "reviewRequired",
    "reviewFolder",
    "flightRecordNumbers",
    "imagePaths",
  ];
  const rows = [headers];

  for (const application of applications) {
    if (!application.candidateGroups.length) {
      rows.push([
        application.applicationId,
        application.plot,
        application.pilot,
        application.drone,
        application.dsAreaHa,
        "",
        "",
        "no_match",
        "",
        "",
        0,
        "",
        "",
        "",
        "",
        true,
        application.reviewFolder,
        "",
        "",
      ]);
      continue;
    }

    application.candidateGroups.forEach((group, index) => {
      rows.push([
        application.applicationId,
        application.plot,
        application.pilot,
        application.drone,
        application.dsAreaHa,
        index + 1,
        group.selection,
        group.status,
        group.startTime,
        group.endTime,
        group.flightCount,
        group.totalDjiAreaHa,
        group.areaDifferenceHa,
        group.areaDifferencePercent,
        group.matchConfidence,
        group.reviewRequired,
        application.reviewFolder,
        group.flightRecordNumbers,
        group.imagePaths,
      ]);
    });
  }

  fs.writeFileSync(
    OUTPUT_CSV_PATH,
    rows.map((row) => row.map(toCsvValue).join(";")).join("\n"),
    "utf8",
  );
}

function buildOutput(applications, inventory, flights) {
  const totalDjiAreaHa = round(
    flights.reduce(
      (sum, flight) => sum + (parseNumber(flight.areaValue) || 0),
      0,
    ),
    2,
  );
  const totalDsAreaHa = round(
    applications.reduce(
      (sum, application) => sum + (parseNumber(application.dsAreaHa) || 0),
      0,
    ),
    2,
  );

  const sequentialAssignment = findBestSequentialAssignment(
    applications,
    flights,
  );
  const outputApplications = applications.map((application) => {
    const areaWindowGroups = buildCandidateGroups(application, flights);
    const primaryGroup =
      sequentialAssignment?.byApplicationId.get(application.applicationId) ||
      null;
    const candidateGroups = [
      ...(primaryGroup &&
      primaryGroup.areaDifferencePercent <= CANDIDATE_TOLERANCE_PERCENT
        ? [primaryGroup]
        : []),
      ...areaWindowGroups.filter(
        (group) => !sameFlightSet(group, primaryGroup),
      ),
    ].slice(0, MAX_CANDIDATE_GROUPS);
    const bestGroup = candidateGroups[0] || null;
    const review = copyReviewImages(application, bestGroup);

    if (bestGroup) {
      bestGroup.reviewImagePaths = review.copiedPaths;
    }

    return {
      applicationId: application.applicationId,
      plot: application.plot,
      pilot: application.pilot,
      drone: application.drone,
      dsAreaHa: application.dsAreaHa,
      applicationDate: application.applicationDate,
      source: application.source,
      reviewFolder: review.reviewFolder,
      candidateGroups,
    };
  });

  return {
    date: TARGET_DATE,
    osId: OS_ID,
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      applicationsPath: APPLICATIONS_PATH,
      inventoryPath: INVENTORY_PATH,
    },
    thresholds: {
      strongTolerancePercent: STRONG_TOLERANCE_PERCENT,
      candidateTolerancePercent: CANDIDATE_TOLERANCE_PERCENT,
    },
    sequentialAssignment: sequentialAssignment
      ? {
          accepted: sequentialAssignment.accepted,
          maxDifferencePercent: round(
            sequentialAssignment.maxDifferencePercent,
            2,
          ),
          totalDifferencePercent: round(
            sequentialAssignment.totalDifferencePercent,
            2,
          ),
          strongCount: sequentialAssignment.strongCount,
        }
      : null,
    summary: {
      totalDjiFlights: flights.length,
      totalDjiAreaHa,
      totalDsApplications: applications.length,
      totalDsAreaHa,
      inventorySummary: inventory.summary || null,
    },
    applications: outputApplications,
  };
}

function printSummary(output) {
  console.log("");
  console.log("[RESUMO AGRUPAMENTO DJI -> DS]");
  console.log(`Data: ${output.date}`);
  console.log(
    `DJI: ${output.summary.totalDjiFlights} voos | ${output.summary.totalDjiAreaHa} ha`,
  );
  console.log(
    `DS: ${output.summary.totalDsApplications} aplicacoes | ${output.summary.totalDsAreaHa} ha`,
  );
  console.log("");

  for (const application of output.applications) {
    const group = application.candidateGroups[0];
    if (!group) {
      console.log(
        `${application.plot} | DS ${application.dsAreaHa} ha | sem candidato confiavel | revisao: ${application.reviewFolder}`,
      );
      continue;
    }

    console.log(
      [
        application.plot,
        `DS ${application.dsAreaHa} ha`,
        `DJI ${group.totalDjiAreaHa} ha`,
        `dif ${group.areaDifferenceHa} ha (${group.areaDifferencePercent}%)`,
        `${group.startTime}-${group.endTime}`,
        `${group.flightCount} voos`,
        group.status,
        `revisao: ${application.reviewFolder}`,
      ].join(" | "),
    );
  }

  console.log("");
  console.log(`[OK] JSON: ${OUTPUT_JSON_PATH}`);
  console.log(`[OK] CSV: ${OUTPUT_CSV_PATH}`);
  console.log(`[OK] Revisao visual: ${REVIEW_ROOT}`);
}

function main() {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  fs.mkdirSync(REVIEW_ROOT, { recursive: true });

  const applications = loadApplications().filter(
    (application) =>
      (!application.applicationDate ||
        application.applicationDate === TARGET_DATE) &&
      application.dsAreaHa !== null,
  );
  const { inventory, flights } = loadInventory();

  const output = buildOutput(applications, inventory, flights);

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(output, null, 2), "utf8");
  writeCsv(output.applications);
  printSummary(output);
}

main();
