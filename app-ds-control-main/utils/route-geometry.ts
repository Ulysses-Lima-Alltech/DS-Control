import * as turf from '@turf/turf';

export type LngLatCoordinate = [number, number];

type Orientation = 'direct' | 'swapped';

type CoordinateOption = {
  direct: LngLatCoordinate | null;
  swapped: LngLatCoordinate | null;
};

type CoordinateObject = Record<string, unknown>;

export type RouteGeometryNormalizationResult = {
  featureCollection: GeoJSON.FeatureCollection | null;
  coordinates: LngLatCoordinate[];
  startCoordinate: LngLatCoordinate | null;
  destinationCoordinate: LngLatCoordinate | null;
  navigationStartCoordinate: LngLatCoordinate | null;
  pointCount: number;
  invalidPointCount: number;
  invertedLatLng: boolean;
  source: string | null;
};

const START_COORDINATE_KEYS = [
  'start',
  'startPoint',
  'startCoordinate',
  'initialPoint',
  'initialCoordinate',
  'entryPoint',
  'entrancePoint',
  'origin',
];

const ROUTE_GEOMETRY_KEYS = ['geoJson', 'geojson', 'geometry'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value);
    if (Number.isFinite(parsedValue)) return parsedValue;
  }
  return null;
};

const isValidLongitude = (value: number) => Number.isFinite(value) && Math.abs(value) <= 180;
const isValidLatitude = (value: number) => Number.isFinite(value) && Math.abs(value) <= 90;

const isValidLngLatCoordinate = (
  coordinate: LngLatCoordinate | null
): coordinate is LngLatCoordinate =>
  Boolean(coordinate && isValidLongitude(coordinate[0]) && isValidLatitude(coordinate[1]));

const parseJsonIfNeeded = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const toCoordinateFromObject = (value: CoordinateObject): LngLatCoordinate | null => {
  const longitude = toFiniteNumber(value.longitude ?? value.lng ?? value.lon ?? value.x);
  const latitude = toFiniteNumber(value.latitude ?? value.lat ?? value.y);

  if (longitude === null || latitude === null) return null;
  if (!isValidLongitude(longitude) || !isValidLatitude(latitude)) return null;

  return [longitude, latitude];
};

const getCoordinateOption = (value: unknown): CoordinateOption | null => {
  const parsedValue = parseJsonIfNeeded(value);

  if (isRecord(parsedValue)) {
    const coordinate = toCoordinateFromObject(parsedValue);
    if (!coordinate) return null;
    return {
      direct: coordinate,
      swapped: null,
    };
  }

  if (!Array.isArray(parsedValue) || parsedValue.length < 2) return null;

  const first = toFiniteNumber(parsedValue[0]);
  const second = toFiniteNumber(parsedValue[1]);
  if (first === null || second === null) return null;

  const direct: LngLatCoordinate | null =
    isValidLongitude(first) && isValidLatitude(second) ? [first, second] : null;
  const swapped: LngLatCoordinate | null =
    isValidLongitude(second) && isValidLatitude(first) ? [second, first] : null;

  if (!direct && !swapped) return null;

  return { direct, swapped };
};

const getDistanceKm = (coordinates: LngLatCoordinate[]) => {
  if (coordinates.length < 2) return 0;

  try {
    return turf.length(turf.lineString(coordinates), { units: 'kilometers' });
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const resolveOrientation = (options: CoordinateOption[]): Orientation => {
  let forcedDirectCount = 0;
  let forcedSwappedCount = 0;

  options.forEach((option) => {
    if (option.direct && !option.swapped) forcedDirectCount += 1;
    if (!option.direct && option.swapped) forcedSwappedCount += 1;
  });

  if (forcedSwappedCount > forcedDirectCount) return 'swapped';
  if (forcedDirectCount > forcedSwappedCount) return 'direct';

  const directCoordinates = options
    .map((option) => option.direct ?? option.swapped)
    .filter(isValidLngLatCoordinate);
  const swappedCoordinates = options
    .map((option) => option.swapped ?? option.direct)
    .filter(isValidLngLatCoordinate);

  if (directCoordinates.length >= 2 && swappedCoordinates.length >= 2) {
    const directDistance = getDistanceKm(directCoordinates);
    const swappedDistance = getDistanceKm(swappedCoordinates);

    if (
      Number.isFinite(directDistance) &&
      Number.isFinite(swappedDistance) &&
      swappedDistance < directDistance * 0.25
    ) {
      return 'swapped';
    }
  }

  return 'direct';
};

const normalizeCoordinateSequence = (
  values: unknown[]
): { coordinates: LngLatCoordinate[]; invalidPointCount: number; invertedLatLng: boolean } => {
  const options = values.map((value) => getCoordinateOption(value));
  const validOptions = options.filter((option): option is CoordinateOption => Boolean(option));

  if (validOptions.length === 0) {
    return {
      coordinates: [],
      invalidPointCount: values.length,
      invertedLatLng: false,
    };
  }

  const orientation = resolveOrientation(validOptions);
  let invalidPointCount = 0;
  let invertedLatLng = false;

  const coordinates = options
    .map((option) => {
      if (!option) {
        invalidPointCount += 1;
        return null;
      }

      const coordinate =
        orientation === 'swapped'
          ? (option.swapped ?? option.direct)
          : (option.direct ?? option.swapped);

      if (!coordinate) {
        invalidPointCount += 1;
        return null;
      }

      const usedSwapped =
        Boolean(option.swapped) &&
        (!option.direct || (orientation === 'swapped' && option.swapped === coordinate));

      if (usedSwapped) invertedLatLng = true;
      return coordinate;
    })
    .filter(isValidLngLatCoordinate);

  return {
    coordinates,
    invalidPointCount,
    invertedLatLng,
  };
};

const normalizeGeometry = (
  geometry: unknown
): {
  geometry: GeoJSON.Geometry | null;
  coordinates: LngLatCoordinate[];
  invalidPointCount: number;
  invertedLatLng: boolean;
} => {
  const parsedGeometry = parseJsonIfNeeded(geometry);
  if (!isRecord(parsedGeometry) || typeof parsedGeometry.type !== 'string') {
    return {
      geometry: null,
      coordinates: [],
      invalidPointCount: 0,
      invertedLatLng: false,
    };
  }

  switch (parsedGeometry.type) {
    case 'Point': {
      const result = normalizeCoordinateSequence([parsedGeometry.coordinates]);
      return {
        geometry:
          result.coordinates.length === 1
            ? { type: 'Point', coordinates: result.coordinates[0] }
            : null,
        coordinates: result.coordinates,
        invalidPointCount: result.invalidPointCount,
        invertedLatLng: result.invertedLatLng,
      };
    }
    case 'MultiPoint':
    case 'LineString': {
      const result = normalizeCoordinateSequence(
        Array.isArray(parsedGeometry.coordinates) ? parsedGeometry.coordinates : []
      );
      const minPoints = parsedGeometry.type === 'LineString' ? 2 : 1;

      return {
        geometry:
          result.coordinates.length >= minPoints
            ? { type: parsedGeometry.type, coordinates: result.coordinates }
            : null,
        coordinates: result.coordinates,
        invalidPointCount: result.invalidPointCount,
        invertedLatLng: result.invertedLatLng,
      };
    }
    case 'MultiLineString': {
      const rawLines = Array.isArray(parsedGeometry.coordinates) ? parsedGeometry.coordinates : [];
      const normalizedLines = rawLines
        .map((line) => normalizeCoordinateSequence(Array.isArray(line) ? line : []))
        .filter((line) => line.coordinates.length >= 2);

      return {
        geometry:
          normalizedLines.length > 0
            ? {
                type: 'MultiLineString',
                coordinates: normalizedLines.map((line) => line.coordinates),
              }
            : null,
        coordinates: normalizedLines.flatMap((line) => line.coordinates),
        invalidPointCount: normalizedLines.reduce(
          (total, line) => total + line.invalidPointCount,
          0
        ),
        invertedLatLng: normalizedLines.some((line) => line.invertedLatLng),
      };
    }
    case 'Polygon': {
      const rawRings = Array.isArray(parsedGeometry.coordinates) ? parsedGeometry.coordinates : [];
      const normalizedRings = rawRings
        .map((ring) => normalizeCoordinateSequence(Array.isArray(ring) ? ring : []))
        .filter((ring) => ring.coordinates.length >= 4);

      return {
        geometry:
          normalizedRings.length > 0
            ? {
                type: 'Polygon',
                coordinates: normalizedRings.map((ring) => ring.coordinates),
              }
            : null,
        coordinates: normalizedRings.flatMap((ring) => ring.coordinates),
        invalidPointCount: normalizedRings.reduce(
          (total, ring) => total + ring.invalidPointCount,
          0
        ),
        invertedLatLng: normalizedRings.some((ring) => ring.invertedLatLng),
      };
    }
    case 'MultiPolygon': {
      const rawPolygons = Array.isArray(parsedGeometry.coordinates)
        ? parsedGeometry.coordinates
        : [];
      const normalizedPolygons = rawPolygons
        .map((polygon) => {
          const rings = Array.isArray(polygon) ? polygon : [];
          const normalizedRings = rings
            .map((ring) => normalizeCoordinateSequence(Array.isArray(ring) ? ring : []))
            .filter((ring) => ring.coordinates.length >= 4);

          return {
            coordinates: normalizedRings.map((ring) => ring.coordinates),
            flatCoordinates: normalizedRings.flatMap((ring) => ring.coordinates),
            invalidPointCount: normalizedRings.reduce(
              (total, ring) => total + ring.invalidPointCount,
              0
            ),
            invertedLatLng: normalizedRings.some((ring) => ring.invertedLatLng),
          };
        })
        .filter((polygon) => polygon.coordinates.length > 0);

      return {
        geometry:
          normalizedPolygons.length > 0
            ? {
                type: 'MultiPolygon',
                coordinates: normalizedPolygons.map((polygon) => polygon.coordinates),
              }
            : null,
        coordinates: normalizedPolygons.flatMap((polygon) => polygon.flatCoordinates),
        invalidPointCount: normalizedPolygons.reduce(
          (total, polygon) => total + polygon.invalidPointCount,
          0
        ),
        invertedLatLng: normalizedPolygons.some((polygon) => polygon.invertedLatLng),
      };
    }
    case 'GeometryCollection': {
      const geometries = Array.isArray(parsedGeometry.geometries) ? parsedGeometry.geometries : [];
      const normalizedItems = geometries
        .map((item) => normalizeGeometry(item))
        .filter((item) => item.geometry);

      return {
        geometry:
          normalizedItems.length > 0
            ? {
                type: 'GeometryCollection',
                geometries: normalizedItems.map((item) => item.geometry as GeoJSON.Geometry),
              }
            : null,
        coordinates: normalizedItems.flatMap((item) => item.coordinates),
        invalidPointCount: normalizedItems.reduce(
          (total, item) => total + item.invalidPointCount,
          0
        ),
        invertedLatLng: normalizedItems.some((item) => item.invertedLatLng),
      };
    }
    default:
      return {
        geometry: null,
        coordinates: [],
        invalidPointCount: 0,
        invertedLatLng: false,
      };
  }
};

const toFeature = (
  geometry: GeoJSON.Geometry,
  properties?: Record<string, unknown>
): GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>> => ({
  type: 'Feature',
  geometry,
  properties: properties ?? {},
});

const normalizeUnknownFeatureCollection = (
  value: unknown,
  source: string | null = null
): RouteGeometryNormalizationResult => {
  const parsedValue = parseJsonIfNeeded(value);

  if (isRecord(parsedValue)) {
    for (const key of ROUTE_GEOMETRY_KEYS) {
      if (key in parsedValue) {
        return normalizeUnknownFeatureCollection(parsedValue[key], key);
      }
    }
  }

  if (isRecord(parsedValue) && parsedValue.type === 'FeatureCollection') {
    const rawFeatures = Array.isArray(parsedValue.features) ? parsedValue.features : [];
    const normalizedFeatures = rawFeatures
      .map((feature) => {
        if (!isRecord(feature) || feature.type !== 'Feature') return null;

        const normalizedGeometry = normalizeGeometry(feature.geometry);
        if (!normalizedGeometry.geometry) return null;

        return {
          feature: toFeature(
            normalizedGeometry.geometry,
            isRecord(feature.properties) ? feature.properties : {}
          ),
          coordinates: normalizedGeometry.coordinates,
          invalidPointCount: normalizedGeometry.invalidPointCount,
          invertedLatLng: normalizedGeometry.invertedLatLng,
        };
      })
      .filter(
        (
          item
        ): item is {
          feature: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
          coordinates: LngLatCoordinate[];
          invalidPointCount: number;
          invertedLatLng: boolean;
        } => Boolean(item)
      );

    const coordinates = normalizedFeatures.flatMap((item) => item.coordinates);
    const explicitStartCoordinate = extractExplicitStartCoordinate(parsedValue);
    const navigationStartCoordinate = explicitStartCoordinate ?? coordinates[0] ?? null;

    return {
      featureCollection:
        normalizedFeatures.length > 0
          ? {
              type: 'FeatureCollection',
              features: normalizedFeatures.map((item) => item.feature),
            }
          : null,
      coordinates,
      startCoordinate: coordinates[0] ?? null,
      destinationCoordinate: coordinates[coordinates.length - 1] ?? null,
      navigationStartCoordinate,
      pointCount: coordinates.length,
      invalidPointCount: normalizedFeatures.reduce(
        (total, item) => total + item.invalidPointCount,
        0
      ),
      invertedLatLng: normalizedFeatures.some((item) => item.invertedLatLng),
      source,
    };
  }

  if (isRecord(parsedValue) && parsedValue.type === 'Feature') {
    const normalizedGeometry = normalizeGeometry(parsedValue.geometry);
    const coordinates = normalizedGeometry.coordinates;
    const explicitStartCoordinate = extractExplicitStartCoordinate(parsedValue);
    const navigationStartCoordinate = explicitStartCoordinate ?? coordinates[0] ?? null;

    return {
      featureCollection: normalizedGeometry.geometry
        ? {
            type: 'FeatureCollection',
            features: [
              toFeature(
                normalizedGeometry.geometry,
                isRecord(parsedValue.properties) ? parsedValue.properties : {}
              ),
            ],
          }
        : null,
      coordinates,
      startCoordinate: coordinates[0] ?? null,
      destinationCoordinate: coordinates[coordinates.length - 1] ?? null,
      navigationStartCoordinate,
      pointCount: coordinates.length,
      invalidPointCount: normalizedGeometry.invalidPointCount,
      invertedLatLng: normalizedGeometry.invertedLatLng,
      source,
    };
  }

  const normalizedGeometry = normalizeGeometry(parsedValue);
  if (normalizedGeometry.geometry) {
    const explicitStartCoordinate = extractExplicitStartCoordinate(parsedValue);
    const navigationStartCoordinate =
      explicitStartCoordinate ?? normalizedGeometry.coordinates[0] ?? null;

    return {
      featureCollection: {
        type: 'FeatureCollection',
        features: [toFeature(normalizedGeometry.geometry)],
      },
      coordinates: normalizedGeometry.coordinates,
      startCoordinate: normalizedGeometry.coordinates[0] ?? null,
      destinationCoordinate:
        normalizedGeometry.coordinates[normalizedGeometry.coordinates.length - 1] ?? null,
      navigationStartCoordinate,
      pointCount: normalizedGeometry.coordinates.length,
      invalidPointCount: normalizedGeometry.invalidPointCount,
      invertedLatLng: normalizedGeometry.invertedLatLng,
      source,
    };
  }

  if (Array.isArray(parsedValue)) {
    const pointSequence = normalizeCoordinateSequence(parsedValue);
    const inferredGeometry =
      pointSequence.coordinates.length >= 2
        ? ({
            type: 'LineString',
            coordinates: pointSequence.coordinates,
          } satisfies GeoJSON.LineString)
        : pointSequence.coordinates.length === 1
          ? ({
              type: 'Point',
              coordinates: pointSequence.coordinates[0],
            } satisfies GeoJSON.Point)
          : null;

    return {
      featureCollection: inferredGeometry
        ? {
            type: 'FeatureCollection',
            features: [toFeature(inferredGeometry)],
          }
        : null,
      coordinates: pointSequence.coordinates,
      startCoordinate: pointSequence.coordinates[0] ?? null,
      destinationCoordinate:
        pointSequence.coordinates[pointSequence.coordinates.length - 1] ?? null,
      navigationStartCoordinate: pointSequence.coordinates[0] ?? null,
      pointCount: pointSequence.coordinates.length,
      invalidPointCount: pointSequence.invalidPointCount,
      invertedLatLng: pointSequence.invertedLatLng,
      source,
    };
  }

  return {
    featureCollection: null,
    coordinates: [],
    startCoordinate: null,
    destinationCoordinate: null,
    navigationStartCoordinate: null,
    pointCount: 0,
    invalidPointCount: 0,
    invertedLatLng: false,
    source,
  };
};

export const extractExplicitStartCoordinate = (value: unknown): LngLatCoordinate | null => {
  const parsedValue = parseJsonIfNeeded(value);

  if (!isRecord(parsedValue)) return null;

  for (const key of START_COORDINATE_KEYS) {
    if (!(key in parsedValue)) continue;

    const coordinateOption = getCoordinateOption(parsedValue[key]);
    if (coordinateOption?.direct) return coordinateOption.direct;
    if (coordinateOption?.swapped) return coordinateOption.swapped;
  }

  return null;
};

export const normalizeRouteGeometry = (
  routeOrGeometry: unknown
): RouteGeometryNormalizationResult => normalizeUnknownFeatureCollection(routeOrGeometry);
