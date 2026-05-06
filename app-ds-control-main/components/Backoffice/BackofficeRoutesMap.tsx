import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { InfiniteData } from '@tanstack/react-query';
import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import MapNavigationButton from '@/components/Map/MapNavigationButton';
import MapViewer from '@/components/Map/MapViewer';
import NavigationMapFullscreen from '@/components/Map/NavigationMapFullscreen';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import { COLORS } from '@/constants/colors';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarmsInfinite, useGetFarmById } from '@/queries/farm.query';
import { useGetAllRoutes } from '@/queries/route.query';
import { getMapboxDirections } from '@/services/mapboxDirections.service';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import {
  MapboxDirectionsError,
  MapboxDirectionsRoute,
  MapboxNavigationStep,
  MapNavigationCoordinate,
} from '@/types/mapNavigation.type';
import { Route, RouteOrderBy, RouteOrderType } from '@/types/route.type';
import { convertDatabaseRoutesToMapViewerRoutesFeatureCollection } from '@/utils/map-utils';
import {
  OperationalRouteDirection,
  resolveOperationalRouteDirection,
} from '@/utils/routeNavigationGeometry';

type LngLatCoordinate = [number, number];

type RouteWithRelations = Route & {
  farm?: {
    id: string;
    name: string;
  };
  customer?: {
    id: string;
    name: string;
  };
};

type RouteGeoStats = {
  pointCount: number;
  distanceKm: number | null;
  startCoordinate: LngLatCoordinate | null;
  destinationCoordinate: LngLatCoordinate | null;
  status?: string;
  observation?: string;
};

const routeOrderByOptions: { id: RouteOrderBy; label: string }[] = [
  { id: RouteOrderBy.CREATEDAT, label: 'Data de criacao' },
  { id: RouteOrderBy.NAME, label: 'Nome da rota' },
  { id: RouteOrderBy.FARM, label: 'Fazenda' },
  { id: RouteOrderBy.CUSTOMER, label: 'Cliente' },
];

const routeOrderTypeOptions: { id: RouteOrderType; label: string }[] = [
  { id: RouteOrderType.DESC, label: 'Descendente' },
  { id: RouteOrderType.ASC, label: 'Ascendente' },
];

const routeLimitOptions: { id: string; label: string }[] = [
  { id: '5', label: '5 por pagina' },
  { id: '10', label: '10 por pagina' },
  { id: '20', label: '20 por pagina' },
];

const LAST_KNOWN_LOCATION_TIMEOUT_MS = 3000;
const CURRENT_LOCATION_TIMEOUT_MS = 10000;
const ROUTE_START_INVALID_MESSAGE =
  'A rota selecionada não possui um ponto inicial válido para navegação.';
const ROUTE_CALCULATION_GENERIC_MESSAGE =
  'Não foi possível calcular a rota até o início da operação. Verifique sua localização e tente novamente.';
const MAPBOX_NO_ROUTE_MESSAGE =
  'A Mapbox não encontrou uma rota viária até o início da operação. Tente ajustar sua localização ou selecione outra rota.';

const ROUTE_GEOMETRY_CANDIDATE_FIELDS = [
  'geoJson',
  'geojson',
  'geometry',
  'points',
  'routePoints',
  'routeCoordinates',
  'coordinates',
  'path',
  'paths',
  'polyline',
  'kml',
  'distance',
  'pointCount',
  'pointsCount',
  'totalPoints',
  'destination',
  'start',
  'farm',
  'customer',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const summarizeDevRouteFieldValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      firstItem: value.length > 0 ? value[0] : null,
      lastItem: value.length > 0 ? value[value.length - 1] : null,
    };
  }

  if (typeof value === 'string') {
    return {
      type: 'string',
      length: value.length,
      preview: value.slice(0, 300),
    };
  }

  if (isRecord(value)) {
    const summary: Record<string, unknown> = {
      type: 'object',
      keys: Object.keys(value),
    };

    if ('type' in value) summary.typeValue = value.type;
    if ('coordinates' in value) {
      summary.coordinatesSummary = summarizeDevRouteFieldValue(value.coordinates);
    }
    if ('features' in value) {
      summary.featuresSummary = summarizeDevRouteFieldValue(value.features);
    }

    return summary;
  }

  return {
    type: value === null ? 'null' : typeof value,
    value,
  };
};

const isGeometryType = (value: unknown): value is GeoJSON.Geometry['type'] =>
  typeof value === 'string' &&
  [
    'Point',
    'LineString',
    'Polygon',
    'MultiPoint',
    'MultiLineString',
    'MultiPolygon',
    'GeometryCollection',
  ].includes(value);

const isGeometry = (value: unknown): value is GeoJSON.Geometry =>
  isRecord(value) && isGeometryType(value.type);

const isValidLngLatCoordinate = (value: unknown): value is LngLatCoordinate => {
  if (!Array.isArray(value) || value.length < 2) return false;

  const longitude = Number(value[0]);
  const latitude = Number(value[1]);

  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(longitude) <= 180 &&
    Math.abs(latitude) <= 90
  );
};

const toLngLatCoordinate = (value: unknown): LngLatCoordinate | null => {
  if (!isValidLngLatCoordinate(value)) return null;
  return [Number(value[0]), Number(value[1])];
};

const normalizeProperties = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  return value;
};

const toFeature = (
  geometry: GeoJSON.Geometry,
  properties?: Record<string, unknown>
): GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>> => ({
  type: 'Feature',
  geometry,
  properties: properties || {},
});

const getFeaturesFromRouteGeoJson = (
  routeGeoJson: unknown
): GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>[] => {
  if (!routeGeoJson) return [];

  if (isRecord(routeGeoJson) && routeGeoJson.type === 'FeatureCollection') {
    const rawFeatures = Array.isArray(routeGeoJson.features) ? routeGeoJson.features : [];

    return rawFeatures
      .map((rawFeature) => {
        if (!isRecord(rawFeature) || rawFeature.type !== 'Feature') return null;
        if (!isGeometry(rawFeature.geometry)) return null;
        return toFeature(rawFeature.geometry, normalizeProperties(rawFeature.properties));
      })
      .filter((feature): feature is GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>> =>
        Boolean(feature)
      );
  }

  if (isRecord(routeGeoJson) && routeGeoJson.type === 'Feature') {
    if (!isGeometry(routeGeoJson.geometry)) return [];
    return [toFeature(routeGeoJson.geometry, normalizeProperties(routeGeoJson.properties))];
  }

  if (isGeometry(routeGeoJson)) {
    return [toFeature(routeGeoJson)];
  }

  return [];
};

const collectCoordinatesFromGeometry = (geometry: GeoJSON.Geometry): LngLatCoordinate[] => {
  switch (geometry.type) {
    case 'Point': {
      const coordinate = toLngLatCoordinate(geometry.coordinates);
      return coordinate ? [coordinate] : [];
    }
    case 'MultiPoint':
      return geometry.coordinates
        .map((coordinate) => toLngLatCoordinate(coordinate))
        .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate));
    case 'LineString':
      return geometry.coordinates
        .map((coordinate) => toLngLatCoordinate(coordinate))
        .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate));
    case 'MultiLineString':
      return geometry.coordinates.flatMap((line) =>
        line
          .map((coordinate) => toLngLatCoordinate(coordinate))
          .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate))
      );
    case 'Polygon':
      return geometry.coordinates.flatMap((ring) =>
        ring
          .map((coordinate) => toLngLatCoordinate(coordinate))
          .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate))
      );
    case 'MultiPolygon':
      return geometry.coordinates.flatMap((polygon) =>
        polygon.flatMap((ring) =>
          ring
            .map((coordinate) => toLngLatCoordinate(coordinate))
            .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate))
        )
      );
    case 'GeometryCollection':
      return geometry.geometries.flatMap((item) => collectCoordinatesFromGeometry(item));
    default:
      return [];
  }
};

const getDistanceKmFromLineGeometry = (geometry: GeoJSON.Geometry): number => {
  switch (geometry.type) {
    case 'LineString': {
      const coordinates = geometry.coordinates
        .map((coordinate) => toLngLatCoordinate(coordinate))
        .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate));
      if (coordinates.length < 2) return 0;
      return turf.length(turf.lineString(coordinates), { units: 'kilometers' });
    }
    case 'MultiLineString':
      return geometry.coordinates.reduce((totalDistance, line) => {
        const lineCoordinates = line
          .map((coordinate) => toLngLatCoordinate(coordinate))
          .filter((coordinate): coordinate is LngLatCoordinate => Boolean(coordinate));
        if (lineCoordinates.length < 2) return totalDistance;
        return (
          totalDistance + turf.length(turf.lineString(lineCoordinates), { units: 'kilometers' })
        );
      }, 0);
    case 'GeometryCollection':
      return geometry.geometries.reduce(
        (totalDistance, item) => totalDistance + getDistanceKmFromLineGeometry(item),
        0
      );
    default:
      return 0;
  }
};

const getFirstStringProperty = (
  properties: Record<string, unknown>,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const getFirstNumericProperty = (
  properties: Record<string, unknown>,
  keys: string[]
): number | undefined => {
  for (const key of keys) {
    const rawValue = properties[key];
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return rawValue;
    if (typeof rawValue === 'string') {
      const numericValue = Number.parseFloat(rawValue);
      if (Number.isFinite(numericValue)) return numericValue;
    }
  }
  return undefined;
};

const extractRouteGeoStats = (routeGeoJson: unknown): RouteGeoStats => {
  const features = getFeaturesFromRouteGeoJson(routeGeoJson);

  if (features.length === 0) {
    return {
      pointCount: 0,
      distanceKm: null,
      startCoordinate: null,
      destinationCoordinate: null,
    };
  }

  const coordinates: LngLatCoordinate[] = [];
  let distanceKm = 0;
  let fallbackDistance: number | undefined;
  let status: string | undefined;
  let observation: string | undefined;

  features.forEach((feature) => {
    const featureCoordinates = collectCoordinatesFromGeometry(feature.geometry);
    if (featureCoordinates.length > 0) {
      coordinates.push(...featureCoordinates);
    }

    distanceKm += getDistanceKmFromLineGeometry(feature.geometry);

    if (!status) {
      status = getFirstStringProperty(feature.properties, [
        'status',
        'routeStatus',
        'state',
        'situation',
      ]);
    }
    if (!observation) {
      observation = getFirstStringProperty(feature.properties, [
        'observation',
        'observations',
        'notes',
        'note',
      ]);
    }
    if (fallbackDistance === undefined) {
      fallbackDistance = getFirstNumericProperty(feature.properties, [
        'distanceKm',
        'distance_km',
        'distance',
      ]);
    }
  });

  const normalizedDistanceKm =
    distanceKm > 0
      ? distanceKm
      : fallbackDistance && fallbackDistance > 0
        ? fallbackDistance > 1000
          ? fallbackDistance / 1000
          : fallbackDistance
        : null;

  return {
    pointCount: coordinates.length,
    distanceKm: normalizedDistanceKm,
    startCoordinate: coordinates.length > 0 ? coordinates[0] : null,
    destinationCoordinate: coordinates.length > 0 ? coordinates[coordinates.length - 1] : null,
    status,
    observation,
  };
};

const getFarmCentroidCoordinate = (farm?: Farm): LngLatCoordinate | null => {
  if (!farm?.plots?.length) return null;

  const plotFeatures: GeoJSON.Feature[] = [];
  farm.plots.forEach((plot) => {
    if (!plot.geoJson?.features?.length) return;
    plotFeatures.push(...plot.geoJson.features);
  });

  if (plotFeatures.length === 0) return null;

  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: plotFeatures,
  };

  const centroid = turf.centroid(featureCollection);
  return toLngLatCoordinate(centroid.geometry.coordinates);
};

const buildRouteLabel = (route: RouteWithRelations, index: number) => {
  if (route.name?.trim()) return route.name.trim();
  return `Rota ${index + 1}`;
};

const logIrAgoraDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[IrAgora][DEV]', message, data);
  }
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutErrorMessage = 'location-timeout'
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutErrorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const isValidNavigationCoordinate = (coordinate: MapNavigationCoordinate) => {
  return (
    Number.isFinite(coordinate.longitude) &&
    Number.isFinite(coordinate.latitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180 &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90
  );
};

const toNavigationCoordinate = (location: Location.LocationObject | null) => {
  if (!location?.coords) return null;

  const coordinate: MapNavigationCoordinate = {
    longitude: location.coords.longitude,
    latitude: location.coords.latitude,
  };

  return isValidNavigationCoordinate(coordinate) ? coordinate : null;
};

const getCurrentNavigationLocationWithTimeout = async (): Promise<MapNavigationCoordinate> => {
  console.warn('[IrAgora][DEV] checking foreground location permission');
  const currentPermission = await withTimeout(
    Location.getForegroundPermissionsAsync(),
    5000,
    'location-permission-check-timeout'
  );

  console.warn('[IrAgora][DEV] foreground permission status', currentPermission);

  let permissionStatus = currentPermission.status;

  if (permissionStatus !== 'granted') {
    console.warn('[IrAgora][DEV] location permission request started');
    const requestResult = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      10000,
      'location-permission-denied'
    );

    console.warn('[IrAgora][DEV] foreground permission request result', requestResult);
    permissionStatus = requestResult.status;
  }

  if (permissionStatus !== 'granted') {
    throw new Error('location-permission-denied');
  }

  console.warn('[IrAgora][DEV] requesting last known location');
  const lastKnownLocation = await withTimeout(
    Location.getLastKnownPositionAsync({
      maxAge: 120000,
      requiredAccuracy: 2000,
    }),
    LAST_KNOWN_LOCATION_TIMEOUT_MS,
    'last-known-location-timeout'
  );

  console.warn('[IrAgora][DEV] last known location result', lastKnownLocation);
  const lastKnownCoordinate = toNavigationCoordinate(lastKnownLocation);

  if (lastKnownCoordinate) {
    return lastKnownCoordinate;
  }

  console.warn('[IrAgora][DEV] requesting current GPS location');
  const currentLocation = await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
    }),
    CURRENT_LOCATION_TIMEOUT_MS,
    'location-timeout'
  );

  console.warn('[IrAgora][DEV] current GPS location result', currentLocation);
  const currentCoordinate = toNavigationCoordinate(currentLocation);

  if (!currentCoordinate) {
    throw new Error('location-timeout');
  }

  return currentCoordinate;
};

const getNavigationAlertMessage = (error: unknown) => {
  if (error instanceof Error && error.message === 'location-permission-denied') {
    return 'Permissão de localização negada. Ative a localização para calcular a rota.';
  }

  if (error instanceof Error && error.message === 'location-timeout') {
    return 'Não foi possível obter sua localização atual. Verifique se o GPS está ativo e tente novamente.';
  }

  if (error instanceof MapboxDirectionsError && error.code === 'no-route') {
    return MAPBOX_NO_ROUTE_MESSAGE;
  }

  if (error instanceof Error) {
    return ROUTE_CALCULATION_GENERIC_MESSAGE;
  }

  return ROUTE_CALCULATION_GENERIC_MESSAGE;
};

const getRouteComparisonMetric = (route: MapboxDirectionsRoute) => {
  return (
    route.durationSeconds ?? route.duration ?? route.distanceMeters ?? route.distance ?? Infinity
  );
};

const buildOperationalRouteMarkerGeoJson = (
  direction: OperationalRouteDirection | null
): GeoJSON.FeatureCollection<GeoJSON.Point> | null => {
  if (!direction) return null;

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          label: 'Início',
          type: 'operational-start',
        },
        geometry: {
          type: 'Point',
          coordinates: [direction.start.longitude, direction.start.latitude],
        },
      },
      {
        type: 'Feature',
        properties: {
          label: 'Fim',
          type: 'operational-end',
        },
        geometry: {
          type: 'Point',
          coordinates: [direction.end.longitude, direction.end.latitude],
        },
      },
    ],
  };
};

const formatDistance = (distanceKm: number | null) => {
  if (!distanceKm || distanceKm <= 0) return 'N/A';

  if (distanceKm < 1) {
    const meters = distanceKm * 1000;
    return `${meters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m`;
  }

  return `${distanceKm.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} km`;
};

const formatCoordinate = (coordinate: LngLatCoordinate | null) => {
  if (!coordinate) return 'N/A';
  const [longitude, latitude] = coordinate;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

function DetailsField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailsField}>
      <Text style={styles.detailsFieldLabel}>{label}</Text>
      <Text style={styles.detailsFieldValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function BackofficeRoutesMap() {
  const { width } = useWindowDimensions();

  const isTablet = width >= 900;
  const shouldUseTwoColumns = width >= 760;
  const mapCardWidth = isTablet ? '64%' : '100%';
  const detailsCardWidth = isTablet ? '34%' : '100%';
  const gridItemWidth = shouldUseTwoColumns ? '48.6%' : '100%';
  const mapHeight = isTablet ? 440 : 320;
  const hasMapboxToken = Boolean(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);

  const [showFilters, setShowFilters] = useState(isTablet);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState('10');
  const [routeSearch, setRouteSearch] = useState('');
  const [debouncedRouteSearch, setDebouncedRouteSearch] = useState('');
  const [orderBy, setOrderBy] = useState<RouteOrderBy>(RouteOrderBy.CREATEDAT);
  const [orderType, setOrderType] = useState<RouteOrderType>(RouteOrderType.DESC);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [selectedFarmId, setSelectedFarmId] = useState<string | undefined>(undefined);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [farmSearchTerm, setFarmSearchTerm] = useState('');

  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState<GeoJSON.FeatureCollection | null>(null);
  const [navigationSteps, setNavigationSteps] = useState<MapboxNavigationStep[]>([]);
  const [navigationOriginCoordinate, setNavigationOriginCoordinate] =
    useState<MapNavigationCoordinate | null>(null);
  const [isNavigationFullscreenVisible, setIsNavigationFullscreenVisible] = useState(false);
  const [activeOperationalRouteDirection, setActiveOperationalRouteDirection] =
    useState<OperationalRouteDirection | null>(null);
  const [operationalRouteMarkerGeoJson, setOperationalRouteMarkerGeoJson] =
    useState<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(null);
  const [navigationErrorMessage, setNavigationErrorMessage] = useState<string | null>(null);
  const [isFetchingNavigationRoute, setIsFetchingNavigationRoute] = useState(false);

  useEffect(() => {
    if (isTablet) {
      setShowFilters(true);
    }
  }, [isTablet]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRouteSearch(routeSearch.trim());
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [routeSearch]);

  const {
    data: customersData,
    hasNextPage: hasNextPageCustomers,
    fetchNextPage: fetchNextPageCustomers,
    isFetchingNextPage: isFetchingNextPageCustomers,
    isFetching: isFetchingCustomers,
  } = useGetAllCustomersInfinite({
    limit: '10',
    search: customerSearchTerm || undefined,
  });

  const {
    data: farmsData,
    hasNextPage: hasNextPageFarms,
    fetchNextPage: fetchNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    isFetching: isFetchingFarms,
  } = useGetAllFarmsInfinite(selectedCustomerId, {
    limit: '10',
    search: farmSearchTerm || undefined,
    includeCustomer: 'true',
  });

  const {
    data: selectedFarmData,
    isFetching: isFetchingSelectedFarm,
    isError: isSelectedFarmError,
    error: selectedFarmError,
    refetch: refetchSelectedFarm,
  } = useGetFarmById(
    selectedFarmId ?? null,
    {
      includePlots: 'true',
      includeGeoJson: 'true',
      includeCustomer: 'true',
    },
    {
      queryKey: ['backoffice-routes-selected-farm', selectedFarmId],
      enabled: !!selectedFarmId,
    }
  );

  const {
    data: routesData,
    isLoading: isLoadingRoutes,
    isFetching: isFetchingRoutes,
    isError: isRoutesError,
    error: routesError,
    refetch: refetchRoutes,
  } = useGetAllRoutes({
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    page: currentPage.toString(),
    limit,
    search: debouncedRouteSearch || undefined,
    includeFarm: 'true',
    includeCustomer: 'true',
    includeGeoJson: 'true',
    orderBy,
    orderType,
  });

  const listedCustomers: Customer[] = useMemo(() => {
    return (
      ((customersData as InfiniteData<{ data: Customer[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Customer[]) || []
    );
  }, [customersData]);

  const listedFarms: Farm[] = useMemo(() => {
    return (
      ((farmsData as InfiniteData<{ data: Farm[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Farm[]) || []
    );
  }, [farmsData]);

  const customerOptions = useMemo(
    () => [
      { id: 'all', name: 'Todos os clientes' },
      ...listedCustomers.map((item) => ({
        id: item.id,
        name: item.name,
      })),
    ],
    [listedCustomers]
  );

  const farmOptions = useMemo(
    () => [
      { id: 'all', name: 'Todas as fazendas' },
      ...listedFarms.map((item) => ({
        id: item.id,
        name: item.name,
      })),
    ],
    [listedFarms]
  );

  const routeRecords = useMemo<RouteWithRelations[]>(
    () => (routesData?.data as RouteWithRelations[] | undefined) ?? [],
    [routesData?.data]
  );

  const totalPages = routesData?.totalPages ?? 1;
  const totalCount = routesData?.totalCount ?? routeRecords.length;

  useEffect(() => {
    if (routeRecords.length === 0) {
      setSelectedRouteId(null);
      return;
    }

    setSelectedRouteId((previousSelectedRouteId) => {
      if (
        previousSelectedRouteId &&
        routeRecords.some((route) => route.id === previousSelectedRouteId)
      ) {
        return previousSelectedRouteId;
      }

      return routeRecords[0].id;
    });
  }, [routeRecords]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const selectedRoute = useMemo<RouteWithRelations | null>(() => {
    if (routeRecords.length === 0) return null;
    if (!selectedRouteId) return routeRecords[0];

    return routeRecords.find((route) => route.id === selectedRouteId) ?? routeRecords[0];
  }, [routeRecords, selectedRouteId]);

  useEffect(() => {
    if (!__DEV__ || !selectedRoute || !isRecord(selectedRoute)) return;

    const routeRecord = selectedRoute as Record<string, unknown>;
    const candidates: Record<string, unknown> = {};

    ROUTE_GEOMETRY_CANDIDATE_FIELDS.forEach((field) => {
      candidates[field] = summarizeDevRouteFieldValue(routeRecord[field]);
    });

    console.warn('[BackofficeRoutesMap][DEV] Selected route payload diagnostic', {
      routeId: routeRecord.id,
      routeName: routeRecord.name,
      routeKeys: Object.keys(routeRecord),
      candidates,
    });
  }, [selectedRoute]);

  const selectedFarm = selectedFarmData?.farm;
  const selectedFarmPlots = selectedFarm?.plots ?? [];

  const routeStatsById = useMemo(() => {
    const map = new Map<string, RouteGeoStats>();
    routeRecords.forEach((route) => {
      map.set(route.id, extractRouteGeoStats(route.geoJson));
    });
    return map;
  }, [routeRecords]);

  const selectedRouteStats = useMemo<RouteGeoStats>(() => {
    if (!selectedRoute) {
      return {
        pointCount: 0,
        distanceKm: null,
        startCoordinate: null,
        destinationCoordinate: null,
      };
    }

    return routeStatsById.get(selectedRoute.id) ?? extractRouteGeoStats(selectedRoute.geoJson);
  }, [routeStatsById, selectedRoute]);

  const fallbackFarmDestination = useMemo(
    () => getFarmCentroidCoordinate(selectedFarm),
    [selectedFarm]
  );

  const destinationCoordinate = useMemo<MapNavigationCoordinate | null>(() => {
    const routeDestination = selectedRouteStats.destinationCoordinate;
    if (routeDestination) {
      return {
        longitude: routeDestination[0],
        latitude: routeDestination[1],
      };
    }

    if (fallbackFarmDestination) {
      return {
        longitude: fallbackFarmDestination[0],
        latitude: fallbackFarmDestination[1],
      };
    }

    return null;
  }, [fallbackFarmDestination, selectedRouteStats.destinationCoordinate]);

  const operationalRouteDirection = useMemo<OperationalRouteDirection | null>(() => {
    if (!selectedRoute) return null;
    return resolveOperationalRouteDirection(selectedRoute);
  }, [selectedRoute]);

  useEffect(() => {
    setActiveOperationalRouteDirection(operationalRouteDirection);
    setOperationalRouteMarkerGeoJson(buildOperationalRouteMarkerGeoJson(operationalRouteDirection));
  }, [operationalRouteDirection]);

  const routesForMap = useMemo<RouteWithRelations[]>(() => {
    if (selectedRoute) return [selectedRoute];
    return routeRecords;
  }, [selectedRoute, routeRecords]);

  const operationalRouteGeoJson = useMemo(() => {
    return convertDatabaseRoutesToMapViewerRoutesFeatureCollection(routesForMap);
  }, [routesForMap]);

  const handleStartNavigationToRoute = useCallback(async () => {
    const routeDirection = operationalRouteDirection;
    const destinationY = routeDirection?.start;

    if (!routeDirection || !destinationY) {
      logIrAgoraDev('Route start coordinate unavailable', {
        selectedRouteId: selectedRoute?.id,
      });
      Alert.alert('Início da rota indisponível', ROUTE_START_INVALID_MESSAGE);
      return;
    }

    try {
      setIsFetchingNavigationRoute(true);
      setNavigationRoute(null);
      setNavigationSteps([]);
      setNavigationOriginCoordinate(null);
      setIsNavigationFullscreenVisible(false);
      setNavigationErrorMessage(null);

      console.warn('[IrAgora][DEV] Navigation calculation started', {
        selectedRouteId,
        destinationY,
      });

      console.warn('[IrAgora][DEV] destination resolved', {
        destinationY,
      });

      console.warn('[IrAgora][DEV] requesting current location');

      const originX = await getCurrentNavigationLocationWithTimeout();
      setNavigationOriginCoordinate(originX);

      console.warn('[IrAgora][DEV] current location resolved', {
        originX,
      });

      console.warn('[IrAgora][DEV] requesting mapbox directions');

      let mapboxRoute: MapboxDirectionsRoute;

      if (routeDirection.reason === 'explicit-field') {
        mapboxRoute = await getMapboxDirections({
          origin: originX,
          destination: destinationY,
        });
      } else {
        const firstCandidate = await getMapboxDirections({
          origin: originX,
          destination: routeDirection.endpoints.firstEndpoint,
        });

        console.warn('[RouteNavigation][DEV] endpoint candidate route calculated', {
          endpointName: 'firstEndpoint',
          distanceMeters: firstCandidate.distanceMeters,
          durationSeconds: firstCandidate.durationSeconds,
        });

        const lastCandidate = await getMapboxDirections({
          origin: originX,
          destination: routeDirection.endpoints.lastEndpoint,
        });

        console.warn('[RouteNavigation][DEV] endpoint candidate route calculated', {
          endpointName: 'lastEndpoint',
          distanceMeters: lastCandidate.distanceMeters,
          durationSeconds: lastCandidate.durationSeconds,
        });

        const shouldUseFirst =
          getRouteComparisonMetric(firstCandidate) <= getRouteComparisonMetric(lastCandidate);

        const resolvedStart = shouldUseFirst
          ? routeDirection.endpoints.firstEndpoint
          : routeDirection.endpoints.lastEndpoint;
        const resolvedEnd = shouldUseFirst
          ? routeDirection.endpoints.lastEndpoint
          : routeDirection.endpoints.firstEndpoint;
        const resolvedDirection: OperationalRouteDirection = {
          ...routeDirection,
          start: resolvedStart,
          end: resolvedEnd,
        };

        console.warn('[RouteNavigation][DEV] operational start resolved', {
          selectedStartEndpoint: resolvedStart,
          selectedEndEndpoint: resolvedEnd,
          reason: 'shortest-mapbox-route',
        });

        setActiveOperationalRouteDirection(resolvedDirection);
        setOperationalRouteMarkerGeoJson(buildOperationalRouteMarkerGeoJson(resolvedDirection));
        mapboxRoute = shouldUseFirst ? firstCandidate : lastCandidate;
      }

      console.warn('[IrAgora][DEV] mapbox route resolved', {
        distanceMeters: mapboxRoute.distanceMeters,
        durationSeconds: mapboxRoute.durationSeconds,
      });

      setNavigationRoute(mapboxRoute.geoJson);
      setNavigationSteps(mapboxRoute.steps);
      setIsNavigationMode(true);
      setIsNavigationFullscreenVisible(true);
    } catch (error) {
      const message = getNavigationAlertMessage(error);

      setNavigationRoute(null);
      setNavigationSteps([]);
      setNavigationErrorMessage(message);
      console.warn('[IrAgora][DEV] navigation calculation failed', error);
      Alert.alert('Não foi possível calcular a rota', message);
    } finally {
      console.warn('[IrAgora][DEV] navigation calculation finished');
      setIsFetchingNavigationRoute(false);
    }
  }, [operationalRouteDirection, selectedRoute?.id, selectedRouteId]);

  const handleCustomerSelect = (value?: string) => {
    const nextCustomerId = !value || value === 'all' ? undefined : value;

    setSelectedCustomerId(nextCustomerId);
    setSelectedFarmId(undefined);
    setSelectedRouteId(null);
    setCurrentPage(1);
    setIsNavigationMode(false);
    setNavigationRoute(null);
    setNavigationSteps([]);
    setNavigationOriginCoordinate(null);
    setIsNavigationFullscreenVisible(false);
    setNavigationErrorMessage(null);
  };

  const handleFarmSelect = (value?: string) => {
    const nextFarmId = !value || value === 'all' ? undefined : value;

    setSelectedFarmId(nextFarmId);
    setSelectedRouteId(null);
    setCurrentPage(1);
    setIsNavigationMode(false);
    setNavigationRoute(null);
    setNavigationSteps([]);
    setNavigationOriginCoordinate(null);
    setIsNavigationFullscreenVisible(false);
    setNavigationErrorMessage(null);
  };

  const clearFilters = () => {
    setRouteSearch('');
    setDebouncedRouteSearch('');
    setSelectedCustomerId(undefined);
    setSelectedFarmId(undefined);
    setSelectedRouteId(null);
    setCurrentPage(1);
    setLimit('10');
    setOrderBy(RouteOrderBy.CREATEDAT);
    setOrderType(RouteOrderType.DESC);
    setCustomerSearchTerm('');
    setFarmSearchTerm('');
    setIsNavigationMode(false);
    setNavigationRoute(null);
    setNavigationSteps([]);
    setNavigationOriginCoordinate(null);
    setIsNavigationFullscreenVisible(false);
    setNavigationErrorMessage(null);
  };

  const activeFilters = useMemo(() => {
    return [
      !!routeSearch.trim() && 'Busca',
      !!selectedCustomerId && 'Cliente',
      !!selectedFarmId && 'Fazenda',
      orderBy !== RouteOrderBy.CREATEDAT && 'Ordenacao',
      orderType !== RouteOrderType.DESC && 'Direcao',
      limit !== '10' && 'Limite',
    ].filter(Boolean) as string[];
  }, [routeSearch, selectedCustomerId, selectedFarmId, orderBy, orderType, limit]);

  const selectedRouteCustomerName =
    selectedRoute?.customer?.name || selectedFarm?.customer?.name || 'Cliente nao informado';
  const selectedRouteFarmName = selectedRoute?.farm?.name || selectedFarm?.name || 'Fazenda N/A';

  const shouldShowMapViewer =
    hasMapboxToken && !isSelectedFarmError && (Boolean(selectedFarmId) || Boolean(selectedRoute));

  useEffect(() => {
    if (!__DEV__) return;

    console.warn('[Backoffice Routes][DEV] route query', {
      apiBaseUrl: process.env.EXPO_PUBLIC_DS_CONTROL_API_URL,
      params: {
        customerId: selectedCustomerId,
        farmId: selectedFarmId,
        page: currentPage.toString(),
        limit,
        search: debouncedRouteSearch || undefined,
        includeFarm: 'true',
        includeCustomer: 'true',
        includeGeoJson: 'true',
        orderBy,
        orderType,
      },
    });
  }, [
    currentPage,
    debouncedRouteSearch,
    limit,
    orderBy,
    orderType,
    selectedCustomerId,
    selectedFarmId,
  ]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Rotas e mapa - Backoffice</Text>
        <Text style={styles.headerSubtitle}>
          Selecione cliente/fazenda, visualize rotas operacionais e use navegação interna.
        </Text>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Filtros</Text>
          {!isTablet && (
            <TouchableOpacity
              onPress={() => setShowFilters((previous) => !previous)}
              style={styles.toggleFiltersButton}
            >
              <Text style={styles.toggleFiltersButtonText}>
                {showFilters ? 'Ocultar' : 'Mostrar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showFilters && (
          <View style={styles.filterContent}>
            <View style={styles.fullWidthField}>
              <Text style={styles.filterLabel}>Busca de rota</Text>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  value={routeSearch}
                  onChangeText={(value) => {
                    setRouteSearch(value);
                    setCurrentPage(1);
                  }}
                  placeholder='Nome da rota, fazenda ou cliente...'
                  placeholderTextColor={COLORS.gray}
                  style={styles.searchInput}
                />
              </View>
            </View>

            <View style={[styles.filterField, { width: gridItemWidth }]}>
              <Text style={styles.filterLabel}>Cliente</Text>
              <SearchableSelectQuery
                value={selectedCustomerId || 'all'}
                listedData={customerOptions}
                onSearchChange={setCustomerSearchTerm}
                onItemSelect={(value) => handleCustomerSelect(value)}
                itemKey='name'
                hasNextPage={hasNextPageCustomers}
                fetchNextPage={fetchNextPageCustomers}
                isFetchingNextPage={isFetchingNextPageCustomers}
                isFetching={isFetchingCustomers}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: gridItemWidth }]}>
              <Text style={styles.filterLabel}>Fazenda</Text>
              <SearchableSelectQuery
                value={selectedFarmId || 'all'}
                listedData={farmOptions}
                onSearchChange={setFarmSearchTerm}
                onItemSelect={(value) => handleFarmSelect(value)}
                itemKey='name'
                hasNextPage={hasNextPageFarms}
                fetchNextPage={fetchNextPageFarms}
                isFetchingNextPage={isFetchingNextPageFarms}
                isFetching={isFetchingFarms}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: gridItemWidth }]}>
              <Text style={styles.filterLabel}>Ordenacao</Text>
              <SearchableSelectQuery
                value={orderBy}
                listedData={routeOrderByOptions}
                onItemSelect={(value) => {
                  setOrderBy((value as RouteOrderBy) || RouteOrderBy.CREATEDAT);
                  setCurrentPage(1);
                }}
                itemKey='label'
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: gridItemWidth }]}>
              <Text style={styles.filterLabel}>Direcao</Text>
              <SearchableSelectQuery
                value={orderType}
                listedData={routeOrderTypeOptions}
                onItemSelect={(value) => {
                  setOrderType((value as RouteOrderType) || RouteOrderType.DESC);
                  setCurrentPage(1);
                }}
                itemKey='label'
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: gridItemWidth }]}>
              <Text style={styles.filterLabel}>Limite</Text>
              <SearchableSelectQuery
                value={limit}
                listedData={routeLimitOptions}
                onItemSelect={(value) => {
                  setLimit(value || '10');
                  setCurrentPage(1);
                }}
                itemKey='label'
                disabled={false}
              />
            </View>

            <View style={styles.clearButtonRow}>
              <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
                <Feather name='x-circle' size={14} color={COLORS.blue} />
                <Text style={styles.clearButtonText}>Limpar filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeFilters.length > 0 && (
          <Text style={styles.activeFiltersText}>
            {activeFilters.length} filtro(s) ativo(s): {activeFilters.join(', ')}
          </Text>
        )}
      </View>

      <View style={styles.mapAndDetailsSection}>
        <View style={[styles.mapCard, { width: mapCardWidth }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mapa de rotas</Text>
            {selectedRoute ? (
              <Text style={styles.sectionSubtitle} numberOfLines={1}>
                {buildRouteLabel(
                  selectedRoute,
                  Math.max(
                    0,
                    routeRecords.findIndex((route) => route.id === selectedRoute.id)
                  )
                )}
              </Text>
            ) : (
              <Text style={styles.sectionSubtitle}>Selecione uma rota para visualizar</Text>
            )}
          </View>

          {selectedFarmId && isSelectedFarmError ? (
            <View style={[styles.errorStateCard, { height: mapHeight }]}>
              <Text style={styles.errorStateTitle}>Erro ao carregar dados da fazenda</Text>
              <Text style={styles.errorStateMessage}>
                {selectedFarmError?.message || 'Nao foi possivel carregar os talhoes para o mapa.'}
              </Text>
              <TouchableOpacity onPress={() => refetchSelectedFarm()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : !hasMapboxToken ? (
            <View style={[styles.warningStateCard, { height: mapHeight }]}>
              <Ionicons name='warning-outline' size={34} color='#92400E' />
              <Text style={styles.warningStateTitle}>Mapa indisponivel</Text>
              <Text style={styles.warningStateMessage}>
                Defina EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN para habilitar a visualizacao do mapa no
                mobile.
              </Text>
            </View>
          ) : shouldShowMapViewer ? (
            <View style={{ height: mapHeight, borderRadius: 10, overflow: 'hidden' }}>
              <MapViewer
                isFetching={isFetchingSelectedFarm || isFetchingRoutes || isFetchingNavigationRoute}
                selectedFarmId={selectedFarmId || null}
                plots={selectedFarmPlots}
                routes={routesForMap}
                navigationRoute={navigationRoute}
                operationalRouteMarkers={operationalRouteMarkerGeoJson}
                showMapTools={Boolean(selectedFarmId)}
                showRoute={routesForMap.length > 0}
                showNavigationRoute={Boolean(navigationRoute)}
                isNavigationMode={isNavigationMode}
              />
              <MapNavigationButton
                isNavigationMode={isNavigationMode}
                onToggleNavigationMode={() => setIsNavigationMode((previous) => !previous)}
                disabled={!operationalRouteDirection}
                showGoNow={Boolean(operationalRouteDirection)}
                goNowDisabled={!operationalRouteDirection}
                goNowLoading={isFetchingNavigationRoute}
                onGoNow={handleStartNavigationToRoute}
              />
            </View>
          ) : (
            <View style={[styles.emptyStateCard, { height: mapHeight }]}>
              <MaterialCommunityIcons name='map-search-outline' size={34} color={COLORS.gray} />
              <Text style={styles.emptyStateTitle}>Nenhuma rota para exibir no mapa</Text>
              <Text style={styles.emptyStateDescription}>
                Selecione uma rota na listagem abaixo. A fazenda e opcional e melhora o foco de
                talhoes no mapa.
              </Text>
            </View>
          )}

          {!selectedFarmId && (
            <View style={styles.optionalFarmHint}>
              <Ionicons name='information-circle-outline' size={16} color={COLORS.blue} />
              <Text style={styles.optionalFarmHintText}>
                Filtro de fazenda opcional: use para melhorar o foco do mapa e mostrar talhoes.
              </Text>
            </View>
          )}

          {navigationErrorMessage ? (
            <Text style={styles.navigationErrorMessage}>{navigationErrorMessage}</Text>
          ) : null}
        </View>

        <View style={[styles.detailsCard, { width: detailsCardWidth }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Detalhes da rota</Text>
            <Text style={styles.sectionSubtitle}>Dados operacionais da selecao atual</Text>
          </View>

          {!selectedRoute ? (
            <View style={styles.detailsEmptyState}>
              <MaterialCommunityIcons name='information-outline' size={24} color={COLORS.gray} />
              <Text style={styles.detailsEmptyStateText}>
                Escolha uma rota na listagem para visualizar nome, distancia, pontos e coordenadas.
              </Text>
            </View>
          ) : (
            <View style={styles.detailsGrid}>
              <DetailsField label='Nome da rota' value={buildRouteLabel(selectedRoute, 0)} />
              <DetailsField label='Fazenda' value={selectedRouteFarmName} />
              <DetailsField label='Cliente' value={selectedRouteCustomerName} />
              <DetailsField
                label='Distancia aproximada'
                value={formatDistance(selectedRouteStats.distanceKm)}
              />
              <DetailsField
                label='Quantidade de pontos'
                value={selectedRouteStats.pointCount.toLocaleString('pt-BR')}
              />
              <DetailsField
                label='Ponto inicial'
                value={formatCoordinate(selectedRouteStats.startCoordinate)}
              />
              <DetailsField
                label='Destino da navegacao'
                value={formatCoordinate(
                  destinationCoordinate
                    ? [destinationCoordinate.longitude, destinationCoordinate.latitude]
                    : null
                )}
              />
              <DetailsField label='Status' value={selectedRouteStats.status || 'Nao informado'} />
              <DetailsField
                label='Observacoes'
                value={selectedRouteStats.observation || 'Sem observacoes'}
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.routesListCard}>
        <View style={styles.routesListHeader}>
          <Text style={styles.routesListTitle}>Rotas backoffice</Text>
          <Text style={styles.routesListCount}>{totalCount.toLocaleString('pt-BR')} rotas</Text>
        </View>
        <Text style={styles.routesListSubtitle}>
          {selectedFarmId
            ? 'Lista filtrada pela fazenda selecionada.'
            : 'Lista geral de rotas. Selecione uma fazenda para filtrar.'}
        </Text>

        {isLoadingRoutes ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size='large' color={COLORS.blue} />
            <Text style={styles.loadingStateText}>Carregando rotas...</Text>
          </View>
        ) : isRoutesError ? (
          <View style={styles.errorStateCard}>
            <Text style={styles.errorStateTitle}>Erro ao carregar rotas</Text>
            <Text style={styles.errorStateMessage}>
              {routesError?.message || 'Nao foi possivel buscar as rotas da fazenda.'}
            </Text>
            <TouchableOpacity onPress={() => refetchRoutes()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : routeRecords.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <MaterialCommunityIcons name='map-marker-off-outline' size={28} color={COLORS.gray} />
            <Text style={styles.emptyStateTitle}>Nenhuma rota encontrada</Text>
            <Text style={styles.emptyStateDescription}>
              Ajuste a busca/filtros ou selecione outra fazenda para visualizar rotas.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.routesGrid}>
              {routeRecords.map((route, index) => {
                const routeStats =
                  routeStatsById.get(route.id) ?? extractRouteGeoStats(route.geoJson);
                const isSelected = selectedRoute?.id === route.id;

                return (
                  <TouchableOpacity
                    key={route.id}
                    onPress={() => setSelectedRouteId(route.id)}
                    style={[
                      styles.routeCard,
                      { width: gridItemWidth },
                      isSelected ? styles.routeCardSelected : undefined,
                    ]}
                  >
                    <View style={styles.routeCardHeader}>
                      <Text style={styles.routeCardTitle} numberOfLines={1}>
                        {buildRouteLabel(route, index)}
                      </Text>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>Selecionada</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.routeCardSubline} numberOfLines={1}>
                      {route.customer?.name ||
                        selectedFarm?.customer?.name ||
                        'Cliente nao informado'}
                    </Text>
                    <Text style={styles.routeCardSubline} numberOfLines={1}>
                      {route.farm?.name || selectedFarm?.name || 'Fazenda nao informada'}
                    </Text>

                    <View style={styles.routeMetaRow}>
                      <View style={styles.routeMetaChip}>
                        <MaterialCommunityIcons
                          name='map-marker-path'
                          size={13}
                          color={COLORS.blue}
                        />
                        <Text style={styles.routeMetaChipText}>
                          {routeStats.pointCount.toLocaleString('pt-BR')} pontos
                        </Text>
                      </View>
                      <View style={styles.routeMetaChip}>
                        <MaterialCommunityIcons name='ruler' size={13} color={COLORS.blue} />
                        <Text style={styles.routeMetaChipText}>
                          {formatDistance(routeStats.distanceKm)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {totalPages > 1 && (
              <View style={styles.paginationWrap}>
                <Text style={styles.paginationText}>
                  Pagina {currentPage} de {totalPages} | {totalCount.toLocaleString('pt-BR')} rotas
                </Text>

                <View style={styles.paginationButtons}>
                  <TouchableOpacity
                    onPress={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    style={[
                      styles.paginationButton,
                      currentPage === 1
                        ? styles.paginationButtonDisabled
                        : styles.paginationButtonEnabled,
                    ]}
                  >
                    <Feather
                      name='chevrons-left'
                      size={16}
                      color={currentPage === 1 ? COLORS.gray : COLORS.white}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                    disabled={currentPage === 1}
                    style={[
                      styles.paginationButton,
                      currentPage === 1
                        ? styles.paginationButtonDisabled
                        : styles.paginationButtonEnabled,
                    ]}
                  >
                    <Feather
                      name='chevron-left'
                      size={16}
                      color={currentPage === 1 ? COLORS.gray : COLORS.white}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                    disabled={currentPage === totalPages}
                    style={[
                      styles.paginationButton,
                      currentPage === totalPages
                        ? styles.paginationButtonDisabled
                        : styles.paginationButtonEnabled,
                    ]}
                  >
                    <Feather
                      name='chevron-right'
                      size={16}
                      color={currentPage === totalPages ? COLORS.gray : COLORS.white}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    style={[
                      styles.paginationButton,
                      currentPage === totalPages
                        ? styles.paginationButtonDisabled
                        : styles.paginationButtonEnabled,
                    ]}
                  >
                    <Feather
                      name='chevrons-right'
                      size={16}
                      color={currentPage === totalPages ? COLORS.gray : COLORS.white}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      <NavigationMapFullscreen
        visible={isNavigationFullscreenVisible}
        onClose={() => setIsNavigationFullscreenVisible(false)}
        navigationRoute={navigationRoute as GeoJSON.FeatureCollection<GeoJSON.LineString> | null}
        operationalRoute={operationalRouteGeoJson}
        operationalRouteMarkers={operationalRouteMarkerGeoJson}
        steps={navigationSteps}
        originCoordinate={navigationOriginCoordinate}
        startCoordinate={activeOperationalRouteDirection?.start ?? null}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 12,
    gap: 12,
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    padding: 12,
  },
  headerTitle: {
    color: COLORS.black,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 4,
    color: COLORS.gray,
    fontSize: 13,
  },
  filterCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleFiltersButton: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleFiltersButtonText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  filterContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  fullWidthField: {
    width: '100%',
    gap: 6,
  },
  filterField: {
    gap: 6,
  },
  filterLabel: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  searchInputWrapper: {
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 10,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    color: COLORS.black,
    fontSize: 15,
  },
  clearButtonRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  activeFiltersText: {
    color: COLORS.blue,
    fontSize: 12,
  },
  mapAndDetailsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mapCard: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    padding: 10,
    gap: 10,
  },
  detailsCard: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    padding: 10,
    gap: 10,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: COLORS.gray,
    fontSize: 12,
  },
  emptyStateCard: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: COLORS.white,
  },
  emptyStateTitle: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateDescription: {
    color: COLORS.gray,
    fontSize: 13,
    textAlign: 'center',
  },
  warningStateCard: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFBEB',
  },
  warningStateTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  warningStateMessage: {
    color: '#B45309',
    fontSize: 13,
    textAlign: 'center',
  },
  errorStateCard: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FEF2F2',
  },
  errorStateTitle: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorStateMessage: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF5F5',
  },
  retryButtonText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  navigationErrorMessage: {
    color: '#B45309',
    fontSize: 12,
    marginTop: 2,
  },
  optionalFarmHint: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionalFarmHintText: {
    color: '#1D4ED8',
    fontSize: 12,
    flex: 1,
  },
  detailsEmptyState: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  detailsEmptyStateText: {
    color: COLORS.gray,
    fontSize: 13,
    textAlign: 'center',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailsField: {
    width: '48.6%',
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
  },
  detailsFieldLabel: {
    color: COLORS.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  detailsFieldValue: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '700',
  },
  routesListCard: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    padding: 12,
    gap: 10,
  },
  routesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  routesListTitle: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  routesListSubtitle: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: -2,
  },
  routesListCount: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  loadingStateText: {
    color: COLORS.gray,
    fontSize: 13,
  },
  routesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  routeCard: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.white,
  },
  routeCardSelected: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.lightblue,
  },
  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  routeCardTitle: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  selectedBadge: {
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  selectedBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  routeCardSubline: {
    color: COLORS.gray,
    fontSize: 12,
  },
  routeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  routeMetaChip: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
  },
  routeMetaChipText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: '600',
  },
  paginationWrap: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  paginationText: {
    flex: 1,
    color: COLORS.gray,
    fontSize: 12,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationButtonEnabled: {
    backgroundColor: COLORS.blue,
  },
  paginationButtonDisabled: {
    backgroundColor: COLORS.lightgray,
  },
});
