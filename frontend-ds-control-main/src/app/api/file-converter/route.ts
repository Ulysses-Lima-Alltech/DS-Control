import { createHash } from 'crypto';

import { kml } from '@tmcw/togeojson';
import { NextRequest, NextResponse } from 'next/server';
import { DOMParser } from 'xmldom';

import { Plot } from '@/types/plot.type';

type FeaturePlotExtractedFromKml = {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    plot_name: string;
    hectare: number;
  };
};

export type ApiResponse = {
  errors: string[];
  plots: Plot[];
};

function normalizeCoordinates(coords: number[][]): number[][] {
  const last = coords[coords.length - 1];
  const first = coords[0];
  if (first[0] === last[0] && first[1] === last[1]) {
    coords = coords.slice(0, -1);
  }

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

function generatePlotId(plot: FeaturePlotExtractedFromKml): string {
  const coords = plot.geometry.coordinates?.[0];
  if (!coords) throw new Error('Invalid geometry');

  const normalizedCoords = normalizeCoordinates(coords);

  const rounded = normalizedCoords.map(([lon, lat]) => [+lon.toFixed(6), +lat.toFixed(6)]);

  const hash = createHash('sha256');
  hash.update(JSON.stringify(rounded));
  return hash.digest('hex');
}

function convertGeojsonForFormattedPlots(features: FeaturePlotExtractedFromKml[]): ApiResponse {
  const errors: string[] = [];
  let missingPlotNameCount = 0;

  if (!features || features.length === 0) {
    errors.push('Nenhum talhão encontrado.');
    return { errors, plots: [] };
  }

  const validFeatures: FeaturePlotExtractedFromKml[] = [];

  features.forEach((feature, index) => {
    if (
      !feature ||
      !feature.properties ||
      feature.properties === null ||
      feature.properties === undefined
    ) {
      errors.push(
        `Talhão ${feature.properties.plot_name ? `de nome ${feature.properties.plot_name}` : ``} ${feature.properties.hectare ? `e ${feature.properties.hectare} hectares` : ''} inválido encontrado [Propriedades não informadas] (Não aparecerá no mapa ao lado, refaça esse polígono no KML, posição ${index + 1}).`
      );
      return;
    }

    if (!feature.geometry) {
      errors.push(
        `Talhão ${feature.properties.plot_name ? `de nome ${feature.properties.plot_name}` : ``} ${feature.properties.hectare ? `e ${feature.properties.hectare} hectares` : ''} inválido encontrado [Geometria não informada] (Não aparecerá no mapa ao lado, refaça esse polígono no KML, posição ${index + 1}).`
      );
      return;
    }

    if (feature.geometry.type !== 'Polygon') {
      errors.push(
        `Talhão ${feature.properties.plot_name ? `de nome ${feature.properties.plot_name}` : ``} ${feature.properties.hectare ? `e ${feature.properties.hectare} hectares` : ''} não é um polígono válido [Tipo diferente de "Polygon"] (Não aparecerá no mapa ao lado, refaça esse polígono no KML, posição ${index + 1}).`
      );
      return;
    }

    if (feature.geometry.coordinates[0].length < 3) {
      errors.push(
        `Talhão ${feature.properties.plot_name ? `de nome ${feature.properties.plot_name}` : ``} ${feature.properties.hectare ? `e ${feature.properties.hectare} hectares` : ''} com formação inválida [Menos de 3 pontos] (Não aparecerá no mapa ao lado, refaça esse polígono no KML, posição ${index + 1}).`
      );
      return;
    }

    if (
      feature.properties.plot_name === null ||
      feature.properties.plot_name === undefined ||
      feature.properties.plot_name === ''
    ) {
      missingPlotNameCount++;
    }

    if (
      feature.properties.hectare === null ||
      feature.properties.hectare === undefined ||
      feature.properties.hectare === 0
    ) {
      errors.push(`Talhão ${feature.properties.plot_name} sem hectare informado.`);
    }

    validFeatures.push(feature);
  });

  if (missingPlotNameCount > 0) {
    const word = missingPlotNameCount === 1 ? 'talhão' : 'talhões';
    errors.push(`Há ${missingPlotNameCount} ${word} sem nome.`);
  }

  const groupedFeatures = new Map<string, FeaturePlotExtractedFromKml[]>();

  validFeatures.forEach((feature) => {
    const plotName = feature.properties.plot_name;
    if (!groupedFeatures.has(plotName)) {
      groupedFeatures.set(plotName, []);
    }
    groupedFeatures.get(plotName)!.push(feature);
  });

  const formattedPlots: Plot[] = [];

  groupedFeatures.forEach((groupFeatures, plotName) => {
    const totalHectare = groupFeatures.reduce((sum, feature) => {
      return sum + (feature.properties.hectare || 0);
    }, 0);

    const featureCollection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: groupFeatures.map((feature) => ({
        type: 'Feature',
        geometry: feature.geometry,
        properties: feature.properties,
      })),
    };

    const externalId = generatePlotId(groupFeatures[0]);

    const plot: Plot = {
      name: plotName,
      externalId: externalId,
      hectare: totalHectare.toString(),
      geoJson: featureCollection,
    };

    formattedPlots.push(plot);
  });

  return {
    errors: errors.length > 0 ? errors : [],
    plots: formattedPlots,
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
    const response: ApiResponse = convertGeojsonForFormattedPlots(
      geojson.features as FeaturePlotExtractedFromKml[]
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Front API] Failed to convert file: ', error);
    return NextResponse.json({ error: '[Front API] Failed to convert file' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ health: 'feels good =D', timestamp: new Date().toISOString() });
}
