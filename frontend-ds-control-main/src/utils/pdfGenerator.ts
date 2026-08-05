import ApplicationIndividualReportPDF from '@/components/PDFReports/ApplicationIndividualReportPDF';
import ApplicationsGeneralReportPDF, {
  type ApplicationsGeneralReportRow,
} from '@/components/PDFReports/ApplicationsGeneralReportPDF';
import ApplicationsReportPDF, {
  type ApplicationsReportPDFProps,
  type ApplicationsReportMetrics,
} from '@/components/PDFReports/ApplicationsReportPDF';
import CompletedPlotsPlannedAreaReportPDF from '@/components/PDFReports/CompletedPlotsPlannedAreaReportPDF';
import FarmsReportPDF, { type FarmsReportRow } from '@/components/PDFReports/FarmsReportPDF';
import GeneralReportPDF, {
  type GeneralNamedValue,
  type GeneralReportStatusSummary,
  type GeneralReportTotals,
} from '@/components/PDFReports/GeneralReportPDF';
import { PendingPlotsReportPDF } from '@/components/PDFReports/PendingPlotsReportPDF';
import PilotApplicationsReportPDF from '@/components/PDFReports/PilotApplicationsReportPDF';
import type { ReportPlotMapSection } from '@/components/PDFReports/ReportPlotMapPages';
import ServiceOrderStrategicReportPDF from '@/components/PDFReports/ServiceOrderStrategicReportPDF';
import ServiceOrdersDetailedReportPDF, {
  type ServiceOrderDetailedSection,
} from '@/components/PDFReports/ServiceOrdersDetailedReportPDF';
import {
  getApplicationDjiFlights,
  type ApplicationDjiFlight,
} from '@/services/application.service';
import { Application } from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import { ServiceOrder } from '@/types/service-order.type';
import {
  enrichApplicationsWithDjiImageUrl,
  prefetchDjiReportImagesByApplicationId,
  type DjiReportImageByApplicationId,
} from '@/utils/djiReportAssets';
import { deriveFarmStrokeColor, resolveFarmMapColor } from '@/utils/farm-map-color';
import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';
import { buildReportMapAssets } from '@/utils/report-map-assets';
import {
  buildStrategicMapFilename,
  scopeStrategicMapServiceOrder,
  type StrategicMapScope,
} from '@/utils/strategic-map-scope';
import {
  buildStrategicMapStaticBaseUrl,
  buildStrategicMapViewport,
  extractPlotPolygons,
  sanitizeStrategicPolygons,
  type StrategicMapShapeInput,
  type StrategicMapViewport,
} from '@/utils/strategicReportMap2d';
import {
  buildStrategicFarmColorMap,
  type StrategicFarmColor,
} from '@/utils/strategicReportPalette';

interface GeneratePDFParams {
  serviceOrder: ServiceOrder;
  applications: Application[];
  reportMetrics?: ApplicationsReportMetrics;
  reportPeriod?: ApplicationsReportPDFProps['reportPeriod'];
}

interface GenerateCompletedPlotsPlannedAreaPDFParams extends GeneratePDFParams {
  completedPlotIds: string[];
}

export interface GenerateFarmsReportPDFParams {
  rows: FarmsReportRow[];
  farms: Farm[];
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
  applications: Application[];
}

export interface GenerateApplicationsGeneralReportPDFParams {
  generatedAt: string;
  filtersSummary: Array<{ label: string; value: string }>;
  periodLabel: string;
  rows: ApplicationsGeneralReportRow[];
  totalAppliedHectares: number;
  applications?: Application[];
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
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
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
  const farmById = new Map((serviceOrder.farms || []).map((farm) => [farm.id, farm]));
  return buildStrategicFarmColorMap(
    orderedFarmIds.map((farmId) => farmById.get(farmId) ?? { id: farmId })
  );
}

async function prefetchStrategicReportMapBase(serviceOrder: ServiceOrder): Promise<{
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
    djiMatchConfidence: maps.length
      ? (application.djiMatchConfidence ?? 1)
      : application.djiMatchConfidence,
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

function applicationFarm(application: Application, serviceOrder?: ServiceOrder) {
  return (
    application.farm ??
    serviceOrder?.farms?.find((farm) => farm.id === application.farmId) ??
    { id: application.farmId || application.plot?.farmId || 'farm-unknown' }
  );
}

function compareMapSections(a: ReportPlotMapSection, b: ReportPlotMapSection): number {
  const aKey = [a.customerName, a.farmName, a.serviceOrderNumber, a.asset.plot.name]
    .filter((value) => value !== undefined)
    .join('|');
  const bKey = [b.customerName, b.farmName, b.serviceOrderNumber, b.asset.plot.name]
    .filter((value) => value !== undefined)
    .join('|');
  return aKey.localeCompare(bKey, 'pt-BR', { numeric: true });
}

export async function generateApplicationsReportPDF({
  serviceOrder,
  applications,
  reportMetrics,
  reportPeriod,
}: GeneratePDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const enrichedApplications = await enrichApplicationsWithDjiImageUrl(serviceOrder, applications);
  const [reportMapAssets, djiImagesByApplicationId] = await Promise.all([
    buildReportMapAssets(
      enrichedApplications
        .filter((application) => Boolean(application.plotId && application.plot))
        .map((application) => ({
          plot: application.plot,
          farm: applicationFarm(application, serviceOrder),
        })),
      { accessToken: getReportMapboxAccessToken(), concurrency: 3 }
    ),
    prefetchDjiReportImagesByApplicationId(enrichedApplications).catch(() => ({})),
  ]);

  const element = ApplicationsReportPDF({
    serviceOrder,
    applications: enrichedApplications,
    reportMetrics,
    reportPeriod,
    reportMapAssetsByPlotId: reportMapAssets.byPlotId,
    djiImagesByApplicationId,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateCompletedPlotsPlannedAreaReportPDF({
  serviceOrder,
  applications,
  completedPlotIds,
  reportMetrics,
}: GenerateCompletedPlotsPlannedAreaPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const completedIds = new Set(completedPlotIds);
  const completedApplications = applications.filter((application) =>
    Boolean(application.plotId && completedIds.has(application.plotId))
  );
  const enrichedApplications = await enrichApplicationsWithDjiImageUrl(
    serviceOrder,
    completedApplications
  );
  const farmById = new Map((serviceOrder.farms || []).map((farm) => [farm.id, farm]));
  const completedPlots = (serviceOrder.plots || []).filter((plot) =>
    Boolean(plot.id && completedIds.has(plot.id))
  );
  const [reportMapAssets, djiImagesByApplicationId] = await Promise.all([
    buildReportMapAssets(
      [
        ...completedPlots.map((plot) => ({
          plot,
          farm: farmById.get(plot.farmId || ''),
        })),
        ...enrichedApplications
          .filter((application) => Boolean(application.plotId && application.plot))
          .map((application) => ({
            plot: application.plot,
            farm: applicationFarm(application, serviceOrder),
          })),
      ],
      { accessToken: getReportMapboxAccessToken(), concurrency: 3 }
    ),
    prefetchDjiReportImagesByApplicationId(enrichedApplications).catch(() => ({})),
  ]);
  const element = CompletedPlotsPlannedAreaReportPDF({
    serviceOrder,
    applications: enrichedApplications,
    completedPlotIds,
    reportMetrics,
    reportMapAssetsByPlotId: reportMapAssets.byPlotId,
    djiImagesByApplicationId,
  });

  // @ts-expect-error - toBlob is not typed
  return pdf(element).toBlob();
}

export async function generatePendingPlotsReportPDF({
  serviceOrder,
  pendingPlotIds,
}: {
  serviceOrder: ServiceOrder;
  pendingPlotIds: string[];
}): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const pendingIds = new Set(pendingPlotIds);
  const plots = (serviceOrder.plots || []).filter((plot) => Boolean(plot.id && pendingIds.has(plot.id)));
  const farmById = new Map((serviceOrder.farms || []).map((farm) => [farm.id, farm]));
  const mapBatch = await buildReportMapAssets(
    plots.map((plot) => ({ plot, farm: farmById.get(plot.farmId || '') })),
    { accessToken: getReportMapboxAccessToken(), concurrency: 3 }
  );
  const mapSections: ReportPlotMapSection[] = mapBatch.assets
    .map((asset) => ({
      asset,
      customerName: serviceOrder.customer?.name,
      farmName: farmById.get(asset.farmId || '')?.name,
      serviceOrderNumber: serviceOrder.number,
    }))
    .sort(compareMapSections);
  return pdf(PendingPlotsReportPDF({ serviceOrder, pendingPlotIds, mapSections })).toBlob();
}

export async function generateServiceOrdersDetailedConsolidatedPDF({
  generatedAt,
  filtersSummary,
  sections,
}: GenerateServiceOrdersDetailedConsolidatedPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const applications = sections.flatMap((section) => section.applications);
  const mapBatch = await buildReportMapAssets(
    applications
      .filter((application) => Boolean(application.plotId && application.plot))
      .map((application) => ({
        plot: application.plot,
        farm: applicationFarm(
          application,
          sections.find((section) => section.serviceOrder.id === application.serviceOrderId)
            ?.serviceOrder
        ),
      })),
    { accessToken: getReportMapboxAccessToken(), concurrency: 3 }
  );
  const mapSections: ReportPlotMapSection[] = mapBatch.assets.map((asset) => {
    const plotApplications = applications.filter((application) => application.plotId === asset.plotId);
    const firstApplication = plotApplications[0];
    const serviceOrder = sections.find(
      (section) => section.serviceOrder.id === firstApplication?.serviceOrderId
    )?.serviceOrder;
    return {
      asset,
      applications: plotApplications,
      customerName: serviceOrder?.customer?.name,
      farmName:
        firstApplication?.farm?.name ||
        serviceOrder?.farms?.find((farm) => farm.id === asset.farmId)?.name,
      serviceOrderNumber: serviceOrder?.number,
      serviceOrderNumbers: Array.from(
        new Set(
          plotApplications
            .map((application) =>
              sections.find((section) => section.serviceOrder.id === application.serviceOrderId)
                ?.serviceOrder.number
            )
            .filter((value): value is number => typeof value === 'number')
        )
      ),
    };
  }).sort(compareMapSections);
  const element = ServiceOrdersDetailedReportPDF({
    title: 'Relatorio Detalhado de Ordens de Servico',
    generatedAt,
    filtersSummary,
    sections,
    mapSections,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export async function generateServiceOrderStrategicReportPDF(
  params: GeneratePDFParams & { scope: StrategicMapScope }
): Promise<Blob> {
  const { serviceOrder, scope } = params;
  const { pdf } = await import('@react-pdf/renderer');
  const scopedServiceOrder = scopeStrategicMapServiceOrder(serviceOrder, scope);
  if (scopedServiceOrder.plots.length === 0) {
    throw new Error(
      scope === 'completed'
        ? 'Não há áreas concluídas para gerar o mapa estratégico.'
        : 'Não há áreas pendentes ou em andamento para gerar o mapa estratégico.'
    );
  }
  const diagnostics = buildStrategicPlotDiagnostics(scopedServiceOrder);
  if (diagnostics.validPlots.length === 0) {
    throw new Error(
      scope === 'completed'
        ? 'As áreas concluídas não possuem geometria válida para gerar o mapa estratégico.'
        : 'As áreas pendentes não possuem geometria válida para gerar o mapa estratégico.'
    );
  }
  // eslint-disable-next-line no-console
  console.info('[StrategicPDF] Diagnostics', {
    serviceOrderId: scopedServiceOrder.id,
    serviceOrderNumber: scopedServiceOrder.number,
    scope,
    totalPlotsInServiceOrder: diagnostics.totalPlots,
    totalValidPlots: diagnostics.validPlots.length,
    totalInvalidPlots: diagnostics.invalidPlots.length,
    totalShapesInput: diagnostics.shapeIds.length,
    validPlotIdsAndNames: diagnostics.validPlots,
    shapePlotIdsAndNames: diagnostics.validPlots,
    invalidPlotIdsAndNames: diagnostics.invalidPlots,
  });

  const { mapViewport, mapBaseDataUrl, mapImageDataUrl, farmColorMap } =
    await prefetchStrategicReportMapBase(scopedServiceOrder);

  const element = ServiceOrderStrategicReportPDF({
    serviceOrder: scopedServiceOrder,
    scope,
    mapViewport,
    prefetchedMapBaseDataUrl: mapBaseDataUrl,
    prefetchedMapImageDataUrl: mapImageDataUrl,
    farmColorMap,
  });

  // @ts-expect-error - toBlob is not typed
  const blob = await pdf(element).toBlob();
  return blob;
}

export { buildStrategicMapFilename };

export async function generateFarmsReportPDF({
  rows,
  farms,
  generatedAt,
  filtersSummary,
}: GenerateFarmsReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const mapBatch = await buildReportMapAssets(
    farms.flatMap((farm) => (farm.plots || []).map((plot) => ({ plot, farm }))),
    { accessToken: getReportMapboxAccessToken(), concurrency: 3 }
  );
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));
  const rowById = new Map(rows.map((row) => [row.farmId, row]));
  const mapSections: ReportPlotMapSection[] = mapBatch.assets.map((asset) => {
    const farm = farmById.get(asset.farmId || '');
    const row = farm ? rowById.get(farm.id) : undefined;
    return {
      asset,
      customerName: row?.customerName || farm?.customer?.name,
      farmName: row?.farmName || farm?.name,
    };
  }).sort(compareMapSections);

  const element = FarmsReportPDF({
    rows,
    generatedAt,
    filtersSummary,
    mapSections,
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
  applications,
}: GenerateGeneralReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const mapBatch = await buildReportMapAssets(
    applications
      .filter((application) => Boolean(application.plotId && application.plot))
      .map((application) => ({ plot: application.plot, farm: applicationFarm(application, application.serviceOrder) })),
    { accessToken: getReportMapboxAccessToken(), concurrency: 3 }
  );
  const mapSections: ReportPlotMapSection[] = mapBatch.assets.map((asset) => {
    const plotApplications = applications.filter((application) => application.plotId === asset.plotId);
    const firstApplication = plotApplications[0];
    return {
      asset,
      applications: plotApplications,
      customerName: firstApplication?.serviceOrder?.customer?.name,
      farmName: firstApplication?.farm?.name,
      serviceOrderNumber: firstApplication?.serviceOrder?.number,
      serviceOrderNumbers: Array.from(
        new Set(
          plotApplications
            .map((application) => application.serviceOrder?.number)
            .filter((value): value is number => typeof value === 'number')
        )
      ),
    };
  }).sort(compareMapSections);

  const element = GeneralReportPDF({
    generatedAt,
    filtersSummary,
    totals,
    statusSummary,
    byFarm,
    byPilot,
    byProduct,
    byAssistant,
    mapSections,
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
  applications = [],
}: GenerateApplicationsGeneralReportPDFParams): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const mapBatch = await buildReportMapAssets(
    applications
      .filter((application) => Boolean(application.plotId && application.plot))
      .map((application) => ({
        plot: application.plot,
        farm: applicationFarm(application, application.serviceOrder),
      })),
    { accessToken: getReportMapboxAccessToken(), concurrency: 3 }
  );
  const mapSections: ReportPlotMapSection[] = mapBatch.assets.map((asset) => {
    const plotApplications = applications.filter((application) => application.plotId === asset.plotId);
    const firstApplication = plotApplications[0];
    return {
      asset,
      applications: plotApplications,
      customerName: firstApplication?.serviceOrder?.customer?.name,
      farmName: firstApplication?.farm?.name,
      serviceOrderNumber: firstApplication?.serviceOrder?.number,
      serviceOrderNumbers: Array.from(
        new Set(
          plotApplications
            .map((application) => application.serviceOrder?.number)
            .filter((value): value is number => typeof value === 'number')
        )
      ),
    };
  }).sort(compareMapSections);

  const element = ApplicationsGeneralReportPDF({
    generatedAt,
    filtersSummary,
    periodLabel,
    rows,
    totalAppliedHectares,
    mapSections,
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

  const djiImagesByApplicationId = linkedDjiFlights.maps.length
    ? ({} as DjiReportImageByApplicationId)
    : await prefetchDjiReportImagesByApplicationId([applicationForPdf]).catch(
        () => ({}) as DjiReportImageByApplicationId
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
    : await buildReportMapAssets(
        applicationForPdf.plot
          ? [
              {
                plot: applicationForPdf.plot,
                farm: applicationFarm(applicationForPdf, applicationForPdf.serviceOrder),
              },
            ]
          : [],
        { accessToken: getReportMapboxAccessToken(), concurrency: 1 }
      ).then((batch) => {
        const asset = batch.assets[0];
        return {
          mapImageDataUrl: asset?.imageDataUrl ?? null,
          mapOverlayPathDs: asset?.overlayPathDs ?? null,
          mapFallbackVectorPathD: asset?.vectorPathD ?? null,
          mapUnavailableMessage: asset?.message ?? 'Geometria do talhão indisponível.',
        };
      });
  const farmMapColor = resolveFarmMapColor(
    applicationForPdf.farm ?? { id: applicationForPdf.farmId || 'farm-unknown' }
  );

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
    farmMapColor,
    farmMapStrokeColor: deriveFarmStrokeColor(farmMapColor),
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
