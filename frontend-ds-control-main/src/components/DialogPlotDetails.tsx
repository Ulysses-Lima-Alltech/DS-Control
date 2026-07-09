import type * as GeoJSON from 'geojson';
import { FileText, MapPin, Printer, SprayCan, X } from 'lucide-react';
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
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from '@/utils/map-utils';
import { buildReportMapboxStaticUrl, parsePlotGeoJson } from '@/utils/mapboxStaticReportMap';
import { formatOperationalDateBR, toOperationalDateYMD } from '@/utils/operational-date';
import { formatTimestamp } from '@/utils/timestamp-formatter';

import 'mapbox-gl/dist/mapbox-gl.css';

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
const REPORT_MAP_UNAVAILABLE_MESSAGE = 'Imagem do talhao indisponivel para este registro.';

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

function buildStaticGeoJsonOverlayUrl(
  plot: Plot,
  width: number,
  height: number,
  accessToken: string
): string | null {
  const parsedGeoJson = extractPlotGeoJson(plot);
  if (!parsedGeoJson) {
    return null;
  }

  const mapResult = buildReportMapboxStaticUrl({
    plot,
    mapWidth: width,
    mapHeight: height,
    accessToken,
  });

  if (!mapResult.url) {
    return null;
  }

  const bboxMatch = mapResult.url.match(/\/static\/\[(.*?)\]\//);
  if (!bboxMatch?.[1]) {
    return null;
  }

  const overlayGeoJson =
    parsedGeoJson.type === 'FeatureCollection'
      ? {
          ...parsedGeoJson,
          features: parsedGeoJson.features.map((feature) => ({
            ...feature,
            properties: {
              ...feature.properties,
              fill: '#EAAE07',
              'fill-opacity': 0.3,
              stroke: '#EAAE07',
              'stroke-width': 3,
              'stroke-opacity': 1,
            },
          })),
        }
      : parsedGeoJson;

  const overlayParam = encodeURIComponent(JSON.stringify(overlayGeoJson));
  const bboxParam = bboxMatch[1];
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${overlayParam})/[${bboxParam}]/${width}x${height}?access_token=${encodeURIComponent(accessToken)}`;
}

function extractPlotGeoJson(plot: Plot): GeoJSON.GeoJSON | null {
  const fromDefault = parsePlotGeoJson(plot);
  if (fromDefault) {
    return fromDefault;
  }

  const rawPlot = plot as unknown as Record<string, unknown>;
  const candidates = [rawPlot.geoJson, rawPlot.geojson, rawPlot.geometry, rawPlot.coordinates];

  for (const candidate of candidates) {
    if (!candidate) continue;

    let parsed: unknown = candidate;
    if (typeof candidate === 'string') {
      try {
        parsed = JSON.parse(candidate);
      } catch {
        continue;
      }
    }

    if (!parsed || typeof parsed !== 'object') continue;
    const geo = parsed as Record<string, unknown>;
    const type = geo.type;

    if (
      type === 'FeatureCollection' ||
      type === 'Feature' ||
      type === 'Polygon' ||
      type === 'MultiPolygon'
    ) {
      return geo as unknown as GeoJSON.GeoJSON;
    }

    if ((type === undefined || type === null) && Array.isArray(geo.coordinates)) {
      return {
        type: 'Polygon',
        coordinates: geo.coordinates as number[][][],
      } as GeoJSON.Polygon;
    }
  }

  return null;
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
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [hasReportMapLoadError, setHasReportMapLoadError] = useState(false);
  const [printOptions, setPrintOptions] = useState<{
    productFilter: string;
    startDate: string;
    endDate: string;
    sections: ReportSections;
  } | null>(null);
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
      latestApplicationDate: latestApplication
        ? formatApplicationDate(latestApplication.date)
        : 'N/A',
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

  const hasOperationTypeInReport = useMemo(() => {
    return reportFilteredApplications.some((application) =>
      Boolean(getApplicationOperationType(application))
    );
  }, [reportFilteredApplications]);

  const geoData = useMemo(() => {
    if (!activePlot) return undefined;
    return convertDatabasePlotsToMapViewerPlotsFeatureCollection([activePlot]);
  }, [activePlot]);

  const reportPreviewMap = useMemo(() => {
    if (!activePlot) {
      return {
        url: null as string | null,
        unavailableMessage: REPORT_MAP_UNAVAILABLE_MESSAGE,
      };
    }

    const mapWidth = 1280;
    const mapHeight = 520;
    const accessToken =
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';
    const mapUrl = buildStaticGeoJsonOverlayUrl(activePlot, mapWidth, mapHeight, accessToken);

    return {
      url: mapUrl,
      unavailableMessage: REPORT_MAP_UNAVAILABLE_MESSAGE,
    };
  }, [activePlot]);

  function updateReportSection(key: keyof ReportSections, checked: boolean | 'indeterminate') {
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
    setHasReportMapLoadError(false);
    setIsReportOptionsOpen(true);
  }

  function generatePrintPreview() {
    try {
      if (!activePlot) {
        throw new Error('missing_plot');
      }

      if (reportStartDate && reportEndDate && reportStartDate > reportEndDate) {
        toast.error('Periodo invalido. Ajuste as datas inicial e final.');
        return;
      }

      setPrintOptions({
        productFilter: reportProductFilter,
        startDate: reportStartDate,
        endDate: reportEndDate,
        sections: reportSections,
      });
      setHasReportMapLoadError(false);
      setIsPrintPreviewOpen(true);
      setIsReportOptionsOpen(false);
    } catch {
      toast.error('Não foi possível gerar a visualização de impressão. Tente novamente.');
    }
  }

  function handlePrint() {
    window.print();
  }

  const hasNoApplications = !isLoadingApplications && sortedApplications.length === 0;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setIsReportOptionsOpen(false);
            setIsPrintPreviewOpen(false);
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
              <span>Historico Completo do Talhao - {activePlot?.name || 'Talhao'}</span>
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
              <p className='text-sm text-muted-foreground'>
                Selecione o talhao para visualizar o historico.
              </p>
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
            {isPrintPreviewOpen ? (
              <div
                id='plot-print-preview-root'
                className='mx-auto w-full max-w-5xl rounded-lg border bg-white p-6 text-black'
              >
                <div className='print-actions mb-4 flex flex-wrap items-center justify-between gap-2'>
                  <h2 className='text-xl font-semibold'>Pré-visualização do relatório</h2>
                  <div className='flex items-center gap-2'>
                    <Button
                      type='button'
                      onClick={handlePrint}
                      className='bg-orange-600 hover:bg-orange-700 text-white'
                    >
                      <Printer className='mr-2 h-4 w-4' />
                      Imprimir
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setIsPrintPreviewOpen(false)}
                    >
                      Fechar
                    </Button>
                  </div>
                </div>

                <div className='space-y-6'>
                  <header>
                    <h1 className='text-3xl font-bold'>Relatório de Aplicações por Talhão</h1>
                    <p className='mt-2 text-sm text-muted-foreground'>
                      Talhão: {activePlot?.name || 'N/A'} | Fazenda: {data?.farm?.name || 'N/A'} |
                      Cliente: {data?.farm?.customer?.name || 'N/A'}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      Período:{' '}
                      {printOptions?.startDate || printOptions?.endDate
                        ? `${formatOperationalDateBR(printOptions?.startDate || undefined)} até ${formatOperationalDateBR(printOptions?.endDate || undefined)}`
                        : 'Todos os períodos'}
                    </p>
                  </header>

                  {printOptions?.sections.includeMap ? (
                    <section className='rounded-md border bg-muted/20 p-4'>
                      {reportPreviewMap.url && !hasReportMapLoadError ? (
                        <div className='relative overflow-hidden rounded-md border bg-black/5'>
                          <img
                            src={reportPreviewMap.url}
                            alt={`Visualizacao do talhao ${activePlot?.name || ''}`}
                            className='block h-[300px] w-full object-cover'
                            onError={() => setHasReportMapLoadError(true)}
                          />
                        </div>
                      ) : geoData ? (
                        <div className='overflow-hidden rounded-md border bg-black/5'>
                          <div className='h-[300px]'>
                            <MapViewer
                              key={`plot-print-map-${activePlot?.id || 'none'}`}
                              layerNameToHighlight={activePlot?.name}
                              layerPlotIdsToHighlight={activePlot?.id ? [activePlot.id] : undefined}
                              geoData={geoData}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className='flex h-[300px] items-center justify-center rounded-md border border-dashed bg-background px-6 text-center'>
                          <div>
                            <p className='text-base font-semibold'>
                              {activePlot?.name || 'Talhao'}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              {hasReportMapLoadError
                                ? REPORT_MAP_UNAVAILABLE_MESSAGE
                                : reportPreviewMap.unavailableMessage ||
                                  REPORT_MAP_UNAVAILABLE_MESSAGE}
                            </p>
                          </div>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {printOptions?.sections.includeSummary ? (
                    <section className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                      <div className='rounded-md border p-3'>
                        <p className='text-xs text-muted-foreground'>Total de aplicações</p>
                        <p className='mt-1 text-sm font-semibold'>
                          {reportSummary.totalApplications}
                        </p>
                      </div>
                      <div className='rounded-md border p-3'>
                        <p className='text-xs text-muted-foreground'>Área total aplicada</p>
                        <p className='mt-1 text-sm font-semibold'>
                          {formatAreaValue(reportSummary.totalAppliedArea)}
                        </p>
                      </div>
                      <div className='rounded-md border p-3'>
                        <p className='text-xs text-muted-foreground'>Última aplicação</p>
                        <p className='mt-1 text-sm font-semibold'>
                          {reportFilteredApplications[0]
                            ? formatApplicationDate(reportFilteredApplications[0].date)
                            : 'N/A'}
                        </p>
                      </div>
                      <div className='rounded-md border p-3'>
                        <p className='text-xs text-muted-foreground'>Cultura</p>
                        <p className='mt-1 text-sm font-semibold'>
                          {reportSummary.latestCulture || 'N/A'}
                        </p>
                      </div>
                    </section>
                  ) : null}

                  {printOptions?.sections.includeDetailedHistory ? (
                    <section>
                      <h2 className='mb-3 text-lg font-semibold'>Detalhamento do Histórico</h2>
                      <div className='overflow-x-auto rounded-md border'>
                        <table className='w-full border-collapse text-sm'>
                          <thead className='bg-muted/30'>
                            <tr>
                              <th className='border-b p-2 text-left'>Data</th>
                              {hasOperationTypeInReport ? (
                                <th className='border-b p-2 text-left'>Operação/Tipo</th>
                              ) : null}
                              <th className='border-b p-2 text-left'>Produto</th>
                              <th className='border-b p-2 text-left'>Piloto</th>
                              <th className='border-b p-2 text-left'>Drone</th>
                              <th className='border-b p-2 text-left'>Área aplicada</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportFilteredApplications.length ? (
                              reportFilteredApplications.map((application) => (
                                <tr key={`report-row-${application.id}`}>
                                  <td className='border-b p-2'>
                                    {formatApplicationDate(application.date)}
                                  </td>
                                  {hasOperationTypeInReport ? (
                                    <td className='border-b p-2'>
                                      {getApplicationOperationType(application) || '-'}
                                    </td>
                                  ) : null}
                                  <td className='border-b p-2'>
                                    {application.product?.name || '-'}
                                  </td>
                                  <td className='border-b p-2'>{application.pilot?.name || '-'}</td>
                                  <td className='border-b p-2'>{application.drone?.name || '-'}</td>
                                  <td className='border-b p-2'>
                                    {formatAreaValue(parseNumericValue(application.hectares))}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  className='p-4 text-center text-muted-foreground'
                                  colSpan={hasOperationTypeInReport ? 6 : 5}
                                >
                                  Nenhuma aplicacao encontrada para os filtros selecionados.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
                <Card className='order-1 lg:col-span-12'>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Resumo do Talhao</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                      <div className='rounded-md border bg-muted/20 p-3'>
                        <p className='text-xs text-muted-foreground'>Total de Aplicacoes</p>
                        <p className='mt-1 text-sm font-semibold'>
                          {historySummary.totalApplications}
                        </p>
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

                <div className='order-2 lg:col-span-8 space-y-4'>
                  <Card className='overflow-hidden'>
                    <CardHeader>
                      <CardTitle className='text-lg'>Visualizacao do Talhao</CardTitle>
                      <CardDescription>
                        {activePlot
                          ? `Talhao em destaque: ${activePlot.name}`
                          : 'Selecione um talhao para visualizar'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='p-0'>
                      <div className='h-[320px] sm:h-[380px] lg:h-[420px] min-h-[320px]'>
                        {isLoadingFarm ? (
                          <Skeleton className='h-full w-full' />
                        ) : (
                          <MapViewer
                            key={`plot-map-${isOpen ? 'open' : 'closed'}-${activePlot?.id || 'none'}`}
                            layerNameToHighlight={activePlot?.name}
                            layerPlotIdsToHighlight={activePlot?.id ? [activePlot.id] : undefined}
                            geoData={geoData}
                            onPlotClick={(clickedPlotId) => {
                              const clickedPlot = farmPlots.find(
                                (plot) => plot.id === clickedPlotId
                              );
                              if (clickedPlot?.id) {
                                setSelectedPlotFilter(clickedPlot.id);
                              }
                            }}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>Informacoes do Talhao</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3'>
                        <div className='rounded-sm bg-muted/25 p-3'>
                          <p className='text-xs text-muted-foreground'>Fazenda</p>
                          <p className='mt-1 font-medium'>{data?.farm?.name || 'N/A'}</p>
                        </div>
                        <div className='rounded-sm bg-muted/25 p-3'>
                          <p className='text-xs text-muted-foreground'>Cliente</p>
                          <p className='mt-1 font-medium'>{data?.farm?.customer?.name || 'N/A'}</p>
                        </div>
                        <div className='rounded-sm bg-muted/25 p-3'>
                          <p className='text-xs text-muted-foreground'>Area do Talhao</p>
                          <p className='mt-1 font-medium'>{formatPlotArea(activePlot?.hectare)}</p>
                        </div>
                        <div className='rounded-sm bg-muted/25 p-3'>
                          <p className='text-xs text-muted-foreground'>Data de Cadastro</p>
                          <p className='mt-1 font-medium'>
                            {formatTimestamp(activePlot?.createdAt)}
                          </p>
                        </div>
                        <div className='rounded-sm bg-muted/25 p-3'>
                          <p className='text-xs text-muted-foreground'>Cultura Mais Recente</p>
                          <p className='mt-1 font-medium'>{historySummary.latestCulture}</p>
                        </div>
                        <div className='rounded-sm bg-muted/25 p-3'>
                          <p className='text-xs text-muted-foreground'>Identificador</p>
                          <p className='mt-1 font-mono text-xs'>{activePlot?.id || 'N/A'}</p>
                        </div>
                        <div className='rounded-sm bg-muted/25 p-3 md:col-span-2 xl:col-span-1'>
                          <p className='text-xs text-muted-foreground'>Nome do Talhao</p>
                          <p className='mt-1 font-medium'>{activePlot?.name || 'N/A'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className='order-3 lg:col-span-4'>
                  <Card className='overflow-hidden flex flex-col lg:h-[760px]'>
                    <CardHeader>
                      <CardTitle className='text-lg'>Historico de Aplicacoes</CardTitle>
                      <CardDescription>
                        {isLoadingApplications
                          ? 'Carregando aplicacoes...'
                          : `${sortedApplications.length} aplicacoes registradas`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3 overflow-y-auto pr-1 flex-1 min-h-0'>
                      {isLoadingApplications &&
                        Array.from({ length: 3 }).map((_, index) => (
                          <Skeleton
                            key={`app-loading-${index}`}
                            className='h-28 w-full rounded-md'
                          />
                        ))}

                      {hasNoApplications && (
                        <div className='rounded-md border border-dashed p-5 text-center'>
                          <SprayCan className='mx-auto mb-3 h-8 w-8 text-muted-foreground/70' />
                          <p className='text-sm font-medium'>
                            Nenhuma aplicacao encontrada para este talhao.
                          </p>
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
                                    <p className='text-sm font-semibold'>
                                      {application.product?.name || 'N/A'}
                                    </p>
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
                                      <p className='text-[11px] text-muted-foreground'>
                                        Operacao/Tipo
                                      </p>
                                      <p className='text-xs font-semibold'>{operationType}</p>
                                    </div>
                                  )}

                                  <div className='rounded-sm bg-muted/30 p-2'>
                                    <p className='text-[11px] text-muted-foreground'>
                                      Area aplicada
                                    </p>
                                    <p className='text-xs font-semibold'>
                                      {formatAreaValue(parseNumericValue(application.hectares))}
                                    </p>
                                  </div>

                                  <div className='rounded-sm bg-muted/30 p-2'>
                                    <p className='text-[11px] text-muted-foreground'>Piloto</p>
                                    <p className='text-xs font-semibold'>
                                      {application.pilot?.name || 'N/A'}
                                    </p>
                                  </div>

                                  <div className='rounded-sm bg-muted/30 p-2'>
                                    <p className='text-[11px] text-muted-foreground'>Drone</p>
                                    <p className='text-xs font-semibold'>
                                      {application.drone?.name || 'N/A'}
                                    </p>
                                  </div>

                                  <div className='rounded-sm bg-muted/30 p-2'>
                                    <p className='text-[11px] text-muted-foreground'>Cultura</p>
                                    <p className='text-xs font-semibold'>
                                      {application.culture?.name || 'N/A'}
                                    </p>
                                  </div>

                                  {application.serviceOrder?.number ? (
                                    <div className='rounded-sm bg-muted/30 p-2'>
                                      <p className='text-[11px] text-muted-foreground'>OS</p>
                                      <p className='text-xs font-semibold'>
                                        #{application.serviceOrder.number}
                                      </p>
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
            )}
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
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute right-4 top-4 h-8 w-8'
            >
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
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #plot-print-preview-root,
          #plot-print-preview-root * {
            visibility: visible !important;
          }
          #plot-print-preview-root {
            position: fixed !important;
            inset: 0 !important;
            z-index: 99999 !important;
            width: 100% !important;
            max-width: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
          }
          .print-actions {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
