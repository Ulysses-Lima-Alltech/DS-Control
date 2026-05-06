import {
  MapboxDirectionsError,
  MapboxDirectionsRoute,
  MapboxNavigationStep,
  MapNavigationCoordinate,
} from '@/types/mapNavigation.type';

type MapboxDirectionsApiManeuver = {
  instruction?: string;
  type?: string;
  modifier?: string;
  location?: [number, number];
};

type MapboxDirectionsApiStep = {
  distance?: number;
  duration?: number;
  maneuver?: MapboxDirectionsApiManeuver;
};

type MapboxDirectionsApiLeg = {
  steps?: MapboxDirectionsApiStep[];
};

type MapboxDirectionsApiRoute = {
  distance?: number;
  duration?: number;
  geometry?: GeoJSON.LineString;
  legs?: MapboxDirectionsApiLeg[];
};

type MapboxDirectionsApiResponse = {
  routes?: MapboxDirectionsApiRoute[];
  code?: string;
  message?: string;
};

const MAPBOX_DIRECTIONS_ENDPOINT = 'https://api.mapbox.com/directions/v5/mapbox/driving';
const MAPBOX_DIRECTIONS_TIMEOUT_MS = 15000;
const MAPBOX_NO_ROUTE_CODES = ['NoRoute', 'NoSegment', 'ProfileNotFound'];
const MAPBOX_NO_ROUTE_MESSAGE =
  'A Mapbox não encontrou uma rota viária até o início da operação. Tente ajustar sua localização ou selecione outra rota.';
const MAPBOX_TIMEOUT_MESSAGE =
  'Não foi possível calcular a rota até o início da operação. Verifique sua localização e tente novamente.';

const isValidCoordinate = (coordinate: MapNavigationCoordinate) => {
  return (
    Number.isFinite(coordinate.longitude) &&
    Number.isFinite(coordinate.latitude) &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180 &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90
  );
};

const formatCoordinate = (value: number) => value.toFixed(6);

const buildDirectionsUrl = (
  origin: MapNavigationCoordinate,
  destination: MapNavigationCoordinate,
  accessToken: string
) => {
  const coordinatePath = [
    `${formatCoordinate(origin.longitude)},${formatCoordinate(origin.latitude)}`,
    `${formatCoordinate(destination.longitude)},${formatCoordinate(destination.latitude)}`,
  ].join(';');

  const searchParams = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    access_token: accessToken,
  });

  return `${MAPBOX_DIRECTIONS_ENDPOINT}/${coordinatePath}?${searchParams.toString()}`;
};

const removeAccessTokenFromUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.delete('access_token');
    return parsedUrl.toString();
  } catch {
    return url.replace(/([?&]access_token=)[^&]+/i, '$1[removed]');
  }
};

const logMapboxDirectionsDev = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    console.warn('[MapboxDirections][DEV]', message, data);
  }
};

const isNoRouteCode = (code?: string) => Boolean(code && MAPBOX_NO_ROUTE_CODES.includes(code));

const readMapboxResponse = async (response: Response): Promise<MapboxDirectionsApiResponse> => {
  try {
    return (await response.json()) as MapboxDirectionsApiResponse;
  } catch {
    return {};
  }
};

const buildNavigationRouteGeoJson = (
  geometry: GeoJSON.LineString,
  distance?: number,
  duration?: number
): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        type: 'navigation',
        distance,
        duration,
      },
      geometry,
    },
  ],
});

const normalizeDirectionsSteps = (steps?: MapboxDirectionsApiStep[]): MapboxNavigationStep[] => {
  if (!Array.isArray(steps)) return [];

  const normalizedSteps: MapboxNavigationStep[] = [];

  steps.forEach((step) => {
    const location = step.maneuver?.location;
    if (!Array.isArray(location) || location.length < 2) return;

    const longitude = Number(location[0]);
    const latitude = Number(location[1]);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      return;
    }

    normalizedSteps.push({
      instruction: step.maneuver?.instruction || '',
      distanceMeters: Number(step.distance ?? 0),
      durationSeconds: Number(step.duration ?? 0),
      maneuverType: step.maneuver?.type,
      maneuverModifier: step.maneuver?.modifier,
      maneuverLocation: {
        longitude,
        latitude,
      },
    });
  });

  return normalizedSteps;
};

export async function getMapboxDrivingDirections(
  origin: MapNavigationCoordinate,
  destination: MapNavigationCoordinate
): Promise<MapboxDirectionsRoute> {
  const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    const error = new MapboxDirectionsError('Token Mapbox não configurado.', 'missing-token');
    logMapboxDirectionsDev('request failed', { code: error.code, error: error.message });
    throw error;
  }

  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    const error = new MapboxDirectionsError(
      'Coordenadas inválidas para calcular a rota.',
      'invalid-coordinate'
    );
    logMapboxDirectionsDev('request failed', { code: error.code, origin, destination });
    throw error;
  }

  const url = buildDirectionsUrl(origin, destination, accessToken);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MAPBOX_DIRECTIONS_TIMEOUT_MS);

  logMapboxDirectionsDev('request started', {
    origin,
    destination,
    url: removeAccessTokenFromUrl(url),
    timeoutMs: MAPBOX_DIRECTIONS_TIMEOUT_MS,
  });

  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await readMapboxResponse(response);

    logMapboxDirectionsDev('response status', {
      status: response.status,
      ok: response.ok,
      code: data.code,
      message: data.message,
      routesCount: data.routes?.length ?? 0,
    });

    if (isNoRouteCode(data.code)) {
      throw new MapboxDirectionsError(MAPBOX_NO_ROUTE_MESSAGE, 'no-route', data.code);
    }

    if (!response.ok) {
      throw new MapboxDirectionsError(
        data.message || 'Não foi possível calcular a rota pelo Mapbox.',
        'http-error',
        data.code
      );
    }

    const route = data.routes?.[0];

    if (!route?.geometry || route.geometry.type !== 'LineString') {
      throw new MapboxDirectionsError(
        isNoRouteCode(data.code)
          ? MAPBOX_NO_ROUTE_MESSAGE
          : data.message || MAPBOX_NO_ROUTE_MESSAGE,
        isNoRouteCode(data.code) ? 'no-route' : 'invalid-response',
        data.code
      );
    }

    logMapboxDirectionsDev('route resolved', {
      distance: route.distance,
      duration: route.duration,
      coordinateCount: route.geometry.coordinates.length,
      stepsCount: route.legs?.[0]?.steps?.length ?? 0,
    });

    const steps = normalizeDirectionsSteps(route.legs?.[0]?.steps);

    return {
      geoJson: buildNavigationRouteGeoJson(route.geometry, route.distance, route.duration),
      distance: route.distance,
      duration: route.duration,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      steps,
    };
  } catch (error) {
    if (error instanceof MapboxDirectionsError) {
      logMapboxDirectionsDev('request failed', {
        code: error.code,
        mapboxCode: error.mapboxCode,
        message: error.message,
      });
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new MapboxDirectionsError(MAPBOX_TIMEOUT_MESSAGE, 'timeout');
      logMapboxDirectionsDev('request failed', {
        code: timeoutError.code,
        timeoutMs: MAPBOX_DIRECTIONS_TIMEOUT_MS,
        message: timeoutError.message,
      });
      throw timeoutError;
    }

    logMapboxDirectionsDev('request failed', { error });
    throw new MapboxDirectionsError('Não foi possível calcular a rota pelo Mapbox.', 'unknown');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getMapboxDirections({
  origin,
  destination,
}: {
  origin: MapNavigationCoordinate;
  destination: MapNavigationCoordinate;
}): Promise<MapboxDirectionsRoute> {
  return getMapboxDrivingDirections(origin, destination);
}
