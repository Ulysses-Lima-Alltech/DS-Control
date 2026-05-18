import {
  FileText,
  MapPin,
  SprayCan,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import MapViewer from '@/components/MapViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGetApplicationsByFarmId } from '@/queries/application.query';
import { useGetFarmById } from '@/queries/farm.query';
import { Application } from '@/types/applications.type';
import { Plot } from '@/types/plot.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';
import {
  buildReportMapboxStaticUrl,
  getReportMapPlaceholderMessage,
} from '@/utils/mapboxStaticReportMap';
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from '@/utils/map-utils';
import { formatOperationalDateBR, toOperationalDateYMD } from '@/utils/operational-date';
import { buildPlotPolygonSvgPathDs } from '@/utils/reportPlotPolygonSvg';
import { formatTimestamp } from '@/utils/timestamp-formatter';

import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_FALLBACK_TOKEN =
  'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';

const REPORT_MAP_WIDTH = 1400;
const REPORT_MAP_HEIGHT = 620;

const DEFAULT_REPORT_SECTIONS = {
  includeMap: true,
  includeSummary: true,
  includeDetailedHistory: true,
};

type DialogPlotDetailsProps = {
  farmId: string;
  plotId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ReportSections = typeof DEFAULT_REPORT_SECTIONS;

function parseNumericValue(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatAreaValue(value: number) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function formatPlotArea(hectare: string | undefined) {
  if (!hectare) return 'N/A';
  const parsed = parseNumericValue(hectare);
  if (!parsed) return '0,00 ha';
  return formatAreaValue(parsed);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function firstStringFromKeys(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[]
): string | null {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getApplicationOperationType(application: Application): string | null {
  const fromApplication = firstStringFromKeys(application as unknown as Record<string, unknown>, [
    'operation',
    'operationType',
    'applicationType',
    'method',
    'type',
  ]);

  if (fromApplication) {
    return fromApplication;
  }

  return firstStringFromKeys(application.serviceOrder as unknown as Record<string, unknown>, [
    'operation',
    'operationType',
    'method',
    'type',
  ]);
}

export default function DialogPlotDetails({
  farmId,
  plotId,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: DialogPlotDetailsProps) {
  const [selectedPlotFilter, setSelectedPlotFilter] = useState<string | undefined>(plotId);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const [isReportOptionsOpen, setIsReportOptionsOpen] = useState(false);
  const [reportProductFilter, setReportProductFilter] = useState('all');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportSections, setReportSections] = useState<ReportSections>(DEFAULT_REPORT_SECTIONS);

  const isOpen = externalOpen !== undefined ? externalOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;
  const isExternalControlled = externalOpen !== undefined;

  const { data, isLoading: isLoadingFarm } = useGetFarmById(
    farmId,
    {
      includePlots: 'true',
      includeGeoJson: 'true',
      includeCustomer: 'true',
    },
    {
      queryKey: ['farm', 'details', farmId],
      enabled: isOpen,
    }
  );

  const { data: applicationData, isLoading: isLoadingApplications } = useGetApplicationsByFarmId(
    data?.farm?.id || '',
    {
      enabled: isOpen && !!data?.farm?.id,
    }
  );

  const farmPlots = useMemo(() => {
    return (data?.farm?.plots ?? []).filter((plot) => !plot.deletedAt && plot.id);
  }, [data?.farm?.plots]);

  const plotOptions = useMemo(() => {
    return farmPlots
      .filter((plot): plot is Plot & { id: string } => Boolean(plot.id))
      .map((plot) => ({
        value: plot.id,
        label: plot.name,
      }));
  }, [farmPlots]);

  useEffect(() => {
    if (plotId) {
      setSelectedPlotFilter(plotId);
    }
  }, [plotId]);

  useEffect(() => {
    if (!isOpen) return;

    if (plotId) {
      setSelectedPlotFilter(plotId);
      return;
    }

    setSelectedPlotFilter((previousValue) => previousValue ?? plotOptions[0]?.value);
  }, [isOpen, plotId, plotOptions]);

  const activePlot = useMemo(() => {
    if (!selectedPlotFilter) {
      return farmPlots[0] ?? null;
    }

    return farmPlots.find((plot) => plot.id === selectedPlotFilter) ?? farmPlots[0] ?? null;
  }, [farmPlots, selectedPlotFilter]);

  const filteredApplications = useMemo(() => {
    if (!applicationData?.data || !activePlot?.id) return [];
    return applicationData.data.filter((application) => application.plotId === activePlot.id);
  }, [applicationData?.data, activePlot?.id]);

  const sortedApplications = useMemo(() => {
    return [...filteredApplications].sort((first, second) => {
      const firstDate = toOperationalDateYMD(first.date) ?? '';
      const secondDate = toOperationalDateYMD(second.date) ?? '';

      if (firstDate === secondDate) {
        const firstCreated = toOperationalDateYMD(first.createdAt) ?? '';
        const secondCreated = toOperationalDateYMD(second.createdAt) ?? '';
        return secondCreated.localeCompare(firstCreated);
      }

      return secondDate.localeCompare(firstDate);
    });
  }, [filteredApplications]);

  const historySummary = useMemo(() => {
    const totalApplications = sortedApplications.length;
    const totalAppliedArea = sortedApplications.reduce((sum, application) => {
      return sum + parseNumericValue(application.hectares);
    }, 0);
    const latestApplication = sortedApplications[0] ?? null;

    return {
      totalApplications,
      totalAppliedArea,
      latestApplication,
      latestCulture: latestApplication?.culture?.name || 'N/A',
      latestApplicationDate: latestApplication ? formatApplicationDate(latestApplication.date) : 'N/A',
    };
  }, [sortedApplications]);

  const reportProductOptions = useMemo(() => {
    const map = new Map<string, string>();

    sortedApplications.forEach((application) => {
      if (application.productId && application.product?.name && !map.has(application.productId)) {
        map.set(application.productId, application.product.name);
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'));
  }, [sortedApplications]);

  const reportFilteredApplications = useMemo(() => {
    return sortedApplications.filter((application) => {
      if (reportProductFilter !== 'all' && application.productId !== reportProductFilter) {
        return false;
      }

      const applicationDate = toOperationalDateYMD(application.date);
      if (!applicationDate) {
        return false;
      }

      if (reportStartDate && applicationDate < reportStartDate) {
        return false;
      }

      if (reportEndDate && applicationDate > reportEndDate) {
        return false;
      }

      return true;
    });
  }, [sortedApplications, reportProductFilter, reportStartDate, reportEndDate]);

  const reportSummary = useMemo(() => {
    const totalAppliedArea = reportFilteredApplications.reduce((sum, application) => {
      return sum + parseNumericValue(application.hectares);
    }, 0);

    const latestApplication = reportFilteredApplications[0] ?? null;

    return {
      totalAppliedArea,
      totalApplications: reportFilteredApplications.length,
      latestCulture: latestApplication?.culture?.name ?? historySummary.latestCulture,
    };
  }, [reportFilteredApplications, historySummary.latestCulture]);

  const geoData = useMemo(() => {
    if (!farmPlots.length) return undefined;
    return convertDatabasePlotsToMapViewerPlotsFeatureCollection(farmPlots);
  }, [farmPlots]);

  function updateReportSection(
    key: keyof ReportSections,
    checked: boolean | 'indeterminate'
  ) {
    setReportSections((previousState) => ({
      ...previousState,
      [key]: checked === true,
    }));
  }

  function resetAndOpenReportOptions() {
    if (!activePlot) {
      toast.error('Selecione um talhao para abrir as opcoes de relatorio.');
      return;
    }

    setReportProductFilter('all');
    setReportStartDate('');
    setReportEndDate('');
    setReportSections(DEFAULT_REPORT_SECTIONS);
    setIsReportOptionsOpen(true);
  }

  function generatePrintPreview() {
    if (!activePlot) {
      toast.error('Nenhum talhao selecionado para gerar relatorio.');
      return;
    }

    if (reportStartDate && reportEndDate && reportStartDate > reportEndDate) {
      toast.error('Periodo invalido. Ajuste as datas inicial e final.');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');

    if (!printWindow) {
      toast.error('Bloqueador de pop-up ativo. Permita a abertura da visualizacao para imprimir.');
      return;
    }

    const mapResult = buildReportMapboxStaticUrl({
      plot: activePlot,
      mapWidth: REPORT_MAP_WIDTH,
      mapHeight: REPORT_MAP_HEIGHT,
      accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || MAPBOX_FALLBACK_TOKEN,
    });

    const polygonPaths =
      buildPlotPolygonSvgPathDs(activePlot, REPORT_MAP_WIDTH, REPORT_MAP_HEIGHT) ?? [];

    const mapSection = reportSections.includeMap
      ? mapResult.url
        ? `
        <section class="report-map-section">
          <div class="map-wrapper">
            <img src="${mapResult.url}" alt="Mapa do Talhao" class="map-image" />
            ${
              polygonPaths.length
                ? `
              <svg viewBox="0 0 ${REPORT_MAP_WIDTH} ${REPORT_MAP_HEIGHT}" preserveAspectRatio="none" class="map-overlay">
                ${polygonPaths
                  .map(
                    (path) =>
                      `<path d="${path}" fill="#EAAE07" fill-opacity="0.28" stroke="#B8860B" stroke-width="2" fill-rule="evenodd" />`
                  )
                  .join('')}
              </svg>
            `
                : ''
            }
          </div>
        </section>
      `
        : `
        <section class="report-map-section map-placeholder">
          ${escapeHtml(getReportMapPlaceholderMessage(mapResult.unavailableReason))}
        </section>
      `
      : '';

    const detailRows = reportFilteredApplications.length
      ? reportFilteredApplications
          .map((application) => {
            const operationType = getApplicationOperationType(application) || '-';

            return `
            <tr>
              <td>${escapeHtml(formatApplicationDate(application.date))}</td>
              <td>${escapeHtml(operationType)}</td>
              <td>${escapeHtml(application.product?.name || '-')}</td>
              <td>${escapeHtml(application.pilot?.name || '-')}</td>
              <td>${escapeHtml(application.drone?.name || '-')}</td>
              <td>${escapeHtml(formatAreaValue(parseNumericValue(application.hectares)))}</td>
            </tr>
          `;
          })
          .join('')
      : `
        <tr>
          <td colspan="6" class="empty-row">Nenhuma aplicacao encontrada para os filtros selecionados.</td>
        </tr>
      `;

    const reportPeriod =
      reportStartDate || reportEndDate
        ? `${formatOperationalDateBR(reportStartDate || undefined)} ate ${formatOperationalDateBR(reportEndDate || undefined)}`
        : 'Todos os periodos';

    const reportHtml = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Relatorio de Aplicacoes por Talhao</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              background: #f5f5f5;
              padding: 24px;
            }
            .report-sheet {
              max-width: 1180px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 12px;
              padding: 28px;
              border: 1px solid #e5e7eb;
            }
            .report-title {
              margin: 0;
              font-size: 28px;
              color: #1f2937;
            }
            .report-subtitle {
              margin: 8px 0 0;
              color: #6b7280;
              font-size: 14px;
            }
            .report-period {
              margin: 4px 0 0;
              color: #6b7280;
              font-size: 13px;
            }
            .report-map-section {
              margin-top: 24px;
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              overflow: hidden;
              min-height: 320px;
              background: #f3f4f6;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #4b5563;
              font-weight: 600;
            }
            .map-wrapper {
              position: relative;
              width: 100%;
              height: 100%;
              min-height: 320px;
            }
            .map-image,
            .map-overlay {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
            }
            .summary-grid {
              margin-top: 24px;
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
            }
            .summary-card {
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              padding: 12px;
              background: #fafafa;
            }
            .summary-label {
              display: block;
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            .summary-value {
              margin-top: 6px;
              font-size: 16px;
              font-weight: 700;
              color: #1f2937;
            }
            .info-grid {
              margin-top: 16px;
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
            }
            .info-item {
              border: 1px solid #f0f1f4;
              border-radius: 8px;
              padding: 10px;
              background: #fff;
            }
            .info-item strong {
              display: block;
              color: #6b7280;
              font-size: 12px;
              margin-bottom: 4px;
            }
            .history-section {
              margin-top: 26px;
            }
            .history-title {
              margin: 0 0 12px;
              font-size: 18px;
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              overflow: hidden;
            }
            thead {
              background: #f9fafb;
            }
            th,
            td {
              text-align: left;
              padding: 10px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 13px;
            }
            .empty-row {
              text-align: center;
              color: #6b7280;
              padding: 22px;
            }
            @media print {
              body {
                background: white;
                padding: 0;
              }
              .report-sheet {
                max-width: none;
                border: 0;
                border-radius: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <main class="report-sheet">
            <h1 class="report-title">Relatorio de Aplicacoes por Talhao</h1>
            <p class="report-subtitle">
              Talhao: ${escapeHtml(activePlot.name)} | Fazenda: ${escapeHtml(data?.farm?.name || 'N/A')} | Cliente: ${escapeHtml(data?.farm?.customer?.name || 'N/A')}
            </p>
            <p class="report-period">Periodo: ${escapeHtml(reportPeriod)}</p>

            ${mapSection}

            ${
              reportSections.includeSummary
                ? `
              <section class="summary-grid">
                <article class="summary-card">
                  <span class="summary-label">Fazenda</span>
                  <span class="summary-value">${escapeHtml(data?.farm?.name || 'N/A')}</span>
                </article>
                <article class="summary-card">
                  <span class="summary-label">Cliente</span>
                  <span class="summary-value">${escapeHtml(data?.farm?.customer?.name || 'N/A')}</span>
                </article>
                <article class="summary-card">
                  <span class="summary-label">Talhao e Area</span>
                  <span class="summary-value">${escapeHtml(`${activePlot.name} (${formatPlotArea(activePlot.hectare)})`)}</span>
                </article>
                <article class="summary-card">
                  <span class="summary-label">Total de aplicacoes</span>
                  <span class="summary-value">${escapeHtml(String(reportSummary.totalApplications))}</span>
                </article>
                <article class="summary-card">
                  <span class="summary-label">Area total aplicada</span>
                  <span class="summary-value">${escapeHtml(formatAreaValue(reportSummary.totalAppliedArea))}</span>
                </article>
                <article class="summary-card">
                  <span class="summary-label">Cultura</span>
                  <span class="summary-value">${escapeHtml(reportSummary.latestCulture || 'N/A')}</span>
                </article>
              </section>
            `
                : ''
            }

            <section class="info-grid">
              <article class="info-item"><strong>Talhao</strong>${escapeHtml(activePlot.name || 'N/A')}</article>
              <article class="info-item"><strong>ID do Talhao</strong>${escapeHtml(activePlot.id || 'N/A')}</article>
              <article class="info-item"><strong>Data de Cadastro</strong>${escapeHtml(formatTimestamp(activePlot.createdAt))}</article>
              <article class="info-item"><strong>Gerado em</strong>${escapeHtml(new Date().toLocaleString('pt-BR'))}</article>
            </section>

            ${
              reportSections.includeDetailedHistory
                ? `
              <section class="history-section">
                <h2 class="history-title">Detalhamento do Historico</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Operacao/Tipo</th>
                      <th>Produto</th>
                      <th>Piloto</th>
                      <th>Drone</th>
                      <th>Area Aplicada</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detailRows}
                  </tbody>
                </table>
              </section>
            `
                : ''
            }
          </main>
          <script>
            window.addEventListener('load', function () {
              setTimeout(function () {
                window.print();
              }, 300);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();

    setIsReportOptionsOpen(false);
  }

  const hasNoApplications = !isLoadingApplications && sortedApplications.length === 0;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setIsReportOptionsOpen(false);
          }
          setIsOpen(nextOpen);
        }}
      >
        {!isExternalControlled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant='outline' size='icon' className='h-8 w-8'>
                  <MapPin className='h-4 w-4' />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Ver historico do talhao</TooltipContent>
          </Tooltip>
        )}

        <DialogContent
          showCloseButton={false}
          className='h-[92vh] w-[96vw] max-w-[96vw] sm:max-w-[94vw] lg:max-w-7xl flex flex-col gap-4 overflow-hidden p-5 sm:p-6'
        >
          <DialogHeader className='pr-28 text-left'>
            <DialogTitle className='text-xl sm:text-2xl font-semibold flex items-start gap-2'>
              <MapPin className='h-6 w-6 text-primary mt-0.5' />
              <span>
                Historico Completo do Talhao - {activePlot?.name || 'Talhao'}
              </span>
            </DialogTitle>
            <DialogDescription className='text-sm sm:text-base'>
              {data?.farm
                ? `Fazenda: ${data.farm.name} | Cliente: ${data.farm.customer?.name || 'N/A'}`
                : 'Sem dados de fazenda disponiveis'}
            </DialogDescription>
          </DialogHeader>

          <div className='absolute right-4 top-4 flex items-center gap-2'>
            <Button
              type='button'
              className='bg-orange-600 hover:bg-orange-700 text-white h-9 px-3'
              onClick={resetAndOpenReportOptions}
            >
              <FileText className='h-4 w-4 mr-2' />
              Relatorio PDF
            </Button>
            <DialogClose asChild>
              <Button type='button' variant='ghost' size='icon' className='h-9 w-9'>
                <X className='h-4 w-4' />
              </Button>
            </DialogClose>
          </div>

          {plotOptions.length > 1 && (
            <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-sm text-muted-foreground'>Selecione o talhao para visualizar o historico.</p>
              <div className='w-full sm:w-[330px]'>
                <SearchableSelect
                  options={plotOptions}
                  value={activePlot?.id}
                  onValueChange={(plotValue) => setSelectedPlotFilter(plotValue)}
                  placeholder='Selecionar talhao...'
                  emptyText='Nenhum talhao encontrado'
                  searchPlaceholder='Buscar talhao...'
                  className='w-full'
                  clearable={false}
                />
              </div>
            </div>
          )}

          <div className='flex-1 min-h-0 overflow-y-auto pr-1'>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
              <Card className='order-1 lg:order-2 lg:col-span-8 lg:row-span-2 overflow-hidden'>
                <CardHeader>
                  <CardTitle className='text-lg'>Visualizacao do Talhao</CardTitle>
                  <CardDescription>
                    {activePlot
                      ? `Talhao em destaque: ${activePlot.name}`
                      : 'Selecione um talhao para visualizar'}
                  </CardDescription>
                </CardHeader>
                <CardContent className='p-0'>
                  <div className='h-[320px] sm:h-[380px] lg:h-[560px]'>
                    {isLoadingFarm ? (
                      <Skeleton className='h-full w-full' />
                    ) : (
                      <MapViewer
                        layerNameToHighlight={activePlot?.name}
                        layerPlotIdsToHighlight={activePlot?.id ? [activePlot.id] : undefined}
                        geoData={geoData}
                        onPlotClick={(clickedPlotId) => {
                          const clickedPlot = farmPlots.find((plot) => plot.id === clickedPlotId);
                          if (clickedPlot?.id) {
                            setSelectedPlotFilter(clickedPlot.id);
                          }
                        }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className='order-2 lg:order-1 lg:col-span-12'>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Resumo do Talhao</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                    <div className='rounded-md border bg-muted/20 p-3'>
                      <p className='text-xs text-muted-foreground'>Total de Aplicacoes</p>
                      <p className='mt-1 text-sm font-semibold'>{historySummary.totalApplications}</p>
                    </div>
                    <div className='rounded-md border bg-muted/20 p-3'>
                      <p className='text-xs text-muted-foreground'>Area Total Aplicada</p>
                      <p className='mt-1 text-sm font-semibold'>
                        {formatAreaValue(historySummary.totalAppliedArea)}
                      </p>
                    </div>
                    <div className='rounded-md border bg-muted/20 p-3'>
                      <p className='text-xs text-muted-foreground'>Ultima Aplicacao</p>
                      <p className='mt-1 text-sm font-semibold'>
                        {historySummary.latestApplicationDate}
                      </p>
                    </div>
                    <div className='rounded-md border bg-muted/20 p-3'>
                      <p className='text-xs text-muted-foreground'>Cultura Mais Recente</p>
                      <p className='mt-1 text-sm font-semibold truncate'>
                        {historySummary.latestCulture}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className='order-3 lg:order-3 lg:col-span-4'>
                <CardHeader>
                  <CardTitle className='text-lg'>Informacoes do Talhao</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-3 text-sm'>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>Fazenda</span>
                      <span className='text-right font-medium'>{data?.farm?.name || 'N/A'}</span>
                    </div>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>Cliente</span>
                      <span className='text-right font-medium'>
                        {data?.farm?.customer?.name || 'N/A'}
                      </span>
                    </div>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>Area do Talhao</span>
                      <span className='text-right font-medium'>
                        {formatPlotArea(activePlot?.hectare)}
                      </span>
                    </div>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>Data de Cadastro</span>
                      <span className='text-right font-medium'>
                        {formatTimestamp(activePlot?.createdAt)}
                      </span>
                    </div>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>Cultura Mais Recente</span>
                      <span className='text-right font-medium'>{historySummary.latestCulture}</span>
                    </div>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>Identificador</span>
                      <span className='text-right font-mono text-xs'>{activePlot?.id || 'N/A'}</span>
                    </div>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>Nome do Talhao</span>
                      <span className='text-right font-medium'>{activePlot?.name || 'N/A'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className='order-4 lg:order-4 lg:col-span-4 lg:max-h-[560px] overflow-hidden'>
                <CardHeader>
                  <CardTitle className='text-lg'>Historico de Aplicacoes</CardTitle>
                  <CardDescription>
                    {isLoadingApplications
                      ? 'Carregando aplicacoes...'
                      : `${sortedApplications.length} aplicacoes registradas`}
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3 overflow-y-auto max-h-[440px] pr-1'>
                  {isLoadingApplications &&
                    Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={`app-loading-${index}`} className='h-28 w-full rounded-md' />
                    ))}

                  {hasNoApplications && (
                    <div className='rounded-md border border-dashed p-5 text-center'>
                      <SprayCan className='mx-auto mb-3 h-8 w-8 text-muted-foreground/70' />
                      <p className='text-sm font-medium'>Nenhuma aplicacao encontrada para este talhao.</p>
                    </div>
                  )}

                  {!isLoadingApplications &&
                    sortedApplications.map((application) => {
                      const operationType = getApplicationOperationType(application);

                      return (
                        <Card key={application.id} className='border-muted'>
                          <CardContent className='p-3 space-y-3'>
                            <div className='flex items-start justify-between gap-3'>
                              <div>
                                <p className='text-sm font-semibold'>{application.product?.name || 'N/A'}</p>
                                <p className='text-xs text-muted-foreground'>
                                  {formatApplicationDate(application.date)}
                                </p>
                              </div>
                              <div className='rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary'>
                                #{application.serviceOrder?.number ?? '-'}
                              </div>
                            </div>

                            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                              {operationType && (
                                <div className='rounded-sm bg-muted/30 p-2'>
                                  <p className='text-[11px] text-muted-foreground'>Operacao/Tipo</p>
                                  <p className='text-xs font-semibold'>{operationType}</p>
                                </div>
                              )}

                              <div className='rounded-sm bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Area aplicada</p>
                                <p className='text-xs font-semibold'>
                                  {formatAreaValue(parseNumericValue(application.hectares))}
                                </p>
                              </div>

                              <div className='rounded-sm bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Piloto</p>
                                <p className='text-xs font-semibold'>{application.pilot?.name || 'N/A'}</p>
                              </div>

                              <div className='rounded-sm bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Drone</p>
                                <p className='text-xs font-semibold'>{application.drone?.name || 'N/A'}</p>
                              </div>

                              <div className='rounded-sm bg-muted/30 p-2'>
                                <p className='text-[11px] text-muted-foreground'>Cultura</p>
                                <p className='text-xs font-semibold'>{application.culture?.name || 'N/A'}</p>
                              </div>

                              {application.serviceOrder?.number ? (
                                <div className='rounded-sm bg-muted/30 p-2'>
                                  <p className='text-[11px] text-muted-foreground'>OS</p>
                                  <p className='text-xs font-semibold'>#{application.serviceOrder.number}</p>
                                </div>
                              ) : null}
                            </div>

                            {application.observations ? (
                              <div className='rounded-sm border border-dashed p-2'>
                                <p className='text-[11px] text-muted-foreground'>Observacoes</p>
                                <p className='text-xs'>{application.observations}</p>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReportOptionsOpen} onOpenChange={setIsReportOptionsOpen}>
        <DialogContent className='sm:max-w-xl max-w-[96vw]' showCloseButton={false}>
          <DialogHeader className='pr-10 text-left'>
            <DialogTitle className='text-xl font-semibold'>Opcoes do Relatorio</DialogTitle>
            <DialogDescription>
              Defina os filtros e o conteudo da visualizacao de impressao.
            </DialogDescription>
          </DialogHeader>

          <DialogClose asChild>
            <Button type='button' variant='ghost' size='icon' className='absolute right-4 top-4 h-8 w-8'>
              <X className='h-4 w-4' />
            </Button>
          </DialogClose>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <p className='text-sm font-medium'>Tipo de Aplicacao (Produto)</p>
              <Select value={reportProductFilter} onValueChange={setReportProductFilter}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Todos os produtos' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos os produtos</SelectItem>
                  {reportProductOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>Periodo das Aplicacoes</p>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <Input
                  type='date'
                  value={reportStartDate}
                  onChange={(event) => setReportStartDate(event.target.value)}
                />
                <Input
                  type='date'
                  value={reportEndDate}
                  onChange={(event) => setReportEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>Incluir no Relatorio</p>
              <div className='space-y-2 rounded-md border p-3'>
                <label className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    checked={reportSections.includeMap}
                    onCheckedChange={(checked) => updateReportSection('includeMap', checked)}
                  />
                  <span>Mapa do Talhao</span>
                </label>
                <label className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    checked={reportSections.includeSummary}
                    onCheckedChange={(checked) => updateReportSection('includeSummary', checked)}
                  />
                  <span>Resumo de Areas</span>
                </label>
                <label className='flex items-center gap-2 text-sm'>
                  <Checkbox
                    checked={reportSections.includeDetailedHistory}
                    onCheckedChange={(checked) =>
                      updateReportSection('includeDetailedHistory', checked)
                    }
                  />
                  <span>Historico Detalhado</span>
                </label>
              </div>
            </div>

            <Button
              type='button'
              className='w-full bg-orange-600 hover:bg-orange-700 text-white'
              onClick={generatePrintPreview}
            >
              Gerar Visualizacao para Impressao
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
