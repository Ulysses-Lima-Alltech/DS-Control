import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { Route } from '@/types/route.type';
import { deriveFarmStrokeColor, resolveFarmMapColor } from '@/utils/farm-map-color';

export function convertDatabasePlotsToMapViewerPlotsFeatureCollection(
  geoData: Plot[],
  farms: Farm[] = []
): GeoJSON.FeatureCollection {
  const formattedPlots: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  const safePlots = Array.isArray(geoData) ? geoData : [];
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));

  safePlots.forEach((plot) => {
    const plotGeoJson = plot?.geoJson as any;
    if (!plotGeoJson || typeof plotGeoJson !== 'object') return;

    const plotId = String(plot?.id ?? '');
    const plotName = plot?.name ?? 'Talhao sem nome';
    const plotHectare = Number.isFinite(Number(plot?.hectare)) ? Number(plot.hectare) : 0;
    const farm = plot.farmId ? farmById.get(plot.farmId) : undefined;
    const fill = resolveFarmMapColor(farm ?? { id: plot.farmId || 'farm-unknown' });
    const stroke = deriveFarmStrokeColor(fill);

    if (plotGeoJson.type === 'FeatureCollection' && Array.isArray(plotGeoJson.features)) {
      const featuresWithPlotId = plotGeoJson.features
        .filter((feature: any) => feature?.geometry)
        .map((feature: any) => ({
          ...feature,
          properties: {
            ...(feature?.properties ?? {}),
            imported_fill: feature?.properties?.fill,
            imported_stroke: feature?.properties?.stroke,
            fill,
            stroke,
            plot_id: plotId,
            plot_name: plotName,
            hectare: plotHectare,
          },
        }));
      formattedPlots.features.push(...featuresWithPlotId);
      return;
    }

    if (plotGeoJson.type === 'Feature' && plotGeoJson.geometry) {
      formattedPlots.features.push({
        ...plotGeoJson,
        properties: {
          ...(plotGeoJson?.properties ?? {}),
          imported_fill: plotGeoJson?.properties?.fill,
          imported_stroke: plotGeoJson?.properties?.stroke,
          fill,
          stroke,
          plot_id: plotId,
          plot_name: plotName,
          hectare: plotHectare,
        },
      });
      return;
    }

    if (plotGeoJson.type && plotGeoJson.coordinates) {
      formattedPlots.features.push({
        type: 'Feature',
        geometry: plotGeoJson,
        properties: {
          fill,
          stroke,
          plot_id: plotId,
          plot_name: plotName,
          hectare: plotHectare,
        },
      });
    }
  });

  return formattedPlots;
}

export function convertDatabaseRoutesToMapViewerRoutesFeatureCollection(
  routes: Route[]
): GeoJSON.FeatureCollection | null {
  if (!routes || routes.length === 0) return null;

  const formattedRoutes: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  routes.forEach((route) => {
    if (!route.geoJson) return;

    const routeGeoJson = route.geoJson as any;

    // Check if the geoJson is a Feature
    if (routeGeoJson.type === 'Feature') {
      formattedRoutes.features.push({
        ...routeGeoJson,
        properties: {
          ...routeGeoJson.properties,
          route_id: route.id,
          route_name: route.name,
        },
      });
    }
    // Check if the geoJson is a FeatureCollection
    else if (routeGeoJson.type === 'FeatureCollection' && routeGeoJson.features) {
      const featuresWithRouteId = routeGeoJson.features.map((feature: any) => ({
        ...feature,
        properties: {
          ...feature.properties,
          route_id: route.id,
          route_name: route.name,
        },
      }));
      formattedRoutes.features.push(...featuresWithRouteId);
    }
    // If it's a geometry object directly, wrap it in a Feature
    else if (routeGeoJson.type && routeGeoJson.coordinates) {
      formattedRoutes.features.push({
        type: 'Feature',
        properties: {
          route_id: route.id,
          route_name: route.name,
        },
        geometry: routeGeoJson,
      });
    }
  });

  return formattedRoutes.features.length > 0 ? formattedRoutes : null;
}

function getLastCoordinateFromGeometry(geometry: any): [number, number] | null {
  if (!geometry || !geometry.type) return null;

  switch (geometry.type) {
    case 'Point': {
      const coordinate = geometry.coordinates;
      return Array.isArray(coordinate) && coordinate.length >= 2
        ? [coordinate[0], coordinate[1]]
        : null;
    }
    case 'LineString': {
      const coordinates = geometry.coordinates;
      const last =
        Array.isArray(coordinates) && coordinates.length > 0
          ? coordinates[coordinates.length - 1]
          : null;
      return Array.isArray(last) && last.length >= 2 ? [last[0], last[1]] : null;
    }
    case 'MultiLineString': {
      const lines = geometry.coordinates;
      const lastLine = Array.isArray(lines) && lines.length > 0 ? lines[lines.length - 1] : null;
      const last =
        Array.isArray(lastLine) && lastLine.length > 0 ? lastLine[lastLine.length - 1] : null;
      return Array.isArray(last) && last.length >= 2 ? [last[0], last[1]] : null;
    }
    case 'Polygon': {
      const rings = geometry.coordinates;
      const lastRing = Array.isArray(rings) && rings.length > 0 ? rings[rings.length - 1] : null;
      const last =
        Array.isArray(lastRing) && lastRing.length > 0 ? lastRing[lastRing.length - 1] : null;
      return Array.isArray(last) && last.length >= 2 ? [last[0], last[1]] : null;
    }
    case 'MultiPolygon': {
      const polygons = geometry.coordinates;
      const lastPolygon =
        Array.isArray(polygons) && polygons.length > 0 ? polygons[polygons.length - 1] : null;
      const lastRing =
        Array.isArray(lastPolygon) && lastPolygon.length > 0
          ? lastPolygon[lastPolygon.length - 1]
          : null;
      const last =
        Array.isArray(lastRing) && lastRing.length > 0 ? lastRing[lastRing.length - 1] : null;
      return Array.isArray(last) && last.length >= 2 ? [last[0], last[1]] : null;
    }
    case 'GeometryCollection': {
      const geometries = geometry.geometries;
      if (!Array.isArray(geometries) || geometries.length === 0) return null;
      for (let i = geometries.length - 1; i >= 0; i -= 1) {
        const coordinate = getLastCoordinateFromGeometry(geometries[i]);
        if (coordinate) return coordinate;
      }
      return null;
    }
    default:
      return null;
  }
}

function getRouteEndpointCoordinate(routeGeoJson: any): [number, number] | null {
  if (!routeGeoJson) return null;

  if (routeGeoJson.type === 'Feature' && routeGeoJson.geometry) {
    return getLastCoordinateFromGeometry(routeGeoJson.geometry);
  }

  if (routeGeoJson.type === 'FeatureCollection' && Array.isArray(routeGeoJson.features)) {
    for (let i = routeGeoJson.features.length - 1; i >= 0; i -= 1) {
      const feature = routeGeoJson.features[i];
      const coordinate = feature?.geometry ? getLastCoordinateFromGeometry(feature.geometry) : null;
      if (coordinate) return coordinate;
    }
    return null;
  }

  if (routeGeoJson.type && routeGeoJson.coordinates) {
    return getLastCoordinateFromGeometry(routeGeoJson);
  }

  return null;
}

export function buildRouteEndpointMarkersGeoJson(
  routes: Route[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  (routes || []).forEach((route) => {
    if (!route?.geoJson) return;

    const endpoint = getRouteEndpointCoordinate(route.geoJson as any);
    if (!endpoint) return;

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: endpoint,
      },
      properties: {
        route_id: route.id,
        label: route.name || 'Rota',
      },
    });
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function calculateGeoJSONCenter(geoData: GeoJSON.FeatureCollection): {
  latitude: number;
  longitude: number;
} {
  if (!geoData || !geoData.features || geoData.features.length === 0) {
    return { latitude: -47.47279534812462, longitude: -5.507436510864934 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  geoData.features.forEach((feature) => {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const coordinates = feature.geometry.coordinates;

      if (feature.geometry.type === 'Polygon') {
        (coordinates as GeoJSON.Position[][]).forEach((ring) => {
          ring.forEach((coord) => {
            const [lng, lat] = coord;
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
          });
        });
      } else if (feature.geometry.type === 'MultiPolygon') {
        (coordinates as GeoJSON.Position[][][]).forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach((coord) => {
              const [lng, lat] = coord;
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
              minLng = Math.min(minLng, lng);
              maxLng = Math.max(maxLng, lng);
            });
          });
        });
      }
    }
  });

  if (minLat === Infinity || maxLat === -Infinity) {
    return { latitude: -47.47279534812462, longitude: -5.507436510864934 };
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
  };
}

/**
 * Creates a Mapbox expression for fill color with property fallback
 */
export function createFillColorExpression(defaultColor: string = '#007AFF') {
  return ['case', ['has', 'fill'], ['get', 'fill'], defaultColor] as const;
}

/**
 * Creates a Mapbox expression for fill opacity with property fallback
 * Handles both fill-opacity and stroke-opacity properties, converting 0 to 0.5
 */
export function createFillOpacityExpression(defaultOpacity: number = 0.7) {
  return [
    'case',
    ['has', 'fill-opacity'],
    ['case', ['==', ['get', 'fill-opacity'], 0], 0.5, ['get', 'fill-opacity']],
    ['has', 'stroke-opacity'],
    ['case', ['==', ['get', 'stroke-opacity'], 0], 0.5, ['get', 'stroke-opacity']],
    defaultOpacity,
  ] as const;
}

/**
 * Creates a Mapbox expression for stroke color with property fallback
 */
export function createStrokeColorExpression(defaultColor: string = '#007AFF') {
  return ['case', ['has', 'stroke'], ['get', 'stroke'], defaultColor] as const;
}
