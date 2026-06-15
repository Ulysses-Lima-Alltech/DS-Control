const fs = require("fs");
const path = require("path");

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

function normalizeDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (match) return `${match[1]}/${match[2]}/${match[3]}`;

  match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  return text.replace(/-/g, "/");
}

function dateToIso(value) {
  return normalizeDate(value).replace(/\//g, "-");
}

function dateToFilePart(value) {
  return normalizeDate(value).replace(/\//g, "_");
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
  return [];
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const match = String(value ?? "").match(/-?\d+(?:[.,]\d+)*/);
  if (!match) return null;

  const normalized = match[0].replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function firstPresent(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseDateList(value) {
  return unique(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map(normalizeDate),
  );
}

function dateFilePartToDate(value) {
  const match = String(value || "").match(/^(\d{4})_(\d{2})_(\d{2})$/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : "";
}

function inferGroupDate(filePath) {
  const match = path
    .basename(String(filePath || ""))
    .match(/^dji_application_groups_(\d{4}_\d{2}_\d{2})\.json$/);
  return match ? dateFilePartToDate(match[1]) : "";
}

function parsePathList(value) {
  return unique(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function discoverGroupFiles(baseDir, datesFilter, warnings) {
  if (!fs.existsSync(baseDir)) {
    warnings.push(`diretorio_base_nao_encontrado:${baseDir}`);
    return [];
  }

  if (datesFilter.length) {
    const groupFiles = [];

    for (const date of datesFilter) {
      const groupPath = path.join(
        baseDir,
        `dji_application_groups_${dateToFilePart(date)}.json`,
      );

      if (fileExists(groupPath)) {
        groupFiles.push(groupPath);
      } else {
        warnings.push(`grupo_dji_nao_encontrado:${path.basename(groupPath)}`);
      }
    }

    return unique(groupFiles);
  }

  return fs
    .readdirSync(baseDir)
    .filter((fileName) =>
      /^dji_application_groups_\d{4}_\d{2}_\d{2}\.json$/.test(fileName),
    )
    .sort()
    .map((fileName) => path.join(baseDir, fileName));
}

function isCenteredMapPng(filePath) {
  const normalized = String(filePath || "").toLowerCase();
  return normalized.endsWith(".png") && normalized.includes("map_crop_centered");
}

function fileExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function sortFlightsByTime(flights) {
  return [...flights].sort((a, b) => {
    const aTime = String(a.startTime || "");
    const bTime = String(b.startTime || "");
    if (aTime !== bTime) return aTime.localeCompare(bTime);

    return String(a.flightRecordNumber || "").localeCompare(
      String(b.flightRecordNumber || ""),
    );
  });
}

function pickPrimaryImage(group, flightImagesByRecord) {
  const flights = sortFlightsByTime(asArray(group?.djiFlights));
  if (!flights.length) return null;

  if (flights.length === 2) {
    const first = flights[0];
    const second = flights[1];
    const firstArea = parseNumber(first.areaValue) || 0;
    const secondArea = parseNumber(second.areaValue) || 0;
    const selected = secondArea > firstArea ? second : first;
    return flightImagesByRecord.get(selected.flightRecordNumber) || null;
  }

  const centerIndex = Math.floor((flights.length - 1) / 2);
  const selected = flights[centerIndex];
  return flightImagesByRecord.get(selected.flightRecordNumber) || null;
}

function buildFlightImages(group, inventoryByRecord) {
  const imagesByRecord = new Map();
  const groupFlights = asArray(group?.djiFlights);

  for (const flight of groupFlights) {
    const recordNumber = flight.flightRecordNumber;
    const inventoryFlight = inventoryByRecord.get(recordNumber) || {};
    const imagePath = firstPresent(flight, ["imagePath", "mapImagePath", "mapOnlyImagePath"]) ||
      firstPresent(inventoryFlight, ["mapImagePath", "mapOnlyImagePath", "imagePath"]);

    if (isCenteredMapPng(imagePath)) {
      imagesByRecord.set(recordNumber, imagePath);
    }
  }

  for (const imagePath of asArray(group?.imagePaths)) {
    if (!isCenteredMapPng(imagePath)) continue;

    const recordNumber = String(imagePath).match(/_(R\d+)_/)?.[1];
    if (recordNumber && !imagesByRecord.has(recordNumber)) {
      imagesByRecord.set(recordNumber, imagePath);
    }
  }

  const orderedRecordNumbers = groupFlights
    .map((flight) => flight.flightRecordNumber)
    .filter(Boolean);
  const orderedImages = orderedRecordNumbers
    .map((recordNumber) => imagesByRecord.get(recordNumber))
    .filter(Boolean);

  return {
    flightImages: unique(orderedImages),
    flightImagesByRecord: imagesByRecord,
  };
}

function determineMatchType(group) {
  if (!group) return "candidate_review_required";
  if (group.reviewApproved === true) return "high_confidence";
  if (group.status === "candidate") return "candidate_review_required";
  if (group.status === "strong" && group.reviewRequired === false) {
    return "exact_application";
  }
  if (group.status === "strong") return "high_confidence";
  if (group.visualReviewApproved === true || group.reviewApproved === true) {
    return "high_confidence";
  }

  return "candidate_review_required";
}

function normalizeApplication(application) {
  return {
    applicationId: application.applicationId,
    serviceOrderId: application.serviceOrderId || application.raw?.serviceOrderId || null,
    osNumber: String(application.osNumber || application.raw?.serviceOrder?.number || ""),
    date: dateToIso(application.date || application.applicationDate || application.raw?.date),
    plot: typeof application.plot === "string"
      ? application.plot
      : application.plot?.name || application.raw?.plot?.name || null,
    farm: typeof application.farm === "string"
      ? application.farm
      : application.farm?.name || application.raw?.farm?.name || "",
    pilot: typeof application.pilot === "string"
      ? application.pilot
      : application.pilot?.name || application.raw?.pilot?.name || null,
    drone: typeof application.drone === "string"
      ? application.drone
      : application.drone?.name || application.raw?.drone?.name || null,
    dsAreaHa: parseNumber(application.areaHa ?? application.dsAreaHa ?? application.hectares),
  };
}

function buildManifestApplication(
  groupedApplication,
  dsApplication,
  inventoryByRecord,
  sourceFileNames,
  options,
  generatedAt,
) {
  const group = asArray(groupedApplication.candidateGroups)[0] || null;
  const reasons = [];
  const warnings = [];
  const ds = dsApplication || normalizeApplication(groupedApplication);

  if (!group) {
    warnings.push("sem_grupo_dji_validado");
  }

  const flightRecordNumbers = unique(asArray(group?.flightRecordNumbers));
  const { flightImages, flightImagesByRecord } = buildFlightImages(group, inventoryByRecord);
  const primaryImagePath = pickPrimaryImage(group, flightImagesByRecord);
  const missingImages = unique([primaryImagePath, ...flightImages]).filter(
    (imagePath) => !fileExists(imagePath),
  );

  if (!primaryImagePath) {
    warnings.push("primaryImagePath_nao_encontrado");
  }

  if (flightImages.length !== flightRecordNumbers.length) {
    warnings.push("flightImages_incompleto_para_voos_do_grupo");
  }

  if (missingImages.length) {
    warnings.push(`imagem_inexistente:${missingImages.join("|")}`);
  }

  if (group?.reviewRequired === true) {
    reasons.push("grupo_marcado_para_revisao");
  }

  if (group?.status === "candidate") {
    reasons.push("candidate_pendente_mvp");
  }

  const canApproveReviewed =
    options.approveReviewed &&
    Boolean(group) &&
    ["candidate", "strong"].includes(group.status) &&
    warnings.length === 0;
  const reviewRequired = canApproveReviewed ? false : reasons.length > 0 || warnings.length > 0;
  const reviewStatus = canApproveReviewed
    ? "approved"
    : reviewRequired
      ? "pending"
      : "not_required";
  const reviewApprovedAt = canApproveReviewed ? generatedAt : null;
  const reviewApprovedBy = canApproveReviewed ? "manual_review" : null;
  const djiAreaHa = parseNumber(group?.totalDjiAreaHa);
  const dsAreaHa = parseNumber(ds.dsAreaHa);
  const areaDifferenceHa = Number.isFinite(djiAreaHa) && Number.isFinite(dsAreaHa)
    ? round(djiAreaHa - dsAreaHa)
    : parseNumber(group?.areaDifferenceHa);
  const areaDifferencePercent = parseNumber(group?.areaDifferencePercent);

  return {
    applicationId: ds.applicationId,
    serviceOrderId: ds.serviceOrderId,
    osNumber: ds.osNumber,
    date: ds.date,
    plot: ds.plot,
    farm: ds.farm,
    pilot: ds.pilot,
    drone: ds.drone,
    dsAreaHa: round(dsAreaHa),
    djiAreaHa: round(djiAreaHa),
    areaDifferenceHa,
    areaDifferencePercent: round(areaDifferencePercent),
    flightCount: group?.flightCount || flightRecordNumbers.length,
    flightRecordNumbers,
    primaryImagePath,
    flightImages,
    imageScope: "application",
    matchType: determineMatchType({
      ...group,
      reviewRequired,
      reviewApproved: canApproveReviewed,
    }),
    matchConfidence: parseNumber(group?.matchConfidence),
    reviewRequired,
    reviewRequiredReason: reviewRequired ? [...warnings, ...reasons].join("; ") : "",
    reviewStatus,
    reviewApprovedAt,
    reviewApprovedBy,
    groupStatus: group?.status || null,
    source: {
      dsControl: sourceFileNames.applications,
      djiInventory: sourceFileNames.inventory,
      djiApplicationGroups: sourceFileNames.groups,
      groupSelection: group?.selection || null,
    },
    generatedAt,
  };
}

function printSummary(output, outputPath) {
  console.log("");
  console.log("[RESUMO MANIFEST DJI APPLICATIONS]");
  console.log(`Total aplicacoes no manifest: ${output.summary.totalApplications}`);
  console.log(`Total aplicacoes com imagem: ${output.summary.totalApplicationsWithImage}`);
  console.log(`Total aplicacoes reviewRequired: ${output.summary.totalReviewRequired}`);
  console.log(`Total aplicacoes aprovadas: ${output.summary.totalApproved}`);
  console.log(`Total high_confidence: ${output.summary.totalHighConfidence}`);
  console.log(`Total exact_application: ${output.summary.totalExactApplication}`);
  console.log(`Total voos DJI usados: ${output.summary.totalDjiFlightsUsed}`);
  console.log(`Total hectares DS: ${output.summary.totalDsAreaHa}`);
  console.log(`Total hectares DJI: ${output.summary.totalDjiAreaHa}`);
  console.log("");
  console.log(`[OK] JSON: ${outputPath}`);
}

function main() {
  const osId = getArg("--os-id", "134");
  const datesFromArg = parseDateList(getArg("--dates", ""));
  const targetDate = normalizeDate(
    datesFromArg[0] || getArg("--date", process.argv[2] || "2026/05/20"),
  );
  const useAllGroups = hasFlag("--all-groups") || datesFromArg.length > 1;
  const datesFilter = datesFromArg.length
    ? datesFromArg
    : useAllGroups
      ? []
      : [targetDate];
  const datesFilterIso = new Set(datesFilter.map(dateToIso));
  const options = {
    approveReviewed: hasFlag("--approve-reviewed"),
  };
  const baseDir = path.resolve(__dirname, "downloads-dji", `os-${osId}-v2`);
  const applicationsPath = path.resolve(
    getArg("--applications", path.join(baseDir, `os_${osId}_aplicacoes_v2.json`)),
  );
  const outputPath = path.resolve(
    getArg(
      "--output",
      path.join(baseDir, `dji_manifest_applications_os_${osId}.json`),
    ),
  );
  const warnings = [];
  const groupsArg = getArg("--groups", "");
  const explicitGroupPaths = parsePathList(groupsArg).map((groupPath) =>
    path.resolve(groupPath),
  );
  const groupPaths = hasFlag("--no-groups")
    ? []
    : useAllGroups
      ? explicitGroupPaths.length
        ? explicitGroupPaths
        : discoverGroupFiles(baseDir, datesFilter, warnings)
      : [
          path.resolve(
            getArg(
              "--groups",
              path.join(
                baseDir,
                `dji_application_groups_${dateToFilePart(targetDate)}.json`,
              ),
            ),
          ),
        ];

  const applications = asArray(readJson(applicationsPath))
    .map(normalizeApplication)
    .filter(
      (application) =>
        !datesFilterIso.size || datesFilterIso.has(application.date),
    );
  const applicationById = new Map(
    applications.map((application) => [application.applicationId, application]),
  );

  const generatedAt = new Date().toISOString();
  const applicationsById = {};
  const inventoryPaths = [];
  const groupsPaths = [];

  for (const groupsPath of groupPaths) {
    if (!fileExists(groupsPath)) {
      warnings.push(`grupo_dji_nao_encontrado:${groupsPath}`);
      continue;
    }

    const groups = readJson(groupsPath);
    const inferredGroupDate = inferGroupDate(groupsPath);
    const groupDateIso = dateToIso(groups.date || inferredGroupDate);

    if (datesFilterIso.size && !datesFilterIso.has(groupDateIso)) {
      warnings.push(
        `grupo_dji_fora_das_datas:${path.basename(groupsPath)}:${groupDateIso}`,
      );
      continue;
    }

    const inventoryPath = path.resolve(
      useAllGroups
        ? path.join(
            baseDir,
            `dji_inventory_${dateToFilePart(groupDateIso)}_clean.json`,
          )
        : getArg(
            "--inventory",
            path.join(
              baseDir,
              `dji_inventory_${dateToFilePart(targetDate)}_clean.json`,
            ),
          ),
    );
    const inventory = fileExists(inventoryPath)
      ? readJson(inventoryPath)
      : { flights: [] };

    if (!fileExists(inventoryPath)) {
      warnings.push(`inventario_dji_nao_encontrado:${inventoryPath}`);
    } else {
      inventoryPaths.push(inventoryPath);
    }

    groupsPaths.push(groupsPath);

    const inventoryFlights = asArray(inventory.flights || inventory);
    const inventoryByRecord = new Map(
      inventoryFlights
        .filter((flight) => flight.flightRecordNumber)
        .map((flight) => [flight.flightRecordNumber, flight]),
    );
    const groupedApplications = asArray(groups.applications || groups);
    const sourceFileNames = {
      applications: path.basename(applicationsPath),
      inventory: fileExists(inventoryPath) ? path.basename(inventoryPath) : null,
      groups: path.basename(groupsPath),
    };

    for (const groupedApplication of groupedApplications) {
      const applicationId = groupedApplication.applicationId;
      if (!applicationId) continue;

      const dsApplication = applicationById.get(applicationId);
      if (!dsApplication) {
        warnings.push(
          `aplicacao_grupo_fora_do_ds:${applicationId}:${path.basename(groupsPath)}`,
        );
        continue;
      }

      if (dsApplication.date && groupDateIso && dsApplication.date !== groupDateIso) {
        warnings.push(
          `aplicacao_grupo_data_incompativel:${applicationId}:${dsApplication.date}:${groupDateIso}`,
        );
        continue;
      }

      if (applicationsById[applicationId]) {
        warnings.push(
          `aplicacao_duplicada_em_grupos:${applicationId}:${path.basename(groupsPath)}`,
        );
        continue;
      }

      applicationsById[applicationId] = buildManifestApplication(
        groupedApplication,
        dsApplication,
        inventoryByRecord,
        sourceFileNames,
        options,
        generatedAt,
      );
    }
  }

  const manifestApplications = Object.values(applicationsById);
  const usedFlightRecordNumbers = unique(
    manifestApplications.flatMap((application) => application.flightRecordNumbers),
  );
  const summary = {
    totalApplications: manifestApplications.length,
    totalApplicationsWithImage: manifestApplications.filter(
      (application) => Boolean(application.primaryImagePath),
    ).length,
    totalReviewRequired: manifestApplications.filter(
      (application) => application.reviewRequired,
    ).length,
    totalApproved: manifestApplications.filter(
      (application) => application.reviewStatus === "approved",
    ).length,
    totalHighConfidence: manifestApplications.filter(
      (application) => application.matchType === "high_confidence",
    ).length,
    totalExactApplication: manifestApplications.filter(
      (application) => application.matchType === "exact_application",
    ).length,
    totalDjiFlightsUsed: usedFlightRecordNumbers.length,
    totalDsAreaHa: round(
      manifestApplications.reduce(
        (total, application) => total + (application.dsAreaHa || 0),
        0,
      ),
    ),
    totalDjiAreaHa: round(
      manifestApplications.reduce(
        (total, application) => total + (application.djiAreaHa || 0),
        0,
      ),
    ),
  };

  const output = {
    osId,
    date: datesFilter.length === 1 ? dateToIso(datesFilter[0]) : null,
    dates: datesFilter.length
      ? datesFilter.map(dateToIso)
      : unique(groupPaths.map((groupPath) => dateToIso(inferGroupDate(groupPath)))),
    imageScope: "application",
    generatedAt,
    sourceFiles: {
      applicationsPath,
      inventoryPaths: unique(inventoryPaths),
      groupsPaths: unique(groupsPaths),
    },
    warnings,
    summary,
    applications: applicationsById,
  };

  if (output.sourceFiles.inventoryPaths.length === 1) {
    output.sourceFiles.inventoryPath = output.sourceFiles.inventoryPaths[0];
  }

  if (output.sourceFiles.groupsPaths.length === 1) {
    output.sourceFiles.groupsPath = output.sourceFiles.groupsPaths[0];
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  for (const warning of warnings) {
    console.log(`[WARN] ${warning}`);
  }
  printSummary(output, outputPath);
}

main();
