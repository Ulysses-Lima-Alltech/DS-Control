import { Plot } from '@/types/plot.type';
import { Route } from '@/types/route.type';

export function convertDatabasePlotsToMapViewerPlotsFeatureCollection(
  geoData: Plot[]
): GeoJSON.FeatureCollection {
  const formattedPlots: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  geoData.forEach((plot) => {
    const plotFeatureCollection = plot.geoJson as GeoJSON.FeatureCollection;
    if (plotFeatureCollection.features && Array.isArray(plotFeatureCollection.features)) {
      const featuresWithPlotId = plotFeatureCollection.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          plot_id: plot.id,
          plot_name: plot.name,
          hectare: plot.hectare,
        },
      }));
      formattedPlots.features.push(...featuresWithPlotId);
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
