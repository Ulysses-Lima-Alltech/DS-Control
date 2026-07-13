import type { GeoJSON } from 'geojson';

import type { Plot } from '@/types/plot.type';
import {
  getReportPaddedBoundsForPlot,
  parsePlotGeoJson,
  type ReportPaddedBoundsWorld,
} from '@/utils/mapboxStaticReportMap';

const DEFAULT_PADDING = 0.1;

type Point = { x: number; y: number };
type ProjectedPolygon = Point[][];

export type PlotPolygonSvgOverlay = {
  paths: string[];
  labelPoint: Point;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lngToNormalizedX(lng: number): number {
  return (lng + 180) / 360;
}

function latToNormalizedY(lat: number): number {
  const sinValue = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sinValue) / (1 - sinValue)) / (4 * Math.PI);
}

function projectLngLatToMapPx(
  lng: number,
  lat: number,
  world: ReportPaddedBoundsWorld,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } {
  const { west, south, east, north } = world;
  const westX = lngToNormalizedX(west);
  const eastX = lngToNormalizedX(east);
  const lngX = lngToNormalizedX(lng);
  const xDenominator = Math.max(Math.abs(eastX - westX), 1e-12);
  const x = ((lngX - westX) / xDenominator) * mapWidth;

  const northY = latToNormalizedY(north);
  const southY = latToNormalizedY(south);
  const latY = latToNormalizedY(lat);
  const yDenominator = Math.max(Math.abs(southY - northY), 1e-12);
  const y = ((latY - northY) / yDenominator) * mapHeight;

  return {
    x: clamp(x, 0, mapWidth),
    y: clamp(y, 0, mapHeight),
  };
}

function polygonArea(ring: Point[]): number {
  let area = 0;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    area += ring[previous].x * ring[index].y - ring[index].x * ring[previous].y;
  }

  return area / 2;
}

function distanceToSegmentSquared(point: Point, start: Point, end: Point): number {
  let x = start.x;
  let y = start.y;
  let dx = end.x - x;
  let dy = end.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = end.x;
      y = end.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point.x - x;
  dy = point.y - y;
  return dx * dx + dy * dy;
}

function signedDistanceToPolygon(point: Point, polygon: ProjectedPolygon): number {
  let inside = false;
  let minimumDistanceSquared = Number.POSITIVE_INFINITY;

  polygon.forEach((ring) => {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const currentPoint = ring[index];
      const previousPoint = ring[previous];

      if (
        currentPoint.y > point.y !== previousPoint.y > point.y &&
        point.x <
          ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
            (previousPoint.y - currentPoint.y) +
            currentPoint.x
      ) {
        inside = !inside;
      }

      minimumDistanceSquared = Math.min(
        minimumDistanceSquared,
        distanceToSegmentSquared(point, currentPoint, previousPoint)
      );
    }
  });

  const distance = Math.sqrt(minimumDistanceSquared);
  return inside ? distance : -distance;
}

function polygonCentroid(polygon: ProjectedPolygon): Point | null {
  const ring = polygon[0];
  let areaAccumulator = 0;
  let xAccumulator = 0;
  let yAccumulator = 0;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start = ring[previous];
    const end = ring[index];
    const cross = start.x * end.y - end.x * start.y;
    areaAccumulator += cross;
    xAccumulator += (start.x + end.x) * cross;
    yAccumulator += (start.y + end.y) * cross;
  }

  if (Math.abs(areaAccumulator) < 1e-12) {
    return null;
  }

  return {
    x: xAccumulator / (3 * areaAccumulator),
    y: yAccumulator / (3 * areaAccumulator),
  };
}

type SurfaceCell = Point & {
  halfSize: number;
  distance: number;
  maximumDistance: number;
};

function createSurfaceCell(
  x: number,
  y: number,
  halfSize: number,
  polygon: ProjectedPolygon
): SurfaceCell {
  const distance = signedDistanceToPolygon({ x, y }, polygon);

  return {
    x,
    y,
    halfSize,
    distance,
    maximumDistance: distance + halfSize * Math.SQRT2,
  };
}

/**
 * Calcula o polo de inacessibilidade do polígono projetado. O resultado é um
 * point-on-surface, sempre interno e visualmente central, inclusive em formas côncavas.
 */
function pointOnPolygonSurface(polygon: ProjectedPolygon, precision = 1): Point | null {
  const exteriorRing = polygon[0];
  if (!exteriorRing || exteriorRing.length < 3) {
    return null;
  }

  const xs = exteriorRing.map((point) => point.x);
  const ys = exteriorRing.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);

  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    return polygonCentroid(polygon);
  }

  const halfSize = cellSize / 2;
  const queue: SurfaceCell[] = [];

  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      queue.push(createSurfaceCell(x + halfSize, y + halfSize, halfSize, polygon));
    }
  }

  const centroid = polygonCentroid(polygon);
  let bestCell = centroid
    ? createSurfaceCell(centroid.x, centroid.y, 0, polygon)
    : createSurfaceCell(minX + width / 2, minY + height / 2, 0, polygon);
  const boundingBoxCell = createSurfaceCell(minX + width / 2, minY + height / 2, 0, polygon);

  if (boundingBoxCell.distance > bestCell.distance) {
    bestCell = boundingBoxCell;
  }

  while (queue.length > 0) {
    queue.sort((left, right) => left.maximumDistance - right.maximumDistance);
    const cell = queue.pop()!;

    if (cell.distance > bestCell.distance) {
      bestCell = cell;
    }

    if (cell.maximumDistance - bestCell.distance <= precision) {
      continue;
    }

    const childHalfSize = cell.halfSize / 2;
    queue.push(
      createSurfaceCell(cell.x - childHalfSize, cell.y - childHalfSize, childHalfSize, polygon),
      createSurfaceCell(cell.x + childHalfSize, cell.y - childHalfSize, childHalfSize, polygon),
      createSurfaceCell(cell.x - childHalfSize, cell.y + childHalfSize, childHalfSize, polygon),
      createSurfaceCell(cell.x + childHalfSize, cell.y + childHalfSize, childHalfSize, polygon)
    );
  }

  return bestCell.distance >= 0 ? { x: bestCell.x, y: bestCell.y } : centroid;
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
  const coords =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
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

function polygonsFromGeoJson(geoJson: GeoJSON): number[][][][] {
  const polygons: number[][][][] = [];

  if (geoJson.type === 'FeatureCollection' && geoJson.features?.length) {
    for (const f of geoJson.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'Polygon' && g.coordinates?.length) {
        polygons.push(g.coordinates as number[][][]);
      } else if (g.type === 'MultiPolygon' && g.coordinates?.length) {
        polygons.push(...(g.coordinates as number[][][][]));
      }
    }
    return polygons;
  }

  if (geoJson.type === 'Polygon' && geoJson.coordinates?.length) {
    return [geoJson.coordinates as number[][][]];
  }

  if (geoJson.type === 'MultiPolygon' && geoJson.coordinates?.length) {
    return geoJson.coordinates as number[][][][];
  }

  return polygons;
}

function projectPolygon(
  polygon: number[][][],
  world: ReportPaddedBoundsWorld,
  mapWidth: number,
  mapHeight: number
): ProjectedPolygon {
  return polygon.map((ring) =>
    ring.map(([lng, lat]) => projectLngLatToMapPx(lng, lat, world, mapWidth, mapHeight))
  );
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
  return buildPlotPolygonSvgOverlay(plot, mapWidth, mapHeight, paddingRatio)?.paths ?? null;
}

export function buildPlotPolygonSvgOverlay(
  plot: Plot,
  mapWidth: number,
  mapHeight: number,
  paddingRatio: number = DEFAULT_PADDING
): PlotPolygonSvgOverlay | null {
  const world = getReportPaddedBoundsForPlot(plot, paddingRatio, mapWidth / mapHeight);
  if (!world) {
    return null;
  }

  const geoJson = parsePlotGeoJson(plot);
  if (!geoJson) {
    return null;
  }

  const polygons = polygonsFromGeoJson(geoJson);
  const projectedPolygons = polygons
    .map((polygon) => projectPolygon(polygon, world, mapWidth, mapHeight))
    .filter((polygon) => polygon[0]?.length >= 3);
  const paths = polygons
    .map((polygon) => polygonRingsToPathD(polygon, world, mapWidth, mapHeight))
    .filter(Boolean);

  if (paths.length === 0 || projectedPolygons.length === 0) {
    return null;
  }

  const labelPolygon = projectedPolygons.reduce((largest, polygon) =>
    Math.abs(polygonArea(polygon[0])) > Math.abs(polygonArea(largest[0])) ? polygon : largest
  );
  const labelPoint = pointOnPolygonSurface(labelPolygon) ?? polygonCentroid(labelPolygon);

  return labelPoint ? { paths, labelPoint } : null;
}

export function buildPlotReportLabel(plot: Plot): { title: string; area: string } {
  const normalizedName = plot.name.trim();
  const title = /^talh[aã]o\b/i.test(normalizedName) ? normalizedName : `Talhão ${normalizedName}`;
  const hectares = Number.parseFloat(plot.hectare || '0');
  const area = `${(Number.isFinite(hectares) ? hectares : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;

  return { title, area };
}
