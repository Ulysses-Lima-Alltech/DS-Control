const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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

function fail(message) {
  console.error(`[ERRO] ${message}`);
  process.exit(1);
}

function extractUuid(value) {
  const match = String(value || "").match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return match ? match[0] : "";
}

function validateOsUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return "";
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return "";
  if (!extractUuid(text)) return "";

  return text;
}

function normalizeDateIso(value, options = {}) {
  const text = String(value || "").trim();
  const pattern = options.strict
    ? /^(\d{4})[/-](\d{2})[/-](\d{2})$/
    : /^(\d{4})[/-](\d{2})[/-](\d{2})/;
  const match = text.match(pattern);

  if (!match) {
    if (options.strict) {
      throw new Error(`Data invalida: ${text}. Use YYYY/MM/DD ou YYYY-MM-DD.`);
    }
    return "";
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid) {
    if (options.strict) {
      throw new Error(`Data invalida: ${text}. Use YYYY/MM/DD ou YYYY-MM-DD.`);
    }
    return "";
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseDatesArg(value) {
  const text = String(value || "").trim();
  if (!text) return [];

  return unique(
    text
      .split(",")
      .map((item) => normalizeDateIso(item.trim(), { strict: true }))
      .filter(Boolean),
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function toDjiDate(value) {
  return normalizeDateIso(value, { strict: true }).replace(/-/g, "/");
}

function dateToFilePart(value) {
  return normalizeDateIso(value, { strict: true }).replace(/-/g, "_");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.applications)) return value.applications;
  if (Array.isArray(value?.flights)) return value.flights;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function scriptPath(fileName) {
  return path.join(__dirname, fileName);
}

function formatCommandPart(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function runNodeScript(fileName, args, options = {}) {
  const command = [process.execPath, fileName, ...args]
    .map(formatCommandPart)
    .join(" ");
  console.log("");
  console.log(`[RUN] ${command}`);

  const result = spawnSync(process.execPath, [scriptPath(fileName), ...args], {
    cwd: __dirname,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    if (options.continueOnError) {
      console.log(`[WARN] Falha ao executar ${fileName}: ${result.error.message}`);
      return false;
    }

    throw result.error;
  }

  if (result.status !== 0) {
    const message = `${fileName} terminou com codigo ${result.status}`;
    if (options.continueOnError) {
      console.log(`[WARN] ${message}`);
      return false;
    }

    throw new Error(message);
  }

  return true;
}

function applicationsPathForOs(osId) {
  return path.join(outputDirForOs(osId), `os_${osId}_aplicacoes_v2.json`);
}

function outputDirForOs(osId) {
  return path.join(__dirname, "downloads-dji", `os-${osId}-v2`);
}

function inventoryCleanPath(osId, dateIso) {
  return path.join(
    outputDirForOs(osId),
    `dji_inventory_${dateToFilePart(dateIso)}_clean.json`,
  );
}

function groupPath(osId, dateIso) {
  return path.join(
    outputDirForOs(osId),
    `dji_application_groups_${dateToFilePart(dateIso)}.json`,
  );
}

function manifestPathForOs(osId) {
  return path.join(
    outputDirForOs(osId),
    `dji_manifest_applications_os_${osId}.json`,
  );
}

function frontendOutputDir(osId) {
  return path.resolve(
    __dirname,
    "..",
    "frontend-ds-control-main",
    "public",
    "dji-reports",
    `os-${osId}`,
  );
}

function readApplications(applicationsPath) {
  const applications = asArray(readJson(applicationsPath));

  return applications.map((application) => ({
    ...application,
    normalizedDate: normalizeDateIso(
      application.date || application.applicationDate || application.raw?.date,
    ),
  }));
}

function countInventoryFlights(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, count: 0 };
  }

  const inventory = readJson(filePath);
  const flights = asArray(inventory.flights || inventory);
  const count = Number(
    inventory.summary?.totalValidFlights ??
      inventory.totalValidFlights ??
      inventory.totalFlightsCaptured ??
      flights.length,
  );

  return {
    exists: true,
    count: Number.isFinite(count) ? count : flights.length,
  };
}

function readManifestEvidenceSummary(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { applicationsWithEvidence: 0, manifestApplications: 0 };
  }

  const manifest = readJson(manifestPath);
  const applications = asArray(manifest.applications);
  const applicationsWithEvidence = applications.filter(
    (application) =>
      Boolean(application.primaryImagePath) &&
      fs.existsSync(application.primaryImagePath),
  ).length;

  return {
    applicationsWithEvidence,
    manifestApplications: applications.length,
  };
}

function printWarnings(warnings) {
  for (const warning of warnings) {
    console.log(`[WARN] ${warning}`);
  }
}

function main() {
  const osId = String(getArg("--os-id", "")).trim();
  const osUrl = validateOsUrl(getArg("--os-url", ""));
  const approveReviewed = hasFlag("--approve-reviewed");
  const exportFrontend = hasFlag("--export-frontend");
  const skipDji = hasFlag("--skip-dji");
  const skipExport = hasFlag("--skip-export");
  const warnings = [];

  if (!/^\d+$/.test(osId)) {
    fail("Informe --os-id com um numero valido.");
  }

  if (!osUrl) {
    fail("Informe --os-url com uma URL http(s) da OS contendo o UUID da ordem.");
  }

  let requestedDates = [];
  try {
    requestedDates = parseDatesArg(getArg("--dates", ""));
  } catch (error) {
    fail(error.message);
  }

  const applicationsPath = applicationsPathForOs(osId);

  runNodeScript("dscontrol-extrair-aplicacoes-os.js", [
    "--os-id",
    osId,
    "--os-url",
    osUrl,
  ]);

  if (!fs.existsSync(applicationsPath)) {
    fail(`JSON de aplicacoes nao encontrado: ${applicationsPath}`);
  }

  const applications = readApplications(applicationsPath);
  const dsDates = unique(
    applications.map((application) => application.normalizedDate),
  );

  if (!applications.length) {
    fail(`Nenhuma aplicacao DS Control encontrada em ${applicationsPath}`);
  }

  if (!dsDates.length) {
    fail("Nenhuma data de aplicacao DS Control foi encontrada.");
  }

  const dsDateSet = new Set(dsDates);
  const selectedDates = requestedDates.length
    ? requestedDates.filter((date) => dsDateSet.has(date))
    : dsDates;

  for (const date of requestedDates) {
    if (!dsDateSet.has(date)) {
      warnings.push(`data_informada_sem_aplicacao_ds:${date}`);
    }
  }

  if (!selectedDates.length) {
    fail("Nenhuma das datas informadas existe nas aplicacoes DS Control da OS.");
  }

  const selectedDateSet = new Set(selectedDates);
  const selectedApplications = applications.filter((application) =>
    selectedDateSet.has(application.normalizedDate),
  );
  const groupPathsForManifest = [];
  let totalDjiFlightsCaptured = 0;

  console.log("");
  console.log(`[INFO] Datas DS Control: ${dsDates.join(", ")}`);
  console.log(`[INFO] Datas selecionadas: ${selectedDates.join(", ")}`);

  if (skipDji) {
    console.log("[INFO] --skip-dji ativo: usando inventarios/grupos existentes.");

    for (const dateIso of selectedDates) {
      const inventoryInfo = countInventoryFlights(inventoryCleanPath(osId, dateIso));
      if (inventoryInfo.exists) {
        totalDjiFlightsCaptured += inventoryInfo.count;
      } else {
        warnings.push(`inventario_existente_nao_encontrado:${dateIso}`);
      }

      const existingGroupPath = groupPath(osId, dateIso);
      if (fs.existsSync(existingGroupPath)) {
        groupPathsForManifest.push(existingGroupPath);
      } else {
        warnings.push(`grupo_existente_nao_encontrado:${dateIso}`);
      }
    }
  } else {
    for (const dateIso of selectedDates) {
      const djiDate = toDjiDate(dateIso);
      console.log("");
      console.log(`[INFO] Processando DJI ${djiDate}`);

      const inventoryOk = runNodeScript(
        "dji-inventario-dia.js",
        [
          "--os-id",
          osId,
          "--date",
          djiDate,
          "--capture-mode",
          "map-crop-centered",
        ],
        { continueOnError: true },
      );

      if (!inventoryOk) {
        warnings.push(`inventario_dji_falhou_ou_sem_voos:${dateIso}`);
        continue;
      }

      const cleanInventoryPath = inventoryCleanPath(osId, dateIso);
      const inventoryInfo = countInventoryFlights(cleanInventoryPath);

      if (!inventoryInfo.exists) {
        warnings.push(`inventario_limpo_nao_encontrado:${dateIso}`);
        continue;
      }

      totalDjiFlightsCaptured += inventoryInfo.count;

      if (inventoryInfo.count <= 0) {
        warnings.push(`sem_voos_dji_encontrados:${dateIso}`);
        continue;
      }

      runNodeScript("dji-agrupar-aplicacoes-os.js", [
        "--os-id",
        osId,
        "--date",
        djiDate,
        "--applications",
        applicationsPath,
        "--inventory",
        cleanInventoryPath,
      ]);

      const createdGroupPath = groupPath(osId, dateIso);
      if (fs.existsSync(createdGroupPath)) {
        groupPathsForManifest.push(createdGroupPath);
      } else {
        warnings.push(`grupo_dji_nao_gerado:${dateIso}`);
      }
    }
  }

  const manifestPath = manifestPathForOs(osId);
  const manifestArgs = [
    "--os-id",
    osId,
    "--all-groups",
    "--applications",
    applicationsPath,
    "--dates",
    selectedDates.join(","),
    "--output",
    manifestPath,
  ];

  if (approveReviewed) {
    manifestArgs.push("--approve-reviewed");
  }

  if (groupPathsForManifest.length) {
    manifestArgs.push("--groups", unique(groupPathsForManifest).join(","));
  } else {
    manifestArgs.push("--no-groups");
  }

  runNodeScript("dji-gerar-manifest-aplicacoes-os.js", manifestArgs);

  let exportedFrontendDir = "";
  if (exportFrontend && !skipExport) {
    runNodeScript("dji-exportar-assets-frontend-os.js", ["--os-id", osId]);
    exportedFrontendDir = frontendOutputDir(osId);
  } else if (exportFrontend && skipExport) {
    warnings.push("export_frontend_ignorado_por_skip_export");
  }

  const manifestEvidence = readManifestEvidenceSummary(manifestPath);
  const applicationsWithEvidence = manifestEvidence.applicationsWithEvidence;
  const applicationsWithoutEvidence = Math.max(
    selectedApplications.length - applicationsWithEvidence,
    0,
  );

  console.log("");
  console.log("[RESUMO FINAL DJI SMARTFARM OS]");
  console.log(`OS: ${osId}`);
  console.log(`Total aplicacoes DS: ${applications.length}`);
  console.log(`Total aplicacoes DS nas datas processadas: ${selectedApplications.length}`);
  console.log(`Datas processadas: ${selectedDates.join(", ")}`);
  console.log(`Total voos DJI capturados: ${totalDjiFlightsCaptured}`);
  console.log(`Total aplicacoes com evidencia DJI: ${applicationsWithEvidence}`);
  console.log(`Total aplicacoes sem evidencia DJI: ${applicationsWithoutEvidence}`);
  console.log(`Manifest final: ${manifestPath}`);

  if (exportedFrontendDir) {
    console.log(`Pasta frontend exportada: ${exportedFrontendDir}`);
  }

  printWarnings(warnings);
}

main();
