import type * as GeoJSON from 'geojson';

import { getApplicationById } from '@/services/application.service';
import { getServiceOrderById } from '@/services/service-order.service';
import type { Application } from '@/types/applications.type';
import type { Plot } from '@/types/plot.type';
import { OPERATIONAL_TIME_ZONE } from '@/utils/operational-date';
import { downloadPDF, generateApplicationIndividualReportPDF } from '@/utils/pdfGenerator';

function formatGeneratedAt(): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: OPERATIONAL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date());
}

function isPolygonCoordinates(value: unknown): value is number[][][] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const firstRing = value[0];
  if (!Array.isArray(firstRing) || firstRing.length === 0) return false;
  const firstCoordinate = firstRing[0];
  return (
    Array.isArray(firstCoordinate) &&
    typeof firstCoordinate[0] === 'number' &&
    typeof firstCoordinate[1] === 'number'
  );
}

function isMultiPolygonCoordinates(value: unknown): value is number[][][][] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return isPolygonCoordinates(value[0]);
}

function ensureFeatureCollection(raw: unknown): GeoJSON.FeatureCollection | null {
  if (!raw) return null;

  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const source = parsed as Record<string, unknown>;

  if (source.type === 'FeatureCollection') {
    return source as unknown as GeoJSON.FeatureCollection;
  }

  if (source.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [source as unknown as GeoJSON.Feature],
    };
  }

  if (
    source.type === 'Polygon' ||
    source.type === 'MultiPolygon' ||
    source.type === 'GeometryCollection'
  ) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: source as unknown as GeoJSON.Geometry,
          properties: {},
        },
      ],
    };
  }

  if (source.geometry) {
    const nested = ensureFeatureCollection(source.geometry);
    if (nested) return nested;
  }

  if (source.geoJson || source.geojson) {
    const nested = ensureFeatureCollection(source.geoJson || source.geojson);
    if (nested) return nested;
  }

  if (source.coordinates) {
    if (isMultiPolygonCoordinates(source.coordinates)) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'MultiPolygon',
              coordinates: source.coordinates,
            },
            properties: {},
          },
        ],
      };
    }

    if (isPolygonCoordinates(source.coordinates)) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: source.coordinates,
            },
            properties: {},
          },
        ],
      };
    }
  }

  return null;
}

function normalizePlotForReport(plot: Plot | undefined): Plot | undefined {
  if (!plot) {
    return undefined;
  }

  const plotRecord = plot as Plot & Record<string, unknown>;
  const geoJsonCandidate =
    plotRecord.geoJson ?? plotRecord.geojson ?? plotRecord.geometry ?? plotRecord.coordinates;
  const normalizedGeoJson = ensureFeatureCollection(geoJsonCandidate);

  if (!normalizedGeoJson) {
    return plot;
  }

  return {
    ...plot,
    geoJson: normalizedGeoJson,
  };
}

async function resolveApplicationForReport(
  applicationId: string,
  baseApplication?: Application
): Promise<Application> {
  const loadedApplication = baseApplication
    ? { ...baseApplication }
    : (await getApplicationById(applicationId)).application;

  let resolvedApplication: Application = {
    ...loadedApplication,
    plot: normalizePlotForReport(loadedApplication.plot) || loadedApplication.plot,
  };

  const serviceOrderId = resolvedApplication.serviceOrderId || resolvedApplication.serviceOrder?.id;

  if (serviceOrderId) {
    try {
      const serviceOrder = await getServiceOrderById(serviceOrderId, {
        includePlots: 'true',
        includeGeoJson: 'true',
        includePilots: 'true',
        includeFarms: 'true',
        includeContracts: 'true',
        includeCustomers: 'true',
      });

      const mappedPlot = resolvedApplication.plotId
        ? serviceOrder.plots?.find((plot) => plot.id === resolvedApplication.plotId)
        : undefined;

      resolvedApplication = {
        ...resolvedApplication,
        serviceOrder,
        plot: normalizePlotForReport(mappedPlot || resolvedApplication.plot) || resolvedApplication.plot,
      };
    } catch {
      resolvedApplication = {
        ...resolvedApplication,
        plot: normalizePlotForReport(resolvedApplication.plot) || resolvedApplication.plot,
      };
    }
  }

  return resolvedApplication;
}

export async function generateAndDownloadApplicationIndividualReport(args: {
  applicationId: string;
  application?: Application;
}): Promise<Application> {
  const resolvedApplication = await resolveApplicationForReport(args.applicationId, args.application);

  const blob = await generateApplicationIndividualReportPDF({
    application: resolvedApplication,
    generatedAt: formatGeneratedAt(),
  });

  const fileBase = resolvedApplication.serviceOrder?.number
    ? `os-${resolvedApplication.serviceOrder.number}`
    : resolvedApplication.id;

  downloadPDF(blob, `relatorio-aplicacao-${fileBase}.pdf`);

  return resolvedApplication;
}
