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

export type ResolveSelectedOperationalRouteNavigationParams = Omit<
  FindBestOperationalRouteParams,
  'routes' | 'respectExplicitDirection'
> & {
  route: Route;
  /**
   * All routes belonging to the same farm as `route`. Used to look for other drawn
   * routes whose endpoint sits close to one of `route`'s endpoints, so a route that
   * doesn't reach a public road on its own can still be entered via a connected
   * neighbor route that does.
   */
  farmRoutes?: Route[];
};

type RouteDirectionContext = {
  route: Route;
  direction: OperationalRouteDirection;
};

const DEFAULT_CONCURRENCY = 6;
// Two drawn routes are treated as touching/connected when their endpoints sit
// within this distance of each other (they were very likely drawn as separate
// KML files for what is physically the same trail junction).
const ROUTE_CONNECTION_THRESHOLD_METERS = 35;
// Safety caps so a farm with many interconnected routes can't blow up the number
// of Mapbox Directions calls made when looking for the best entry.
const MAX_GRAPH_HOPS = 4;
const MAX_GRAPH_CANDIDATES_PER_ENDPOINT = 8;

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

// ---------------------------------------------------------------------------
// Route connectivity graph
//
// Drawn (operational) routes rarely reach a public road on their own — a route
// may end in the middle of the farm while a *different* drawn route happens to
// touch the same spot (or the road itself). To find the fastest real entry we
// treat every route as an edge between its two endpoints and look for other
// routes whose endpoints sit within ROUTE_CONNECTION_THRESHOLD_METERS of the
// selected route's endpoints, chaining ("summing") them together when needed.
// ---------------------------------------------------------------------------

type RouteGraphNode = {
  id: string;
  coordinate: MapNavigationCoordinate;
};

type RouteGraphEdge = {
  route: Route;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
};

type RouteGraph = {
  nodes: Map<string, RouteGraphNode>;
  adjacency: Map<string, RouteGraphEdge[]>;
  endpointNodesByRouteId: Map<string, { firstNodeId: string; lastNodeId: string }>;
};

const distanceMetersBetween = (first: MapNavigationCoordinate, second: MapNavigationCoordinate) =>
  turf.distance(
    turf.point([first.longitude, first.latitude]),
    turf.point([second.longitude, second.latitude]),
    { units: 'kilometers' }
  ) * 1000;

const buildRouteConnectivityGraph = (routes: Route[]): RouteGraph => {
  const nodes = new Map<string, RouteGraphNode>();
  const endpointNodesByRouteId = new Map<string, { firstNodeId: string; lastNodeId: string }>();
  const adjacency = new Map<string, RouteGraphEdge[]>();

  const findOrCreateNode = (coordinate: MapNavigationCoordinate): string => {
    for (const node of nodes.values()) {
      if (distanceMetersBetween(node.coordinate, coordinate) <= ROUTE_CONNECTION_THRESHOLD_METERS) {
        return node.id;
      }
    }

    const id = `node-${nodes.size}`;
    nodes.set(id, { id, coordinate });
    return id;
  };

  const addEdge = (edge: RouteGraphEdge) => {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge]);
    adjacency.set(edge.toNodeId, [...(adjacency.get(edge.toNodeId) ?? []), edge]);
  };

  routes.forEach((route) => {
    const direction = resolveOperationalRouteDirection(route);
    if (!direction) return;

    const firstNodeId = findOrCreateNode(direction.endpoints.firstEndpoint);
    const lastNodeId = findOrCreateNode(direction.endpoints.lastEndpoint);
    endpointNodesByRouteId.set(route.id, { firstNodeId, lastNodeId });

    if (firstNodeId === lastNodeId) return;

    addEdge({
      route,
      fromNodeId: firstNodeId,
      toNodeId: lastNodeId,
      distanceMeters: getOperationalDistanceMeters(route),
    });
  });

  return { nodes, adjacency, endpointNodesByRouteId };
};

type RouteGraphPathStep = { edge: RouteGraphEdge; traversalFromNodeId: string };

type RouteGraphPathResult = { distanceMeters: number; path: RouteGraphPathStep[] };

// Plain Dijkstra over a small graph (a handful of routes per farm at most), so a
// linear scan for the next closest unvisited node is simpler than a heap and
// fast enough in practice.
const findShortestGraphPaths = (
  graph: RouteGraph,
  startNodeId: string,
  excludeRouteId: string,
  maxHops: number
): Map<string, RouteGraphPathResult> => {
  const best = new Map<string, RouteGraphPathResult>([
    [startNodeId, { distanceMeters: 0, path: [] }],
  ]);
  const visited = new Set<string>();

  while (true) {
    let currentNodeId: string | null = null;
    let currentBest: RouteGraphPathResult | null = null;

    for (const [nodeId, result] of best) {
      if (visited.has(nodeId)) continue;
      if (!currentBest || result.distanceMeters < currentBest.distanceMeters) {
        currentBest = result;
        currentNodeId = nodeId;
      }
    }

    if (!currentNodeId || !currentBest) break;
    visited.add(currentNodeId);

    if (currentBest.path.length >= maxHops) continue;

    const neighbors = graph.adjacency.get(currentNodeId) ?? [];
    for (const edge of neighbors) {
      if (edge.route.id === excludeRouteId) continue;

      const neighborNodeId = edge.fromNodeId === currentNodeId ? edge.toNodeId : edge.fromNodeId;
      const candidateDistance = currentBest.distanceMeters + edge.distanceMeters;
      const existing = best.get(neighborNodeId);

      if (!existing || candidateDistance < existing.distanceMeters) {
        best.set(neighborNodeId, {
          distanceMeters: candidateDistance,
          path: [...currentBest.path, { edge, traversalFromNodeId: currentNodeId }],
        });
      }
    }
  }

  return best;
};

type RouteEntryCandidate = {
  coordinate: MapNavigationCoordinate;
  connectorDistanceMeters: number;
  connectorPath: RouteGraphPathStep[];
  arrivalEndpoint: 'first' | 'last';
};

const collectRouteEntryCandidates = (graph: RouteGraph, route: Route): RouteEntryCandidate[] => {
  const endpointNodeIds = graph.endpointNodesByRouteId.get(route.id);
  if (!endpointNodeIds) return [];

  const candidates: RouteEntryCandidate[] = [];

  (['first', 'last'] as const).forEach((endpointKey) => {
    const startNodeId =
      endpointKey === 'first' ? endpointNodeIds.firstNodeId : endpointNodeIds.lastNodeId;
    const reachable = findShortestGraphPaths(graph, startNodeId, route.id, MAX_GRAPH_HOPS);

    let addedForEndpoint = 0;
    for (const [nodeId, result] of reachable) {
      if (addedForEndpoint >= MAX_GRAPH_CANDIDATES_PER_ENDPOINT) break;

      const node = graph.nodes.get(nodeId);
      if (!node) continue;

      candidates.push({
        coordinate: node.coordinate,
        connectorDistanceMeters: result.distanceMeters,
        connectorPath: result.path,
        arrivalEndpoint: endpointKey,
      });
      addedForEndpoint += 1;
    }
  });

  return candidates;
};

const buildConnectedOperationalGeoJson = (
  connectorPath: RouteGraphPathStep[],
  selectedRoute: Route,
  selectedDirection: OperationalRouteDirection,
  arrivalEndpoint: 'first' | 'last'
): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = [];

  connectorPath.forEach((step) => {
    const connectorDirection = resolveOperationalRouteDirection(step.edge.route);
    if (!connectorDirection) return;

    const entryCoordinate =
      step.traversalFromNodeId === step.edge.fromNodeId
        ? connectorDirection.endpoints.firstEndpoint
        : connectorDirection.endpoints.lastEndpoint;

    const connectorGeoJson = buildOperationalRouteGeoJson(
      step.edge.route,
      connectorDirection.endpoints,
      entryCoordinate
    );

    features.push(
      ...connectorGeoJson.features.map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          label: 'Trecho de conexão',
        },
      }))
    );
  });

  const selectedEntryCoordinate =
    arrivalEndpoint === 'first'
      ? selectedDirection.endpoints.firstEndpoint
      : selectedDirection.endpoints.lastEndpoint;

  const selectedGeoJson = buildOperationalRouteGeoJson(
    selectedRoute,
    selectedDirection.endpoints,
    selectedEntryCoordinate
  );

  features.push(...selectedGeoJson.features);

  return { type: 'FeatureCollection', features };
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

export async function resolveSelectedOperationalRouteNavigation({
  route,
  origin,
  getDirections,
  concurrency = DEFAULT_CONCURRENCY,
  farmRoutes,
}: ResolveSelectedOperationalRouteNavigationParams): Promise<BestOperationalRouteCandidate | null> {
  const direction = resolveOperationalRouteDirection(route);
  if (!direction) return null;

  const routesForGraph =
    farmRoutes && farmRoutes.some((farmRoute) => farmRoute.id === route.id)
      ? farmRoutes
      : [...(farmRoutes ?? []), route];

  const graph = buildRouteConnectivityGraph(routesForGraph);

  const candidates = collectRouteEntryCandidates(graph, route);

  if (candidates.length === 0) return null;

  const settledCandidates = await settleWithConcurrency(
    candidates,
    concurrency,
    async (candidate) => ({
      candidate,
      mapboxRoute: await getDirections({ origin, destination: candidate.coordinate }),
    })
  );

  const evaluatedCandidates = settledCandidates.flatMap((result) => {
    if (result.status !== 'fulfilled') return [];

    const { candidate, mapboxRoute } = result.value;
    const mapboxDistanceMeters = getMapboxDistanceMeters(mapboxRoute);
    if (!Number.isFinite(mapboxDistanceMeters)) return [];

    const operationalDistanceMeters =
      getOperationalDistanceMeters(route) + candidate.connectorDistanceMeters;
    const totalDistanceMeters = mapboxDistanceMeters + operationalDistanceMeters;

    return [
      {
        candidate,
        mapboxRoute,
        mapboxDistanceMeters,
        operationalDistanceMeters,
        totalDistanceMeters,
      },
    ];
  });

  if (evaluatedCandidates.length === 0) return null;

  const best = evaluatedCandidates.reduce((bestSoFar, current) =>
    current.totalDistanceMeters < bestSoFar.totalDistanceMeters ? current : bestSoFar
  );

  const selectedEntry = best.candidate.coordinate;
  const selectedExit =
    best.candidate.arrivalEndpoint === 'first'
      ? direction.endpoints.lastEndpoint
      : direction.endpoints.firstEndpoint;

  const resolvedDirection: OperationalRouteDirection = {
    ...direction,
    start: selectedEntry,
    end: selectedExit,
  };

  const operationalRouteGeoJson = buildConnectedOperationalGeoJson(
    best.candidate.connectorPath,
    route,
    direction,
    best.candidate.arrivalEndpoint
  );

  return {
    route,
    direction: resolvedDirection,
    mapboxRoute: best.mapboxRoute,
    selectedEntry,
    selectedExit,
    operationalDistanceMeters: best.operationalDistanceMeters,
    mapboxDistanceMeters: best.mapboxDistanceMeters,
    totalDistanceMeters: best.totalDistanceMeters,
    totalDurationSeconds: getMapboxDurationSeconds(best.mapboxRoute),
    combinedGeoJson: buildCombinedGeoJson({
      mapboxRoute: best.mapboxRoute,
      operationalRouteGeoJson,
      route,
    }),
  };
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
