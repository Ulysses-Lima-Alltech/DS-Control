import type { FeatureCollection, GeoJSON } from 'geojson';

import type { Plot } from '@/types/plot.type';

/** Limite da API Mapbox Static (8192); margem para query string. */
const MAPBOX_STATIC_URL_SAFE_MAX = 7900;

const DEFAULT_FILL = '#3388ff';
const DEFAULT_STROKE = '#3388ff';
const FILL_OPACITY = 0.3;
const STROKE_WIDTH = 3;
const DEFAULT_PADDING = 0.1;

export type ReportMapBoundingBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  centerLng: number;
  centerLat: number;
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

/**
 * URL única Mapbox Static: satélite + polígono embutido via overlay geojson().
 * Sem overlay se não houver geometria válida ou token; fallback satélite-only se URL exceder limite.
 */
export function buildReportMapboxStaticUrl(params: BuildReportMapboxStaticUrlParams): string | null {
  const { plot, mapWidth, mapHeight, accessToken } = params;
  const padding = params.padding ?? DEFAULT_PADDING;

  const token = accessToken?.trim();
  if (!token) {
    return null;
  }

  const bounds = calculatePlotBounds(plot);
  if (!bounds) {
    return null;
  }

  const bboxStr = paddedBboxString(bounds, padding);
  const overlayFc = buildPlotOverlayFeatureCollection(plot);

  if (!overlayFc) {
    return buildBboxOnlyStaticUrl(bboxStr, mapWidth, mapHeight, token);
  }

  let url = buildOverlayStaticUrl(bboxStr, mapWidth, mapHeight, token, overlayFc);
  if (url.length <= MAPBOX_STATIC_URL_SAFE_MAX) {
    return url;
  }

  return buildBboxOnlyStaticUrl(bboxStr, mapWidth, mapHeight, token);
}
