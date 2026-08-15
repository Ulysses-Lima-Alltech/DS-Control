import * as turf from '@turf/turf';

import { Plot } from '@/types/plot.type';
import { Route } from '@/types/route.type';

// Same order of magnitude as ROUTE_CONNECTION_THRESHOLD_METERS in
// bestOperationalRoute.ts - how close a drawn route needs to pass to a
// plot's boundary to be considered "reaches this talhao".
const PLOT_ROUTE_CONNECTION_THRESHOLD_METERS = 40;

export type RouteDistanceMatch = {
  route: Route;
  distanceMeters: number;
};

const toFeatureArray = (geoJson: unknown): GeoJSON.Feature[] => {
  if (!geoJson || typeof geoJson !== 'object') return [];
  const value = geoJson as Record<string, unknown>;

  if (value.type === 'FeatureCollection' && Array.isArray(value.features)) {
    return value.features as GeoJSON.Feature[];
  }
  if (value.type === 'Feature') {
    return [value as unknown as GeoJSON.Feature];
  }
  if (typeof value.type === 'string') {
    return [{ type: 'Feature', properties: {}, geometry: value as unknown as GeoJSON.Geometry }];
  }
  return [];
};

const flattenByType = <T extends GeoJSON.Geometry['type']>(
  geoJson: unknown,
  geometryType: T
): GeoJSON.Feature<Extract<GeoJSON.Geometry, { type: T }>>[] => {
  const results: GeoJSON.Feature<Extract<GeoJSON.Geometry, { type: T }>>[] = [];

  for (const feature of toFeatureArray(geoJson)) {
    if (!feature.geometry) continue;
    try {
      const flattened = turf.flatten(feature);
      flattened.features.forEach((flatFeature) => {
        if (flatFeature.geometry?.type === geometryType) {
          results.push(flatFeature as GeoJSON.Feature<Extract<GeoJSON.Geometry, { type: T }>>);
        }
      });
    } catch {
      // Malformed geometry - skip it rather than fail the whole lookup.
    }
  }

  return results;
};

/**
 * Finds which of a farm's drawn routes pass close enough to a given plot to
 * be considered a way to reach it, sorted by proximity (closest first).
 */
export function findRoutesForPlot(
  plot: Plot,
  routes: Route[],
  thresholdMeters: number = PLOT_ROUTE_CONNECTION_THRESHOLD_METERS
): RouteDistanceMatch[] {
  const plotPolygons = flattenByType(plot.geoJson, 'Polygon');
  if (plotPolygons.length === 0) return [];

  const plotFeatureCollection = turf.featureCollection(plotPolygons);
  const plotCentroid = turf.centroid(plotFeatureCollection);
  const bufferedPlotPolygons = plotPolygons
    .map((polygon) => turf.buffer(polygon, thresholdMeters, { units: 'meters' }))
    .filter((buffered): buffered is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> =>
      Boolean(buffered)
    );
  if (bufferedPlotPolygons.length === 0) return [];

  const matches: RouteDistanceMatch[] = [];

  for (const route of routes) {
    const routeLines = flattenByType(route.geoJson, 'LineString');
    if (routeLines.length === 0) continue;

    let closestDistanceMeters = Infinity;
    let intersects = false;

    for (const line of routeLines) {
      if (
        !intersects &&
        bufferedPlotPolygons.some((buffered) => turf.booleanIntersects(buffered, line))
      ) {
        intersects = true;
      }
      const distance = turf.pointToLineDistance(plotCentroid, line, { units: 'meters' });
      if (distance < closestDistanceMeters) closestDistanceMeters = distance;
    }

    if (intersects) {
      matches.push({ route, distanceMeters: closestDistanceMeters });
    }
  }

  return matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
