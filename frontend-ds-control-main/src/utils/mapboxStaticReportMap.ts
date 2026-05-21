import type { GeoJSON } from 'geojson';

import type { Plot } from '@/types/plot.type';

const DEFAULT_PADDING = 0.1;
const MIN_SPAN = 1e-4;
const WEB_MERCATOR_MAX_LAT = 85.05112878;

const DEBUG_PREFIX = '[REPORT_MAP_DEBUG]';

export type ReportMapSuccessMode = 'bbox_only';

function logReportMapSuccess(params: {
  plotId: string;
  plotName: string;
  bounds: ReportMapBoundingBox;
  geometryTypes: string[];
  finalUrl: string;
  mapMode: ReportMapSuccessMode;
}): void {
  console.log(DEBUG_PREFIX, {
    phase: 'buildReportMapboxStaticUrl:success',
    plotId: params.plotId,
    plotName: params.plotName,
    bounds: params.bounds,
    geometryTypes: params.geometryTypes,
    mapMode: params.mapMode,
    finalUrlLength: params.finalUrl.length,
    finalUrl: params.finalUrl,
  });
}

export type ReportMapBoundingBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  centerLng: number;
  centerLat: number;
};

/** Quando `url` é null; caso contrário `unavailableReason` é null. */
export type ReportMapUnavailableReason =
  | 'token_missing'
  | 'geojson_missing'
  | 'bounds_invalid'
  | 'unsupported_geometry'
  | 'unknown';

export type BuildReportMapboxStaticUrlResult = {
  url: string | null;
  unavailableReason: ReportMapUnavailableReason | null;
  /** Mantido por compatibilidade; sempre false (sem overlay geojson). */
  usedLongUrlFallback: boolean;
};

export function parsePlotGeoJson(plot: Plot): GeoJSON | null {
  let geoJson: unknown = plot.geoJson;
  if (geoJson === undefined || geoJson === null) {
    return null;
  }
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson) as GeoJSON;
    } catch {
      return null;
    }
  }
  return geoJson as GeoJSON;
}

function collectGeometryTypes(geoJson: GeoJSON | null): string[] {
  if (!geoJson || geoJson.type !== 'FeatureCollection' || !geoJson.features?.length) {
    return [];
  }
  return geoJson.features.map((f) => f.geometry?.type ?? 'null_geometry');
}

export function calculatePlotBounds(plot: Plot): ReportMapBoundingBox | null {
  const geoJson = parsePlotGeoJson(plot);
  if (!geoJson || geoJson.type !== 'FeatureCollection' || !geoJson.features?.length) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const feature of geoJson.features) {
    const g = feature.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) {
        for (const coord of ring) {
          const [lng, lat] = coord;
          minLng = Math.min(minLng, lng);
          minLat = Math.min(minLat, lat);
          maxLng = Math.max(maxLng, lng);
          maxLat = Math.max(maxLat, lat);
        }
      }
    } else if (g.type === 'MultiPolygon') {
      for (const polygon of g.coordinates) {
        for (const ring of polygon) {
          for (const coord of ring) {
            const [lng, lat] = coord;
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
          }
        }
      }
    }
  }

  if (
    minLng === Infinity ||
    maxLng === -Infinity ||
    minLat === Infinity ||
    maxLat === -Infinity
  ) {
    return null;
  }

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
    centerLng: (minLng + maxLng) / 2,
    centerLat: (minLat + maxLat) / 2,
  };
}

/** Mesmo retângulo [west,south,east,north] usado no Mapbox Static bbox-only. */
export type ReportPaddedBoundsWorld = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type LngLatPoint = [number, number];

function clampLat(lat: number): number {
  return Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));
}

function normalizeLngLatPoint(point: unknown): LngLatPoint | null {
  if (!Array.isArray(point) || point.length < 2) {
    return null;
  }
  const lng = Number(point[0]);
  const lat = Number(point[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return [lng, clampLat(lat)];
}

export function extractLngLatPointsFromGeometry(geoJson: GeoJSON | null): LngLatPoint[] {
  if (!geoJson) {
    return [];
  }

  const points: LngLatPoint[] = [];

  const walkGeometry = (geometry: GeoJSON.Geometry | null | undefined): void => {
    if (!geometry) return;

    if (geometry.type === 'Polygon') {
      for (const ring of geometry.coordinates || []) {
        for (const coordinate of ring || []) {
          const normalizedPoint = normalizeLngLatPoint(coordinate);
          if (normalizedPoint) points.push(normalizedPoint);
        }
      }
      return;
    }

    if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates || []) {
        for (const ring of polygon || []) {
          for (const coordinate of ring || []) {
            const normalizedPoint = normalizeLngLatPoint(coordinate);
            if (normalizedPoint) points.push(normalizedPoint);
          }
        }
      }
      return;
    }

    if (geometry.type === 'GeometryCollection') {
      for (const nested of geometry.geometries || []) {
        walkGeometry(nested);
      }
    }
  };

  if (geoJson.type === 'FeatureCollection') {
    for (const feature of geoJson.features || []) {
      walkGeometry(feature.geometry);
    }
    return points;
  }

  if (geoJson.type === 'Feature') {
    walkGeometry(geoJson.geometry);
    return points;
  }

  walkGeometry(geoJson as GeoJSON.Geometry);
  return points;
}

export function calculateGeometryBbox(points: LngLatPoint[]): ReportMapBoundingBox | null {
  if (!points.length) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  if (
    minLng === Infinity ||
    maxLng === -Infinity ||
    minLat === Infinity ||
    maxLat === -Infinity
  ) {
    return null;
  }

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
    centerLng: (minLng + maxLng) / 2,
    centerLat: (minLat + maxLat) / 2,
  };
}

export function expandBboxWithAspectRatio(
  bounds: ReportMapBoundingBox,
  targetAspectRatio: number,
  paddingPercent: number
): ReportPaddedBoundsWorld {
  const centerLng = bounds.centerLng;
  const centerLat = bounds.centerLat;

  let lngSpan = Math.max(bounds.maxLng - bounds.minLng, MIN_SPAN);
  let latSpan = Math.max(bounds.maxLat - bounds.minLat, MIN_SPAN);

  const paddingFactor = 1 + Math.max(0, paddingPercent) * 2;
  lngSpan *= paddingFactor;
  latSpan *= paddingFactor;

  const safeAspectRatio = Number.isFinite(targetAspectRatio) && targetAspectRatio > 0
    ? targetAspectRatio
    : 1;
  const currentAspectRatio = lngSpan / latSpan;

  if (currentAspectRatio > safeAspectRatio) {
    latSpan = lngSpan / safeAspectRatio;
  } else {
    lngSpan = latSpan * safeAspectRatio;
  }

  return {
    west: centerLng - lngSpan / 2,
    south: clampLat(centerLat - latSpan / 2),
    east: centerLng + lngSpan / 2,
    north: clampLat(centerLat + latSpan / 2),
  };
}

/**
 * Bbox com padding (igual a `buildReportMapboxStaticUrl`) para projetar o polígono do talhão sobre a imagem.
 */
export function getReportPaddedBoundsForPlot(
  plot: Plot,
  paddingRatio: number = DEFAULT_PADDING,
  targetAspectRatio?: number
): ReportPaddedBoundsWorld | null {
  const parsedGeoJson = parsePlotGeoJson(plot);
  const points = extractLngLatPointsFromGeometry(parsedGeoJson);
  const bounds = calculateGeometryBbox(points);
  if (!bounds) {
    return null;
  }
  const derivedAspectRatio = targetAspectRatio && targetAspectRatio > 0 ? targetAspectRatio : 1;
  return expandBboxWithAspectRatio(bounds, derivedAspectRatio, paddingRatio);
}

/**
 * Mapbox Static apenas por bbox [west,south,east,north] — sem overlay geojson (evita 404 por URL longa).
 */
function buildBboxOnlyStaticUrl(
  bboxStr: string,
  width: number,
  height: number,
  accessToken: string
): string {
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/[${bboxStr}]/${width}x${height}?access_token=${encodeURIComponent(accessToken)}`;
}

export type BuildReportMapboxStaticUrlParams = {
  plot: Plot;
  mapWidth: number;
  mapHeight: number;
  /** Padding em torno do bbox (0–1), padrão 0.1 como antes. */
  padding?: number;
  accessToken: string | undefined;
};

/** Mensagem curta para placeholder do relatório (diagnóstico temporário). */
export function getReportMapPlaceholderMessage(
  reason: ReportMapUnavailableReason | null
): string {
  switch (reason) {
    case 'token_missing':
      return 'Mapa indisponível: token ausente';
    case 'geojson_missing':
      return 'Mapa indisponível: geoJson ausente';
    case 'bounds_invalid':
      return 'Mapa indisponível: bounds inválido';
    case 'unsupported_geometry':
      return 'Mapa indisponível: geometria não suportada';
    case 'unknown':
    default:
      return 'Mapa indisponível';
  }
}

/**
 * URL Mapbox Static: satélite por bbox apenas (sem geojson() overlay).
 * O geoJson do plot continua a ser usado só para calcular bounds + padding.
 */
export function buildReportMapboxStaticUrl(
  params: BuildReportMapboxStaticUrlParams
): BuildReportMapboxStaticUrlResult {
  const { plot, mapWidth, mapHeight, accessToken } = params;
  const padding = params.padding ?? DEFAULT_PADDING;

  const plotId = plot.id ?? '(sem id)';
  const plotName = plot.name ?? '(sem nome)';
  const rawGeoPresent = plot.geoJson !== undefined && plot.geoJson !== null;
  const parsed = parsePlotGeoJson(plot);
  const geometryTypes = collectGeometryTypes(parsed);

  const token = accessToken?.trim();

  if (!token) {
    console.log(DEBUG_PREFIX, {
      tokenPresent: false,
      plotId,
      plotName,
      geoJsonPresent: rawGeoPresent,
      geometryTypes,
      boundsCalculated: false,
      returnNullReason: 'token_missing',
      usedLongUrlFallback: false,
    });
    return {
      url: null,
      unavailableReason: 'token_missing',
      usedLongUrlFallback: false,
    };
  }

  if (!rawGeoPresent || parsed === null) {
    const reason: ReportMapUnavailableReason = 'geojson_missing';
    console.log(DEBUG_PREFIX, {
      tokenPresent: true,
      plotId,
      plotName,
      geoJsonPresent: rawGeoPresent,
      geometryTypes: [],
      boundsCalculated: false,
      returnNullReason: reason,
      detail: parsed === null && rawGeoPresent ? 'parse_failed_or_invalid' : 'missing',
      usedLongUrlFallback: false,
    });
    return { url: null, unavailableReason: reason, usedLongUrlFallback: false };
  }

  if (parsed.type !== 'FeatureCollection' || !parsed.features?.length) {
    console.log(DEBUG_PREFIX, {
      tokenPresent: true,
      plotId,
      plotName,
      geoJsonPresent: true,
      geometryTypes,
      boundsCalculated: false,
      returnNullReason: 'geojson_missing',
      detail: 'not_feature_collection_or_empty_features',
      usedLongUrlFallback: false,
    });
    return { url: null, unavailableReason: 'geojson_missing', usedLongUrlFallback: false };
  }

  const points = extractLngLatPointsFromGeometry(parsed);
  const bounds = calculateGeometryBbox(points);
  if (!bounds) {
    console.log(DEBUG_PREFIX, {
      tokenPresent: true,
      plotId,
      plotName,
      geoJsonPresent: true,
      geometryTypes,
      boundsCalculated: false,
      returnNullReason: 'unsupported_geometry',
      detail: 'no_polygon_or_multipolygon_coordinates_for_bounds',
      usedLongUrlFallback: false,
    });
    return {
      url: null,
      unavailableReason: 'unsupported_geometry',
      usedLongUrlFallback: false,
    };
  }

  const worldBounds = expandBboxWithAspectRatio(
    bounds,
    mapWidth / mapHeight,
    padding
  );
  const bboxStr = [worldBounds.west, worldBounds.south, worldBounds.east, worldBounds.north].join(',');
  const url = buildBboxOnlyStaticUrl(bboxStr, mapWidth, mapHeight, token);

  logReportMapSuccess({
    plotId,
    plotName,
    bounds,
    geometryTypes,
    finalUrl: url,
    mapMode: 'bbox_only',
  });

  return {
    url,
    unavailableReason: null,
    usedLongUrlFallback: false,
  };
}
