import type * as GeoJSON from 'geojson';

import type { Plot } from '@/types/plot.type';

type LngLat = [number, number];
type PolygonRings = LngLat[][];
type PlotPolygons = PolygonRings[];
type XYPoint = { x: number; y: number };

const EPSILON = 1e-12;

export type StrategicMapShapeInput = {
  id: string;
  label: string;
  farmKey: string;
  polygons: PlotPolygons;
};

export type StrategicMapShapeProjected = {
  id: string;
  label: string;
  farmKey: string;
  pathD: string;
  labelX: number;
  labelY: number;
  areaPx: number;
  bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
};

export type StrategicMapProjection = {
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  extentKm: {
    widthKm: number;
    heightKm: number;
    diagonalKm: number;
  };
  shapes: StrategicMapShapeProjected[];
};

function isSamePoint(a: LngLat, b: LngLat): boolean {
  return Math.abs(a[0] - b[0]) < EPSILON && Math.abs(a[1] - b[1]) < EPSILON;
}

function normalizeRing(rawRing: GeoJSON.Position[]): LngLat[] | null {
  const points: LngLat[] = [];

  for (const coord of rawRing) {
    if (!Array.isArray(coord) || coord.length < 2) {
      continue;
    }

    const lng = Number(coord[0]);
    const lat = Number(coord[1]);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue;
    }

    points.push([lng, lat]);
  }

  if (points.length < 3) {
    return null;
  }

  if (isSamePoint(points[0], points[points.length - 1])) {
    points.pop();
  }

  if (points.length < 3) {
    return null;
  }

  return points;
}

function normalizePolygon(rawPolygon: GeoJSON.Position[][]): PolygonRings | null {
  const rings = rawPolygon
    .map((ring) => normalizeRing(ring))
    .filter((ring): ring is LngLat[] => ring !== null);

  if (rings.length === 0) {
    return null;
  }

  return rings;
}

function collectPolygonsFromGeometry(
  geometry: GeoJSON.Geometry | null | undefined,
  polygons: PlotPolygons
): void {
  if (!geometry) {
    return;
  }

  if (geometry.type === 'Polygon') {
    const normalized = normalizePolygon(geometry.coordinates);
    if (normalized) {
      polygons.push(normalized);
    }
    return;
  }

  if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => {
      const normalized = normalizePolygon(polygon);
      if (normalized) {
        polygons.push(normalized);
      }
    });
    return;
  }

  if (geometry.type === 'GeometryCollection') {
    geometry.geometries.forEach((nested) => collectPolygonsFromGeometry(nested, polygons));
  }
}

function parseGeoJson(rawGeoJson: unknown): GeoJSON.GeoJSON | null {
  if (!rawGeoJson) {
    return null;
  }

  if (typeof rawGeoJson === 'string') {
    try {
      const parsed = JSON.parse(rawGeoJson) as GeoJSON.GeoJSON;
      return parsed;
    } catch {
      return null;
    }
  }

  return rawGeoJson as GeoJSON.GeoJSON;
}

export function extractPlotPolygons(plot: Plot): PlotPolygons {
  const geoJson = parseGeoJson(plot.geoJson);
  if (!geoJson) {
    return [];
  }

  const polygons: PlotPolygons = [];

  if (geoJson.type === 'FeatureCollection') {
    geoJson.features.forEach((feature) => {
      collectPolygonsFromGeometry(feature.geometry, polygons);
    });
    return polygons;
  }

  if (geoJson.type === 'Feature') {
    collectPolygonsFromGeometry(geoJson.geometry, polygons);
    return polygons;
  }

  collectPolygonsFromGeometry(geoJson as GeoJSON.Geometry, polygons);
  return polygons;
}

function ringArea(ring: LngLat[]): number {
  if (ring.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function ringCentroid(ring: LngLat[]): LngLat {
  const area = ringArea(ring);

  if (Math.abs(area) < EPSILON) {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    ring.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });

    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  }

  let centroidLng = 0;
  let centroidLat = 0;

  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const factor = x1 * y2 - x2 * y1;
    centroidLng += (x1 + x2) * factor;
    centroidLat += (y1 + y2) * factor;
  }

  const divisor = 6 * area;
  return [centroidLng / divisor, centroidLat / divisor];
}

function getLargestPolygon(polygons: PlotPolygons): PolygonRings | null {
  if (polygons.length === 0) {
    return null;
  }

  let largest: PolygonRings | null = null;
  let largestArea = -Infinity;

  polygons.forEach((polygon) => {
    const outerRing = polygon[0];
    if (!outerRing || outerRing.length < 3) {
      return;
    }

    const area = Math.abs(ringArea(outerRing));
    if (area > largestArea) {
      largestArea = area;
      largest = polygon;
    }
  });

  return largest;
}

function defaultShapeLabelPoint(shape: StrategicMapShapeInput): LngLat | null {
  const largestPolygon = getLargestPolygon(shape.polygons);
  if (!largestPolygon) {
    return null;
  }

  const outerRing = largestPolygon[0];
  if (!outerRing) {
    return null;
  }

  return ringCentroid(outerRing);
}

function buildPathFromRing(
  ring: XYPoint[]
): string {
  if (ring.length < 2) {
    return '';
  }

  const first = ring[0];
  let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;

  for (let i = 1; i < ring.length; i++) {
    const point = ring[i];
    d += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  d += ' Z';
  return d;
}

function buildPathFromPolygon(
  polygon: XYPoint[][]
): string {
  return polygon
    .map((ring) => buildPathFromRing(ring))
    .filter(Boolean)
    .join(' ');
}

function projectRing(
  ring: LngLat[],
  project: (point: LngLat) => { x: number; y: number }
): XYPoint[] {
  return ring.map((point) => project(point));
}

function projectedRingArea(ring: XYPoint[]): number {
  if (ring.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    sum += current.x * next.y - next.x * current.y;
  }

  return sum / 2;
}

function projectedPolygonArea(polygon: XYPoint[][]): number {
  if (polygon.length === 0) {
    return 0;
  }

  const outerArea = Math.abs(projectedRingArea(polygon[0]));
  const holesArea = polygon
    .slice(1)
    .reduce((sum, hole) => sum + Math.abs(projectedRingArea(hole)), 0);

  return Math.max(0, outerArea - holesArea);
}

function computeAdaptivePadding(basePadding: number, width: number, height: number): number {
  const fallback = Math.max(8, Math.min(16, Math.min(width, height) * 0.035));
  if (!Number.isFinite(basePadding) || basePadding < 0) {
    return fallback;
  }

  const maxAllowed = Math.max(8, Math.min(width, height) * 0.08);
  return Math.max(6, Math.min(basePadding, maxAllowed));
}

export function buildStrategicMapProjection(
  shapes: StrategicMapShapeInput[],
  width: number,
  height: number,
  padding: number = 20
): StrategicMapProjection | null {
  const allPoints: LngLat[] = [];

  shapes.forEach((shape) => {
    shape.polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((point) => {
          allPoints.push(point);
        });
      });
    });
  });

  if (allPoints.length === 0) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  allPoints.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  if (lngSpan < EPSILON || latSpan < EPSILON) {
    return null;
  }

  const adaptivePadding = computeAdaptivePadding(padding, width, height);
  const usableWidth = Math.max(1, width - adaptivePadding * 2);
  const usableHeight = Math.max(1, height - adaptivePadding * 2);
  const scale = Math.min(usableWidth / lngSpan, usableHeight / latSpan);

  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }

  const drawingWidth = lngSpan * scale;
  const drawingHeight = latSpan * scale;
  const offsetX = adaptivePadding + (usableWidth - drawingWidth) / 2;
  const offsetY = adaptivePadding + (usableHeight - drawingHeight) / 2;

  const project = ([lng, lat]: LngLat) => ({
    x: offsetX + (lng - minLng) * scale,
    y: offsetY + (maxLat - lat) * scale,
  });

  const projectedShapes: StrategicMapShapeProjected[] = shapes
    .map((shape) => {
      const projectedPolygons = shape.polygons.map((polygon) =>
        polygon.map((ring) => projectRing(ring, project))
      );

      const pathD = projectedPolygons
        .map((polygon) => buildPathFromPolygon(polygon))
        .filter(Boolean)
        .join(' ');

      if (!pathD) {
        return null;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let areaPx = 0;

      projectedPolygons.forEach((polygon) => {
        areaPx += projectedPolygonArea(polygon);
        polygon.forEach((ring) => {
          ring.forEach((point) => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
          });
        });
      });

      if (
        !Number.isFinite(minX) ||
        !Number.isFinite(minY) ||
        !Number.isFinite(maxX) ||
        !Number.isFinite(maxY)
      ) {
        return null;
      }

      const labelPointLngLat =
        defaultShapeLabelPoint(shape) ?? ([(minLng + maxLng) / 2, (minLat + maxLat) / 2] as LngLat);
      const labelPoint = project(labelPointLngLat);

      return {
        id: shape.id,
        label: shape.label,
        farmKey: shape.farmKey,
        pathD,
        labelX: labelPoint.x,
        labelY: labelPoint.y,
        areaPx,
        bbox: {
          minX,
          minY,
          maxX,
          maxY,
          width: Math.max(0, maxX - minX),
          height: Math.max(0, maxY - minY),
        },
      };
    })
    .filter((shape): shape is StrategicMapShapeProjected => shape !== null);

  if (projectedShapes.length === 0) {
    return null;
  }

  const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const widthKm = Math.abs(lngSpan * 111.32 * Math.cos(midLatRad));
  const heightKm = Math.abs(latSpan * 110.574);

  return {
    bounds: {
      minLng,
      minLat,
      maxLng,
      maxLat,
    },
    extentKm: {
      widthKm,
      heightKm,
      diagonalKm: Math.sqrt(widthKm ** 2 + heightKm ** 2),
    },
    shapes: projectedShapes,
  };
}
