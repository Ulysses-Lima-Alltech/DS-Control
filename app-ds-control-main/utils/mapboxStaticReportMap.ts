import type { FeatureCollection, GeoJSON } from 'geojson';

import type { Plot } from '@/types/plot.type';

/** Limite da API Mapbox Static (8192); margem para query string. */
const MAPBOX_STATIC_URL_SAFE_MAX = 7900;

const DEFAULT_FILL = '#3388ff';
const DEFAULT_STROKE = '#3388ff';
const FILL_OPACITY = 0.3;
const STROKE_WIDTH = 3;
const DEFAULT_PADDING = 0.1;

const DEBUG_PREFIX = '[REPORT_MAP_DEBUG]';

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
  /** true se a URL com overlay excedeu o limite e foi usado satélite sem polígono embutido. */
  usedLongUrlFallback: boolean;
};

function parsePlotGeoJson(plot: Plot): GeoJSON | null {
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

function getDefaultFillFromPlot(plot: Plot): string {
  const geoJson = parsePlotGeoJson(plot);
  if (geoJson?.type === 'FeatureCollection' && geoJson.features?.[0]?.properties) {
    const fill = (geoJson.features[0].properties as Record<string, unknown>).fill;
    if (typeof fill === 'string' && fill.length > 0) return fill;
  }
  return DEFAULT_FILL;
}

function getDefaultStrokeFromPlot(plot: Plot): string {
  const geoJson = parsePlotGeoJson(plot);
  if (geoJson?.type === 'FeatureCollection' && geoJson.features?.[0]?.properties) {
    const stroke = (geoJson.features[0].properties as Record<string, unknown>).stroke;
    if (typeof stroke === 'string' && stroke.length > 0) return stroke;
  }
  return DEFAULT_STROKE;
}

/**
 * GeoJSON para overlay Mapbox Static (simplestyle-spec: fill, fill-opacity, stroke, stroke-width).
 */
export function buildPlotOverlayFeatureCollection(plot: Plot): FeatureCollection | null {
  const geoJson = parsePlotGeoJson(plot);
  if (!geoJson || geoJson.type !== 'FeatureCollection' || !geoJson.features?.length) {
    return null;
  }

  const fillDefault = getDefaultFillFromPlot(plot);
  const strokeDefault = getDefaultStrokeFromPlot(plot);

  const features = geoJson.features
    .filter((f) => {
      const t = f.geometry?.type;
      return t === 'Polygon' || t === 'MultiPolygon';
    })
    .map((f) => {
      const props = { ...(f.properties as Record<string, unknown> | null | undefined) };
      const fill = typeof props.fill === 'string' && props.fill.length > 0 ? props.fill : fillDefault;
      const stroke =
        typeof props.stroke === 'string' && props.stroke.length > 0 ? props.stroke : strokeDefault;

      return {
        type: 'Feature' as const,
        geometry: f.geometry!,
        properties: {
          ...props,
          fill,
          'fill-opacity': FILL_OPACITY,
          stroke,
          'stroke-width': STROKE_WIDTH,
          'stroke-opacity': 1,
        },
      };
    });

  if (features.length === 0) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function paddedBboxString(bounds: ReportMapBoundingBox, paddingRatio: number): string {
  const lngPadding = (bounds.maxLng - bounds.minLng) * paddingRatio;
  const latPadding = (bounds.maxLat - bounds.minLat) * paddingRatio;
  return [
    bounds.minLng - lngPadding,
    bounds.minLat - latPadding,
    bounds.maxLng + lngPadding,
    bounds.maxLat + latPadding,
  ].join(',');
}

function buildBboxOnlyStaticUrl(
  bboxStr: string,
  width: number,
  height: number,
  accessToken: string
): string {
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/[${bboxStr}]/${width}x${height}?access_token=${encodeURIComponent(accessToken)}`;
}

function buildOverlayStaticUrl(
  bboxStr: string,
  width: number,
  height: number,
  accessToken: string,
  overlayFeatureCollection: FeatureCollection
): string {
  const json = JSON.stringify(overlayFeatureCollection);
  const encoded = encodeURIComponent(json);
  const overlaySegment = `geojson(${encoded})`;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlaySegment}[${bboxStr}]/${width}x${height}?access_token=${encodeURIComponent(accessToken)}`;
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
 * URL única Mapbox Static: satélite + polígono embutido via overlay geojson().
 * Sem overlay se não houver geometria válida ou token; fallback satélite-only se URL exceder limite.
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
  const tokenPresent = Boolean(token);

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

  const bounds = calculatePlotBounds(plot);
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

  const lngSpan = bounds.maxLng - bounds.minLng;
  const latSpan = bounds.maxLat - bounds.minLat;
  if (lngSpan < 1e-12 || latSpan < 1e-12) {
    console.log(DEBUG_PREFIX, {
      tokenPresent: true,
      plotId,
      plotName,
      geoJsonPresent: true,
      geometryTypes,
      boundsCalculated: true,
      bounds,
      returnNullReason: 'bounds_invalid',
      detail: 'degenerate_extent',
      usedLongUrlFallback: false,
    });
    return { url: null, unavailableReason: 'bounds_invalid', usedLongUrlFallback: false };
  }

  const bboxStr = paddedBboxString(bounds, padding);
  const overlayFc = buildPlotOverlayFeatureCollection(plot);

  if (!overlayFc) {
    const url = buildBboxOnlyStaticUrl(bboxStr, mapWidth, mapHeight, token);
    console.log(DEBUG_PREFIX, {
      tokenPresent: true,
      plotId,
      plotName,
      geoJsonPresent: true,
      geometryTypes,
      boundsCalculated: true,
      bounds,
      returnNullReason: null,
      overlaySkipped: true,
      detail: 'no_polygon_features_for_overlay_using_satellite_only',
      usedLongUrlFallback: false,
    });
    return { url, unavailableReason: null, usedLongUrlFallback: false };
  }

  const urlWithOverlay = buildOverlayStaticUrl(
    bboxStr,
    mapWidth,
    mapHeight,
    token,
    overlayFc
  );
  const overlayUrlLength = urlWithOverlay.length;

  if (overlayUrlLength <= MAPBOX_STATIC_URL_SAFE_MAX) {
    console.log(DEBUG_PREFIX, {
      tokenPresent: true,
      plotId,
      plotName,
      geoJsonPresent: true,
      geometryTypes,
      boundsCalculated: true,
      bounds,
      returnNullReason: null,
      overlayUrlLength,
      usedLongUrlFallback: false,
    });
    return {
      url: urlWithOverlay,
      unavailableReason: null,
      usedLongUrlFallback: false,
    };
  }

  const fallbackUrl = buildBboxOnlyStaticUrl(bboxStr, mapWidth, mapHeight, token);
  console.log(DEBUG_PREFIX, {
    tokenPresent: true,
    plotId,
    plotName,
    geoJsonPresent: true,
    geometryTypes,
    boundsCalculated: true,
    bounds,
    returnNullReason: null,
    overlayUrlLength,
    usedLongUrlFallback: true,
    detail: 'url_exceeds_safe_max_using_satellite_only_fallback',
    safeMax: MAPBOX_STATIC_URL_SAFE_MAX,
  });
  return {
    url: fallbackUrl,
    unavailableReason: null,
    usedLongUrlFallback: true,
  };
}
