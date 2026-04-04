import { pdf } from '@react-pdf/renderer';

import ApplicationsReportPDF from '@/components/PDFReports/ApplicationsReportPDF';
import { Application } from '@/types/applications.type';
import { ServiceOrder } from '@/types/service-order.type';
import { fetchRemoteImageAsDataUrl } from '@/utils/fetchRemoteImageAsDataUrl';
import { buildReportMapboxStaticUrl } from '@/utils/mapboxStaticReportMap';

interface GeneratePDFParams {
  serviceOrder: ServiceOrder;
  applications: Application[];
}

const REPORT_MAP_WIDTH = 1280;
const REPORT_MAP_HEIGHT = 480;

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
      console.log('[REPORT_PREFETCH_DEBUG]', {
        phase: 'pdfGenerator:no_plot',
        plotId,
        plotName: null,
        mapUrlExists: false,
        unavailableReason: null,
        usedLongUrlFallback: false,
        note: 'first application sem plot',
      });
      out[plotId] = null;
      continue;
    }
    const mapResult = buildReportMapboxStaticUrl({
      plot,
      mapWidth: REPORT_MAP_WIDTH,
      mapHeight: REPORT_MAP_HEIGHT,
      accessToken,
    });

    console.log('[REPORT_PREFETCH_DEBUG]', {
      phase: 'pdfGenerator:after_buildReportMapboxStaticUrl',
      plotId,
      plotName: plot.name ?? null,
      mapUrlExists: Boolean(mapResult.url),
      mapUrlLength: mapResult.url?.length ?? 0,
      unavailableReason: mapResult.unavailableReason,
      usedLongUrlFallback: mapResult.usedLongUrlFallback,
    });

    if (!mapResult.url) {
      out[plotId] = null;
      continue;
    }
    const dataUrl = await fetchRemoteImageAsDataUrl(mapResult.url);
    out[plotId] = dataUrl;

    console.log('[REPORT_PREFETCH_DEBUG]', {
      phase: 'pdfGenerator:after_fetchRemoteImageAsDataUrl',
      plotId,
      plotName: plot.name ?? null,
      prefetchResultExists: Boolean(dataUrl),
      prefetchDataUrlLength: typeof dataUrl === 'string' ? dataUrl.length : 0,
    });
  }

  return out;
}

export async function generateApplicationsReportPDF({
  serviceOrder,
  applications,
}: GeneratePDFParams): Promise<Blob> {
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
