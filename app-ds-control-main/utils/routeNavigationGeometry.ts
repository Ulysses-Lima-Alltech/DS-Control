import { MapNavigationCoordinate } from '@/types/mapNavigation.type';

type SupportedGeometryType = 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';

export type RouteEndpoints = {
  firstEndpoint: MapNavigationCoordinate;
  lastEndpoint: MapNavigationCoordinate;
  coordinates: MapNavigationCoordinate[];
  geometryType: SupportedGeometryType;
};

export type OperationalRouteDirection = {
  start: MapNavigationCoordinate;
  end: MapNavigationCoordinate;
  reason: 'explicit-field' | 'endpoints';
  explicitStart?: MapNavigationCoordinate;
  explicitEnd?: MapNavigationCoordinate;
  endpoints: RouteEndpoints;
};

const geometryPriority: SupportedGeometryType[] = [
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
];

const startFieldPaths = [
  'start',
  'startPoint',
  'origin',
  'initialPoint',
  'entryPoint',
  'navigationStart',
  'navigationStartPoint',
  'metadata.start',
  'properties.start',
];

const endFieldPaths = [
  'end',
  'endPoint',
  'destination',
  'finalPoint',
  'exitPoint',
  'navigationEnd',
  'navigationEndPoint',
  'metadata.end',
  'properties.end',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const logRouteNavigationDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[RouteNavigation][DEV]', message, data);
  }
};

const normalizeGeoJsonInput = (value: unknown): unknown => {
  const routeCandidate = isRecord(value) && 'geoJson' in value ? value.geoJson : value;

  if (typeof routeCandidate !== 'string') return routeCandidate;

  try {
    return JSON.parse(routeCandidate);
  } catch (error) {
    logRouteNavigationDev('Failed to parse GeoJSON string', { error });
    return null;
  }
};

const toNavigationCoordinate = (value: unknown): MapNavigationCoordinate | null => {
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);
    return toValidatedCoordinate(longitude, latitude);
  }

  if (isRecord(value)) {
    const longitude = Number(value.longitude ?? value.lng ?? value.lon);
    const latitude = Number(value.latitude ?? value.lat);
    return toValidatedCoordinate(longitude, latitude);
  }

  return null;
};

const toValidatedCoordinate = (longitude: number, latitude: number) => {
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return { longitude, latitude };
};

const getByPath = (value: unknown, path: string): unknown => {
  return path.split('.').reduce<unknown>((currentValue, key) => {
    if (!isRecord(currentValue)) return undefined;
    return currentValue[key];
  }, value);
};

const findExplicitCoordinate = (routeOrGeoJson: unknown, paths: string[]) => {
  for (const path of paths) {
    const coordinate = toNavigationCoordinate(getByPath(routeOrGeoJson, path));
    if (coordinate) return { coordinate, path };
  }

  const geoJson = normalizeGeoJsonInput(routeOrGeoJson);

  if (isRecord(geoJson) && geoJson.type === 'Feature') {
    for (const path of paths) {
      const coordinate = toNavigationCoordinate(getByPath(geoJson, path));
      if (coordinate) return { coordinate, path };
    }
  }

  if (
    isRecord(geoJson) &&
    geoJson.type === 'FeatureCollection' &&
    Array.isArray(geoJson.features)
  ) {
    for (const feature of geoJson.features) {
      for (const path of paths) {
        const coordinate = toNavigationCoordinate(getByPath(feature, path));
        if (coordinate) return { coordinate, path };
      }
    }
  }

  return null;
};

const positionsToCoordinates = (positions: unknown): MapNavigationCoordinate[] => {
  if (!Array.isArray(positions)) return [];

  return positions
    .map((position) => toNavigationCoordinate(position))
    .filter((coordinate): coordinate is MapNavigationCoordinate => Boolean(coordinate));
};

const coordinatesFromGeometry = (
  geometry: unknown,
  geometryType: SupportedGeometryType
): MapNavigationCoordinate[] => {
  if (!isRecord(geometry) || geometry.type !== geometryType) return [];

  if (geometryType === 'LineString') {
    return positionsToCoordinates(geometry.coordinates);
  }

  if (geometryType === 'MultiLineString') {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates.flatMap((line) => positionsToCoordinates(line))
      : [];
  }

  if (geometryType === 'Polygon') {
    return Array.isArray(geometry.coordinates)
      ? positionsToCoordinates(geometry.coordinates[0])
      : [];
  }

  if (geometryType === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates)) return [];

    for (const polygon of geometry.coordinates) {
      const coordinates = Array.isArray(polygon) ? positionsToCoordinates(polygon[0]) : [];
      if (coordinates.length > 0) return coordinates;
    }
  }

  return [];
};

const findCoordinatesByPriority = (
  geoJson: unknown
): { coordinates: MapNavigationCoordinate[]; geometryType: SupportedGeometryType } | null => {
  const geometries: unknown[] = [];

  if (
    isRecord(geoJson) &&
    geoJson.type === 'FeatureCollection' &&
    Array.isArray(geoJson.features)
  ) {
    geoJson.features.forEach((feature) => {
      if (isRecord(feature) && feature.type === 'Feature') geometries.push(feature.geometry);
    });
  } else if (isRecord(geoJson) && geoJson.type === 'Feature') {
    geometries.push(geoJson.geometry);
  } else {
    geometries.push(geoJson);
  }

  for (const geometryType of geometryPriority) {
    for (const geometry of geometries) {
      const coordinates = coordinatesFromGeometry(geometry, geometryType);
      if (coordinates.length > 0) return { coordinates, geometryType };
    }
  }

  return null;
};

export const extractRouteEndpointsFromGeoJson = (
  routeOrGeoJson: unknown
): RouteEndpoints | null => {
  const geoJson = normalizeGeoJsonInput(routeOrGeoJson);
  const result = findCoordinatesByPriority(geoJson);

  if (!result || result.coordinates.length === 0) {
    logRouteNavigationDev('No valid route endpoints found');
    return null;
  }

  const endpoints = {
    firstEndpoint: result.coordinates[0],
    lastEndpoint: result.coordinates[result.coordinates.length - 1],
    coordinates: result.coordinates,
    geometryType: result.geometryType,
  };

  logRouteNavigationDev('route endpoints extracted', {
    firstEndpoint: endpoints.firstEndpoint,
    lastEndpoint: endpoints.lastEndpoint,
    geometryType: endpoints.geometryType,
    totalCoordinates: endpoints.coordinates.length,
  });

  return endpoints;
};

export const resolveOperationalRouteDirection = (
  routeOrGeoJson: unknown
): OperationalRouteDirection | null => {
  const endpoints = extractRouteEndpointsFromGeoJson(routeOrGeoJson);
  if (!endpoints) return null;

  const explicitStart = findExplicitCoordinate(routeOrGeoJson, startFieldPaths);
  const explicitEnd = findExplicitCoordinate(routeOrGeoJson, endFieldPaths);

  if (explicitStart) {
    const start = explicitStart.coordinate;
    const end = explicitEnd?.coordinate ?? getOppositeEndpoint(start, endpoints);

    logRouteNavigationDev('explicit operational start found', {
      field: explicitStart.path,
      start,
      explicitEndField: explicitEnd?.path,
      end,
    });

    logRouteNavigationDev('operational start resolved', {
      selectedStartEndpoint: start,
      selectedEndEndpoint: end,
      reason: 'explicit-field',
    });

    return {
      start,
      end,
      reason: 'explicit-field',
      explicitStart: start,
      explicitEnd: explicitEnd?.coordinate,
      endpoints,
    };
  }

  logRouteNavigationDev('no explicit operational start found, comparing endpoints', {
    firstEndpoint: endpoints.firstEndpoint,
    lastEndpoint: endpoints.lastEndpoint,
  });

  return {
    start: endpoints.firstEndpoint,
    end: endpoints.lastEndpoint,
    reason: 'endpoints',
    endpoints,
  };
};

export const extractRouteStartCoordinate = (
  routeOrGeoJson: unknown
): MapNavigationCoordinate | null => {
  return resolveOperationalRouteDirection(routeOrGeoJson)?.start ?? null;
};

const getOppositeEndpoint = (start: MapNavigationCoordinate, endpoints: RouteEndpoints) => {
  if (coordinatesAreEqual(start, endpoints.firstEndpoint)) return endpoints.lastEndpoint;
  return endpoints.firstEndpoint;
};

const coordinatesAreEqual = (
  firstCoordinate: MapNavigationCoordinate,
  secondCoordinate: MapNavigationCoordinate
) => {
  return (
    Math.abs(firstCoordinate.longitude - secondCoordinate.longitude) < 0.000001 &&
    Math.abs(firstCoordinate.latitude - secondCoordinate.latitude) < 0.000001
  );
};
