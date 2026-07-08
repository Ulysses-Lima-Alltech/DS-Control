import * as turf from '@turf/turf';

import { MapboxDirectionsRoute, MapNavigationCoordinate } from '@/types/mapNavigation.type';
import { Route } from '@/types/route.type';
import {
  OperationalRouteDirection,
  RouteEndpoints,
  resolveOperationalRouteDirection,
} from '@/utils/routeNavigationGeometry';

type GetDirections = (params: {
  origin: MapNavigationCoordinate;
  destination: MapNavigationCoordinate;
}) => Promise<MapboxDirectionsRoute>;

type EndpointName = 'firstEndpoint' | 'lastEndpoint' | 'explicitStart';

type EndpointDirectionTask = {
  route: Route;
  endpointName: EndpointName;
  destination: MapNavigationCoordinate;
};

type EndpointDirectionResult = EndpointDirectionTask & {
  mapboxRoute: MapboxDirectionsRoute;
};

export type BestOperationalRouteCandidate = {
  route: Route;
  direction: OperationalRouteDirection;
  mapboxRoute: MapboxDirectionsRoute;
  selectedEntry: MapNavigationCoordinate;
  selectedExit: MapNavigationCoordinate;
  operationalDistanceMeters: number;
  mapboxDistanceMeters: number;
  totalDistanceMeters: number;
  totalDurationSeconds?: number;
  combinedGeoJson: GeoJSON.FeatureCollection;
};

export type FindBestOperationalRouteParams = {
  routes: Route[];
  origin: MapNavigationCoordinate;
  getDirections: GetDirections;
  concurrency?: number;
  respectExplicitDirection?: boolean;
};

type RouteDirectionContext = {
  route: Route;
  direction: OperationalRouteDirection;
};

const DEFAULT_CONCURRENCY = 6;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const coordinatesAreEqual = (
  firstCoordinate: MapNavigationCoordinate,
  secondCoordinate: MapNavigationCoordinate
) => {
  return (
    Math.abs(firstCoordinate.longitude - secondCoordinate.longitude) < 0.000001 &&
    Math.abs(firstCoordinate.latitude - secondCoordinate.latitude) < 0.000001
  );
};

const toPosition = (coordinate: MapNavigationCoordinate): GeoJSON.Position => [
  coordinate.longitude,
  coordinate.latitude,
];

const getMapboxDistanceMeters = (route: MapboxDirectionsRoute) => {
  return Number(route.distanceMeters ?? route.distance ?? Number.NaN);
};

const getRouteComparisonMetric = (route: MapboxDirectionsRoute) => {
  const distance = getMapboxDistanceMeters(route);
  if (Number.isFinite(distance)) return distance;

  return Number(route.durationSeconds ?? route.duration ?? Infinity);
};

const getMapboxDurationSeconds = (route: MapboxDirectionsRoute) => {
  const duration = Number(route.durationSeconds ?? route.duration ?? Number.NaN);
  return Number.isFinite(duration) ? duration : undefined;
};

const getLineDistanceMeters = (line: GeoJSON.Position[]) => {
  const lngLatLine = line
    .filter((position) => position.length >= 2)
    .map((position) => [Number(position[0]), Number(position[1])] as GeoJSON.Position)
    .filter(
      ([longitude, latitude]) =>
        Number.isFinite(longitude) &&
        Number.isFinite(latitude) &&
        Math.abs(longitude) <= 180 &&
        Math.abs(latitude) <= 90
    );

  if (lngLatLine.length < 2) return 0;

  return turf.length(turf.lineString(lngLatLine), { units: 'kilometers' }) * 1000;
};

const normalizeGeoJson = (value: unknown): unknown => {
  if (isRecord(value) && 'geoJson' in value) return normalizeGeoJson(value.geoJson);

  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const collectLineStringsFromGeometry = (geometry: unknown): GeoJSON.Position[][] => {
  if (!isRecord(geometry)) return [];

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    return [geometry.coordinates as GeoJSON.Position[]];
  }

  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates as GeoJSON.Position[][];
  }

  if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    return geometry.geometries.flatMap(collectLineStringsFromGeometry);
  }

  return [];
};

const collectLineStringsFromGeoJson = (routeOrGeoJson: unknown): GeoJSON.Position[][] => {
  const geoJson = normalizeGeoJson(routeOrGeoJson);

  if (
    isRecord(geoJson) &&
    geoJson.type === 'FeatureCollection' &&
    Array.isArray(geoJson.features)
  ) {
    return geoJson.features.flatMap((feature) =>
      isRecord(feature) ? collectLineStringsFromGeometry(feature.geometry) : []
    );
  }

  if (isRecord(geoJson) && geoJson.type === 'Feature') {
    return collectLineStringsFromGeometry(geoJson.geometry);
  }

  return collectLineStringsFromGeometry(geoJson);
};

const getOperationalDistanceMeters = (route: Route) => {
  return collectLineStringsFromGeoJson(route).reduce(
    (totalDistance, line) => totalDistance + getLineDistanceMeters(line),
    0
  );
};

const buildOperationalRouteGeoJson = (
  route: Route,
  endpoints: RouteEndpoints,
  selectedEntry: MapNavigationCoordinate
): GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString> => {
  const shouldReverse = coordinatesAreEqual(selectedEntry, endpoints.lastEndpoint);
  const lines = collectLineStringsFromGeoJson(route);
  const orientedLines = shouldReverse
    ? [...lines].reverse().map((line) => [...line].reverse())
    : lines;

  if (orientedLines.length === 1) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            segment: 'operational',
            route_id: route.id,
            route_name: route.name,
            label: 'Rota operacional',
          },
          geometry: {
            type: 'LineString',
            coordinates: orientedLines[0],
          },
        },
      ],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          segment: 'operational',
          route_id: route.id,
          route_name: route.name,
          label: 'Rota operacional',
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: orientedLines,
        },
      },
    ],
  };
};

const buildCombinedGeoJson = ({
  mapboxRoute,
  operationalRouteGeoJson,
  route,
}: {
  mapboxRoute: MapboxDirectionsRoute;
  operationalRouteGeoJson: GeoJSON.FeatureCollection;
  route: Route;
}): GeoJSON.FeatureCollection => {
  const mapboxFeatures =
    mapboxRoute.geoJson?.features?.map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        segment: 'mapbox',
        label: 'Até a entrada',
      },
    })) ?? [];

  const operationalFeatures =
    operationalRouteGeoJson.features?.map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        segment: 'operational',
        route_id: route.id,
        route_name: route.name,
        label: 'Rota operacional',
      },
    })) ?? [];

  return {
    type: 'FeatureCollection',
    features: [...mapboxFeatures, ...operationalFeatures],
  };
};

async function settleWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        results[currentIndex] = {
          status: 'fulfilled',
          value: await mapper(items[currentIndex]),
        };
      } catch (reason) {
        results[currentIndex] = {
          status: 'rejected',
          reason,
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, () => worker())
  );

  return results;
}

const getSelectedEndpointResult = (
  firstResult?: EndpointDirectionResult,
  lastResult?: EndpointDirectionResult
) => {
  if (!firstResult) return lastResult ?? null;
  if (!lastResult) return firstResult;

  return getRouteComparisonMetric(firstResult.mapboxRoute) <=
    getRouteComparisonMetric(lastResult.mapboxRoute)
    ? firstResult
    : lastResult;
};

export async function findBestOperationalRouteCandidate({
  routes,
  origin,
  getDirections,
  concurrency = DEFAULT_CONCURRENCY,
  respectExplicitDirection = false,
}: FindBestOperationalRouteParams): Promise<BestOperationalRouteCandidate | null> {
  const routeContexts: RouteDirectionContext[] = routes.flatMap((route) => {
    const direction = resolveOperationalRouteDirection(route);
    return direction ? [{ route, direction }] : [];
  });

  if (routeContexts.length === 0) return null;

  const endpointTasks = routeContexts.flatMap<EndpointDirectionTask>(({ route, direction }) => {
    if (respectExplicitDirection && direction.reason === 'explicit-field') {
      return [
        {
          route,
          endpointName: 'explicitStart',
          destination: direction.start,
        },
      ];
    }

    return [
      {
        route,
        endpointName: 'firstEndpoint',
        destination: direction.endpoints.firstEndpoint,
      },
      {
        route,
        endpointName: 'lastEndpoint',
        destination: direction.endpoints.lastEndpoint,
      },
    ];
  });

  const settledEndpointResults = await settleWithConcurrency(
    endpointTasks,
    concurrency,
    async (task) => ({
      ...task,
      mapboxRoute: await getDirections({
        origin,
        destination: task.destination,
      }),
    })
  );

  const endpointResultsByRoute = new Map<string, EndpointDirectionResult[]>();

  settledEndpointResults.forEach((result) => {
    if (result.status !== 'fulfilled') return;

    const routeResults = endpointResultsByRoute.get(result.value.route.id) ?? [];
    routeResults.push(result.value);
    endpointResultsByRoute.set(result.value.route.id, routeResults);
  });

  const candidates = routeContexts.flatMap<BestOperationalRouteCandidate>(
    ({ route, direction }) => {
      const routeEndpointResults = endpointResultsByRoute.get(route.id) ?? [];
      const explicitResult = routeEndpointResults.find(
        (result) => result.endpointName === 'explicitStart'
      );
      const firstResult = routeEndpointResults.find(
        (result) => result.endpointName === 'firstEndpoint'
      );
      const lastResult = routeEndpointResults.find(
        (result) => result.endpointName === 'lastEndpoint'
      );
      const selectedEndpointResult =
        explicitResult ?? getSelectedEndpointResult(firstResult, lastResult);

      if (!selectedEndpointResult) return [];

      const selectedEntry =
        selectedEndpointResult.endpointName === 'lastEndpoint'
          ? direction.endpoints.lastEndpoint
          : selectedEndpointResult.endpointName === 'firstEndpoint'
            ? direction.endpoints.firstEndpoint
            : direction.start;

      const selectedExit = coordinatesAreEqual(selectedEntry, direction.endpoints.firstEndpoint)
        ? direction.endpoints.lastEndpoint
        : direction.endpoints.firstEndpoint;
      const resolvedDirection: OperationalRouteDirection = {
        ...direction,
        start: selectedEntry,
        end: selectedExit,
      };
      const operationalRouteGeoJson = buildOperationalRouteGeoJson(
        route,
        direction.endpoints,
        selectedEntry
      );
      const operationalDistanceMeters = getOperationalDistanceMeters(route);
      const mapboxDistanceMeters = getMapboxDistanceMeters(selectedEndpointResult.mapboxRoute);

      if (!Number.isFinite(mapboxDistanceMeters)) return [];

      const totalDistanceMeters = mapboxDistanceMeters + operationalDistanceMeters;

      return [
        {
          route,
          direction: resolvedDirection,
          mapboxRoute: selectedEndpointResult.mapboxRoute,
          selectedEntry,
          selectedExit,
          operationalDistanceMeters,
          mapboxDistanceMeters,
          totalDistanceMeters,
          totalDurationSeconds: getMapboxDurationSeconds(selectedEndpointResult.mapboxRoute),
          combinedGeoJson: buildCombinedGeoJson({
            mapboxRoute: selectedEndpointResult.mapboxRoute,
            operationalRouteGeoJson,
            route,
          }),
        },
      ];
    }
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((bestCandidate, candidate) =>
    candidate.totalDistanceMeters < bestCandidate.totalDistanceMeters ? candidate : bestCandidate
  );
}

export function getOperationalSegmentGeoJson(
  combinedGeoJson: GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection | null {
  const features = combinedGeoJson.features.filter(
    (feature) => feature.properties?.segment === 'operational'
  );

  if (features.length === 0) return null;

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function buildBestRouteMarkersGeoJson({
  origin,
  entry,
  exit,
}: {
  origin?: MapNavigationCoordinate | null;
  entry: MapNavigationCoordinate;
  exit: MapNavigationCoordinate;
}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: [
      ...(origin
        ? [
            {
              type: 'Feature' as const,
              properties: {
                label: 'Você',
                type: 'user',
              },
              geometry: {
                type: 'Point' as const,
                coordinates: toPosition(origin),
              },
            },
          ]
        : []),
      {
        type: 'Feature',
        properties: {
          label: 'Entrada escolhida',
          type: 'operational-start',
        },
        geometry: {
          type: 'Point',
          coordinates: toPosition(entry),
        },
      },
      {
        type: 'Feature',
        properties: {
          label: 'Destino/Fazenda',
          type: 'operational-end',
        },
        geometry: {
          type: 'Point',
          coordinates: toPosition(exit),
        },
      },
    ],
  };
}
