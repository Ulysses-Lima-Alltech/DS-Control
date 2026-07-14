import ApplicationIndividualReportPDF from '@/components/PDFReports/ApplicationIndividualReportPDF';
import ApplicationsGeneralReportPDF, {
  type ApplicationsGeneralReportRow,
} from '@/components/PDFReports/ApplicationsGeneralReportPDF';
import ApplicationsReportPDF from '@/components/PDFReports/ApplicationsReportPDF';
import FarmsReportPDF, { type FarmsReportRow } from '@/components/PDFReports/FarmsReportPDF';
import GeneralReportPDF, {
  type GeneralNamedValue,
  type GeneralReportStatusSummary,
  type GeneralReportTotals,
} from '@/components/PDFReports/GeneralReportPDF';
import PilotApplicationsReportPDF from '@/components/PDFReports/PilotApplicationsReportPDF';
import ServiceOrderStrategicReportPDF from '@/components/PDFReports/ServiceOrderStrategicReportPDF';
import ServiceOrdersDetailedReportPDF, {
  type ServiceOrderDetailedSection,
} from '@/components/PDFReports/ServiceOrdersDetailedReportPDF';
import { getApplicationDjiFlights, type ApplicationDjiFlight } from '@/services/application.service';
import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import {
  enrichApplicationsWithDjiImageUrl,
  prefetchDjiReportImagesByApplicationId,
  type DjiReportImageByApplicationId,
} from '@/utils/djiReportAssets';
import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';
import {
  buildReportMapboxStaticUrl,
  getReportMapPlaceholderMessage,
} from '@/utils/mapboxStaticReportMap';
import { buildPlotPolygonSvgPathDs } from '@/utils/reportPlotPolygonSvg';
import {
  buildStrategicMapStaticBaseUrl,
  buildStrategicMapViewport,
  buildStrategicMapProjection,
  extractPlotPolygons,
  sanitizeStrategicPolygons,
  type StrategicMapShapeInput,
  type StrategicMapViewport,
} from '@/utils/strategicReportMap2d';
import { buildStrategicFarmColorMap, type StrategicFarmColor } from '@/utils/strategicReportPalette';

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

export interface GenerateApplicationsGeneralReportPDFParams {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  periodLabel: string;
  rows: ApplicationsGeneralReportRow[];
  totalAppliedHectares: number;
}

export interface GenerateApplicationIndividualReportPDFParams {
  application: Application;
  generatedAt: string;
}

export interface GenerateServiceOrdersDetailedConsolidatedPDFParams {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  sections: ServiceOrderDetailedSection[];
}

export interface GeneratePilotApplicationsReportPDFParams {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  groups: Array<{ pilotName: string; applications: Application[] }>;
}

const REPORT_MAP_WIDTH = 1280;
const REPORT_MAP_HEIGHT = 480;
const STRATEGIC_REPORT_MAP_WIDTH = 1200;
const STRATEGIC_REPORT_MAP_HEIGHT = 760;
const STRATEGIC_REPORT_MAP_PADDING = 48;
const STRATEGIC_REPORT_MAP_STYLE = 'mapbox/light-v11';
const STRATEGIC_REPORT_MAP_PIXEL_RATIO: 1 | 2 = 2;
const STRATEGIC_REPORT_PADDING_SCALE = 1.2;
const STRATEGIC_REPORT_SAFE_AREA_INSETS_PX = {
  top: 12,
  right: 24,
  bottom: 152,
  left: 344,
} as const;

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

    out[plotId] = await fetchRemoteImageAsDataUrl(mapResult.url);
  }

  return out;
}

function buildStrategicMapShapes(serviceOrder: ServiceOrder): StrategicMapShapeInput[] {
  return (serviceOrder.plots || [])
    .map((plot) => {
      if (!plot.id) {
        return null;
      }

      const polygons = sanitizeStrategicPolygons(extractPlotPolygons(plot));
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

function buildStrategicFarmColorMapFromServiceOrder(
  serviceOrder: ServiceOrder
): Map<string, StrategicFarmColor> {
  const orderedFarmIds = Array.from(
    new Set(
      (serviceOrder.plots || [])
        .map((plot) => plot.farmId || 'farm-unknown')
        .filter((farmId): farmId is string => Boolean(farmId))
    )
  );
  return buildStrategicFarmColorMap(orderedFarmIds);
}

async function prefetchStrategicReportMapBase(
  serviceOrder: ServiceOrder
): Promise<{
  mapViewport: StrategicMapViewport | null;
  mapBaseDataUrl: string | null;
  mapImageDataUrl: string | null;
  farmColorMap: Map<string, StrategicFarmColor>;
}> {
  const shapes = buildStrategicMapShapes(serviceOrder);
  const farmColorMap = buildStrategicFarmColorMapFromServiceOrder(serviceOrder);
  const mapViewport = buildStrategicMapViewport(
    shapes,
    STRATEGIC_REPORT_MAP_WIDTH,
    STRATEGIC_REPORT_MAP_HEIGHT,
    STRATEGIC_REPORT_MAP_PADDING,
    {
      paddingScale: STRATEGIC_REPORT_PADDING_SCALE,
      minPaddingPx: 2,
      maxPaddingRatio: 0.14,
      safeAreaInsetsPx: STRATEGIC_REPORT_SAFE_AREA_INSETS_PX,
    }
  );

  const accessToken = getReportMapboxAccessToken().trim();
  if (!mapViewport) {
    return {
      mapViewport,
      mapBaseDataUrl: null,
      mapImageDataUrl: null,
      farmColorMap,
    };
  }

  const mapBaseUrl = accessToken
    ? buildStrategicMapStaticBaseUrl({
        viewport: mapViewport,
        width: STRATEGIC_REPORT_MAP_WIDTH,
        height: STRATEGIC_REPORT_MAP_HEIGHT,
        accessToken,
        styleId: STRATEGIC_REPORT_MAP_STYLE,
        pixelRatio: STRATEGIC_REPORT_MAP_PIXEL_RATIO,
      })
    : null;

  let mapBaseDataUrl: string | null = null;
  if (mapBaseUrl) {
    mapBaseDataUrl = await fetchRemoteImageAsDataUrl(mapBaseUrl);
  }

  return {
    mapViewport,
    mapBaseDataUrl,
    mapImageDataUrl: null,
    farmColorMap,
  };
}

function buildStrategicPlotDiagnostics(serviceOrder: ServiceOrder): {
  totalPlots: number;
  validPlots: Array<{ id: string; name: string }>;
  invalidPlots: Array<{ id: string; name: string }>;
  shapeIds: string[];
} {
  const plots = serviceOrder.plots || [];
  const validPlots: Array<{ id: string; name: string }> = [];
  const invalidPlots: Array<{ id: string; name: string }> = [];

  plots.forEach((plot) => {
    if (!plot.id) return;
    const sanitizedPolygons = sanitizeStrategicPolygons(extractPlotPolygons(plot));
    const payload = { id: plot.id, name: plot.name || `Talhao ${plot.id}` };
    if (sanitizedPolygons.length > 0) {
      validPlots.push(payload);
      return;
    }
    invalidPlots.push(payload);
  });

  return {
    totalPlots: plots.length,
    validPlots,
    invalidPlots,
    shapeIds: validPlots.map((plot) => plot.id),
  };
}

async function prefetchApplicationIndividualMap(application: Application): Promise<{
  mapImageDataUrl: string | null;
  mapOverlayPathDs: string[] | null;
  mapFallbackVectorPathD: string | null;
  mapUnavailableMessage: string | null;
}> {
  const plot = application.plot;
  if (!plot) {
    return {
      mapImageDataUrl: null,
      mapOverlayPathDs: null,
      mapFallbackVectorPathD: null,
      mapUnavailableMessage: 'Mapa indisponivel para esta aplicacao.',
    };
  }

  const accessToken = getReportMapboxAccessToken();
  const mapResult = buildReportMapboxStaticUrl({
    plot,
    mapWidth: REPORT_MAP_WIDTH,
    mapHeight: REPORT_MAP_HEIGHT,
    accessToken,
  });

  let mapImageDataUrl: string | null = null;
  let mapUnavailableMessage: string | null = getReportMapPlaceholderMessage(
    mapResult.unavailableReason
  );
  if (mapResult.url) {
    try {
      mapImageDataUrl = await fetchRemoteImageAsDataUrl(mapResult.url);
      mapUnavailableMessage = null;
    } catch {
      mapUnavailableMessage = 'Falha ao carregar o mapa da aplicacao.';
    }
  }

  let mapOverlayPathDs: string[] | null = null;
  try {
    mapOverlayPathDs = buildPlotPolygonSvgPathDs(plot, REPORT_MAP_WIDTH, REPORT_MAP_HEIGHT);
  } catch {
    mapOverlayPathDs = null;
  }

  let mapFallbackVectorPathD: string | null = null;
  try {
    const polygons = extractPlotPolygons(plot);
    if (polygons.length > 0) {
      const projection = buildStrategicMapProjection(
        [
          {
            id: plot.id || application.id,
            label: plot.name || `Talhao ${plot.id || application.id}`,
            farmKey: plot.farmId || application.farmId || 'farm-unknown',
            polygons,
          },
        ],
        REPORT_MAP_WIDTH,
        REPORT_MAP_HEIGHT,
        10
      );
      mapFallbackVectorPathD = projection?.shapes[0]?.pathD || null;
    }
  } catch {
    mapFallbackVectorPathD = null;
  }

  if (!mapImageDataUrl && !mapFallbackVectorPathD && !mapUnavailableMessage) {
    mapUnavailableMessage = 'Mapa indisponivel para esta aplicacao.';
  }

  return {
    mapImageDataUrl,
    mapOverlayPathDs,
    mapFallbackVectorPathD,
    mapUnavailableMessage,
  };
}

type LinkedDjiFlightMap = {
  imageSrc: string;
  imageUrl: string;
  recordNumber: string;
  flightDate?: string | null;
  startTime?: string | null;
  pilotName?: string | null;
  aircraftName?: string | null;
  djiTaskAreaHa?: string | number | null;
  djiEstimatedAppliedAreaHa?: string | number | null;
};

async function fetchLinkedDjiFlightMaps(application: Application): Promise<{
  flights: ApplicationDjiFlight[];
  maps: LinkedDjiFlightMap[];
}> {
  try {
    const response = await getApplicationDjiFlights(application.id);
    const flights = response.flights || [];
    const maps: LinkedDjiFlightMap[] = [];

    for (const flight of flights) {
      if (!flight.pngSignedUrl) {
        continue;
      }

      const imageSrc = await fetchRemoteImageAsDataUrl(flight.pngSignedUrl).catch(() => null);
      if (!imageSrc) {
        continue;
      }

      maps.push({
        imageSrc,
        imageUrl: flight.pngSignedUrl,
        recordNumber: flight.recordNumber,
        flightDate: flight.flightDate,
        startTime: flight.startTime,
        pilotName: flight.pilotName,
        aircraftName: flight.aircraftName,
        djiTaskAreaHa: flight.taskAreaHa,
        djiEstimatedAppliedAreaHa: flight.estimatedAppliedAreaHa,
      });
    }

    return { flights, maps };
  } catch {
    return { flights: [], maps: [] };
  }
}

function buildApplicationWithLinkedDjiFlights(
  application: Application,
  flights: ApplicationDjiFlight[],
  maps: LinkedDjiFlightMap[]
): Application {
  const firstMappedFlight = maps[0];
  const estimatedAppliedAreaTotal = flights.reduce(
    (total, flight) => total + parseReportNumber(flight.estimatedAppliedAreaHa),
    0
  );

  return {
    ...application,
    djiImageUrl: firstMappedFlight?.imageUrl || application.djiImageUrl,
    djiImageStatus: maps.length ? 'approved' : application.djiImageStatus,
    djiDate: firstMappedFlight?.flightDate || application.djiDate,
    djiImageScope: maps.length ? 'application' : application.djiImageScope,
    djiMatchType: maps.length ? 'manual' : application.djiMatchType,
    djiMatchConfidence: maps.length ? application.djiMatchConfidence ?? 1 : application.djiMatchConfidence,
    djiFlightRecordNumber: firstMappedFlight?.recordNumber || application.djiFlightRecordNumber,
    djiMetadata: {
      ...(application.djiMetadata || {}),
      source: maps.length ? 'linked_application_dji_flights' : application.djiMetadata?.source,
      approved: maps.length ? true : application.djiMetadata?.approved,
      recordNumber: firstMappedFlight?.recordNumber || application.djiMetadata?.recordNumber,
      dsPlannedAreaHa: application.plot?.hectare,
      dsAppliedAreaHa: application.hectares,
      djiLinkedFlightCount: flights.length,
      djiRenderedFlightCount: maps.length,
      djiEstimatedAppliedAreaTotalHa: estimatedAppliedAreaTotal,
    },
  };
}

function parseReportNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

export async function generateApplicationsReportPDF({
  serviceOrder,
  applications,
}: GeneratePDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const enrichedApplications = await enrichApplicationsWithDjiImageUrl(serviceOrder, applications);
  const [prefetchedMapImageDataUrls, djiImagesByApplicationId] = await Promise.all([
    prefetchReportMapImagesByPlotId(enrichedApplications),
    prefetchDjiReportImagesByApplicationId(enrichedApplications).catch(() => ({})),
  ]);

  const element = ApplicationsReportPDF({
    serviceOrder,
    applications: enrichedApplications,
    prefetchedMapImageDataUrls,
    djiImagesByApplicationId,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateServiceOrdersDetailedConsolidatedPDF({
  generatedAt,
  filtersSummary,
  sections,
}: GenerateServiceOrdersDetailedConsolidatedPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const element = ServiceOrdersDetailedReportPDF({
    title: 'Relatorio Detalhado de Ordens de Servico',
    generatedAt,
    filtersSummary,
    sections,
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
  const diagnostics = buildStrategicPlotDiagnostics(serviceOrder);
  console.info('[StrategicPDF] Diagnostics', {
    serviceOrderId: serviceOrder.id,
    serviceOrderNumber: serviceOrder.number,
    totalPlotsInServiceOrder: diagnostics.totalPlots,
    totalValidPlots: diagnostics.validPlots.length,
    totalInvalidPlots: diagnostics.invalidPlots.length,
    totalShapesInput: diagnostics.shapeIds.length,
    validPlotIdsAndNames: diagnostics.validPlots,
    shapePlotIdsAndNames: diagnostics.validPlots,
    invalidPlotIdsAndNames: diagnostics.invalidPlots,
  });

  const { mapViewport, mapBaseDataUrl, mapImageDataUrl, farmColorMap } =
    await prefetchStrategicReportMapBase(serviceOrder);

  const element = ServiceOrderStrategicReportPDF({
    serviceOrder,
    applications,
    mapViewport,
    prefetchedMapBaseDataUrl: mapBaseDataUrl,
    prefetchedMapImageDataUrl: mapImageDataUrl,
    farmColorMap,
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

export async function generateApplicationsGeneralReportPDF({
  generatedAt,
  filtersSummary,
  periodLabel,
  rows,
  totalAppliedHectares,
}: GenerateApplicationsGeneralReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');

  const element = ApplicationsGeneralReportPDF({
    generatedAt,
    filtersSummary,
    periodLabel,
    rows,
    totalAppliedHectares,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateApplicationIndividualReportPDF({
  application,
  generatedAt,
}: GenerateApplicationIndividualReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const [enrichedApplication] = application.serviceOrder
    ? await enrichApplicationsWithDjiImageUrl(application.serviceOrder, [application])
    : [application];

  const linkedDjiFlights = await fetchLinkedDjiFlightMaps(enrichedApplication);
  const applicationForPdf = linkedDjiFlights.maps.length
    ? buildApplicationWithLinkedDjiFlights(
        enrichedApplication,
        linkedDjiFlights.flights,
        linkedDjiFlights.maps
      )
    : enrichedApplication;

  const djiImagesByApplicationId =
    linkedDjiFlights.maps.length
      ? ({} as DjiReportImageByApplicationId)
      : await prefetchDjiReportImagesByApplicationId([applicationForPdf]).catch(
          () => ({} as DjiReportImageByApplicationId)
        );
  const djiImage = linkedDjiFlights.maps[0]
    ? {
        imageSrc: linkedDjiFlights.maps[0].imageSrc,
        imageUrl: linkedDjiFlights.maps[0].imageUrl,
      }
    : djiImagesByApplicationId[applicationForPdf.id];
  const mapData = djiImage
    ? {
        mapImageDataUrl: null,
        mapOverlayPathDs: null,
        mapFallbackVectorPathD: null,
        mapUnavailableMessage: null,
      }
    : await prefetchApplicationIndividualMap(applicationForPdf);

  const element = ApplicationIndividualReportPDF({
    application: applicationForPdf,
    generatedAt,
    djiImageDataUrl: djiImage?.imageSrc ?? null,
    djiImageUrl: applicationForPdf.djiImageUrl ?? null,
    djiFlightMaps: linkedDjiFlights.maps,
    mapImageDataUrl: mapData.mapImageDataUrl,
    mapOverlayPathDs: mapData.mapOverlayPathDs,
    mapFallbackVectorPathD: mapData.mapFallbackVectorPathD,
    mapUnavailableMessage: mapData.mapUnavailableMessage,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generatePilotApplicationsReportPDF({
  generatedAt,
  filtersSummary,
  groups,
}: GeneratePilotApplicationsReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const element = PilotApplicationsReportPDF({
    generatedAt,
    filtersSummary,
    groups,
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
