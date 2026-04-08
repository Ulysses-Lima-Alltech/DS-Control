'use client';

import { differenceInCalendarDays, format, max as maxDate, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Info,
  Leaf,
  Map,
  RefreshCw,
  SprayCan,
  TrendingUp,
  X,
} from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useGetApplicationsEvolution,
  useGetApplicationsTopFarms,
  useGetStatsApplications,
} from '@/queries/application.query';
import { useGetFarmById } from '@/queries/farm.query';
import { useGetProductById } from '@/queries/product.query';
import { ServiceOrderStatus } from '@/types/service-order.type';
import type { EvolutionGranularity } from '@/services/application.service';
import {
  APPLICATION_ISSUE_LABELS,
  type ApplicationIssueFilter,
} from '@/types/applications.type';

/**
 * Gráficos — Visão Geral (Aplicações)
 *
 * O `ChartContainer` do shadcn (`ui/chart.tsx`) inclui `aspect-video` no wrapper. Em cards com
 * altura limitada isso compete com o `ResponsiveContainer` do Recharts e pode gerar SVG com
 * dimensão incorreta e paths (linhas/barras) vazando para fora do card.
 *
 * Nesta tela neutralizamos isso com: (1) `ChartPlotShell` — altura explícita em px; (2) classe
 * `OVERVIEW_CHART_CONTAINER_CLASS` no `ChartContainer` com `!aspect-auto` (anula o 16:9),
 * `overflow-hidden` e encadeamento de altura até o ResponsiveContainer; (3) cards com
 * `min-w-0 overflow-hidden`. Gráficos devem passar por `OverviewChartPlot` para não reabrir regressão.
 */

type OverviewFilters = {
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  productId?: string;
  pilotId?: string;
  customerId?: string;
  serviceOrderId?: string;
  invalidApplication?: boolean;
  startDate?: string;
  endDate?: string;
};

const formatNumber = (value: number, suffix = '') =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;

const formatCompact = (value: number) =>
  value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** Alturas em px — base real para o ResponsiveContainer (evita %/aspect instável). */
const CHART_EVOLUTION_H = 220;
const CHART_BAR_H = 200;

function truncateAxisLabel(value: unknown, maxLen = 22): string {
  const s = String(value ?? '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

/** Modo Auto: ≤45 dias → dia; &gt;45 e ≤730 dias (~24 meses) → mês; senão → ano. */
const EVOLUTION_AUTO_DAY_MAX = 45;
const EVOLUTION_AUTO_MONTH_MAX_DAYS = 730;
/** Modo dia manual: período &gt;90 dias usa só os últimos 90 dias (API + aviso na UI). */
const EVOLUTION_DAY_CLIP_DAYS = 90;

type EvolutionMode = 'auto' | EvolutionGranularity;

function resolveEvolutionGranularity(
  mode: EvolutionMode,
  startDateStr: string,
  endDateStr: string
): EvolutionGranularity {
  if (mode !== 'auto') return mode;
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  const days = differenceInCalendarDays(end, start) + 1;
  if (days <= EVOLUTION_AUTO_DAY_MAX) return 'day';
  if (days <= EVOLUTION_AUTO_MONTH_MAX_DAYS) return 'month';
  return 'year';
}

function formatEvolutionAxisTick(period: string, g: EvolutionGranularity): string {
  if (g === 'day' && period.length >= 10) {
    return format(parseISO(period), 'dd/MM', { locale: ptBR });
  }
  if (g === 'month' && period.length >= 7) {
    return format(parseISO(`${period}-01`), 'MMM/yyyy', { locale: ptBR });
  }
  return period;
}

function formatEvolutionTooltipPeriod(period: string, g: EvolutionGranularity): string {
  if (g === 'day' && period.length >= 10) {
    return format(parseISO(period), 'dd/MM/yyyy', { locale: ptBR });
  }
  if (g === 'month' && period.length >= 7) {
    return format(parseISO(`${period}-01`), 'MMMM yyyy', { locale: ptBR });
  }
  return `Ano ${period}`;
}

function hasActiveOverviewFilters(f: OverviewFilters): boolean {
  return Boolean(
    (f.search && f.search.trim().length > 0) ||
      f.startDate ||
      f.endDate ||
      f.farmId ||
      f.productId ||
      f.pilotId ||
      f.customerId ||
      f.serviceOrderId ||
      f.serviceOrderStatus ||
      f.invalidApplication === true
  );
}

function SectionError({
  title,
  description,
  onRetry,
  compact,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 text-center ${
        compact ? 'px-3 py-6' : 'px-4 py-10'
      }`}
    >
      <AlertCircle className='h-8 w-8 text-destructive/80' aria-hidden />
      <div className='space-y-1 max-w-sm'>
        <p className='text-sm font-medium text-foreground'>{title}</p>
        <p className='text-xs text-muted-foreground leading-relaxed'>{description}</p>
      </div>
      <Button type='button' variant='outline' size='sm' className='gap-1.5' onClick={onRetry}>
        <RefreshCw className='h-3.5 w-3.5' />
        Tentar novamente
      </Button>
    </div>
  );
}

function ChartEmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className='flex h-full min-h-[160px] flex-col items-center justify-center gap-1.5 px-4 text-center'>
      <p className='text-sm text-muted-foreground'>{title}</p>
      {hint ? <p className='text-xs text-muted-foreground/90 max-w-xs leading-relaxed'>{hint}</p> : null}
    </div>
  );
}

/** Shell com dimensão fixa: o único ancestral com “altura real” em px para o Recharts. */
function ChartPlotShell({ heightPx, children }: { heightPx: number; children: ReactNode }) {
  return (
    <div
      className='relative w-full min-h-0 min-w-0 max-h-full overflow-hidden rounded-md'
      style={{ height: heightPx }}
    >
      {children}
    </div>
  );
}

/**
 * Anula o `aspect-video` padrão do ChartContainer (`!aspect-auto`) e força o fluxo de altura
 * até `.recharts-responsive-container`, para o SVG não extrapolar o shell.
 */
const OVERVIEW_CHART_CONTAINER_CLASS =
  'h-full w-full min-h-0 min-w-0 !aspect-auto overflow-hidden [&_.recharts-responsive-container]:h-full [&_.recharts-responsive-container]:w-full [&_.recharts-responsive-container]:max-h-full';

/**
 * Ponto único de montagem de gráfico nesta tela: shell com altura + ChartContainer seguro.
 * Não usar ChartContainer solto dentro de cards sem este wrapper e sem OVERVIEW_CHART_CONTAINER_CLASS.
 */
function OverviewChartPlot({
  heightPx,
  chartId,
  config,
  children,
}: {
  heightPx: number;
  chartId: string;
  config: ChartConfig;
  /** LineChart/BarChart — tipo alinhado ao ResponsiveContainer interno do ChartContainer. */
  children: ReactElement;
}) {
  return (
    <ChartPlotShell heightPx={heightPx}>
      <ChartContainer id={chartId} className={OVERVIEW_CHART_CONTAINER_CLASS} config={config}>
        {children}
      </ChartContainer>
    </ChartPlotShell>
  );
}

function KpiSkeletonGrid() {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
      {Array.from({ length: 4 }).map((_, idx) => (
        <Card key={idx} className='min-h-[112px]'>
          <CardContent className='p-4'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0 flex-1 space-y-2'>
                <Skeleton className='h-3 w-28' />
                <Skeleton className='h-8 w-24' />
                <Skeleton className='h-3 w-36' />
              </div>
              <Skeleton className='h-9 w-9 shrink-0 rounded-md' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between gap-2'>
          <div className='space-y-2'>
            <Skeleton className='h-5 w-56' />
            <Skeleton className='h-3 w-64' />
          </div>
          <Skeleton className='h-6 w-28 rounded-full' />
        </div>
      </CardHeader>
      <CardContent className='pt-1'>
        <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2'>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className='h-[76px] w-full rounded-md' />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type ApplicationsOverviewDashboardProps = OverviewFilters & {
  onNavigateRecordsWithIssue?: (issue: ApplicationIssueFilter) => void;
  onFarmFilterChange?: (farmId: string | undefined) => void;
  onProductFilterChange?: (productId: string | undefined) => void;
  onClearCrossFilters?: () => void;
};

const BAR_SELECTED = 'hsl(var(--primary))';

export function ApplicationsOverviewDashboard({
  onNavigateRecordsWithIssue,
  onFarmFilterChange,
  onProductFilterChange,
  onClearCrossFilters,
  ...filters
}: ApplicationsOverviewDashboardProps) {
  const [inconsistencySheetOpen, setInconsistencySheetOpen] = useState(false);

  const farmLabelQuery = useGetFarmById(filters.farmId ?? null);
  const productLabelQuery = useGetProductById(filters.productId ?? '', {
    enabled: Boolean(filters.productId),
  });

  const handleFarmBarClick = useCallback(
    (row: { farmId: string | null; name: string }) => {
      if (!onFarmFilterChange || !row.farmId) return;
      onFarmFilterChange(filters.farmId === row.farmId ? undefined : row.farmId);
    },
    [filters.farmId, onFarmFilterChange]
  );

  const handleProductBarClick = useCallback(
    (row: { productId?: string; name: string }) => {
      if (!onProductFilterChange || !row.productId) return;
      onProductFilterChange(filters.productId === row.productId ? undefined : row.productId);
    },
    [filters.productId, onProductFilterChange]
  );
  const effectiveDateRange = useMemo(() => {
    const endDate = filters.endDate || format(new Date(), 'yyyy-MM-dd');
    const startDate = filters.startDate || format(subDays(new Date(), 90), 'yyyy-MM-dd');
    return { startDate, endDate };
  }, [filters.endDate, filters.startDate]);

  const [evolutionMode, setEvolutionMode] = useState<EvolutionMode>('auto');

  const resolvedEvolutionGranularity = useMemo(
    () =>
      resolveEvolutionGranularity(
        evolutionMode,
        effectiveDateRange.startDate,
        effectiveDateRange.endDate
      ),
    [evolutionMode, effectiveDateRange.startDate, effectiveDateRange.endDate]
  );

  const evolutionApiRange = useMemo(() => {
    const start = parseISO(effectiveDateRange.startDate);
    const end = parseISO(effectiveDateRange.endDate);
    const spanDays = differenceInCalendarDays(end, start) + 1;
    let rangeStart = start;
    let rangeEnd = end;
    let dayRangeCapped = false;
    if (resolvedEvolutionGranularity === 'day' && spanDays > EVOLUTION_DAY_CLIP_DAYS) {
      rangeStart = maxDate([start, subDays(end, EVOLUTION_DAY_CLIP_DAYS - 1)]);
      dayRangeCapped = true;
    }
    return {
      startDate: format(rangeStart, 'yyyy-MM-dd'),
      endDate: format(rangeEnd, 'yyyy-MM-dd'),
      dayRangeCapped,
    };
  }, [
    effectiveDateRange.startDate,
    effectiveDateRange.endDate,
    resolvedEvolutionGranularity,
  ]);

  const evolutionMonthsParam = useMemo(() => {
    if (resolvedEvolutionGranularity === 'day') return EVOLUTION_DAY_CLIP_DAYS;
    if (resolvedEvolutionGranularity === 'year') return 40;
    return 24;
  }, [resolvedEvolutionGranularity]);

  const evolutionQueryParams = useMemo(
    () => ({
      ...filters,
      startDate: evolutionApiRange.startDate,
      endDate: evolutionApiRange.endDate,
      months: evolutionMonthsParam,
      granularity: resolvedEvolutionGranularity,
    }),
    [
      filters,
      evolutionApiRange.startDate,
      evolutionApiRange.endDate,
      evolutionMonthsParam,
      resolvedEvolutionGranularity,
    ]
  );

  const evolutionCardSubtitle = useMemo(() => {
    const segment =
      resolvedEvolutionGranularity === 'day'
        ? 'Últimos dias no período selecionado'
        : resolvedEvolutionGranularity === 'month'
          ? 'Últimos meses no período selecionado'
          : 'Últimos anos no período selecionado';
    if (evolutionMode === 'auto') {
      return `${segment} · granularidade automática`;
    }
    const gLabel =
      resolvedEvolutionGranularity === 'day'
        ? 'dia'
        : resolvedEvolutionGranularity === 'month'
          ? 'mês'
          : 'ano';
    return `${segment} · agregação por ${gLabel}`;
  }, [evolutionMode, resolvedEvolutionGranularity]);

  const filtersActive = useMemo(() => hasActiveOverviewFilters(filters), [filters]);

  const statsQuery = useGetStatsApplications(filters);
  const evolutionQuery = useGetApplicationsEvolution(evolutionQueryParams);
  const topFarmsQuery = useGetApplicationsTopFarms({ ...filters, limit: 5 });

  const stats = statsQuery.data?.stats;
  const totalApplications = stats?.applicationCount ?? 0;
  const totalAreaHectares = stats?.totalAreaHectares ?? 0;
  const avgHectaresPerApplication = stats?.averageApplicationArea ?? 0;
  const looseCount = stats?.pendingApplicationsCount ?? 0;
  const loosePercent = totalApplications > 0 ? (looseCount / totalApplications) * 100 : 0;

  const evolutionData = useMemo(() => {
    return (evolutionQuery.data?.evolution || [])
      .filter((item) => typeof item?.yearMonth === 'string' && item.yearMonth.length >= 4)
      .map((item) => ({
        period: item.yearMonth,
        applications: Math.max(0, Number(item.applicationsCount) || 0),
      }));
  }, [evolutionQuery.data?.evolution]);

  const productData = useMemo(() => {
    return [...(stats?.typeOfProducts || [])]
      .filter((row) => row?.product != null && Number(row.hectares) >= 0)
      .sort((a, b) => Number(b.hectares) - Number(a.hectares))
      .slice(0, 5)
      .map((item) => ({
        name: String(item.product),
        productId: item.productId,
        hectares: Math.max(0, Number(item.hectares) || 0),
      }));
  }, [stats?.typeOfProducts]);

  const topFarms = useMemo(() => {
    return (topFarmsQuery.data?.topFarms || [])
      .filter((farm) => farm?.farmName != null)
      .map((farm) => ({
        name: String(farm.farmName),
        farmId: farm.farmId,
        hectares: Math.max(0, Number(farm.totalAreaHectares) || 0),
      }));
  }, [topFarmsQuery.data?.topFarms]);

  const hasNoAlerts =
    (stats?.pendingApplicationsCount || 0) === 0 &&
    (stats?.pendingApplicationsTotalArea || 0) === 0 &&
    (stats?.pendingFarmsCount || 0) === 0 &&
    (stats?.pendingPlotsCount || 0) === 0 &&
    (stats?.invalidApplication || 0) === 0 &&
    (stats?.pendingApplicationsMissingFarmCount ?? 0) === 0;

  /** Total distinto alinhado ao critério de pendência estrutural (mesmo universo que “avulsas” no KPI). */
  const operationalInconsistencyTotal = stats?.pendingApplicationsCount ?? 0;

  const inconsistencyCompositionRows = useMemo(() => {
    if (!stats) return [] as { issue: ApplicationIssueFilter; count: number }[];
    const p = stats.pendingApplicationsCount ?? 0;
    const inv = stats.invalidApplication ?? 0;
    const other =
      stats.pendingApplicationsOtherThanInvalidOpenCount ?? Math.max(0, p - inv);
    const rows: { issue: ApplicationIssueFilter; count: number }[] = [];
    if (inv > 0) rows.push({ issue: 'invalid_open_os', count: inv });
    if (other > 0) rows.push({ issue: 'structural_pending_other', count: other });
    return rows;
  }, [stats]);

  const inconsistencySubsetRows = useMemo(() => {
    if (!stats) return [] as { issue: ApplicationIssueFilter; count: number }[];
    const missingFarm = stats.pendingApplicationsMissingFarmCount ?? 0;
    const rows: { issue: ApplicationIssueFilter; count: number }[] = [];
    if ((stats.pendingPlotsCount || 0) > 0) {
      rows.push({ issue: 'structural_missing_plot', count: stats.pendingPlotsCount });
    }
    if (missingFarm > 0) {
      rows.push({ issue: 'structural_missing_farm', count: missingFarm });
    }
    return rows;
  }, [stats]);

  const inconsistencyCompositionAddsUp =
    stats != null &&
    (stats.invalidApplication ?? 0) +
      (stats.pendingApplicationsOtherThanInvalidOpenCount ??
        Math.max(
          0,
          (stats.pendingApplicationsCount ?? 0) - (stats.invalidApplication ?? 0)
        )) ===
      (stats.pendingApplicationsCount ?? 0);

  const handleInconsistencyViewRecords = (issue: ApplicationIssueFilter) => {
    onNavigateRecordsWithIssue?.(issue);
    setInconsistencySheetOpen(false);
  };

  const emptyChartHint = filtersActive
    ? 'Com os filtros atuais não há pontos neste gráfico. Amplie o período ou revise os filtros na aba Registros.'
    : 'Não há registros no período considerado para montar este gráfico.';

  const crossFilterActive = Boolean(filters.farmId || filters.productId);
  const farmChipLabel = filters.farmId
    ? farmLabelQuery.data?.farm?.name ?? `Fazenda ${filters.farmId.slice(0, 8)}…`
    : '';
  const productChipLabel = filters.productId
    ? productLabelQuery.data?.product?.name ?? `Produto ${filters.productId.slice(0, 8)}…`
    : '';

  return (
    <div className='space-y-5'>
      <div className='rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
            {filters.farmId ? (
              <Badge
                variant='secondary'
                className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal'
              >
                <span className='max-w-[220px] truncate'>Fazenda: {farmChipLabel}</span>
                <button
                  type='button'
                  className='rounded-sm p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  aria-label='Remover filtro de fazenda'
                  onClick={() => onFarmFilterChange?.(undefined)}
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              </Badge>
            ) : null}
            {filters.productId ? (
              <Badge
                variant='secondary'
                className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal'
              >
                <span className='max-w-[220px] truncate'>Produto: {productChipLabel}</span>
                <button
                  type='button'
                  className='rounded-sm p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  aria-label='Remover filtro de produto'
                  onClick={() => onProductFilterChange?.(undefined)}
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              </Badge>
            ) : null}
            {!crossFilterActive ? (
              <span className='text-xs text-muted-foreground'>
                Filtros cruzados: clique numa barra em <strong className='font-medium'>Top fazendas</strong>{' '}
                ou <strong className='font-medium'>Distribuição por produto</strong> para refinar o painel e
                a aba Registros.
              </span>
            ) : null}
          </div>
          {crossFilterActive ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='shrink-0'
              onClick={() => onClearCrossFilters?.()}
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPIs */}
      {statsQuery.isPending ? (
        <KpiSkeletonGrid />
      ) : statsQuery.isError ? (
        <SectionError
          title='Resumo das aplicações indisponível'
          description={
            statsQuery.error?.message ||
            'Não foi possível carregar os indicadores. Verifique a conexão e tente novamente.'
          }
          onRetry={() => statsQuery.refetch()}
        />
      ) : stats ? (
        <>
          {totalApplications === 0 && (
            <div className='rounded-lg border border-dashed border-border bg-muted/25 px-4 py-3'>
              <div className='flex items-start gap-3'>
                <Info className='h-4 w-4 mt-0.5 shrink-0 text-muted-foreground' aria-hidden />
                <div className='min-w-0 space-y-1'>
                  <p className='text-sm font-medium text-foreground'>Nenhuma aplicação neste recorte</p>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    {filtersActive
                      ? 'Os filtros ou o período podem estar muito restritos. Ajuste na aba Registros ou amplie as datas.'
                      : 'Quando houver registros no período selecionado, os números e gráficos serão preenchidos automaticamente.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
            <KpiCard
              title='Total de aplicações'
              value={formatNumber(totalApplications)}
              subtitle='Registros no recorte atual'
              icon={SprayCan}
            />
            <KpiCard
              title='Área total aplicada'
              value={formatNumber(totalAreaHectares)}
              unit='ha'
              subtitle='Soma de hectares aplicados'
              icon={Leaf}
            />
            <KpiCard
              title='Média por aplicação'
              value={formatNumber(avgHectaresPerApplication)}
              unit='ha/aplic.'
              subtitle='Eficiência média por registro'
              icon={TrendingUp}
            />
            <KpiCard
              title='Aplicações avulsas'
              value={formatNumber(looseCount)}
              subtitle={`${formatNumber(loosePercent, '%')} do total`}
              icon={AlertTriangle}
              tone='warning'
            />
          </div>
        </>
      ) : null}

      {/* Evolução */}
      <Card className='min-w-0 overflow-hidden'>
        <CardHeader className='pb-2'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
            <div className='min-w-0 space-y-1 pr-0 sm:pr-2'>
              <CardTitle className='text-base'>Evolução temporal de aplicações</CardTitle>
              <CardDescription>{evolutionCardSubtitle}</CardDescription>
              {evolutionApiRange.dayRangeCapped ? (
                <p className='text-xs text-amber-800 dark:text-amber-400/90 leading-relaxed'>
                  Visualização diária limitada aos últimos {EVOLUTION_DAY_CLIP_DAYS} dias do período
                  selecionado para manter o gráfico legível. Reduza o intervalo nas datas ou use Mês/Ano.
                </p>
              ) : null}
            </div>
            <Select
              value={evolutionMode}
              onValueChange={(v) => setEvolutionMode(v as EvolutionMode)}
            >
              <SelectTrigger
                aria-label='Granularidade da evolução temporal'
                className='h-9 w-full sm:w-[168px] shrink-0 text-xs'
              >
                <SelectValue placeholder='Granularidade' />
              </SelectTrigger>
              <SelectContent align='end'>
                <SelectItem value='auto'>Auto</SelectItem>
                <SelectItem value='day'>Dia</SelectItem>
                <SelectItem value='month'>Mês</SelectItem>
                <SelectItem value='year'>Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className='min-w-0 overflow-hidden pt-1'>
          {evolutionQuery.isPending ? (
            <Skeleton className='w-full rounded-md' style={{ height: CHART_EVOLUTION_H }} />
          ) : evolutionQuery.isError ? (
            <SectionError
              compact
              title='Evolução indisponível'
              description={
                evolutionQuery.error?.message ||
                'Não foi possível carregar a série temporal. Tente novamente em instantes.'
              }
              onRetry={() => evolutionQuery.refetch()}
            />
          ) : evolutionData.length === 0 ? (
            <ChartPlotShell heightPx={CHART_EVOLUTION_H}>
              <ChartEmptyState
                title='Sem dados de evolução para exibir.'
                hint={emptyChartHint}
              />
            </ChartPlotShell>
          ) : (
            <OverviewChartPlot
              heightPx={CHART_EVOLUTION_H}
              chartId='overview-evolution-line'
              config={{ applications: { label: 'Aplicações', color: 'var(--chart-1)' } }}
            >
              <LineChart
                data={evolutionData}
                margin={{
                  left: 4,
                  right: 8,
                  top: 8,
                  bottom: resolvedEvolutionGranularity === 'day' ? 28 : 8,
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis
                  dataKey='period'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={resolvedEvolutionGranularity === 'day' ? 4 : 8}
                  angle={resolvedEvolutionGranularity === 'day' ? -30 : 0}
                  textAnchor={resolvedEvolutionGranularity === 'day' ? 'end' : 'middle'}
                  height={resolvedEvolutionGranularity === 'day' ? 48 : undefined}
                  tickFormatter={(v) => formatEvolutionAxisTick(String(v), resolvedEvolutionGranularity)}
                  interval='preserveStartEnd'
                />
                <YAxis
                  allowDecimals={false}
                  width={36}
                  tickFormatter={(value) => formatCompact(Number(value))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) =>
                        formatEvolutionTooltipPeriod(String(label), resolvedEvolutionGranularity)
                      }
                      formatter={(value) => [
                        `${Number(value ?? 0).toLocaleString('pt-BR')} aplicações`,
                        '',
                      ]}
                    />
                  }
                />
                <Line
                  type='monotone'
                  dataKey='applications'
                  name='Aplicações'
                  stroke='var(--color-applications)'
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </OverviewChartPlot>
          )}
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 min-w-0 xl:grid-cols-2 gap-4'>
        {/* Produtos — depende de stats */}
        <Card className='min-w-0 overflow-hidden'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Distribuição por produto</CardTitle>
            <CardDescription>
              Comparativo de área aplicada (top 5). Clique numa barra para filtrar por produto.
            </CardDescription>
          </CardHeader>
          <CardContent className='min-w-0 overflow-hidden pt-1'>
            {statsQuery.isPending ? (
              <Skeleton className='w-full rounded-md' style={{ height: CHART_BAR_H }} />
            ) : statsQuery.isError ? (
              <SectionError
                compact
                title='Distribuição por produto indisponível'
                description={
                  statsQuery.error?.message ||
                  'Os dados de produto fazem parte do resumo. Recarregue o resumo ou tente novamente.'
                }
                onRetry={() => statsQuery.refetch()}
              />
            ) : productData.length === 0 ? (
              <ChartPlotShell heightPx={CHART_BAR_H}>
                <ChartEmptyState
                  title='Sem dados de produto para o período.'
                  hint={emptyChartHint}
                />
              </ChartPlotShell>
            ) : (
              <OverviewChartPlot
                heightPx={CHART_BAR_H}
                chartId='overview-products-bar'
                config={{ productBar: { label: 'Hectares', color: 'var(--chart-2)' } }}
              >
                <BarChart
                  data={productData}
                  layout='vertical'
                  margin={{ left: 4, right: 10, top: 4, bottom: 4 }}
                  barCategoryGap='12%'
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type='number'
                    tickFormatter={(value) => `${formatCompact(Number(value))} ha`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    dataKey='name'
                    type='category'
                    width={108}
                    tickFormatter={truncateAxisLabel}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [
                          `${formatNumber(Number(value ?? 0), ' ha')}`,
                          'Área',
                        ]}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { name?: string } | undefined;
                          return row?.name ?? '';
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey='hectares'
                    radius={[0, 4, 4, 0]}
                    maxBarSize={32}
                    isAnimationActive={false}
                    cursor={onProductFilterChange ? 'pointer' : 'default'}
                    onClick={(data: unknown) => {
                      if (!data || typeof data !== 'object') return;
                      handleProductBarClick(data as { productId?: string; name: string });
                    }}
                  >
                    {productData.map((entry, index) => (
                      <Cell
                        key={entry.productId ?? `product-${index}`}
                        fill={
                          entry.productId && filters.productId === entry.productId
                            ? BAR_SELECTED
                            : 'var(--color-productBar)'
                        }
                        className={
                          onProductFilterChange && entry.productId
                            ? 'outline-none transition-opacity hover:opacity-90 focus-visible:opacity-100'
                            : 'opacity-95'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </OverviewChartPlot>
            )}
          </CardContent>
        </Card>

        {/* Top fazendas */}
        <Card className='min-w-0 overflow-hidden'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Top 5 fazendas por área</CardTitle>
            <CardDescription>
              Ranking operacional no período. Clique numa barra para filtrar por fazenda.
            </CardDescription>
          </CardHeader>
          <CardContent className='min-w-0 overflow-hidden pt-1'>
            {topFarmsQuery.isPending ? (
              <Skeleton className='w-full rounded-md' style={{ height: CHART_BAR_H }} />
            ) : topFarmsQuery.isError ? (
              <SectionError
                compact
                title='Ranking de fazendas indisponível'
                description={
                  topFarmsQuery.error?.message ||
                  'Não foi possível carregar o ranking. Verifique a conexão e tente de novo.'
                }
                onRetry={() => topFarmsQuery.refetch()}
              />
            ) : topFarms.length === 0 ? (
              <ChartPlotShell heightPx={CHART_BAR_H}>
                <ChartEmptyState
                  title='Sem dados de fazendas para exibir.'
                  hint={emptyChartHint}
                />
              </ChartPlotShell>
            ) : (
              <OverviewChartPlot
                heightPx={CHART_BAR_H}
                chartId='overview-farms-bar'
                config={{ farmBar: { label: 'Hectares', color: 'var(--chart-3)' } }}
              >
                <BarChart
                  data={topFarms}
                  layout='vertical'
                  margin={{ left: 4, right: 10, top: 4, bottom: 4 }}
                  barCategoryGap='12%'
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type='number'
                    tickFormatter={(value) => `${formatCompact(Number(value))} ha`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    dataKey='name'
                    type='category'
                    width={108}
                    tickFormatter={truncateAxisLabel}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [
                          `${formatNumber(Number(value ?? 0), ' ha')}`,
                          'Área',
                        ]}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { name?: string } | undefined;
                          return row?.name ?? '';
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey='hectares'
                    radius={[0, 4, 4, 0]}
                    maxBarSize={32}
                    isAnimationActive={false}
                    cursor={onFarmFilterChange ? 'pointer' : 'default'}
                    onClick={(data: unknown) => {
                      if (!data || typeof data !== 'object') return;
                      handleFarmBarClick(data as { farmId: string | null; name: string });
                    }}
                  >
                    {topFarms.map((entry, index) => (
                      <Cell
                        key={entry.farmId ?? `farm-${index}`}
                        fill={
                          entry.farmId && filters.farmId === entry.farmId
                            ? BAR_SELECTED
                            : 'var(--color-farmBar)'
                        }
                        className={
                          onFarmFilterChange && entry.farmId
                            ? 'outline-none transition-opacity hover:opacity-90 focus-visible:opacity-100'
                            : 'opacity-95'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </OverviewChartPlot>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {statsQuery.isPending ? (
        <AlertsSkeleton />
      ) : statsQuery.isError ? (
        <Card>
          <CardContent className='py-6'>
            <SectionError
              title='Indicadores de alerta indisponíveis'
              description='O bloco de alertas usa o mesmo resumo dos KPIs. Corrija o erro acima ou tente novamente.'
              onRetry={() => statsQuery.refetch()}
            />
          </CardContent>
        </Card>
      ) : stats ? (
        <>
          <Card>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between gap-2'>
                <div>
                  <CardTitle className='text-base'>Alertas e atenção operacional</CardTitle>
                  <CardDescription>Pendências e inconsistências para ação rápida</CardDescription>
                </div>
                <Badge variant={hasNoAlerts ? 'secondary' : 'destructive'}>
                  {hasNoAlerts ? 'Sem alertas críticos' : 'Acompanhar'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='pt-1'>
              <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2'>
                <AlertRow
                  label='Aplicações avulsas'
                  value={formatNumber(stats.pendingApplicationsCount)}
                  tone={(stats.pendingApplicationsCount || 0) > 0 ? 'warning' : 'neutral'}
                />
                <AlertRow
                  label='Área avulsa'
                  value={formatNumber(stats.pendingApplicationsTotalArea, ' ha')}
                  tone={(stats.pendingApplicationsTotalArea || 0) > 0 ? 'warning' : 'neutral'}
                />
                <AlertRow
                  label='Sem fazenda'
                  value={formatNumber(stats.pendingFarmsCount)}
                  tone={(stats.pendingFarmsCount || 0) > 0 ? 'warning' : 'neutral'}
                />
                <AlertRow
                  label='Sem talhão'
                  value={formatNumber(stats.pendingPlotsCount)}
                  tone={(stats.pendingPlotsCount || 0) > 0 ? 'warning' : 'neutral'}
                />
                <InconsistenciesAlertCard
                  title='Inconsistências operacionais'
                  caption='Pendências e registros que exigem revisão'
                  value={formatNumber(operationalInconsistencyTotal)}
                  tone={operationalInconsistencyTotal > 0 ? 'danger' : 'neutral'}
                  onOpen={() => setInconsistencySheetOpen(true)}
                />
              </div>
            </CardContent>
          </Card>

          <Sheet open={inconsistencySheetOpen} onOpenChange={setInconsistencySheetOpen}>
            <SheetContent side='right' className='flex w-[92vw] flex-col sm:max-w-md'>
              <SheetHeader className='text-left'>
                <SheetTitle>Detalhes das inconsistências</SheetTitle>
                <SheetDescription>
                  O total abaixo é o número de aplicações distintas com pendência de vínculo ou estrutura
                  (OS, fazenda ou talhão), nos mesmos filtros da visão geral.
                </SheetDescription>
              </SheetHeader>
              <div className='mt-5 flex-1 space-y-6 overflow-y-auto px-1 pb-4'>
                <div className='rounded-lg border border-border bg-muted/40 p-4'>
                  <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
                    Total no recorte
                  </p>
                  <p className='mt-1 text-3xl font-semibold tabular-nums text-foreground'>
                    {formatNumber(operationalInconsistencyTotal)}
                  </p>
                  <p className='mt-2 text-xs text-muted-foreground leading-relaxed'>
                    As categorias em &quot;Composição do total&quot; são exclusivas entre si e somam este
                    número. Os recortes adicionais são subconjuntos (podem sobrepor o mesmo registro).
                  </p>
                </div>

                {!inconsistencyCompositionAddsUp && operationalInconsistencyTotal > 0 ? (
                  <p className='text-xs text-amber-800 dark:text-amber-400/90 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-3 py-2'>
                    A soma das categorias exclusivas não bate com o total retornado pela API. Atualize a
                    página ou verifique os dados.
                  </p>
                ) : null}

                <div className='space-y-3'>
                  <p className='text-xs font-semibold text-foreground'>Composição do total</p>
                  {operationalInconsistencyTotal === 0 && inconsistencySubsetRows.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      Nenhuma inconsistência operacional neste recorte.
                    </p>
                  ) : inconsistencyCompositionRows.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      Não há categorias exclusivas para exibir; o total ainda pode ser consultado nos
                      indicadores gerais.
                    </p>
                  ) : (
                    inconsistencyCompositionRows.map(({ issue, count }) => (
                      <div
                        key={issue}
                        className='flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between'
                      >
                        <div className='min-w-0 space-y-1'>
                          <p className='text-sm font-medium text-foreground'>
                            {APPLICATION_ISSUE_LABELS[issue]}
                          </p>
                          <p className='text-2xl font-semibold tabular-nums'>{formatNumber(count)}</p>
                        </div>
                        <Button
                          type='button'
                          variant='secondary'
                          size='sm'
                          className='shrink-0'
                          disabled={!onNavigateRecordsWithIssue}
                          onClick={() => handleInconsistencyViewRecords(issue)}
                        >
                          Ver registros
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {inconsistencySubsetRows.length > 0 ? (
                  <div className='space-y-3 border-t border-border pt-4'>
                    <div className='space-y-1'>
                      <p className='text-xs font-semibold text-foreground'>Recortes adicionais</p>
                      <p className='text-xs text-muted-foreground leading-relaxed'>
                        Úteis para priorizar talhão ou fazenda; não some ao total (um mesmo registro pode
                        aparecer em mais de um recorte).
                      </p>
                    </div>
                    {inconsistencySubsetRows.map(({ issue, count }) => (
                      <div
                        key={issue}
                        className='flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between'
                      >
                        <div className='min-w-0 space-y-1'>
                          <p className='text-sm font-medium text-foreground'>
                            {APPLICATION_ISSUE_LABELS[issue]}
                          </p>
                          <p className='text-2xl font-semibold tabular-nums'>{formatNumber(count)}</p>
                        </div>
                        <Button
                          type='button'
                          variant='secondary'
                          size='sm'
                          className='shrink-0'
                          disabled={!onNavigateRecordsWithIssue}
                          onClick={() => handleInconsistencyViewRecords(issue)}
                        >
                          Ver registros
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  unit?: string;
  subtitle: string;
  icon: typeof SprayCan;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card className='min-h-[112px]'>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between gap-3 h-full'>
          <div className='min-w-0'>
            <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>{title}</p>
            <div className='mt-2 flex items-baseline gap-1'>
              <p className='text-2xl leading-none font-semibold text-foreground'>{value}</p>
              {unit ? <span className='text-xs text-muted-foreground'>{unit}</span> : null}
            </div>
            <p className='text-xs text-muted-foreground mt-2'>{subtitle}</p>
          </div>
          <div
            className={`rounded-md p-2 ${
              tone === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon className='h-4 w-4' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InconsistenciesAlertCard({
  title,
  caption,
  value,
  tone = 'neutral',
  onOpen,
}: {
  title: string;
  caption: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'danger';
  onOpen: () => void;
}) {
  const toneClasses =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100/80 focus-visible:ring-red-300'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/80 focus-visible:ring-amber-300'
        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 focus-visible:ring-ring';

  return (
    <button
      type='button'
      onClick={onOpen}
      className={`group relative w-full rounded-md border p-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${toneClasses}`}
      aria-label={`${title}: ${value}. ${caption}. Abrir detalhes.`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <Map className='h-3.5 w-3.5 shrink-0' aria-hidden />
          <span className='text-xs font-medium leading-tight'>{title}</span>
        </div>
        <ChevronRight
          className='h-4 w-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-100'
          aria-hidden
        />
      </div>
      <div className='mt-2 text-xl font-semibold leading-none tabular-nums'>{value}</div>
      <p className='mt-1.5 text-[11px] text-muted-foreground leading-snug'>{caption}</p>
      <p className='mt-2 text-[10px] font-medium uppercase tracking-wide opacity-80'>
        Clique para explorar
      </p>
    </button>
  );
}

function AlertRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  const toneClasses =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-border bg-muted/30 text-muted-foreground';

  return (
    <div className={`rounded-md border p-3 ${toneClasses}`}>
      <div className='flex items-center gap-2'>
        <Map className='h-3.5 w-3.5' />
        <span className='text-xs font-medium'>{label}</span>
      </div>
      <div className='mt-2 text-xl font-semibold leading-none'>{value}</div>
    </div>
  );
}
