'use client';

import type { InfiniteData } from '@tanstack/react-query';
import { differenceInCalendarDays, format, isValid, max as maxDate, parseISO, subDays } from 'date-fns';
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
import DateRangePicker from '@/components/DateRangePicker';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
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
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllProductsInfinite, useGetProductById } from '@/queries/product.query';
import { useGetAllUsersInfinite, useGetUserById } from '@/queries/user.query';
import type { Farm } from '@/types/farm.type';
import type { Product } from '@/types/product.type';
import { ServiceOrderStatus } from '@/types/service-order.type';
import type { User } from '@/types/user.type';
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
const CHART_EVOLUTION_H = 260;
const CHART_BAR_H = 200;
const CHART_BAR_ROW_H = 34;
const CHART_BAR_MIN_H = 196;
const CHART_BAR_MAX_H = 280;
const CHART_Y_AXIS_W = 140;
const CHART_CATEGORY_LABEL_MAX = 20;

function truncateAxisLabel(value: unknown, maxLen = 22): string {
  const s = String(value ?? '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function getHorizontalBarChartHeight(itemsCount: number): number {
  const computed = itemsCount * CHART_BAR_ROW_H + 36;
  return Math.max(CHART_BAR_MIN_H, Math.min(CHART_BAR_MAX_H, computed));
}

/** Modo Auto: ≤45 dias → dia; &gt;45 e ≤730 dias (~24 meses) → mês; senão → ano. */
const EVOLUTION_AUTO_DAY_MAX = 45;
const EVOLUTION_AUTO_MONTH_MAX_DAYS = 730;
/** Modo dia manual: período &gt;90 dias usa só os últimos 90 dias (API + aviso na UI). */
const EVOLUTION_DAY_CLIP_DAYS = 90;

type EvolutionMode = 'auto' | EvolutionGranularity;

function resolveEvolutionGranularity(
  mode: EvolutionMode,
  startDateStr?: string,
  endDateStr?: string
): EvolutionGranularity {
  if (!startDateStr || !endDateStr) {
    return mode === 'auto' ? 'month' : mode;
  }
  if (mode !== 'auto') return mode;
  const start = parseISO(startDateStr);
  const end = parseISO(endDateStr);
  const days = differenceInCalendarDays(end, start) + 1;
  if (days <= EVOLUTION_AUTO_DAY_MAX) return 'day';
  if (days <= EVOLUTION_AUTO_MONTH_MAX_DAYS) return 'month';
  return 'year';
}

function formatByGranularity(dateValue: string, g: EvolutionGranularity, forTooltip = false): string {
  const parsed = parseISO(dateValue);
  if (!isValid(parsed)) return dateValue;
  if (g === 'day') {
    return format(parsed, forTooltip ? 'dd/MM/yyyy' : 'dd/MM', { locale: ptBR });
  }
  if (g === 'month') {
    return format(parsed, forTooltip ? 'MMMM yyyy' : 'MMM/yyyy', { locale: ptBR });
  }
  return format(parsed, 'yyyy', { locale: ptBR });
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
  onPilotFilterChange?: (pilotId: string | undefined) => void;
  onServiceOrderStatusChange?: (status: ServiceOrderStatus | undefined) => void;
  onDateRangeChange?: (range: { startDate: string; endDate: string } | undefined) => void;
  onClearOverviewFilters?: () => void;
};

const BAR_SELECTED = 'hsl(var(--primary))';

export function ApplicationsOverviewDashboard({
  onNavigateRecordsWithIssue,
  onFarmFilterChange,
  onProductFilterChange,
  onPilotFilterChange,
  onServiceOrderStatusChange,
  onDateRangeChange,
  onClearOverviewFilters,
  ...filters
}: ApplicationsOverviewDashboardProps) {
  const [inconsistencySheetOpen, setInconsistencySheetOpen] = useState(false);
  const [farmSearchValue, setFarmSearchValue] = useState('');
  const [productSearchValue, setProductSearchValue] = useState('');
  const [pilotSearchValue, setPilotSearchValue] = useState('');

  const {
    data: farmsData,
    fetchNextPage: fetchNextPageFarms,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    isLoading: isLoadingFarms,
  } = useGetAllFarmsInfinite(filters.customerId, {
    limit: '10',
    search: farmSearchValue || undefined,
  });
  const allFarms =
    (farmsData as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const {
    data: productsData,
    fetchNextPage: fetchNextPageProducts,
    hasNextPage: hasNextPageProducts,
    isFetchingNextPage: isFetchingNextPageProducts,
    isLoading: isLoadingProducts,
  } = useGetAllProductsInfinite({
    limit: '10',
    search: productSearchValue || undefined,
  });
  const allProducts =
    (productsData as unknown as InfiniteData<{ data: Product[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const {
    data: pilotsData,
    fetchNextPage: fetchNextPagePilots,
    hasNextPage: hasNextPagePilots,
    isFetchingNextPage: isFetchingNextPagePilots,
    isLoading: isLoadingPilots,
  } = useGetAllUsersInfinite({
    type: 'pilot',
    limit: '10',
    search: pilotSearchValue || undefined,
  });
  const allPilots =
    (pilotsData as unknown as InfiniteData<{ data: User[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const farmLabelQuery = useGetFarmById(filters.farmId ?? null);
  const productLabelQuery = useGetProductById(filters.productId ?? '', {
    enabled: Boolean(filters.productId),
  });
  const pilotLabelQuery = useGetUserById(filters.pilotId ?? '', {
    queryKey: ['users', 'overview-pilot', filters.pilotId],
    enabled: Boolean(filters.pilotId),
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
  const handleOverviewDateRangeChange = useCallback(
    (range: { startDate: string; endDate: string } | undefined) => {
      onDateRangeChange?.(range);
    },
    [onDateRangeChange]
  );
  const hasExplicitDateRange = Boolean(filters.startDate && filters.endDate);
  const effectiveDateRange = useMemo(() => {
    if (filters.startDate && filters.endDate) {
      return { startDate: filters.startDate, endDate: filters.endDate };
    }
    return undefined;
  }, [filters.endDate, filters.startDate]);

  const [evolutionMode, setEvolutionMode] = useState<EvolutionMode>('auto');

  const resolvedEvolutionGranularity = useMemo(
    () =>
      resolveEvolutionGranularity(
        evolutionMode,
        effectiveDateRange?.startDate,
        effectiveDateRange?.endDate
      ),
    [evolutionMode, effectiveDateRange?.endDate, effectiveDateRange?.startDate]
  );

  const evolutionApiRange = useMemo(() => {
    if (!effectiveDateRange) {
      return {
        startDate: undefined,
        endDate: undefined,
        dayRangeCapped: false,
      };
    }

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
    effectiveDateRange,
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
      startDate: hasExplicitDateRange ? evolutionApiRange.startDate : undefined,
      endDate: hasExplicitDateRange ? evolutionApiRange.endDate : undefined,
      months: evolutionMonthsParam,
      granularity: resolvedEvolutionGranularity,
    }),
    [
      filters,
      hasExplicitDateRange,
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
  const statusOptions = useMemo(
    () => [
      { value: 'open', label: 'Aberto' },
      { value: 'completed', label: 'Concluído' },
      { value: 'cancelled', label: 'Cancelado' },
    ],
    []
  );
  const statusLabelMap = useMemo(
    () => ({
      open: 'Aberto',
      completed: 'Concluído',
      cancelled: 'Cancelado',
    }),
    []
  );

  const statsQuery = useGetStatsApplications(filters);
  const globalStatsQuery = useGetStatsApplications({ ignoreFilters: true });
  const evolutionQuery = useGetApplicationsEvolution(evolutionQueryParams);
  const topFarmsQuery = useGetApplicationsTopFarms({ ...filters, limit: 5 });

  const stats = statsQuery.data?.stats;
  const totalApplications = stats?.applicationCount ?? 0;
  const totalAreaHectares = stats?.totalAreaHectares ?? 0;
  const avgHectaresPerApplication = stats?.averageApplicationArea ?? 0;
  const looseCount = stats?.pendingApplicationsCount ?? 0;
  const loosePercent = totalApplications > 0 ? (looseCount / totalApplications) * 100 : 0;

  const evolution = evolutionQuery.data?.evolution ?? [];
  const chartData = useMemo(() => {
    return evolution
      .map((item) => ({
        name: item.date,
        value: Number(item.applicationsCount || 0),
      }))
      .filter(
        (item) => typeof item.name === 'string' && item.name.length === 10
      ) as Array<{ name: string; value: number }>;
  }, [evolution]);

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

  const productChartHeight = useMemo(
    () => getHorizontalBarChartHeight(productData.length || 5),
    [productData.length]
  );
  const topFarmsChartHeight = useMemo(
    () => getHorizontalBarChartHeight(topFarms.length || 5),
    [topFarms.length]
  );

  const hasNoAlerts =
    (stats?.pendingApplicationsCount || 0) === 0 &&
    (stats?.pendingApplicationsTotalArea || 0) === 0 &&
    (stats?.pendingFarmsCount || 0) === 0 &&
    (stats?.pendingPlotsCount || 0) === 0 &&
    (stats?.invalidApplication || 0) === 0 &&
    (stats?.pendingApplicationsMissingFarmCount ?? 0) === 0;

  /** Total distinto alinhado ao critério de pendência estrutural (mesmo universo que “avulsas” no KPI). */
  const operationalInconsistencyTotal = stats?.pendingApplicationsCount ?? 0;
  const globalOperationalInconsistencyTotal =
    globalStatsQuery.data?.stats?.pendingApplicationsCount ?? 0;

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
  const quickFilterActive = Boolean(
    filters.startDate ||
      filters.endDate ||
      filters.farmId ||
      filters.productId ||
      filters.pilotId ||
      filters.serviceOrderStatus
  );
  const farmChipLabel = filters.farmId
    ? farmLabelQuery.data?.farm?.name ?? `Fazenda ${filters.farmId.slice(0, 8)}…`
    : '';
  const productChipLabel = filters.productId
    ? productLabelQuery.data?.product?.name ?? `Produto ${filters.productId.slice(0, 8)}…`
    : '';
  const pilotChipLabel = filters.pilotId
    ? pilotLabelQuery.data?.name ?? `Piloto ${filters.pilotId.slice(0, 8)}…`
    : '';

  const farmOptions = useMemo(() => {
    const base = allFarms.map((farm) => ({ value: farm.id, label: farm.name }));
    if (
      filters.farmId &&
      farmChipLabel &&
      !base.some((option) => option.value === filters.farmId)
    ) {
      return [{ value: filters.farmId, label: farmChipLabel }, ...base];
    }
    return base;
  }, [allFarms, farmChipLabel, filters.farmId]);

  const productOptions = useMemo(() => {
    const base = allProducts.map((product) => ({ value: product.id, label: product.name }));
    if (
      filters.productId &&
      productChipLabel &&
      !base.some((option) => option.value === filters.productId)
    ) {
      return [{ value: filters.productId, label: productChipLabel }, ...base];
    }
    return base;
  }, [allProducts, filters.productId, productChipLabel]);

  const pilotOptions = useMemo(() => {
    const base = allPilots.map((pilot) => ({ value: pilot.id, label: pilot.name }));
    if (
      filters.pilotId &&
      pilotChipLabel &&
      !base.some((option) => option.value === filters.pilotId)
    ) {
      return [{ value: filters.pilotId, label: pilotChipLabel }, ...base];
    }
    return base;
  }, [allPilots, filters.pilotId, pilotChipLabel]);

  return (
    <div className='space-y-5'>
      <div className='rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            <div className='flex w-full flex-wrap items-center gap-2'>
              <DateRangePicker
                key={`${filters.startDate ?? 'none'}-${filters.endDate ?? 'none'}`}
                className='w-full min-w-[220px] sm:w-[280px]'
                initialValue={
                  filters.startDate && filters.endDate
                    ? { startDate: filters.startDate, endDate: filters.endDate }
                    : undefined
                }
                onChange={handleOverviewDateRangeChange}
              />
              <SearchableSelectQuery
                options={farmOptions}
                value={filters.farmId}
                onValueChange={(value) => onFarmFilterChange?.(value as string | undefined)}
                placeholder='Fazenda'
                searchPlaceholder='Buscar fazenda...'
                className='w-full sm:w-[210px]'
                clearable
                onSearchChange={setFarmSearchValue}
                onScrollEnd={fetchNextPageFarms}
                hasNextPage={hasNextPageFarms}
                isFetchingNextPage={isFetchingNextPageFarms}
                isLoading={isLoadingFarms}
              />
              <SearchableSelectQuery
                options={productOptions}
                value={filters.productId}
                onValueChange={(value) => onProductFilterChange?.(value as string | undefined)}
                placeholder='Produto'
                searchPlaceholder='Buscar produto...'
                className='w-full sm:w-[210px]'
                clearable
                onSearchChange={setProductSearchValue}
                onScrollEnd={fetchNextPageProducts}
                hasNextPage={hasNextPageProducts}
                isFetchingNextPage={isFetchingNextPageProducts}
                isLoading={isLoadingProducts}
              />
              <SearchableSelectQuery
                options={pilotOptions}
                value={filters.pilotId}
                onValueChange={(value) => onPilotFilterChange?.(value as string | undefined)}
                placeholder='Piloto'
                searchPlaceholder='Buscar piloto...'
                className='w-full sm:w-[210px]'
                clearable
                onSearchChange={setPilotSearchValue}
                onScrollEnd={fetchNextPagePilots}
                hasNextPage={hasNextPagePilots}
                isFetchingNextPage={isFetchingNextPagePilots}
                isLoading={isLoadingPilots}
              />
              <SearchableSelectQuery
                options={statusOptions}
                value={filters.serviceOrderStatus}
                onValueChange={(value) =>
                  onServiceOrderStatusChange?.(value as ServiceOrderStatus | undefined)
                }
                placeholder='Status da OS'
                searchPlaceholder='Buscar status...'
                className='w-full sm:w-[180px]'
                clearable
              />
              {quickFilterActive ? (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='shrink-0'
                  onClick={() => onClearOverviewFilters?.()}
                >
                  Limpar filtros
                </Button>
              ) : null}
            </div>

            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              {filters.startDate && filters.endDate ? (
                <Badge
                  variant='secondary'
                  className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal'
                >
                  <span className='max-w-[280px] truncate'>
                    Período: {filters.startDate} até {filters.endDate}
                  </span>
                  <button
                    type='button'
                    className='rounded-sm p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    aria-label='Remover filtro de período'
                    onClick={() => onDateRangeChange?.(undefined)}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </Badge>
              ) : null}
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
              {filters.pilotId ? (
                <Badge
                  variant='secondary'
                  className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal'
                >
                  <span className='max-w-[220px] truncate'>Piloto: {pilotChipLabel}</span>
                  <button
                    type='button'
                    className='rounded-sm p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    aria-label='Remover filtro de piloto'
                    onClick={() => onPilotFilterChange?.(undefined)}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </Badge>
              ) : null}
              {filters.serviceOrderStatus ? (
                <Badge
                  variant='secondary'
                  className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal'
                >
                  <span className='max-w-[220px] truncate'>
                    Status OS: {statusLabelMap[filters.serviceOrderStatus]}
                  </span>
                  <button
                    type='button'
                    className='rounded-sm p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    aria-label='Remover filtro de status da OS'
                    onClick={() => onServiceOrderStatusChange?.(undefined)}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </Badge>
              ) : null}
              {!quickFilterActive && !crossFilterActive ? (
                <span className='text-xs text-muted-foreground'>
                Filtros cruzados: clique numa barra em <strong className='font-medium'>Top fazendas</strong>{' '}
                ou <strong className='font-medium'>Distribuição por produto</strong> para refinar o painel e
                a aba Registros.
                </span>
              ) : null}
            </div>
          </div>
          {quickFilterActive || crossFilterActive ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='shrink-0'
              onClick={() => onClearOverviewFilters?.()}
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
          ) : chartData.length === 0 ? (
            <ChartPlotShell heightPx={CHART_EVOLUTION_H}>
              <ChartEmptyState
                title='Sem dados de evolução para exibir.'
                hint={emptyChartHint}
              />
            </ChartPlotShell>
          ) : chartData.length === 1 ? (
            <OverviewChartPlot
              heightPx={CHART_EVOLUTION_H}
              chartId='overview-evolution-single-bar'
              config={{ value: { label: 'Aplicações', color: 'var(--chart-1)' } }}
            >
              <BarChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis
                  dataKey='name'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) => formatByGranularity(String(v), resolvedEvolutionGranularity)}
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
                        formatByGranularity(String(label), resolvedEvolutionGranularity, true)
                      }
                      formatter={(value) => [
                        `${Number(value ?? 0).toLocaleString('pt-BR')} aplicações`,
                        '',
                      ]}
                    />
                  }
                />
                <Bar dataKey='value' fill='var(--color-value)' radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </OverviewChartPlot>
          ) : (
            <OverviewChartPlot
              heightPx={CHART_EVOLUTION_H}
              chartId='overview-evolution-line'
              config={{ applications: { label: 'Aplicações', color: 'var(--chart-1)' } }}
            >
              <LineChart
                data={chartData}
                margin={{
                  left: 4,
                  right: 8,
                  top: 8,
                  bottom: resolvedEvolutionGranularity === 'day' ? 28 : 8,
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis
                  dataKey='name'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={resolvedEvolutionGranularity === 'day' ? 4 : 8}
                  angle={resolvedEvolutionGranularity === 'day' ? -30 : 0}
                  textAnchor={resolvedEvolutionGranularity === 'day' ? 'end' : 'middle'}
                  height={resolvedEvolutionGranularity === 'day' ? 48 : undefined}
                  tickFormatter={(v) =>
                    formatByGranularity(String(v), resolvedEvolutionGranularity, false)
                  }
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
                        formatByGranularity(String(label), resolvedEvolutionGranularity, true)
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
                  dataKey='value'
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
              <Skeleton className='w-full rounded-md' style={{ height: productChartHeight }} />
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
              <ChartPlotShell heightPx={productChartHeight}>
                <ChartEmptyState
                  title='Sem dados de produto para o período.'
                  hint={emptyChartHint}
                />
              </ChartPlotShell>
            ) : (
              <OverviewChartPlot
                heightPx={productChartHeight}
                chartId='overview-products-bar'
                config={{ productBar: { label: 'Hectares', color: 'var(--chart-2)' } }}
              >
                <BarChart
                  data={productData}
                  layout='vertical'
                  margin={{ left: 8, right: 14, top: 6, bottom: 6 }}
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
                    width={CHART_Y_AXIS_W}
                    tickFormatter={(value) => truncateAxisLabel(value, CHART_CATEGORY_LABEL_MAX)}
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
              <Skeleton className='w-full rounded-md' style={{ height: topFarmsChartHeight }} />
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
              <ChartPlotShell heightPx={topFarmsChartHeight}>
                <ChartEmptyState
                  title='Sem dados de fazendas para exibir.'
                  hint={emptyChartHint}
                />
              </ChartPlotShell>
            ) : (
              <OverviewChartPlot
                heightPx={topFarmsChartHeight}
                chartId='overview-farms-bar'
                config={{ farmBar: { label: 'Hectares', color: 'var(--chart-3)' } }}
              >
                <BarChart
                  data={topFarms}
                  layout='vertical'
                  margin={{ left: 8, right: 14, top: 6, bottom: 6 }}
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
                    width={CHART_Y_AXIS_W}
                    tickFormatter={(value) => truncateAxisLabel(value, CHART_CATEGORY_LABEL_MAX)}
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
                  <p className='text-[11px] font-semibold text-muted-foreground'>
                    Inconsistências no filtro atual
                  </p>
                  <p className='mt-1 text-3xl font-semibold tabular-nums text-foreground'>
                    {formatNumber(operationalInconsistencyTotal)}
                  </p>
                  <div className='mt-3 border-t border-border/80 pt-3'>
                    <p className='text-[11px] font-medium text-muted-foreground'>
                      Total geral de inconsistências
                    </p>
                    <p className='mt-1 text-xl font-semibold tabular-nums text-foreground'>
                      {globalStatsQuery.isPending
                        ? '...'
                        : formatNumber(globalOperationalInconsistencyTotal)}
                    </p>
                  </div>
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
