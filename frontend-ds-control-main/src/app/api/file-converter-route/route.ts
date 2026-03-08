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

export type RouteData = {
  name: string;
  externalId: string;
  geoJson: GeoJSON.FeatureCollection;
};

export type ApiResponse = {
  errors: string[];
  routes: RouteData[];
};

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

  const reordered = [...coords.slice(minIndex), ...coords.slice(0, minIndex)];

  return reordered;
}

function generateRouteId(route: FeatureRouteExtractedFromKml): string {
  let coords: number[][];

  if (route.geometry.type === 'LineString') {
    coords = route.geometry.coordinates as number[][];
  } else {
    coords = (route.geometry.coordinates as number[][][]).flat();
  }

  if (!coords || coords.length === 0) throw new Error('Invalid geometry');

  const normalizedCoords = normalizeCoordinates(coords);
  const rounded = normalizedCoords.map(([lon, lat]) => [+lon.toFixed(6), +lat.toFixed(6)]);

  const hash = createHash('sha256');
  hash.update(JSON.stringify(rounded));
  return hash.digest('hex');
}

function convertGeojsonForFormattedRoutes(features: FeatureRouteExtractedFromKml[]): ApiResponse {
  const errors: string[] = [];
  let missingRouteNameCount = 0;

  if (!features || features.length === 0) {
    errors.push('Nenhuma rota encontrada.');
    return { errors, routes: [] };
  }

  const validFeatures: FeatureRouteExtractedFromKml[] = [];

  features.forEach((feature, index) => {
    if (
      !feature ||
      !feature.properties ||
      feature.properties === null ||
      feature.properties === undefined
    ) {
      errors.push(
        `Rota ${feature.properties?.name ? `de nome ${feature.properties.name}` : ``} inválida encontrada [Propriedades não informadas] (Não aparecerá no mapa ao lado, refaça essa linha no KML, posição ${index + 1}).`
      );
      return;
    }

    if (!feature.geometry) {
      errors.push(
        `Rota ${feature.properties.name ? `de nome ${feature.properties.name}` : ``} inválida encontrada [Geometria não informada] (Não aparecerá no mapa ao lado, refaça essa linha no KML, posição ${index + 1}).`
      );
      return;
    }

    if (feature.geometry.type !== 'LineString' && feature.geometry.type !== 'MultiLineString') {
      errors.push(
        `Rota ${feature.properties.name ? `de nome ${feature.properties.name}` : ``} não é uma linha válida [Tipo diferente de "LineString" ou "MultiLineString"] (Não aparecerá no mapa ao lado, refaça essa linha no KML, posição ${index + 1}).`
      );
      return;
    }

    let coords: number[][];
    if (feature.geometry.type === 'LineString') {
      coords = feature.geometry.coordinates as number[][];
    } else {
      coords = (feature.geometry.coordinates as number[][][]).flat();
    }

    if (coords.length < 2) {
      errors.push(
        `Rota ${feature.properties.name ? `de nome ${feature.properties.name}` : ``} com formação inválida [Menos de 2 pontos] (Não aparecerá no mapa ao lado, refaça essa linha no KML, posição ${index + 1}).`
      );
      return;
    }

    if (
      feature.properties.name === null ||
      feature.properties.name === undefined ||
      feature.properties.name === ''
    ) {
      missingRouteNameCount++;
    }

    validFeatures.push(feature);
  });

  if (missingRouteNameCount > 0) {
    const word = missingRouteNameCount === 1 ? 'rota' : 'rotas';
    errors.push(`Há ${missingRouteNameCount} ${word} sem nome.`);
  }

  const groupedFeatures = new Map<string, FeatureRouteExtractedFromKml[]>();

  validFeatures.forEach((feature) => {
    const routeName = feature.properties.name || '';
    if (!groupedFeatures.has(routeName)) {
      groupedFeatures.set(routeName, []);
    }
    groupedFeatures.get(routeName)!.push(feature);
  });

  const formattedRoutes: RouteData[] = [];

  groupedFeatures.forEach((groupFeatures, routeName) => {
    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      // @ts-expect-error - This is a valid GeoJSON feature collection
      features: groupFeatures.map((feature) => ({
        type: 'Feature',
        geometry: feature.geometry,
        properties: feature.properties,
      })),
    };

    const externalId = generateRouteId(groupFeatures[0]);

    const route: RouteData = {
      name: routeName,
      externalId: externalId,
      geoJson: featureCollection,
    };

    formattedRoutes.push(route);
  });

  return {
    errors: errors.length > 0 ? errors : [],
    routes: formattedRoutes,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const geojson = kml(xml);
    const response: ApiResponse = convertGeojsonForFormattedRoutes(
      geojson.features as FeatureRouteExtractedFromKml[]
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Front API] Failed to convert route file: ', error);
    return NextResponse.json(
      { error: '[Front API] Failed to convert route file' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ health: 'feels good =D', timestamp: new Date().toISOString() });
}
