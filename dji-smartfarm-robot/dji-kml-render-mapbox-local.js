/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const turf = require("@turf/turf");

const DEFAULT_MAPBOX_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

function optionalRequire(name) {
  try {
    return require(name);
  } catch {
    return null;
  }
}

const fastXmlParser = optionalRequire("fast-xml-parser");

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
  return value ? normalizeDate(value).replace(/-/g, "_") : "all";
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

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function hasDisplayValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function formatDecimal(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatHa(value) {
  const formatted = formatDecimal(value, 2);
  return formatted ? `${formatted} ha` : null;
}

function formatMeters(value) {
  const formatted = formatDecimal(value, 2);
  return formatted ? `${formatted} m` : null;
}

function formatDatePtBr(value) {
  let normalized = null;
  try {
    normalized = normalizeDate(value);
  } catch {
    return null;
  }
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function safeFileName(value) {
  return String(value || "unknown")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140) || "unknown";
}

function uniqueOutputName(value, sourceFile, usedNames) {
  const baseName = safeFileName(value);
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  const sourceBaseName = safeFileName(path.basename(sourceFile, path.extname(sourceFile)));
  let candidate = safeFileName(`${baseName}_${sourceBaseName}`);
  let counter = 2;

  while (usedNames.has(candidate)) {
    candidate = safeFileName(`${baseName}_${sourceBaseName}_${counter}`);
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
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

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsString(value) {
  return JSON.stringify(String(value ?? ""));
}

function listKmlFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.kml$/i.test(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
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

function flattenXmlObject(value, output = []) {
  if (value === null || value === undefined) return output;
  if (typeof value !== "object") {
    output.push(String(value));
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenXmlObject(item, output);
    return output;
  }
  for (const item of Object.values(value)) flattenXmlObject(item, output);
  return output;
}

function parseXmlWithFastParser(xml) {
  if (!fastXmlParser?.XMLParser) return null;
  try {
    const parser = new fastXmlParser.XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      trimValues: true,
    });
    return parser.parse(xml);
  } catch {
    return null;
  }
}

function extractXmlMetadata(xml) {
  const metadata = {};

  for (const match of xml.matchAll(/<Data\s+name=["']([^"']+)["'][\s\S]*?<value>([\s\S]*?)<\/value>/gi)) {
    metadata[decodeXml(match[1]).trim()] = decodeXml(match[2]).trim();
  }

  for (const match of xml.matchAll(/<SimpleData\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/SimpleData>/gi)) {
    metadata[decodeXml(match[1]).trim()] = decodeXml(match[2]).trim();
  }

  return metadata;
}

function metadataValue(metadata, labels) {
  const keys = Object.keys(metadata || {});

  for (const label of labels) {
    const found = keys.find((key) => key.toLowerCase() === label.toLowerCase());
    if (found && String(metadata[found]).trim()) return metadata[found];
  }

  for (const label of labels) {
    const found = keys.find((key) =>
      key.toLowerCase().includes(label.toLowerCase()),
    );
    if (found && String(metadata[found]).trim()) return metadata[found];
  }

  return null;
}

function extractRecordNumber(xml, fileInfo, parsedXml) {
  const nameRecords = Array.from(xml.matchAll(/<name[^>]*>([\s\S]*?)<\/name>/gi))
    .map((match) => decodeXml(match[1]).trim())
    .map((value) => value.match(/\bR[0-9A-Z-]+\b/i)?.[0])
    .filter(Boolean);

  const parsedRecords = parsedXml
    ? flattenXmlObject(parsedXml)
        .map((value) => value.match(/\bR[0-9A-Z-]+\b/i)?.[0])
        .filter(Boolean)
    : [];

  return firstNonEmpty(fileInfo.recordNumber, ...nameRecords, ...parsedRecords);
}

function extractDateFromXml(xml, metadata) {
  const candidate = firstNonEmpty(
    metadataValue(metadata, ["Flight Date", "Date", "Start Time", "StartTime", "Takeoff Time"]),
    xml.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/)?.[0],
    xml.match(/\b(20\d{2})(\d{2})(\d{2})\b/)?.[0],
  );

  if (!candidate) return null;

  try {
    return normalizeDate(candidate);
  } catch {
    return null;
  }
}

function extractTimeValue(value) {
  const text = String(value || "");
  const match = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
  }

  const compact = text.match(/\b(20\d{6})(\d{2})(\d{2})(\d{2})\b/);
  if (compact) return `${compact[2]}:${compact[3]}:${compact[4]}`;

  return null;
}

function extractCoordinates(xml) {
  return Array.from(xml.matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi))
    .map((match) =>
      decodeXml(match[1])
        .trim()
        .split(/\s+/)
        .map((token) => token.split(",").slice(0, 2).map(Number))
        .filter(
          (pair) =>
            pair.length === 2 &&
            Number.isFinite(pair[0]) &&
            Number.isFinite(pair[1]),
        ),
    )
    .filter((coordinates) => coordinates.length > 0);
}

function calculateBBox(coordinates) {
  if (!coordinates.length) return null;

  const lngs = coordinates.map((coord) => coord[0]);
  const lats = coordinates.map((coord) => coord[1]);

  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function bboxCenter(bbox) {
  if (!bbox) return null;
  return [round((bbox[0] + bbox[2]) / 2, 7), round((bbox[1] + bbox[3]) / 2, 7)];
}

function bboxToBoundsLiteral(bbox) {
  if (!bbox) return "null";
  return JSON.stringify([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);
}

function allCoordinates(lineStrings) {
  return lineStrings.flat();
}

function startEndPoints(lineStrings) {
  const lines = lineStrings.filter((line) => line.length > 0);
  if (!lines.length) return { start: null, end: null };

  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  return {
    start: firstLine[0],
    end: lastLine[lastLine.length - 1],
  };
}

function buildRouteGeoJson(flight, lineStrings) {
  return {
    type: "FeatureCollection",
    features: lineStrings.map((coordinates, index) => ({
      type: "Feature",
      properties: {
        kind: "flight_route",
        segmentIndex: index + 1,
        recordNumber: flight.recordNumber,
        aircraftName: flight.aircraftName,
        flightDate: flight.flightDate,
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    })),
  };
}

function buildPointGeoJson(point, kind, flight) {
  return {
    type: "FeatureCollection",
    features: point
      ? [{
          type: "Feature",
          properties: {
            kind,
            recordNumber: flight.recordNumber,
          },
          geometry: {
            type: "Point",
            coordinates: point,
          },
        }]
      : [],
  };
}

function parseKmlFile(filePath, targetDate, defaultRouteSpacingM) {
  console.log(`[INFO] Parseando KML: ${path.basename(filePath)}`);

  const xml = fs.readFileSync(filePath, "utf8");
  const parsedXml = parseXmlWithFastParser(xml);
  const fileInfo = parseFileNameInfo(filePath);
  const metadata = extractXmlMetadata(xml);
  const flightDate = firstNonEmpty(fileInfo.flightDate, extractDateFromXml(xml, metadata));
  const rawLineStrings = extractCoordinates(xml);
  const lineStrings = rawLineStrings.filter((coordinatesLine) => coordinatesLine.length >= 2);
  const coordinates = allCoordinates(lineStrings);
  const routeSpacingFromKml = parseNumber(
    metadataValue(metadata, ["Route Spacing", "Route Spacing(m)", "routeSpacing", "Route Width"]),
  );

  if (!lineStrings.length) {
    throw new Error("Nenhuma coordenada de rota encontrada no KML.");
  }

  const recordNumber = firstNonEmpty(
    extractRecordNumber(xml, fileInfo, parsedXml),
    path.basename(filePath, path.extname(filePath)),
  );
  const flight = {
    recordNumber,
    mapScope: "single_kml_file",
    mapPurpose: "individual_report_map",
    overviewOnly: false,
    aircraftName: firstNonEmpty(
      fileInfo.aircraftName,
      metadataValue(metadata, ["Aircraft Name", "Device Name", "Drone Name", "UAV Name"]),
    ),
    sourceFile: filePath,
    flightDate,
    startTime: firstNonEmpty(
      fileInfo.startTime,
      extractTimeValue(metadataValue(metadata, ["Start Time", "StartTime", "Takeoff Time"])),
    ),
    endTime: extractTimeValue(metadataValue(metadata, ["End Time", "EndTime", "Landing Time"])),
    pilotName: metadataValue(metadata, ["Pilot Name", "Operator Name"]),
    taskAreaHa: parseNumber(
      metadataValue(metadata, ["Task Area", "Area Covered", "Operation Area", "Area"]),
    ),
    routeSpacingM: routeSpacingFromKml ?? defaultRouteSpacingM,
    routeSpacingSource: routeSpacingFromKml === null ? "default" : "kml",
    coordinateCount: coordinates.length,
    segmentCount: lineStrings.length,
    routeGeometryType: "FeatureCollection",
    bbox: calculateBBox(coordinates),
    center: null,
    routeDistanceKm: null,
    estimatedAppliedAreaHa: null,
    routeGeoJsonFile: null,
    bufferGeoJsonFile: null,
    htmlFile: null,
    pngFile: null,
    renderStatus: "ERROR",
    warnings: [],
  };

  if (rawLineStrings.length !== lineStrings.length) {
    flight.warnings.push({
      stage: "kml_segments",
      message: "Blocos de coordenadas com menos de dois pontos foram ignorados para preservar apenas segmentos reais de rota.",
      ignoredCoordinateBlocks: rawLineStrings.length - lineStrings.length,
    });
  }

  if (targetDate && flight.flightDate !== targetDate) {
    flight.filteredOutReason = `flightDate ${flight.flightDate || "desconhecida"} diferente de ${targetDate}`;
  }

  const routeGeoJson = buildRouteGeoJson(flight, lineStrings);
  const bufferDistance = (flight.routeSpacingM || defaultRouteSpacingM) / 2;
  const bufferGeoJson = turf.buffer(routeGeoJson, bufferDistance, { units: "meters" });
  const bufferBbox = turf.bbox(bufferGeoJson);
  const routeDistanceKm = lineStrings.reduce((sum, coordinatesLine) => {
    if (coordinatesLine.length < 2) return sum;
    return sum + turf.length(turf.lineString(coordinatesLine), { units: "kilometers" });
  }, 0);

  flight.bbox = bufferBbox || flight.bbox;
  flight.center = bboxCenter(flight.bbox);
  flight.routeDistanceKm = round(routeDistanceKm, 4);
  flight.estimatedAppliedAreaHa = round(turf.area(bufferGeoJson) / 10000, 4);
  flight.startEnd = startEndPoints(lineStrings);

  return { flight, routeGeoJson, bufferGeoJson };
}

function filterKmlFilesByDate(kmlFiles, date, manifest) {
  if (!date) {
    console.log(`[INFO] KMLs filtrados pela data: ${kmlFiles.length}`);
    return kmlFiles;
  }

  const selected = [];
  for (const filePath of kmlFiles) {
    const fileInfo = parseFileNameInfo(filePath);
    if (fileInfo.flightDate === date) {
      selected.push(filePath);
      continue;
    }

    if (!fileInfo.flightDate) {
      try {
        const xml = fs.readFileSync(filePath, "utf8");
        const metadata = extractXmlMetadata(xml);
        if (extractDateFromXml(xml, metadata) === date) selected.push(filePath);
      } catch (error) {
        manifest.warnings.push({
          stage: "kml_date_filter",
          sourceFile: filePath,
          message: error.message,
        });
      }
    }
  }

  console.log(`[INFO] KMLs filtrados pela data: ${selected.length}`);
  return selected;
}

function mapboxHtmlDocument({
  title,
  mapboxToken,
  mapboxStyle,
  width,
  height,
  padding,
  bbox,
  bodyPanel,
  scriptBody,
  showNavigationControl = true,
}) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; background: #0d1117; font-family: Arial, sans-serif; }
    #map { width: ${Number(width)}px; height: ${Number(height)}px; max-width: 100vw; max-height: 100vh; }
    .panel {
      position: absolute;
      top: 24px;
      left: 24px;
      width: 280px;
      max-width: calc(100% - 48px);
      background: rgba(255, 255, 255, 0.9);
      color: #111827;
      border-radius: 8px;
      padding: 14px 16px;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
      line-height: 1.35;
      z-index: 2;
    }
    .panel h1 { margin: 0 0 9px; font-size: 16px; letter-spacing: 0; }
    .row { display: flex; justify-content: space-between; gap: 14px; border-top: 1px solid rgba(17, 24, 39, 0.1); padding: 6px 0; font-size: 12.5px; }
    .row:first-of-type { border-top: 0; }
    .label { color: #4b5563; }
    .value { font-weight: 700; text-align: right; overflow-wrap: anywhere; }
    .legend { display: grid; gap: 7px; max-height: 420px; overflow: auto; }
    .legend-item { display: grid; grid-template-columns: 16px 1fr; align-items: center; gap: 8px; font-size: 13px; }
    .swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,.2); }
    .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  ${bodyPanel}
  <script>
    mapboxgl.accessToken = ${jsString(mapboxToken)};
    window.__MAPBOX_RENDER_READY = false;
    const map = new mapboxgl.Map({
      container: "map",
      style: ${jsString(mapboxStyle)},
      bounds: ${bboxToBoundsLiteral(bbox)},
      fitBoundsOptions: { padding: ${Number(padding)}, duration: 0 },
      preserveDrawingBuffer: true
    });
    ${showNavigationControl ? 'map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");' : ""}
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 180, unit: "metric" }), "bottom-right");
    map.on("load", () => {
      ${scriptBody}
      if (${bboxToBoundsLiteral(bbox)}) map.fitBounds(${bboxToBoundsLiteral(bbox)}, { padding: ${Number(padding)}, duration: 0 });
    });
    map.once("idle", () => {
      window.__MAPBOX_RENDER_READY = true;
    });
  </script>
</body>
</html>`;
}

function flightPanel(flight) {
  const timeValue = flight.startTime && flight.endTime ? `${flight.startTime} - ${flight.endTime}` : null;
  const rows = [
    ["Registro", flight.recordNumber],
    ["Drone", flight.aircraftName],
    ["Data", formatDatePtBr(flight.flightDate)],
    ["Hor&aacute;rio", timeValue],
    ["&Aacute;rea DJI", formatHa(flight.taskAreaHa)],
    ["&Aacute;rea estimada desenhada", formatHa(flight.estimatedAppliedAreaHa)],
    ["Faixa", formatMeters(flight.routeSpacingM)],
    ["Pontos da rota", flight.coordinateCount],
  ].filter(([, value]) => hasDisplayValue(value));

  return `<aside class="panel">
    <h1>Aplica&ccedil;&atilde;o DJI</h1>
    ${rows.map(([label, value]) => `<div class="row"><span class="label">${label}</span><span class="value">${htmlEscape(value)}</span></div>`).join("\n")}
  </aside>`;
}

function flightMapScript(routeGeoJson, bufferGeoJson, startGeoJson, endGeoJson) {
  return `
      const routeGeoJson = ${JSON.stringify(routeGeoJson)};
      const bufferGeoJson = ${JSON.stringify(bufferGeoJson)};
      const startGeoJson = ${JSON.stringify(startGeoJson)};
      const endGeoJson = ${JSON.stringify(endGeoJson)};
      map.addSource("buffer", { type: "geojson", data: bufferGeoJson });
      map.addLayer({
        id: "buffer-fill",
        type: "fill",
        source: "buffer",
        paint: { "fill-color": "#22c55e", "fill-opacity": 0.34 }
      });
      map.addLayer({
        id: "buffer-outline",
        type: "line",
        source: "buffer",
        paint: { "line-color": "#14532d", "line-width": 2.5, "line-opacity": 0.95 }
      });
      map.addSource("route", { type: "geojson", data: routeGeoJson });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#f97316", "line-width": 4.5, "line-opacity": 0.95 }
      });
      map.addSource("start-point", { type: "geojson", data: startGeoJson });
      map.addLayer({
        id: "start-point-circle",
        type: "circle",
        source: "start-point",
        paint: { "circle-radius": 7, "circle-color": "#16a34a", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 }
      });
      map.addSource("end-point", { type: "geojson", data: endGeoJson });
      map.addLayer({
        id: "end-point-circle",
        type: "circle",
        source: "end-point",
        paint: { "circle-radius": 7, "circle-color": "#dc2626", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 }
      });
  `;
}

function writeFlightHtml(flight, routeGeoJson, bufferGeoJson, outputDirs, options) {
  console.log("[INFO] Gerando HTML Mapbox");
  const startGeoJson = buildPointGeoJson(flight.startEnd?.start, "start", flight);
  const endGeoJson = buildPointGeoJson(flight.startEnd?.end, "end", flight);
  const html = mapboxHtmlDocument({
    title: `DJI ${flight.recordNumber || "voo"}`,
    mapboxToken: options.mapboxToken,
    mapboxStyle: options.mapboxStyle,
    width: options.width,
    height: options.height,
    padding: options.padding,
    bbox: flight.bbox,
    bodyPanel: flightPanel(flight),
    scriptBody: flightMapScript(routeGeoJson, bufferGeoJson, startGeoJson, endGeoJson),
    showNavigationControl: false,
  });
  const filePath = path.join(outputDirs.htmlDir, `${safeFileName(flight.outputName || flight.recordNumber)}.mapbox.html`);
  fs.writeFileSync(filePath, html, "utf8");
  flight.htmlFile = filePath;
  return filePath;
}

function colorForIndex(index) {
  const colors = [
    "#22c55e", "#f97316", "#0ea5e9", "#e11d48", "#a855f7",
    "#eab308", "#14b8a6", "#f43f5e", "#84cc16", "#6366f1",
  ];
  return colors[index % colors.length];
}

function addColorProperties(featureCollection, flight, color) {
  return {
    type: "FeatureCollection",
    features: (featureCollection?.features || []).map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties || {}),
        recordNumber: flight.recordNumber,
        aircraftName: flight.aircraftName,
        color,
      },
    })),
  };
}

function mergeFeatureCollections(collections) {
  return {
    type: "FeatureCollection",
    features: collections.flatMap((collection) => collection?.features || []),
  };
}

function overviewPanel(flights, colors) {
  return `<aside class="panel">
    <h1>Overview do dia</h1>
    <div class="legend">
      ${flights.map((flight, index) => `<div class="legend-item"><span class="swatch" style="background:${colors[index]}"></span><span>${htmlEscape(flight.recordNumber || "sem record")} ${htmlEscape(flight.aircraftName || "")}</span></div>`).join("\n")}
    </div>
  </aside>`;
}

function overviewScript(routeGeoJson, bufferGeoJson) {
  return `
      const routeGeoJson = ${JSON.stringify(routeGeoJson)};
      const bufferGeoJson = ${JSON.stringify(bufferGeoJson)};
      map.addSource("overview-buffer", { type: "geojson", data: bufferGeoJson });
      map.addLayer({
        id: "overview-buffer-fill",
        type: "fill",
        source: "overview-buffer",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.24 }
      });
      map.addLayer({
        id: "overview-buffer-line",
        type: "line",
        source: "overview-buffer",
        paint: { "line-color": ["get", "color"], "line-width": 2, "line-opacity": 0.9 }
      });
      map.addSource("overview-route", { type: "geojson", data: routeGeoJson });
      map.addLayer({
        id: "overview-route-line",
        type: "line",
        source: "overview-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 3.4, "line-opacity": 0.95 }
      });
  `;
}

function combinedBbox(flights) {
  const boxes = flights.map((flight) => flight.bbox).filter(Boolean);
  if (!boxes.length) return null;
  return [
    Math.min(...boxes.map((bbox) => bbox[0])),
    Math.min(...boxes.map((bbox) => bbox[1])),
    Math.max(...boxes.map((bbox) => bbox[2])),
    Math.max(...boxes.map((bbox) => bbox[3])),
  ];
}

function writeOverviewHtml(flights, renderedData, outputDirs, options) {
  console.log("[INFO] Gerando overview do dia");
  const colors = flights.map((_, index) => colorForIndex(index));
  const routes = renderedData.map((item, index) => addColorProperties(item.routeGeoJson, item.flight, colors[index]));
  const buffers = renderedData.map((item, index) => addColorProperties(item.bufferGeoJson, item.flight, colors[index]));
  const html = mapboxHtmlDocument({
    title: "DJI overview",
    mapboxToken: options.mapboxToken,
    mapboxStyle: options.mapboxStyle,
    width: options.width,
    height: options.height,
    padding: options.padding,
    bbox: combinedBbox(flights),
    bodyPanel: overviewPanel(flights, colors),
    scriptBody: overviewScript(mergeFeatureCollections(routes), mergeFeatureCollections(buffers)),
    showNavigationControl: true,
  });
  const filePath = path.join(outputDirs.outputRoot, "overview_day.mapbox.html");
  fs.writeFileSync(filePath, html, "utf8");
  return filePath;
}

async function renderPngWithPlaywright(htmlFile, pngFile, options, manifest) {
  console.log("[INFO] Renderizando PNG com Playwright");
  const playwright = optionalRequire("playwright");
  if (!playwright) {
    manifest.warnings.push({
      stage: "render_png",
      htmlFile,
      message: "Playwright nao instalado; rode npm install playwright em dji-smartfarm-robot para gerar PNG.",
    });
    return false;
  }

  let browser = null;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: options.width, height: options.height } });
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "load", timeout: 60000 });
    await page.waitForFunction(() => window.__MAPBOX_RENDER_READY === true, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: pngFile, type: "png", fullPage: false });
    console.log(`[OK] PNG gerado: ${pngFile}`);
    return true;
  } catch (error) {
    manifest.warnings.push({
      stage: "render_png",
      htmlFile,
      pngFile,
      message: error.message,
    });
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function cleanFlight(flight) {
  return {
    recordNumber: flight.recordNumber,
    mapScope: flight.mapScope,
    mapPurpose: flight.mapPurpose,
    overviewOnly: flight.overviewOnly,
    outputName: flight.outputName,
    aircraftName: flight.aircraftName,
    sourceFile: flight.sourceFile,
    flightDate: flight.flightDate,
    startTime: flight.startTime,
    endTime: flight.endTime,
    pilotName: flight.pilotName,
    taskAreaHa: flight.taskAreaHa,
    estimatedAppliedAreaHa: flight.estimatedAppliedAreaHa,
    routeSpacingM: flight.routeSpacingM,
    coordinateCount: flight.coordinateCount,
    segmentCount: flight.segmentCount,
    routeGeometryType: flight.routeGeometryType,
    bbox: flight.bbox,
    center: flight.center,
    routeDistanceKm: flight.routeDistanceKm,
    routeGeoJsonFile: flight.routeGeoJsonFile,
    bufferGeoJsonFile: flight.bufferGeoJsonFile,
    htmlFile: flight.htmlFile,
    pngFile: flight.pngFile,
    renderStatus: flight.renderStatus,
  };
}

function buildManifestClean(manifest) {
  return {
    date: manifest.date,
    totalKmlFilesFound: manifest.totalKmlFilesFound,
    totalKmlFilesRendered: manifest.totalKmlFilesRendered,
    totalErrors: manifest.errors.length,
    outputDir: manifest.outputDir,
    mapboxStyle: manifest.mapboxStyle,
    flights: manifest.flights.map(cleanFlight),
    overview: manifest.overview,
    warnings: manifest.warnings,
    errors: manifest.errors,
  };
}

async function main() {
  const rawDate = getArg("--date", "");
  const date = rawDate ? normalizeDate(rawDate) : null;
  const kmlDir = path.resolve(getArg("--kml-dir", ""));
  const mapboxToken = firstNonEmpty(
    getArg("--mapbox-token", ""),
    process.env.MAPBOX_TOKEN,
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    process.env.REACT_APP_MAPBOX_TOKEN,
  );
  const mapboxStyle = getArg("--map-style", DEFAULT_MAPBOX_STYLE);
  const defaultRouteSpacingM = parseNumber(getArg("--default-route-spacing-m", "7")) ?? 7;
  const width = parseNumber(getArg("--width", "1600")) ?? 1600;
  const height = parseNumber(getArg("--height", "1000")) ?? 1000;
  const padding = parseNumber(getArg("--padding", "80")) ?? 80;
  const renderPng = getBoolArg("--render-png", true);
  const renderHtml = getBoolArg("--render-html", true);
  const renderOverview = getBoolArg("--overview", true);
  const outputRoot = path.resolve(
    getArg("--output", path.join(__dirname, "kml-mapbox-renders", date ? dateToFilePart(date) : "all")),
  );
  const outputDirs = {
    outputRoot,
    geojsonDir: path.join(outputRoot, "geojson"),
    htmlDir: path.join(outputRoot, "html"),
    pngDir: path.join(outputRoot, "png"),
  };
  const manifest = {
    date,
    kmlDir,
    outputDir: outputRoot,
    mapboxStyle,
    generatedAt: new Date().toISOString(),
    totalKmlFilesFound: 0,
    totalKmlFilesRendered: 0,
    flights: [],
    overview: {
      mapScope: "multiple_kml_operational_overview",
      mapPurpose: "operational_support",
      overviewOnly: true,
      reportBase: false,
      note: "Overview operacional; nao usar como base do relatorio.",
      htmlFile: null,
      pngFile: null,
      renderStatus: mapboxToken ? "ERROR" : "GEOJSON_ONLY_NO_MAPBOX_TOKEN",
    },
    warnings: [],
    errors: [],
  };

  if (!fs.existsSync(kmlDir)) {
    throw new Error(`Pasta KML nao encontrada: ${kmlDir}`);
  }

  if (!fastXmlParser) {
    manifest.warnings.push({
      stage: "dependencies",
      message: "fast-xml-parser nao esta instalado; parser interno por regex sera usado. Para instalar: npm install fast-xml-parser.",
    });
  }

  if (!mapboxToken) {
    manifest.warnings.push({
      stage: "mapbox_token",
      message: "Token Mapbox ausente; GeoJSON e manifest serao gerados, mas HTML/PNG Mapbox nao serao renderizados.",
    });
  }

  ensureDir(outputDirs.outputRoot);
  ensureDir(outputDirs.geojsonDir);
  if (mapboxToken && (renderHtml || renderPng || renderOverview)) ensureDir(outputDirs.htmlDir);
  if (mapboxToken && renderPng) ensureDir(outputDirs.pngDir);

  console.log("[INFO] Lendo KMLs locais");
  const allKmlFiles = listKmlFiles(kmlDir);
  manifest.totalKmlFilesFound = allKmlFiles.length;
  const selectedKmlFiles = filterKmlFilesByDate(allKmlFiles, date, manifest);
  const renderedData = [];
  const options = { mapboxToken, mapboxStyle, width, height, padding };
  const usedOutputNames = new Set();

  for (const filePath of selectedKmlFiles) {
    let parsed = null;
    try {
      parsed = parseKmlFile(filePath, date, defaultRouteSpacingM);
      const recordFileName = uniqueOutputName(parsed.flight.recordNumber, filePath, usedOutputNames);
      parsed.flight.outputName = recordFileName;
      parsed.flight.routeGeoJsonFile = path.join(outputDirs.geojsonDir, `${recordFileName}.route.geojson`);
      parsed.flight.bufferGeoJsonFile = path.join(outputDirs.geojsonDir, `${recordFileName}.buffer.geojson`);
      writeJson(parsed.flight.routeGeoJsonFile, parsed.routeGeoJson);
      writeJson(parsed.flight.bufferGeoJsonFile, parsed.bufferGeoJson);
      console.log(`[OK] GeoJSON gerado: ${recordFileName}`);

      if (!mapboxToken) {
        parsed.flight.renderStatus = "GEOJSON_ONLY_NO_MAPBOX_TOKEN";
      } else {
        if (renderHtml || renderPng) {
          writeFlightHtml(parsed.flight, parsed.routeGeoJson, parsed.bufferGeoJson, outputDirs, options);
        }

        if (renderPng && parsed.flight.htmlFile) {
          parsed.flight.pngFile = path.join(outputDirs.pngDir, `${recordFileName}.mapbox.png`);
          const pngOk = await renderPngWithPlaywright(parsed.flight.htmlFile, parsed.flight.pngFile, options, manifest);
          parsed.flight.renderStatus = pngOk ? "RENDERED" : "HTML_ONLY_NO_PLAYWRIGHT";
          if (!pngOk) parsed.flight.pngFile = null;
        } else {
          parsed.flight.renderStatus = "RENDERED";
        }
      }

      renderedData.push(parsed);
      manifest.flights.push(parsed.flight);
    } catch (error) {
      const fallbackRecord = safeFileName(path.basename(filePath, path.extname(filePath)));
      const failedFlight = {
        recordNumber: fallbackRecord,
        mapScope: "single_kml_file",
        mapPurpose: "individual_report_map",
        overviewOnly: false,
        aircraftName: null,
        sourceFile: filePath,
        flightDate: null,
        taskAreaHa: null,
        estimatedAppliedAreaHa: null,
        routeSpacingM: defaultRouteSpacingM,
        coordinateCount: 0,
        segmentCount: 0,
        routeGeometryType: "FeatureCollection",
        bbox: null,
        center: null,
        routeDistanceKm: null,
        routeGeoJsonFile: null,
        bufferGeoJsonFile: null,
        htmlFile: null,
        pngFile: null,
        renderStatus: "ERROR",
      };
      manifest.flights.push(failedFlight);
      manifest.errors.push({
        stage: "kml_parse_or_render",
        sourceFile: filePath,
        message: error.message,
        stack: error.stack,
      });
    }
  }

  if (mapboxToken && renderOverview && renderedData.length) {
    const overviewHtml = writeOverviewHtml(
      renderedData.map((item) => item.flight),
      renderedData,
      outputDirs,
      options,
    );
    manifest.overview.htmlFile = overviewHtml;

    if (renderPng) {
      const overviewPng = path.join(outputDirs.outputRoot, "overview_day.mapbox.png");
      const pngOk = await renderPngWithPlaywright(overviewHtml, overviewPng, options, manifest);
      manifest.overview.pngFile = pngOk ? overviewPng : null;
      manifest.overview.renderStatus = pngOk ? "RENDERED" : "HTML_ONLY_NO_PLAYWRIGHT";
    } else {
      manifest.overview.renderStatus = "RENDERED";
    }
  } else if (!mapboxToken) {
    manifest.overview.renderStatus = "GEOJSON_ONLY_NO_MAPBOX_TOKEN";
  } else if (!renderOverview) {
    manifest.overview.renderStatus = "RENDERED";
  }

  manifest.totalKmlFilesRendered = manifest.flights.filter((flight) => flight.renderStatus === "RENDERED").length;
  writeJson(path.join(outputDirs.outputRoot, "manifest.json"), manifest);
  writeJson(path.join(outputDirs.outputRoot, "manifest_clean.json"), buildManifestClean(manifest));
  console.log("[OK] Manifest gerado");
}

main().catch((error) => {
  console.error("[ERRO]", error.message);
  process.exit(1);
});
