import ApplicationsReportPDF from '@/components/PDFReports/ApplicationsReportPDF';
import FarmsReportPDF, { type FarmsReportRow } from '@/components/PDFReports/FarmsReportPDF';
import GeneralReportPDF, {
  type GeneralNamedValue,
  type GeneralReportStatusSummary,
  type GeneralReportTotals,
} from '@/components/PDFReports/GeneralReportPDF';
import ServiceOrderStrategicReportPDF from '@/components/PDFReports/ServiceOrderStrategicReportPDF';
import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';
import { buildReportMapboxStaticUrl } from '@/utils/mapboxStaticReportMap';
import {
  buildStrategicMapStaticBaseUrl,
  buildStrategicMapViewport,
  extractPlotPolygons,
  type StrategicMapShapeInput,
  type StrategicMapViewport,
} from '@/utils/strategicReportMap2d';

interface GeneratePDFParams {
  serviceOrder: ServiceOrder;
  applications: Application[];
}

export interface GenerateFarmsReportPDFParams {
  rows: FarmsReportRow[];
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
}

export interface GenerateGeneralReportPDFParams {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  totals: GeneralReportTotals;
  statusSummary: GeneralReportStatusSummary;
  byFarm: GeneralNamedValue[];
  byPilot: GeneralNamedValue[];
  byProduct: GeneralNamedValue[];
  byAssistant: GeneralNamedValue[];
}

const REPORT_MAP_WIDTH = 1280;
const REPORT_MAP_HEIGHT = 480;
const STRATEGIC_REPORT_MAP_WIDTH = 418;
const STRATEGIC_REPORT_MAP_HEIGHT = 286;
const STRATEGIC_REPORT_MAP_PADDING = 8;
const STRATEGIC_REPORT_MAP_STYLE = 'mapbox/light-v11';
const STRATEGIC_REPORT_PADDING_SCALE = 0.58;

function getReportMapboxAccessToken(): string {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q'
  );
}

/**
 * Mesma regra de páginas por talhão que ApplicationsReportPDF; pré-busca cada mapUrl Mapbox para data URL antes do pdf().
 */
async function prefetchReportMapImagesByPlotId(
  applications: Application[]
): Promise<Record<string, string | null>> {
  const applicationsWithPlot = applications.filter((app) => app.plotId !== null);
  const applicationsByPlot = applicationsWithPlot.reduce(
    (acc, app) => {
      const plotId = app.plotId!;
      if (!acc[plotId]) {
        acc[plotId] = [];
      }
      acc[plotId].push(app);
      return acc;
    },
    {} as Record<string, Application[]>
  );

  const accessToken = getReportMapboxAccessToken();
  const out: Record<string, string | null> = {};

  for (const plotId of Object.keys(applicationsByPlot)) {
    const plotApplications = applicationsByPlot[plotId];
    const plot = plotApplications[0]?.plot;
    if (!plot) {
      out[plotId] = null;
      continue;
    }
    const mapResult = buildReportMapboxStaticUrl({
      plot,
      mapWidth: REPORT_MAP_WIDTH,
      mapHeight: REPORT_MAP_HEIGHT,
      accessToken,
    });

    if (!mapResult.url) {
      out[plotId] = null;
      continue;
    }
    const dataUrl = await fetchRemoteImageAsDataUrl(mapResult.url);
    out[plotId] = dataUrl;

  }

  return out;
}

function buildStrategicMapShapes(serviceOrder: ServiceOrder): StrategicMapShapeInput[] {
  return (serviceOrder.plots || [])
    .map((plot) => {
      if (!plot.id) {
        return null;
      }

      const polygons = extractPlotPolygons(plot);
      if (polygons.length === 0) {
        return null;
      }

      return {
        id: plot.id,
        label: plot.name || `Talhao ${plot.id}`,
        farmKey: plot.farmId || 'farm-unknown',
        polygons,
      };
    })
    .filter((shape): shape is StrategicMapShapeInput => shape !== null);
}

async function prefetchStrategicReportMapBase(
  serviceOrder: ServiceOrder
): Promise<{
  mapViewport: StrategicMapViewport | null;
  mapBaseDataUrl: string | null;
}> {
  const shapes = buildStrategicMapShapes(serviceOrder);
  const mapViewport = buildStrategicMapViewport(
    shapes,
    STRATEGIC_REPORT_MAP_WIDTH,
    STRATEGIC_REPORT_MAP_HEIGHT,
    STRATEGIC_REPORT_MAP_PADDING,
    {
      paddingScale: STRATEGIC_REPORT_PADDING_SCALE,
      minPaddingPx: 2,
      maxPaddingRatio: 0.05,
    }
  );

  const accessToken = getReportMapboxAccessToken().trim();
  if (!mapViewport || !accessToken) {
    return { mapViewport, mapBaseDataUrl: null };
  }

  const mapBaseUrl = buildStrategicMapStaticBaseUrl({
    viewport: mapViewport,
    width: STRATEGIC_REPORT_MAP_WIDTH,
    height: STRATEGIC_REPORT_MAP_HEIGHT,
    accessToken,
    styleId: STRATEGIC_REPORT_MAP_STYLE,
    pixelRatio: 2,
  });

  const mapBaseDataUrl = await fetchRemoteImageAsDataUrl(mapBaseUrl);
  return { mapViewport, mapBaseDataUrl };
}

export async function generateApplicationsReportPDF({
  serviceOrder,
  applications,
}: GeneratePDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const prefetchedMapImageDataUrls = await prefetchReportMapImagesByPlotId(applications);

  const element = ApplicationsReportPDF({
    serviceOrder,
    applications,
    prefetchedMapImageDataUrls,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateServiceOrderStrategicReportPDF({
  serviceOrder,
  applications,
}: GeneratePDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const { mapViewport, mapBaseDataUrl } = await prefetchStrategicReportMapBase(serviceOrder);

  const element = ServiceOrderStrategicReportPDF({
    serviceOrder,
    applications,
    mapViewport,
    prefetchedMapBaseDataUrl: mapBaseDataUrl,
    mapBaseStyleLabel: 'Mapbox Light',
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateFarmsReportPDF({
  rows,
  generatedAt,
  filtersSummary,
}: GenerateFarmsReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');

  const element = FarmsReportPDF({
    rows,
    generatedAt,
    filtersSummary,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateGeneralReportPDF({
  generatedAt,
  filtersSummary,
  totals,
  statusSummary,
  byFarm,
  byPilot,
  byProduct,
  byAssistant,
}: GenerateGeneralReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');

  const element = GeneralReportPDF({
    generatedAt,
    filtersSummary,
    totals,
    statusSummary,
    byFarm,
    byPilot,
    byProduct,
    byAssistant,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export function downloadPDF(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
