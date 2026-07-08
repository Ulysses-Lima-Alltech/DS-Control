import { createHash } from 'crypto';

import { kml } from '@tmcw/togeojson';
import { NextRequest, NextResponse } from 'next/server';
import { DOMParser } from 'xmldom';

type FeatureRouteExtractedFromKml = {
  type: 'Feature';
  geometry: {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][] | number[][][];
  };
  properties: {
    name?: string;
    [key: string]: unknown;
  };
};

type ConvertedRouteError = {
  fileName?: string;
  message: string;
};

export type ConvertedRouteData = {
  name: string;
  externalId: string;
  sourceFileName: string;
  geoJson: GeoJSON.FeatureCollection;
  pointCount: number;
  distanceMeters?: number;
  start?: { longitude: number; latitude: number };
  end?: { longitude: number; latitude: number };
};

export type ApiResponse = {
  errors: ConvertedRouteError[];
  routes: ConvertedRouteData[];
};

type RouteConversionResult = {
  errors: ConvertedRouteError[];
  routes: ConvertedRouteData[];
};

const EARTH_RADIUS_METERS = 6371008.8;

function normalizeCoordinates(coords: number[][]): number[][] {
  if (coords.length < 2) return coords;

  let minIndex = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i];
    const [lon0, lat0] = coords[minIndex];
    if (lon1 < lon0 || (lon1 === lon0 && lat1 < lat0)) {
      minIndex = i;
    }
  }

  return [...coords.slice(minIndex), ...coords.slice(0, minIndex)];
}

function toCoordinatePair(position: unknown): number[] | null {
  if (!Array.isArray(position) || position.length < 2) return null;

  const longitude = Number(position[0]);
  const latitude = Number(position[1]);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    Math.abs(longitude) > 180 ||
    Math.abs(latitude) > 90
  ) {
    return null;
  }

  return [longitude, latitude];
}

function getLineCoordinates(route: FeatureRouteExtractedFromKml): number[][][] {
  if (route.geometry.type === 'LineString') {
    const coordinates = (route.geometry.coordinates as number[][])
      .map(toCoordinatePair)
      .filter((coordinate): coordinate is number[] => Boolean(coordinate));
    return coordinates.length > 0 ? [coordinates] : [];
  }

  return (route.geometry.coordinates as number[][][])
    .map((line) =>
      line.map(toCoordinatePair).filter((coordinate): coordinate is number[] => Boolean(coordinate))
    )
    .filter((line) => line.length > 0);
}

function generateRouteId(features: FeatureRouteExtractedFromKml[]): string {
  const coords = features.flatMap((feature) => getLineCoordinates(feature).flat());

  if (!coords || coords.length === 0) throw new Error('Invalid geometry');

  const normalizedCoords = normalizeCoordinates(coords);
  const rounded = normalizedCoords.map(([lon, lat]) => [+lon.toFixed(6), +lat.toFixed(6)]);

  const hash = createHash('sha256');
  hash.update(JSON.stringify(rounded));
  return hash.digest('hex');
}

function getDistanceBetweenCoordinatesMeters(
  firstCoordinate: number[],
  secondCoordinate: number[]
): number {
  const [firstLongitude, firstLatitude] = firstCoordinate;
  const [secondLongitude, secondLatitude] = secondCoordinate;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const deltaLatitude = toRadians(secondLatitude - firstLatitude);
  const deltaLongitude = toRadians(secondLongitude - firstLongitude);
  const firstLatitudeRadians = toRadians(firstLatitude);
  const secondLatitudeRadians = toRadians(secondLatitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(deltaLongitude / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getLineDistanceMeters(line: number[][]): number {
  if (line.length < 2) return 0;

  return line.reduce((totalDistance, coordinate, index) => {
    if (index === 0) return totalDistance;
    return totalDistance + getDistanceBetweenCoordinatesMeters(line[index - 1], coordinate);
  }, 0);
}

function getRouteMetadata(features: FeatureRouteExtractedFromKml[]) {
  const lines = features.flatMap(getLineCoordinates);
  const coordinates = lines.flat();
  const firstCoordinate = coordinates[0];
  const lastCoordinate = coordinates[coordinates.length - 1];
  const distanceMeters = lines.reduce(
    (totalDistance, line) => totalDistance + getLineDistanceMeters(line),
    0
  );

  return {
    pointCount: coordinates.length,
    distanceMeters,
    start: firstCoordinate
      ? {
          longitude: firstCoordinate[0],
          latitude: firstCoordinate[1],
        }
      : undefined,
    end: lastCoordinate
      ? {
          longitude: lastCoordinate[0],
          latitude: lastCoordinate[1],
        }
      : undefined,
  };
}

function getFileBaseName(fileName?: string) {
  if (!fileName) return '';
  return fileName.replace(/\.kml$/i, '').trim();
}

function getFallbackRouteName(index: number) {
  return `Rota ${String(index + 1).padStart(2, '0')}`;
}

function getFeatureRouteName(feature?: FeatureRouteExtractedFromKml | null) {
  const name = feature?.properties?.name;
  return typeof name === 'string' ? name.trim() : '';
}

function convertGeojsonForFormattedRoutes({
  features,
  sourceFileName,
  routeStartIndex,
}: {
  features: FeatureRouteExtractedFromKml[];
  sourceFileName: string;
  routeStartIndex: number;
}): RouteConversionResult {
  const errors: ConvertedRouteError[] = [];

  if (!features || features.length === 0) {
    errors.push({ fileName: sourceFileName, message: 'Nenhuma rota encontrada.' });
    return { errors, routes: [] };
  }

  const validFeatures: FeatureRouteExtractedFromKml[] = [];

  features.forEach((feature, index) => {
    const routeName = getFeatureRouteName(feature);
    const routeLabel = routeName ? `de nome ${routeName}` : '';
    const positionText = `posição ${index + 1}`;

    if (!feature || !feature.properties) {
      errors.push({
        fileName: sourceFileName,
        message: `Rota ${routeLabel} inválida encontrada [Propriedades não informadas] (${positionText}).`,
      });
      return;
    }

    if (!feature.geometry) {
      errors.push({
        fileName: sourceFileName,
        message: `Rota ${routeLabel} inválida encontrada [Geometria não informada] (${positionText}).`,
      });
      return;
    }

    if (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString') {
      errors.push({
        fileName: sourceFileName,
        message: `Rota ${routeLabel} não é uma linha válida [Tipo diferente de "LineString" ou "MultiLineString"] (${positionText}).`,
      });
      return;
    }

    const coordinates = getLineCoordinates(feature).flat();

    if (coordinates.length < 2) {
      errors.push({
        fileName: sourceFileName,
        message: `Rota ${routeLabel} com formação inválida [Menos de 2 pontos] (${positionText}).`,
      });
      return;
    }

    validFeatures.push(feature);
  });

  if (validFeatures.length === 0) {
    errors.push({ fileName: sourceFileName, message: 'Nenhuma rota válida encontrada.' });
    return { errors, routes: [] };
  }

  const groupedFeatures = new Map<string, FeatureRouteExtractedFromKml[]>();

  validFeatures.forEach((feature) => {
    const routeName = getFeatureRouteName(feature);
    const groupKey = routeName || '__unnamed_route__';
    if (!groupedFeatures.has(groupKey)) {
      groupedFeatures.set(groupKey, []);
    }
    groupedFeatures.get(groupKey)!.push(feature);
  });

  const sourceFileBaseName = getFileBaseName(sourceFileName);
  const formattedRoutes: ConvertedRouteData[] = [];

  groupedFeatures.forEach((groupFeatures, routeName) => {
    const routeIndex = routeStartIndex + formattedRoutes.length;
    const name =
      routeName !== '__unnamed_route__'
        ? routeName
        : sourceFileBaseName || getFallbackRouteName(routeIndex);
    const externalId = generateRouteId(groupFeatures);
    const metadata = getRouteMetadata(groupFeatures);

    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: groupFeatures.map((feature) => ({
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          ...feature.properties,
          route_name: name,
          source_file: sourceFileName,
          externalId,
        },
      })) as GeoJSON.Feature[],
    };

    formattedRoutes.push({
      name,
      externalId,
      sourceFileName,
      geoJson: featureCollection,
      pointCount: metadata.pointCount,
      distanceMeters: metadata.distanceMeters,
      start: metadata.start,
      end: metadata.end,
    });
  });

  return {
    errors,
    routes: formattedRoutes,
  };
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'arrayBuffer' in value && 'name' in value);
}

function getRequestFiles(formData: FormData): File[] {
  const files = formData.getAll('files').filter(isFile);
  const legacyFile = formData.get('file');

  if (isFile(legacyFile)) {
    files.push(legacyFile);
  }

  return files;
}

async function convertKmlFile(file: File, routeStartIndex: number): Promise<RouteConversionResult> {
  if (!file || file.size === 0) {
    return {
      errors: [{ fileName: file?.name, message: 'Arquivo KML não selecionado ou vazio.' }],
      routes: [],
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const geojson = kml(xml);

    return convertGeojsonForFormattedRoutes({
      features: geojson.features as FeatureRouteExtractedFromKml[],
      sourceFileName: file.name,
      routeStartIndex,
    });
  } catch (error) {
    console.error('[Front API] Failed to convert route file: ', error);
    return {
      errors: [{ fileName: file.name, message: 'Falha ao converter este arquivo KML.' }],
      routes: [],
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const files = getRequestFiles(formData);

    if (files.length === 0) {
      return NextResponse.json(
        { errors: [{ message: 'Nenhum arquivo KML enviado.' }], routes: [] },
        { status: 400 }
      );
    }

    const response: ApiResponse = {
      errors: [],
      routes: [],
    };

    for (const file of files) {
      const result = await convertKmlFile(file, response.routes.length);
      response.errors.push(...result.errors);
      response.routes.push(...result.routes);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Front API] Failed to convert route file: ', error);
    return NextResponse.json(
      {
        errors: [{ message: '[Front API] Failed to convert route file' }],
        routes: [],
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ health: 'feels good =D', timestamp: new Date().toISOString() });
}
