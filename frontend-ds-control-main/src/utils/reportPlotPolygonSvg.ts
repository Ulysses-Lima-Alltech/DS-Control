import type { GeoJSON } from 'geojson';

import type { Plot } from '@/types/plot.type';

import {
  getReportPaddedBoundsForPlot,
  parsePlotGeoJson,
  type ReportPaddedBoundsWorld,
} from '@/utils/mapboxStaticReportMap';

const DEFAULT_PADDING = 0.1;

function projectLngLatToMapPx(
  lng: number,
  lat: number,
  world: ReportPaddedBoundsWorld,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } {
  const { west, south, east, north } = world;
  const x = ((lng - west) / (east - west)) * mapWidth;
  const y = ((north - lat) / (north - south)) * mapHeight;
  return {
    x: Math.max(0, Math.min(mapWidth, x)),
    y: Math.max(0, Math.min(mapHeight, y)),
  };
}

function ringToPathD(
  ring: number[][],
  world: ReportPaddedBoundsWorld,
  mapWidth: number,
  mapHeight: number
): string {
  if (!ring?.length) {
    return '';
  }
  const coords = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  if (coords.length < 2) {
    return '';
  }
  const pts = coords.map(([lng, lat]) =>
    projectLngLatToMapPx(lng, lat, world, mapWidth, mapHeight)
  );
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

/**
 * Um path SVG por polígono (exterior + furos num único `d`, fill-rule evenodd).
 */
function polygonRingsToPathD(
  rings: number[][][],
  world: ReportPaddedBoundsWorld,
  mapWidth: number,
  mapHeight: number
): string {
  const parts = rings.map((ring) => ringToPathD(ring, world, mapWidth, mapHeight)).filter(Boolean);
  return parts.join(' ');
}

function pathsFromGeoJson(
  geoJson: GeoJSON,
  world: ReportPaddedBoundsWorld,
  mapWidth: number,
  mapHeight: number
): string[] {
  const out: string[] = [];

  if (geoJson.type === 'FeatureCollection' && geoJson.features?.length) {
    for (const f of geoJson.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'Polygon' && g.coordinates?.length) {
        const d = polygonRingsToPathD(g.coordinates as number[][][], world, mapWidth, mapHeight);
        if (d) out.push(d);
      } else if (g.type === 'MultiPolygon' && g.coordinates?.length) {
        for (const poly of g.coordinates as number[][][][]) {
          const d = polygonRingsToPathD(poly as number[][][], world, mapWidth, mapHeight);
          if (d) out.push(d);
        }
      }
    }
    return out;
  }

  if (geoJson.type === 'Polygon' && geoJson.coordinates?.length) {
    const d = polygonRingsToPathD(geoJson.coordinates as number[][][], world, mapWidth, mapHeight);
    if (d) out.push(d);
    return out;
  }

  if (geoJson.type === 'MultiPolygon' && geoJson.coordinates?.length) {
    for (const poly of geoJson.coordinates as number[][][][]) {
      const d = polygonRingsToPathD(poly as number[][][], world, mapWidth, mapHeight);
      if (d) out.push(d);
    }
  }

  return out;
}

/**
 * Paths SVG (`d`) do contorno do talhão no mesmo sistema da imagem Mapbox bbox-only (mapWidth x mapHeight).
 */
export function buildPlotPolygonSvgPathDs(
  plot: Plot,
  mapWidth: number,
  mapHeight: number,
  paddingRatio: number = DEFAULT_PADDING
): string[] | null {
  const world = getReportPaddedBoundsForPlot(plot, paddingRatio);
  if (!world) {
    return null;
  }

  const geoJson = parsePlotGeoJson(plot);
  if (!geoJson) {
    return null;
  }

  const paths = pathsFromGeoJson(geoJson, world, mapWidth, mapHeight);
  return paths.length ? paths : null;
}
