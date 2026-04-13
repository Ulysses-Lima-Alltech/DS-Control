'use client';

import type { InfiniteData } from '@tanstack/react-query';
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getYear,
  isValid,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Info,
  Leaf,
  Map as MapIcon,
  User as UserIcon,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
  useGetApplicationsByPilotStats,
  useGetApplicationsTopFarms,
  useGetStatsApplications,
} from '@/queries/application.query';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetFarmById } from '@/queries/farm.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllProductsInfinite, useGetProductById } from '@/queries/product.query';
import { useGetAllUsersInfinite, useGetUserById } from '@/queries/user.query';
import type { Farm } from '@/types/farm.type';
import type { Customer } from '@/types/customer.type';
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
 * A evolução temporal usa sempre `LineChart` dentro de `OverviewChartPlot` (todas as granularidades).
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

const EVOLUTION_DAY_BUCKET_COUNT = 30;
const EVOLUTION_YEAR_BUCKET_COUNT = 5;

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseCalendarDateStr(s: string): Date {
  const part = s.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(part);
  if (!m) return parseISO(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function normalizeCalendarDateKey(raw: string): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s.length < 10) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = parseISO(s);
  if (!isValid(parsed)) return s.slice(0, 10);
  return format(parsed, 'yyyy-MM-dd');
}

function getDefaultEvolutionWindow(granularity: EvolutionGranularity): { start: Date; end: Date } {
  const today = startOfDayLocal(new Date());
  if (granularity === 'day') {
    const end = today;
    const start = subDays(end, EVOLUTION_DAY_BUCKET_COUNT - 1);
    return { start, end };
  }
  if (granularity === 'month') {
    const start = startOfMonth(new Date(getYear(today), 0, 1));
    return { start, end: today };
  }
  const endY = getYear(today);
  const startY = endY - (EVOLUTION_YEAR_BUCKET_COUNT - 1);
  const start = startOfDayLocal(new Date(startY, 0, 1));
  return { start, end: today };
}

function getEffectiveEvolutionWindow(
  startDateStr: string | undefined,
  endDateStr: string | undefined,
  granularity: EvolutionGranularity
): { start: Date; end: Date } {
  if (startDateStr && endDateStr) {
    return {
      start: startOfDayLocal(parseCalendarDateStr(startDateStr)),
      end: startOfDayLocal(parseCalendarDateStr(endDateStr)),
    };
  }
  return getDefaultEvolutionWindow(granularity);
}

function buildBucketKeysWithinWindow(
  granularity: EvolutionGranularity,
  window: { start: Date; end: Date }
): string[] {
  const start = startOfDayLocal(window.start);
  const end = startOfDayLocal(window.end);
  if (start > end) return [];

  if (granularity === 'day') {
    const keys: string[] = [];
    const n = differenceInCalendarDays(end, start) + 1;
    for (let i = 0; i < n; i++) {
      keys.push(format(addDays(start, i), 'yyyy-MM-dd'));
    }
    return keys;
  }
  if (granularity === 'month') {
    const rangeStart = startOfMonth(start);
    const rangeEnd = startOfMonth(end);
    return eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).map((d) =>
      format(d, 'yyyy-MM-dd')
    );
  }
  const ys = getYear(start);
  const ye = getYear(end);
  const keys: string[] = [];
  for (let y = ys; y <= ye; y++) {
    keys.push(format(new Date(y, 0, 1), 'yyyy-MM-dd'));
  }
  return keys;
}

function mergeEvolutionSeriesWithZeros(
  items: Array<{ date: string; applicationsCount: number }>,
  bucketKeys: string[]
): Array<{ name: string; value: number }> {
  const byDate = new globalThis.Map<string, number>();
  for (const item of items) {
    if (typeof item.date !== 'string' || item.date.length < 10) continue;
    const k = normalizeCalendarDateKey(item.date);
    byDate.set(k, Number(item.applicationsCount || 0));
  }
  return bucketKeys.map((name) => ({
    name,
    value: byDate.get(name) ?? 0,
  }));
}

function formatByGranularity(dateValue: string, g: EvolutionGranularity, forTooltip = false): string {
  const parsed =
    dateValue.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dateValue)
      ? parseCalendarDateStr(dateValue.slice(0, 10))
      : parseISO(dateValue);
  if (!isValid(parsed)) return dateValue;
  if (g === 'day') {
    return format(parsed, forTooltip ? 'dd/MM/yyyy' : 'dd/MM', { locale: ptBR });
  }
  if (g === 'month') {
    return format(parsed, forTooltip ? 'MMMM yyyy' : 'MMM', { locale: ptBR });
  }
  return format(parsed, 'yyyy', { locale: ptBR });
}

/** Intervalo [startDate,endDate] em yyyy-MM-dd para o bucket clicado (ano = ano civil completo; mês = mês completo; dia = dia). */
function bucketDateRangeFromEvolutionPoint(
  pointName: string,
  g: EvolutionGranularity
): { startDate: string; endDate: string } | null {
  const parsed =
    pointName.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(pointName)
      ? parseCalendarDateStr(pointName.slice(0, 10))
      : parseISO(pointName);
  if (!isValid(parsed)) return null;
  if (g === 'day') {
    const d = format(parsed, 'yyyy-MM-dd');
    return { startDate: d, endDate: d };
  }
  if (g === 'month') {
    return {
      startDate: format(startOfMonth(parsed), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(parsed), 'yyyy-MM-dd'),
    };
  }
  return {
    startDate: format(startOfYear(parsed), 'yyyy-MM-dd'),
    endDate: format(endOfYear(parsed), 'yyyy-MM-dd'),
  };
}

function hasActiveOverviewFilters(f: OverviewFilters): boolean {
  return Boolean(
    (f.search && f.search.trim().length > 0) ||
      f.farmId ||
      f.productId ||
      f.pilotId ||
      f.customerId ||
      f.serviceOrderId ||
      f.serviceOrderStatus ||
      f.invalidApplication === true
  );
}

function getYesterdayDateString(): string {
  return format(subDays(startOfDayLocal(new Date()), 1), 'yyyy-MM-dd');
}

function isYesterdayRange(startDate?: string, endDate?: string): boolean {
  if (!startDate || !endDate) return false;
  const yesterday = getYesterdayDateString();
  return startDate === yesterday && endDate === yesterday;
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
const DEV_MOCK_EVOLUTION =
  process.env.NEXT_PUBLIC_DEV_MOCK_EVOLUTION === 'true' && process.env.NODE_ENV === 'development';

function getDevMockEvolution(granularity: EvolutionGranularity): Array<{ date: string; applicationsCount: number }> {
  if (granularity === 'day') {
    return [
      { date: '2026-04-01', applicationsCount: 12 },
      { date: '2026-04-02', applicationsCount: 15 },
      { date: '2026-04-03', applicationsCount: 10 },
      { date: '2026-04-04', applicationsCount: 19 },
      { date: '2026-04-05', applicationsCount: 13 },
    ];
  }
  if (granularity === 'month') {
    return [
      { date: '2026-01-01', applicationsCount: 122 },
      { date: '2026-02-01', applicationsCount: 118 },
      { date: '2026-03-01', applicationsCount: 135 },
      { date: '2026-04-01', applicationsCount: 141 },
    ];
  }
  return [{ date: '2026-01-01', applicationsCount: 516 }];
}

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
  onCustomerFilterChange?: (customerId: string | undefined) => void;
  onProductFilterChange?: (productId: string | undefined) => void;
  onPilotFilterChange?: (pilotId: string | undefined) => void;
  onServiceOrderStatusChange?: (status: ServiceOrderStatus | undefined) => void;
  onDateRangeChange?: (range: { startDate: string; endDate: string } | undefined) => void;
  onClearOverviewFilters?: () => void;
  /**
   * DEV ONLY — usado pela rota `/debug/applications-overview`.
   * Força dados mock na evolução temporal (mesmo contrato da API) para validar render sem auth.
   */
  __devEvolutionMock?: boolean;
  /** DEV ONLY — força série vazia no gráfico de evolução (branch `empty`). */
  __devEvolutionEmpty?: boolean;
};

const BAR_SELECTED = 'hsl(var(--primary))';
const PRODUCT_BAR_DEFAULT = 'hsl(var(--chart-2) / 0.82)';
const FARM_BAR_DEFAULT = 'hsl(var(--chart-3) / 0.82)';
const LINE_COLOR = 'hsl(var(--chart-1))';
const CHART_GRID_STROKE = 'hsl(var(--border) / 0.55)';

export function ApplicationsOverviewDashboard({
  onNavigateRecordsWithIssue,
  onFarmFilterChange,
  onCustomerFilterChange,
  onProductFilterChange,
  onPilotFilterChange,
  onServiceOrderStatusChange,
  onDateRangeChange,
  onClearOverviewFilters,
  __devEvolutionMock = false,
  __devEvolutionEmpty = false,
  ...filters
}: ApplicationsOverviewDashboardProps) {
  const [inconsistencySheetOpen, setInconsistencySheetOpen] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState('');
  const [farmSearchValue, setFarmSearchValue] = useState('');
  const [productSearchValue, setProductSearchValue] = useState('');
  const [pilotSearchValue, setPilotSearchValue] = useState('');

  const {
    data: customersData,
    fetchNextPage: fetchNextPageCustomers,
    hasNextPage: hasNextPageCustomers,
    isFetchingNextPage: isFetchingNextPageCustomers,
    isLoading: isLoadingCustomers,
  } = useGetAllCustomersInfinite({
    limit: '10',
    search: customerSearchValue || undefined,
  });
  const allCustomers =
    (customersData as unknown as InfiniteData<{ data: Customer[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

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
    status: 'active',
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
  const customerLabel =
    allCustomers.find((customer) => customer.id === filters.customerId)?.name ??
    (filters.customerId ? `Cliente ${filters.customerId.slice(0, 8)}…` : '');

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
  const [evolutionMode, setEvolutionMode] = useState<EvolutionGranularity>('month');

  const hasManualPeriodFilter = Boolean(filters.startDate && filters.endDate);
  const isDefaultYesterdayPeriod = isYesterdayRange(filters.startDate, filters.endDate);

  const effectiveEvolutionWindow = useMemo(
    () => getEffectiveEvolutionWindow(filters.startDate, filters.endDate, evolutionMode),
    [filters.startDate, filters.endDate, evolutionMode]
  );

  const evolutionBucketKeys = useMemo(
    () => buildBucketKeysWithinWindow(evolutionMode, effectiveEvolutionWindow),
    [evolutionMode, effectiveEvolutionWindow]
  );

  const evolutionQueryParams = useMemo(() => {
    const dateParams =
      filters.startDate && filters.endDate
        ? { startDate: filters.startDate, endDate: filters.endDate }
        : {
            startDate: format(effectiveEvolutionWindow.start, 'yyyy-MM-dd'),
            endDate: format(effectiveEvolutionWindow.end, 'yyyy-MM-dd'),
          };
    return {
      search: filters.search,
      serviceOrderStatus: filters.serviceOrderStatus,
      farmId: filters.farmId,
      pilotId: filters.pilotId,
      productId: filters.productId,
      customerId: filters.customerId,
      serviceOrderId: filters.serviceOrderId,
      invalidApplication: filters.invalidApplication,
      ...dateParams,
      granularity: evolutionMode,
    };
  }, [
    effectiveEvolutionWindow.start.getTime(),
    effectiveEvolutionWindow.end.getTime(),
    evolutionMode,
    filters.customerId,
    filters.endDate,
    filters.farmId,
    filters.invalidApplication,
    filters.pilotId,
    filters.productId,
    filters.search,
    filters.serviceOrderId,
    filters.serviceOrderStatus,
    filters.startDate,
  ]);

  const evolutionCardSubtitle = useMemo(() => {
    const gLabel =
      evolutionMode === 'day' ? 'dia' : evolutionMode === 'month' ? 'mês' : 'ano';
    if (hasManualPeriodFilter) {
      return `Período do painel: ${filters.startDate} a ${filters.endDate} · agregação por ${gLabel}`;
    }
    const segment =
      evolutionMode === 'day'
        ? `Últimos ${EVOLUTION_DAY_BUCKET_COUNT} dias`
        : evolutionMode === 'month'
          ? 'Meses do ano atual até o momento'
          : `Últimos ${EVOLUTION_YEAR_BUCKET_COUNT} anos`;
    return `${segment} · agregação por ${gLabel}`;
  }, [
    evolutionMode,
    filters.endDate,
    filters.startDate,
    hasManualPeriodFilter,
  ]);

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
  const byPilotQuery = useGetApplicationsByPilotStats({ ...filters, limit: 10 });

  const stats = statsQuery.data?.stats;
  const totalApplications = stats?.applicationCount ?? 0;
  const totalAreaHectares = stats?.totalAreaHectares ?? 0;

  const evolutionMockActive =
    DEV_MOCK_EVOLUTION ||
    (process.env.NODE_ENV === 'development' && __devEvolutionMock);

  const evolution = useMemo(() => {
    if (process.env.NODE_ENV === 'development' && __devEvolutionEmpty) {
      return [] as Array<{ date: string; applicationsCount: number }>;
    }
    if (evolutionMockActive) {
      return getDevMockEvolution(evolutionMode);
    }
    return evolutionQuery.data?.evolution ?? [];
  }, [
    evolutionQuery.data?.evolution,
    evolutionMode,
    evolutionMockActive,
    __devEvolutionEmpty,
  ]);
  const chartData = useMemo(() => {
    if (process.env.NODE_ENV === 'development' && __devEvolutionEmpty) {
      return [] as Array<{ name: string; value: number }>;
    }
    return mergeEvolutionSeriesWithZeros(evolution, evolutionBucketKeys);
  }, [evolution, evolutionBucketKeys, __devEvolutionEmpty]);

  const isSingleBucket = chartData.length === 1;

  const evolutionSelectedBucketKey = useMemo(() => {
    if (!filters.startDate || !filters.endDate || chartData.length === 0) return null;
    for (const row of chartData) {
      const r = bucketDateRangeFromEvolutionPoint(row.name, evolutionMode);
      if (r && r.startDate === filters.startDate && r.endDate === filters.endDate) {
        return row.name;
      }
    }
    return null;
  }, [chartData, filters.startDate, filters.endDate, evolutionMode]);

  /**
   * Drill-down temporal: Ano → aplica ano civil + passa a Mês; Mês → mês civil + passa a Dia;
   * Dia → só aquele dia (permanece em Dia). O painel inteiro segue `onDateRangeChange`.
   * Se o intervalo já for o mesmo, remove o período (comportamento de toggle).
   */
  const handleEvolutionBucketClick = useCallback(
    (pointName: string) => {
      if (!onDateRangeChange) return;
      const range = bucketDateRangeFromEvolutionPoint(pointName, evolutionMode);
      if (!range) return;
      if (filters.startDate === range.startDate && filters.endDate === range.endDate) {
        onDateRangeChange(undefined);
        return;
      }
      onDateRangeChange(range);
      if (evolutionMode === 'year') {
        setEvolutionMode('month');
      } else if (evolutionMode === 'month') {
        setEvolutionMode('day');
      }
    },
    [onDateRangeChange, evolutionMode, filters.startDate, filters.endDate]
  );

  const evolutionIsPending = evolutionMockActive ? false : evolutionQuery.isPending;
  const evolutionIsError = evolutionMockActive ? false : evolutionQuery.isError;

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
    (!isDefaultYesterdayPeriod && filters.startDate && filters.endDate) ||
      filters.customerId ||
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

  const customerOptions = useMemo(() => {
    const base = allCustomers.map((customer) => ({ value: customer.id, label: customer.name }));
    if (
      filters.customerId &&
      customerLabel &&
      !base.some((option) => option.value === filters.customerId)
    ) {
      return [{ value: filters.customerId, label: customerLabel }, ...base];
    }
    return base;
  }, [allCustomers, customerLabel, filters.customerId]);

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
                options={customerOptions}
                value={filters.customerId}
                onValueChange={(value) => onCustomerFilterChange?.(value as string | undefined)}
                placeholder='Cliente'
                searchPlaceholder='Buscar cliente...'
                className='w-full sm:w-[210px]'
                clearable
                onSearchChange={setCustomerSearchValue}
                onScrollEnd={fetchNextPageCustomers}
                hasNextPage={hasNextPageCustomers}
                isFetchingNextPage={isFetchingNextPageCustomers}
                isLoading={isLoadingCustomers}
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
              {filters.startDate && filters.endDate && !isDefaultYesterdayPeriod ? (
                <Badge
                  variant='outline'
                  className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal border-primary/25 bg-primary/10 text-primary'
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
                variant='outline'
                className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal border-border/70 bg-muted/40'
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
              {filters.customerId ? (
                <Badge
                  variant='outline'
                  className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal border-border/70 bg-muted/40'
                >
                  <span className='max-w-[220px] truncate'>Cliente: {customerLabel}</span>
                  <button
                    type='button'
                    className='rounded-sm p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    aria-label='Remover filtro de cliente'
                    onClick={() => onCustomerFilterChange?.(undefined)}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </Badge>
              ) : null}
              {filters.productId ? (
              <Badge
                variant='outline'
                className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal border-border/70 bg-muted/40'
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
                  variant='outline'
                  className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal border-border/70 bg-muted/40'
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
                  variant='outline'
                  className='group max-w-full gap-1.5 py-1 pl-2.5 pr-1 font-normal border-border/70 bg-muted/40'
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
              title='Total de hectares no período'
              value={formatNumber(totalAreaHectares)}
              unit='ha'
              subtitle='Soma de área aplicada no recorte'
              icon={Leaf}
            />
            <KpiCard
              title='Média por dia'
              value={formatNumber(stats.operationalAverageHectaresPerDay)}
              unit='ha/dia'
              subtitle='Área total dividida pelos dias do recorte'
              icon={TrendingUp}
            />
            <KpiCard
              title='Média por drone'
              value={formatNumber(stats.operationalAverageHectaresPerDrone)}
              unit='ha/drone'
              subtitle='Área total dividida por drones distintos'
              icon={TrendingUp}
            />
            <KpiCard
              title='Média por piloto'
              value={formatNumber(stats.operationalAverageHectaresPerPilot)}
              unit='ha/piloto'
              subtitle='Área total dividida por pilotos distintos'
              icon={UserIcon}
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
              <CardDescription>
                {evolutionCardSubtitle}
                {onDateRangeChange ? (
                  <span className='mt-1 block text-xs text-muted-foreground'>
                    Clique num ponto: em Ano desce para meses daquele ano; em Mês para dias daquele
                    mês; em Dia filtra o dia. O painel e a aba Registros acompanham o período.
                  </span>
                ) : null}
              </CardDescription>
            </div>
            <Select
              value={evolutionMode}
              onValueChange={(v) => setEvolutionMode(v as EvolutionGranularity)}
            >
              <SelectTrigger
                aria-label='Granularidade da evolução temporal'
                className='h-9 w-full sm:w-[168px] shrink-0 text-xs'
              >
                <SelectValue placeholder='Granularidade' />
              </SelectTrigger>
              <SelectContent align='end'>
                <SelectItem value='day'>Dia</SelectItem>
                <SelectItem value='month'>Mês</SelectItem>
                <SelectItem value='year'>Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className='min-w-0 overflow-hidden pt-1'>
          {evolutionIsPending ? (
            <Skeleton className='w-full rounded-md' style={{ height: CHART_EVOLUTION_H }} />
          ) : evolutionIsError ? (
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
          ) : (
            <OverviewChartPlot
              heightPx={CHART_EVOLUTION_H}
              chartId='overview-evolution-temporal'
              config={{ applications: { label: 'Aplicações', color: 'hsl(var(--chart-1))' } }}
            >
              <LineChart
                data={chartData}
                margin={{
                  left: 4,
                  right: 8,
                  top: isSingleBucket ? 16 : 8,
                  bottom: evolutionMode === 'day' ? 28 : 12,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke={CHART_GRID_STROKE}
                  strokeDasharray='3 3'
                />
                <XAxis
                  dataKey='name'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={evolutionMode === 'day' ? 4 : 8}
                  angle={evolutionMode === 'day' ? -30 : 0}
                  textAnchor={evolutionMode === 'day' ? 'end' : 'middle'}
                  height={evolutionMode === 'day' ? 48 : 40}
                  tickFormatter={(v) =>
                    formatByGranularity(String(v), evolutionMode, false)
                  }
                  interval='preserveStartEnd'
                />
                <YAxis
                  allowDecimals={false}
                  width={40}
                  domain={[0, 'dataMax + 1']}
                  tickFormatter={(value) => formatCompact(Number(value))}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) =>
                        formatByGranularity(String(label), evolutionMode, true)
                      }
                      formatter={(value) => [
                        `${Number(value ?? 0).toLocaleString('pt-BR')} aplicações`,
                        '',
                      ]}
                    />
                  }
                />
                <Line
                  type='linear'
                  dataKey='value'
                  name='Aplicações'
                  stroke={LINE_COLOR}
                  strokeWidth={3}
                  strokeOpacity={1}
                  dot={(dotProps: { cx?: number; cy?: number; payload?: { name: string; value: number } }) => {
                    const { cx, cy, payload } = dotProps;
                    if (cx == null || cy == null || !payload) return <g />;
                    const selected = evolutionSelectedBucketKey === payload.name;
                    const baseR = isSingleBucket ? 7 : 4;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={selected ? baseR + 2.5 : baseR}
                        fill={LINE_COLOR}
                        stroke='var(--background)'
                        strokeWidth={2}
                        className={
                          onDateRangeChange
                            ? 'cursor-pointer outline-none transition-[r] duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring'
                            : undefined
                        }
                        onClick={
                          onDateRangeChange
                            ? (e) => {
                                e.stopPropagation();
                                handleEvolutionBucketClick(payload.name);
                              }
                            : undefined
                        }
                      />
                    );
                  }}
                  activeDot={(dotProps: { cx?: number; cy?: number; payload?: { name: string; value: number } }) => {
                    const { cx, cy, payload } = dotProps;
                    if (cx == null || cy == null || !payload) return <g />;
                    const selected = evolutionSelectedBucketKey === payload.name;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={selected ? 12 : 8}
                        fill={LINE_COLOR}
                        stroke='var(--background)'
                        strokeWidth={2}
                        className={onDateRangeChange ? 'cursor-pointer' : undefined}
                        onClick={
                          onDateRangeChange
                            ? (e) => {
                                e.stopPropagation();
                                handleEvolutionBucketClick(payload.name);
                              }
                            : undefined
                        }
                      />
                    );
                  }}
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
                config={{ productBar: { label: 'Hectares', color: 'hsl(var(--chart-2))' } }}
              >
                <BarChart
                  data={productData}
                  layout='vertical'
                  margin={{ left: 8, right: 14, top: 6, bottom: 6 }}
                  barCategoryGap='12%'
                >
                  <CartesianGrid horizontal={false} stroke={CHART_GRID_STROKE} />
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
                            : PRODUCT_BAR_DEFAULT
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
                config={{ farmBar: { label: 'Hectares', color: 'hsl(var(--chart-3))' } }}
              >
                <BarChart
                  data={topFarms}
                  layout='vertical'
                  margin={{ left: 8, right: 14, top: 6, bottom: 6 }}
                  barCategoryGap='12%'
                >
                  <CartesianGrid horizontal={false} stroke={CHART_GRID_STROKE} />
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
                            : FARM_BAR_DEFAULT
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

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Cruzamento operacional por piloto</CardTitle>
          <CardDescription>
            Mostra quem aplicou, quanto aplicou e o rendimento médio por aplicação.
          </CardDescription>
        </CardHeader>
        <CardContent className='pt-1'>
          {byPilotQuery.isPending ? (
            <div className='space-y-2'>
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className='h-10 w-full rounded-md' />
              ))}
            </div>
          ) : byPilotQuery.isError ? (
            <SectionError
              compact
              title='Resumo por piloto indisponível'
              description={
                byPilotQuery.error?.message ||
                'Não foi possível carregar o cruzamento operacional por piloto.'
              }
              onRetry={() => byPilotQuery.refetch()}
            />
          ) : (byPilotQuery.data?.byPilot?.length ?? 0) === 0 ? (
            <ChartEmptyState
              title='Sem dados de pilotos para este recorte.'
              hint='Ajuste os filtros ou amplie o período para visualizar o detalhamento operacional.'
            />
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/40'>
                  <tr>
                    <th className='px-3 py-2 text-left font-medium'>Piloto</th>
                    <th className='px-3 py-2 text-right font-medium'>Total (ha)</th>
                    <th className='px-3 py-2 text-right font-medium'>Aplicações</th>
                    <th className='px-3 py-2 text-right font-medium'>Média por aplicação</th>
                  </tr>
                </thead>
                <tbody>
                  {byPilotQuery.data?.byPilot.map((pilot) => (
                    <tr key={pilot.pilotId ?? pilot.pilotName} className='border-t'>
                      <td className='px-3 py-2'>{pilot.pilotName}</td>
                      <td className='px-3 py-2 text-right tabular-nums'>
                        {pilot.totalAreaHectares.toLocaleString('pt-BR', {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className='px-3 py-2 text-right tabular-nums'>
                        {pilot.applicationsCount.toLocaleString('pt-BR')}
                      </td>
                      <td className='px-3 py-2 text-right tabular-nums'>
                        {pilot.averageAreaPerApplication.toLocaleString('pt-BR', {
                          maximumFractionDigits: 2,
                        })}{' '}
                        ha/aplic.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
  icon: LucideIcon;
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
          <MapIcon className='h-3.5 w-3.5 shrink-0' aria-hidden />
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
        <MapIcon className='h-3.5 w-3.5' />
        <span className='text-xs font-medium'>{label}</span>
      </div>
      <div className='mt-2 text-xl font-semibold leading-none'>{value}</div>
    </div>
  );
}
