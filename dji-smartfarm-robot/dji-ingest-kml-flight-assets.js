/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const CONTENT_TYPES = {
  kml: "application/vnd.google-earth.kml+xml",
  png: "image/png",
  geojson: "application/geo+json",
  json: "application/json",
};

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;

  return value;
}

function getBoolArg(name, fallback) {
  const raw = getArg(name, "");
  if (!raw) return fallback;
  return !["0", "false", "no", "nao"].includes(String(raw).trim().toLowerCase());
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  let match = text.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;

  match = text.match(/(20\d{2})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  throw new Error(`Data invalida: ${value}. Use YYYY-MM-DD ou YYYY/MM/DD.`);
}

function dateToFilePart(value) {
  return normalizeDate(value).replace(/-/g, "_");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function s3Key(...parts) {
  return parts
    .map((part) => trimSlashes(part))
    .filter(Boolean)
    .join("/");
}

function portablePath(filePath, baseDir) {
  if (!filePath) return null;

  const resolvedFile = path.resolve(filePath);
  const resolvedBase = baseDir ? path.resolve(baseDir) : null;

  if (resolvedBase) {
    const relative = path.relative(resolvedBase, resolvedFile);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join("/");
    }
  }

  return path.basename(filePath);
}

function safeKeySegment(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
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
  }

  const parsed = Number.parseFloat(numericText);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : parseNumber(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  return decodeXml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function setMetadataValue(metadata, key, value) {
  const cleanKey = String(key || "").trim();
  const cleanValue = stripTags(value);
  if (!cleanKey || !cleanValue) return;

  if (metadata[cleanKey] === undefined) {
    metadata[cleanKey] = cleanValue;
    return;
  }

  if (Array.isArray(metadata[cleanKey])) {
    if (!metadata[cleanKey].includes(cleanValue)) metadata[cleanKey].push(cleanValue);
    return;
  }

  if (metadata[cleanKey] !== cleanValue) metadata[cleanKey] = [metadata[cleanKey], cleanValue];
}

function extractXmlMetadata(xml) {
  const metadata = {};

  for (const match of xml.matchAll(/<Data\s+name=["']([^"']+)["'][\s\S]*?<value>([\s\S]*?)<\/value>/gi)) {
    setMetadataValue(metadata, decodeXml(match[1]), match[2]);
  }

  for (const match of xml.matchAll(/<SimpleData\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/SimpleData>/gi)) {
    setMetadataValue(metadata, decodeXml(match[1]), match[2]);
  }

  for (const match of xml.matchAll(/<SimpleField\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/SimpleField>/gi)) {
    setMetadataValue(metadata, decodeXml(match[1]), match[2]);
  }

  return metadata;
}

function metadataValue(metadata, labels) {
  const entries = Object.entries(metadata || {});
  const wanted = labels.map(normalizeLabel).filter(Boolean);

  for (const [key, value] of entries) {
    if (wanted.includes(normalizeLabel(key))) return Array.isArray(value) ? value[0] : value;
  }

  for (const [key, value] of entries) {
    const normalizedKey = normalizeLabel(key);
    if (wanted.some((label) => normalizedKey.includes(label))) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return null;
}

function extractTimeValue(value) {
  const text = String(value || "");
  const match = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
  }

  const compact = text.match(/\b(?:20\d{6})(\d{2})(\d{2})(\d{2})\b/);
  if (compact) return `${compact[1]}:${compact[2]}:${compact[3]}`;

  return null;
}

function extractDateValue(value) {
  const text = String(value || "");
  const candidate = firstNonEmpty(
    text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/)?.[0],
    text.match(/\b(20\d{2})(\d{2})(\d{2})\b/)?.[0],
  );

  if (!candidate) return null;

  try {
    return normalizeDate(candidate);
  } catch {
    return null;
  }
}

function parseFileNameInfo(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const compactDateMatch = baseName.match(/(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?/);
  const recordMatch = baseName.match(/\bR[0-9A-Z-]+\b/i);
  const aircraftMatch = baseName.match(/^(.+?)_(?:20\d{6,})/);

  return {
    baseName,
    aircraftName: aircraftMatch ? aircraftMatch[1].trim() : null,
    flightDate: compactDateMatch
      ? `${compactDateMatch[1]}-${compactDateMatch[2]}-${compactDateMatch[3]}`
      : null,
    startTime: compactDateMatch
      ? [compactDateMatch[4], compactDateMatch[5], compactDateMatch[6] || "00"].join(":")
      : null,
    endTime: null,
    recordNumber: recordMatch ? recordMatch[0] : null,
  };
}

function collectNames(xml) {
  return Array.from(xml.matchAll(/<name[^>]*>([\s\S]*?)<\/name>/gi))
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function extractRecordNumber(xml, fileInfo, metadata) {
  const names = collectNames(xml);
  const metadataRecord = metadataValue(metadata, ["recordNumber", "Record Number", "Record", "Registro"]);
  const candidates = [
    fileInfo.recordNumber,
    metadataRecord,
    ...names,
    path.basename(fileInfo.baseName || "", path.extname(fileInfo.baseName || "")),
  ];

  for (const value of candidates) {
    const record = String(value || "").match(/\bR[0-9A-Z-]+\b/i)?.[0];
    if (record) return record;
  }

  return null;
}

function extractKmlFlightMetadata(kmlFile) {
  const xml = fs.readFileSync(kmlFile, "utf8");
  const kmlData = extractXmlMetadata(xml);
  const fileInfo = parseFileNameInfo(kmlFile);
  const names = collectNames(xml);
  const recordNumber = extractRecordNumber(xml, fileInfo, kmlData);
  const dateCandidate = firstNonEmpty(
    metadataValue(kmlData, ["Flight Date", "Date", "Data", "Start Time", "StartTime", "Takeoff Time"]),
    fileInfo.flightDate,
    xml.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/)?.[0],
    xml.match(/\b(20\d{2})(\d{2})(\d{2})\b/)?.[0],
  );
  const startCandidate = firstNonEmpty(
    metadataValue(kmlData, ["Start Time", "StartTime", "Takeoff Time", "Flight Start Time"]),
    fileInfo.startTime,
  );
  const endCandidate = metadataValue(kmlData, ["End Time", "EndTime", "Landing Time", "Flight End Time"]);

  const rawMetadata = {
    ...kmlData,
    _kmlNames: names,
    _sourceFileBaseName: fileInfo.baseName,
  };

  return {
    recordNumber,
    aircraftName: firstNonEmpty(
      metadataValue(kmlData, ["Aircraft Name", "Device Name", "Drone Name", "UAV Name", "Aircraft"]),
      fileInfo.aircraftName,
    ),
    flightDate: extractDateValue(dateCandidate) || fileInfo.flightDate,
    startTime: extractTimeValue(startCandidate) || fileInfo.startTime,
    endTime: extractTimeValue(endCandidate),
    taskAreaHa: firstNumber(metadataValue(kmlData, ["Task Area", "Area Covered", "Operation Area", "Area"])),
    routeSpacingM: firstNumber(metadataValue(kmlData, ["Route Spacing", "Route Spacing(m)", "routeSpacing", "Route Width"])),
    pilotName: metadataValue(kmlData, ["Pilot Name", "Pilot", "Piloto"]),
    operatorName: metadataValue(kmlData, ["Operator Name", "Operator", "Operador"]),
    taskName: metadataValue(kmlData, ["Task Name", "taskName", "Mission Name", "missionName"]),
    farmName: metadataValue(kmlData, ["Farm Name", "Farm", "Fazenda", "Property Name", "Propriedade"]),
    plotName: metadataValue(kmlData, ["Plot Name", "Plot", "Field Name", "Talhao", "Talhão", "Parcela"]),
    productName: metadataValue(kmlData, ["Product Name", "Product", "Produto", "Chemical Name"]),
    cultureName: metadataValue(kmlData, ["Culture Name", "Culture", "Crop", "Cultura"]),
    droneSerial: metadataValue(kmlData, ["Drone Serial", "Serial Number", "Aircraft Serial", "Flight Controller ID"]),
    droneModel: metadataValue(kmlData, ["Drone Model", "Aircraft Model", "Model", "Modelo"]),
    rawMetadata,
  };
}

function listFilesRecursive(rootDir, predicate) {
  const output = [];
  const stack = [rootDir];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (!predicate || predicate(fullPath)) {
        output.push(fullPath);
      }
    }
  }

  return output.sort((a, b) => a.localeCompare(b));
}

function buildKmlIndex(kmlDir) {
  const files = listFilesRecursive(kmlDir, (filePath) => /\.kml$/i.test(filePath));
  const byBaseName = new Map();
  const byRecordNumber = new Map();

  for (const filePath of files) {
    const baseName = path.basename(filePath);
    const fileInfo = parseFileNameInfo(filePath);
    byBaseName.set(baseName.toLowerCase(), filePath);
    if (fileInfo.recordNumber && !byRecordNumber.has(fileInfo.recordNumber)) {
      byRecordNumber.set(fileInfo.recordNumber, filePath);
    }
  }

  return { files, byBaseName, byRecordNumber };
}

function isInsideDir(filePath, dir) {
  const relative = path.relative(path.resolve(dir), path.resolve(filePath));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function findKmlForFlight(flight, kmlDir, kmlIndex) {
  if (flight.sourceFile && fs.existsSync(flight.sourceFile) && isInsideDir(flight.sourceFile, kmlDir)) {
    return flight.sourceFile;
  }

  if (flight.sourceFile) {
    const byBaseName = kmlIndex.byBaseName.get(path.basename(flight.sourceFile).toLowerCase());
    if (byBaseName) return byBaseName;
  }

  if (flight.recordNumber && kmlIndex.byRecordNumber.has(flight.recordNumber)) {
    return kmlIndex.byRecordNumber.get(flight.recordNumber);
  }

  for (const filePath of kmlIndex.files) {
    const xml = fs.readFileSync(filePath, "utf8");
    if (flight.recordNumber && xml.includes(flight.recordNumber)) return filePath;
  }

  return null;
}

function findExistingPath(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function localAssetsForFlight(flight, outputRoot) {
  const outputName = safeKeySegment(firstNonEmpty(flight.outputName, flight.recordNumber));
  const recordNumber = safeKeySegment(flight.recordNumber);
  const pngFile = findExistingPath([
    flight.pngFile,
    path.join(outputRoot, "png", `${outputName}.mapbox.png`),
    path.join(outputRoot, "png", `${recordNumber}.mapbox.png`),
  ]);
  const routeGeoJsonFile = findExistingPath([
    flight.routeGeoJsonFile,
    path.join(outputRoot, "geojson", `${outputName}.route.geojson`),
    path.join(outputRoot, "geojson", `${recordNumber}.route.geojson`),
  ]);
  const bufferGeoJsonFile = findExistingPath([
    flight.bufferGeoJsonFile,
    path.join(outputRoot, "geojson", `${outputName}.buffer.geojson`),
    path.join(outputRoot, "geojson", `${recordNumber}.buffer.geojson`),
  ]);

  return { pngFile, routeGeoJsonFile, bufferGeoJsonFile };
}

function requireLocalFile(filePath, label, flight) {
  if (!filePath) {
    throw new Error(`${label} nao encontrado para ${flight.recordNumber || "voo sem recordNumber"}`);
  }
  return filePath;
}

async function uploadFile(s3, options) {
  const { bucket, key, filePath, contentType, dryRun } = options;

  if (dryRun) {
    console.log(`[DRY-RUN] s3://${bucket}/${key} <= ${filePath}`);
    return;
  }

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: contentType,
  }));
}

async function uploadJson(s3, options) {
  const { bucket, key, data, dryRun } = options;

  if (dryRun) {
    console.log(`[DRY-RUN] s3://${bucket}/${key} <= JSON`);
    return;
  }

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8"),
    ContentType: CONTENT_TYPES.json,
  }));
}

function buildMetadata({ flight, kmlMetadata, kmlFile, kmlDir, assets, outputRoot, keys }) {
  return {
    recordNumber: firstNonEmpty(kmlMetadata.recordNumber, flight.recordNumber),
    sourceFile: portablePath(kmlFile, kmlDir),
    flightDate: firstNonEmpty(kmlMetadata.flightDate, flight.flightDate),
    startTime: firstNonEmpty(kmlMetadata.startTime, flight.startTime),
    endTime: firstNonEmpty(kmlMetadata.endTime, flight.endTime),
    aircraftName: firstNonEmpty(kmlMetadata.aircraftName, flight.aircraftName),
    taskAreaHa: firstNumber(kmlMetadata.taskAreaHa, flight.taskAreaHa),
    estimatedAppliedAreaHa: firstNumber(flight.estimatedAppliedAreaHa),
    routeSpacingM: firstNumber(kmlMetadata.routeSpacingM, flight.routeSpacingM),
    coordinateCount: firstNumber(flight.coordinateCount),
    bbox: flight.bbox || null,
    center: flight.center || null,
    pilotName: firstNonEmpty(kmlMetadata.pilotName, flight.pilotName),
    operatorName: firstNonEmpty(kmlMetadata.operatorName),
    taskName: firstNonEmpty(kmlMetadata.taskName),
    farmName: firstNonEmpty(kmlMetadata.farmName),
    plotName: firstNonEmpty(kmlMetadata.plotName),
    productName: firstNonEmpty(kmlMetadata.productName),
    cultureName: firstNonEmpty(kmlMetadata.cultureName),
    droneSerial: firstNonEmpty(kmlMetadata.droneSerial),
    droneModel: firstNonEmpty(kmlMetadata.droneModel),
    routeDistanceKm: firstNumber(flight.routeDistanceKm),
    pngFile: portablePath(assets.pngFile, outputRoot),
    routeGeoJsonFile: portablePath(assets.routeGeoJsonFile, outputRoot),
    bufferGeoJsonFile: portablePath(assets.bufferGeoJsonFile, outputRoot),
    rawMetadata: kmlMetadata.rawMetadata || {},
    s3: {
      rawKmlKey: keys.rawKmlKey,
      pngKey: keys.pngKey,
      routeGeoJsonKey: keys.routeGeoJsonKey,
      bufferGeoJsonKey: keys.bufferGeoJsonKey,
      metadataKey: keys.metadataKey,
    },
  };
}

function buildIndexFlight(metadata) {
  return {
    recordNumber: metadata.recordNumber,
    flightDate: metadata.flightDate,
    startTime: metadata.startTime,
    aircraftName: metadata.aircraftName,
    taskAreaHa: metadata.taskAreaHa,
    estimatedAppliedAreaHa: metadata.estimatedAppliedAreaHa,
    routeSpacingM: metadata.routeSpacingM,
    metadataS3Key: metadata.s3.metadataKey,
    pngS3Key: metadata.s3.pngKey,
    rawKmlS3Key: metadata.s3.rawKmlKey,
    routeGeoJsonS3Key: metadata.s3.routeGeoJsonKey,
    bufferGeoJsonS3Key: metadata.s3.bufferGeoJsonKey,
  };
}

async function main() {
  const rawDate = getArg("--date", "");
  const kmlDirArg = getArg("--kml-dir", "");
  const bucket = getArg("--bucket", "");
  const prefix = trimSlashes(getArg("--prefix", "dji"));
  const region = getArg("--region", "us-east-1");
  const profile = getArg("--profile", "");
  const dryRun = getBoolArg("--dry-run", false);
  const rendersBase = path.resolve(getArg("--renders-base", path.join(__dirname, "kml-mapbox-renders")));

  if (!rawDate) throw new Error("Argumento obrigatorio ausente: --date YYYY-MM-DD");
  if (!kmlDirArg) throw new Error("Argumento obrigatorio ausente: --kml-dir");
  if (!bucket) throw new Error("Argumento obrigatorio ausente: --bucket");

  const date = normalizeDate(rawDate);
  const datePart = dateToFilePart(date);
  const outputRoot = path.join(rendersBase, datePart);
  const manifestPath = path.join(outputRoot, "manifest_clean.json");
  const metadataDir = path.join(outputRoot, "metadata");

  const kmlDir = path.resolve(kmlDirArg);
  if (!fs.existsSync(kmlDir)) throw new Error(`Pasta KML nao encontrada: ${kmlDir}`);

  if (profile) {
    process.env.AWS_PROFILE = profile;
    process.env.AWS_SDK_LOAD_CONFIG = "1";
  }

  console.log("[INFO] Lendo manifest renderizado");
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest nao encontrado: ${manifestPath}`);
  const manifest = readJson(manifestPath);

  console.log("[INFO] Localizando KML original");
  const kmlIndex = buildKmlIndex(kmlDir);
  ensureDir(metadataDir);

  const s3 = new S3Client({ region });
  const warnings = [];
  const errors = [];
  const indexFlights = [];

  for (const flight of manifest.flights || []) {
    const recordNumber = safeKeySegment(flight.recordNumber);

    try {
      const kmlFile = requireLocalFile(findKmlForFlight(flight, kmlDir, kmlIndex), "KML original", flight);
      const assets = localAssetsForFlight(flight, outputRoot);
      requireLocalFile(assets.pngFile, "PNG individual Mapbox", flight);
      requireLocalFile(assets.routeGeoJsonFile, "route.geojson", flight);
      requireLocalFile(assets.bufferGeoJsonFile, "buffer.geojson", flight);

      console.log("[INFO] Extraindo metadados do KML");
      const kmlMetadata = extractKmlFlightMetadata(kmlFile);
      const finalRecordNumber = safeKeySegment(firstNonEmpty(kmlMetadata.recordNumber, flight.recordNumber, recordNumber));

      if (flight.recordNumber && kmlMetadata.recordNumber && flight.recordNumber !== kmlMetadata.recordNumber) {
        warnings.push({
          stage: "metadata_merge",
          sourceFile: portablePath(kmlFile, kmlDir),
          message: `recordNumber do manifest (${flight.recordNumber}) difere do KML (${kmlMetadata.recordNumber}).`,
        });
      }

      const keys = {
        rawKmlKey: s3Key(prefix, "raw-kml", datePart, `${finalRecordNumber}.kml`),
        pngKey: s3Key(prefix, "renders", datePart, "png", `${finalRecordNumber}.mapbox.png`),
        routeGeoJsonKey: s3Key(prefix, "renders", datePart, "geojson", `${finalRecordNumber}.route.geojson`),
        bufferGeoJsonKey: s3Key(prefix, "renders", datePart, "geojson", `${finalRecordNumber}.buffer.geojson`),
        metadataKey: s3Key(prefix, "renders", datePart, "metadata", `${finalRecordNumber}.metadata.json`),
      };

      console.log("[INFO] Preparando pacote do voo");
      const metadata = buildMetadata({
        flight,
        kmlMetadata,
        kmlFile,
        kmlDir,
        assets,
        outputRoot,
        keys,
      });
      const localMetadataPath = path.join(metadataDir, `${finalRecordNumber}.metadata.json`);
      writeJson(localMetadataPath, metadata);

      console.log("[INFO] Upload KML original");
      await uploadFile(s3, {
        bucket,
        key: keys.rawKmlKey,
        filePath: kmlFile,
        contentType: CONTENT_TYPES.kml,
        dryRun,
      });

      console.log("[INFO] Upload PNG");
      await uploadFile(s3, {
        bucket,
        key: keys.pngKey,
        filePath: assets.pngFile,
        contentType: CONTENT_TYPES.png,
        dryRun,
      });

      console.log("[INFO] Upload GeoJSON");
      await uploadFile(s3, {
        bucket,
        key: keys.routeGeoJsonKey,
        filePath: assets.routeGeoJsonFile,
        contentType: CONTENT_TYPES.geojson,
        dryRun,
      });
      await uploadFile(s3, {
        bucket,
        key: keys.bufferGeoJsonKey,
        filePath: assets.bufferGeoJsonFile,
        contentType: CONTENT_TYPES.geojson,
        dryRun,
      });

      console.log("[INFO] Upload metadata.json");
      await uploadJson(s3, {
        bucket,
        key: keys.metadataKey,
        data: metadata,
        dryRun,
      });

      indexFlights.push(buildIndexFlight(metadata));
    } catch (error) {
      errors.push({
        stage: "flight_package",
        recordNumber: flight.recordNumber || null,
        sourceFile: portablePath(flight.sourceFile, kmlDir),
        message: error.message,
      });
    }
  }

  const flightIndex = {
    date,
    bucket,
    prefix,
    region,
    totalFlights: indexFlights.length,
    flights: indexFlights,
    warnings,
    errors,
  };
  const indexKey = s3Key(prefix, "renders", datePart, "flight-index.json");
  const localIndexPath = path.join(outputRoot, "flight-index.local.json");

  writeJson(localIndexPath, flightIndex);
  await uploadJson(s3, {
    bucket,
    key: indexKey,
    data: flightIndex,
    dryRun,
  });

  console.log("[OK] Flight index gerado");
  console.log("[OK] Ingestão DJI concluída");
}

main().catch((error) => {
  console.error("[ERRO]", error.message);
  process.exit(1);
});
