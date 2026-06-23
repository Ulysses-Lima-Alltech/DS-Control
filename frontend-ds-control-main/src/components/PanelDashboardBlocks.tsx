'use client';

import { InfiniteData, useQueries } from '@tanstack/react-query';
import { differenceInCalendarDays, endOfMonth, format, isValid, startOfMonth } from 'date-fns';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Map as MapIcon,
  Search,
  Sprout,
  UserCheck,
} from 'lucide-react';
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from 'next-themes';

import DateRangePicker from '@/components/DateRangePicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { useGetAllApplications, useGetApplicationsByPilotStats, useGetDashboardMetrics, useGetStatsApplications } from '@/queries/application.query';
import { useGetAllAssistantsInfinite } from '@/queries/assistant.query';
import { useGetAllCropSeasonsInfinite, useGetCurrentCropSeason } from '@/queries/crop-season.query';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetAllDronesInfinite } from '@/queries/drone.query';
import { useGetAllFarms } from '@/queries/farm.query';
import { useGetAllProductsInfinite } from '@/queries/product.query';
import { useGetAllServiceOrders } from '@/queries/service-order.query';
import { useGetAllUsers } from '@/queries/user.query';
import * as ApplicationService from '@/services/application.service';
import {
  APPLICATION_ISSUE_LABELS,
  ApplicationIssueFilter,
  ApplicationOrderBy,
  ApplicationOrderType,
} from '@/types/applications.type';
import { Assistant } from '@/types/assistant.type';
import { CropSeason } from '@/types/crop-season.type';
import { Drone } from '@/types/drone.type';
import { Product } from '@/types/product.type';
import { ServiceOrderStatus } from '@/types/service-order.type';
import { toOperationalDateYMD, toOperationalDateYMDOrToday } from '@/utils/operational-date';

interface PanelDashboardBlocksProps {
  startDate?: string;
  endDate?: string;
  yesterday: string;
}
type RangeMode = 'total' | 'month' | 'day';
type ComparableDateRange = { startDate?: string; endDate?: string } | undefined;
type PilotLaunchStatus = 'launched' | 'pending';
type PilotLaunchRow = {
  id: string;
  date?: string;
  pilotName: string;
  customerName: string;
  farmName: string;
  hectares: number;
  launchStatus: PilotLaunchStatus;
  serviceOrderNumber: number;
};
type EntityChartDataRow = {
  entityId?: string;
  name: string;
  hectares: number;
};
type ApplicationsNavigationFilters = {
  cropSeasonId?: string;
  cropSeasonIds?: string[];
  startDate?: string;
  endDate?: string;
  customerId?: string;
  farmId?: string;
  pilotId?: string;
  assistantId?: string;
  productId?: string;
  droneId?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  applicationIssue?: ApplicationIssueFilter;
};
type DashboardDateRange = { startDate: string; endDate: string };

function getCropSeasonIdsFromSearchParams(searchParams: URLSearchParams | null): string[] {
  if (!searchParams) return [];
  const repeated = searchParams.getAll('cropSeasonIds').flatMap((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
  const single = searchParams.get('cropSeasonId');
  return Array.from(new Set([...(single ? [single] : []), ...repeated]));
}

const TOP_CARD_STYLES = [
  {
    card: 'border-primary/40 bg-primary shadow-sm shadow-primary/20',
    label: 'text-primary-foreground/75',
    value: 'text-primary-foreground',
    iconWrap: 'border border-primary-foreground/15 bg-primary-foreground/15',
    icon: 'text-primary-foreground',
  },
  {
    card: 'border-border/70 bg-card',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    iconWrap: 'border border-primary/15 bg-primary/10',
    icon: 'text-primary',
  },
  {
    card: 'border-primary/15 bg-primary/5',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    iconWrap: 'border border-primary/15 bg-primary/10',
    icon: 'text-primary',
  },
  {
    card: 'border-accent/50 bg-accent/20',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    iconWrap: 'border border-accent/60 bg-accent/40',
    icon: 'text-primary',
  },
  {
    card: 'border-border/70 bg-card',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    iconWrap: 'border border-secondary/20 bg-secondary/15',
    icon: 'text-primary',
  },
  {
    card: 'border-secondary/20 bg-secondary/10',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    iconWrap: 'border border-secondary/25 bg-secondary/20',
    icon: 'text-primary',
  },
];

const DASHBOARD_BAR_COLORS = [
  'var(--brand-primary)',
  'var(--brand-secondary)',
  'var(--brand-accent)',
  'color-mix(in oklch, var(--brand-primary) 72%, white)',
  'color-mix(in oklch, var(--brand-secondary) 72%, white)',
  'color-mix(in oklch, var(--brand-accent) 72%, var(--brand-primary))',
];
const PILOT_BAR_COLORS = DASHBOARD_BAR_COLORS;
const CUSTOMER_BAR_COLORS = DASHBOARD_BAR_COLORS;
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SERVICE_ORDER_STATUS_OPTIONS: Array<{ value: ServiceOrderStatus; label: string }> = [
  { value: 'open', label: 'Aberto' },
  { value: 'completed', label: 'Concluido' },
  { value: 'cancelled', label: 'Cancelado' },
];
const VALID_SERVICE_ORDER_STATUS = new Set<ServiceOrderStatus>(
  SERVICE_ORDER_STATUS_OPTIONS.map((option) => option.value)
);
const APPLICATION_ISSUE_OPTIONS = (
  Object.entries(APPLICATION_ISSUE_LABELS) as [ApplicationIssueFilter, string][]
).map(([value, label]) => ({
  value,
  label,
}));
const VALID_APPLICATION_ISSUES = new Set<ApplicationIssueFilter>(
  APPLICATION_ISSUE_OPTIONS.map((option) => option.value)
);
const AXIS_TICK_MAX_CHARS = 24;
const PANEL_TOGGLE_INACTIVE_CLASS =
  'text-foreground dark:text-slate-100 hover:bg-muted/70 dark:hover:bg-muted/60';
const PANEL_TOGGLE_ACTIVE_CLASS = 'bg-primary text-primary-foreground hover:bg-primary/90';
const LIGHT_CHART_TEXT_COLOR = '#334155';
const DARK_CHART_TEXT_COLOR = '#e5e7eb';
const LIGHT_CHART_AXIS_COLOR = 'rgba(148, 163, 184, 0.4)';
const DARK_CHART_AXIS_COLOR = 'rgba(148, 163, 184, 0.45)';
const LIGHT_CHART_TOOLTIP_BG = '#ffffff';
const DARK_CHART_TOOLTIP_BG = '#0f172a';
const LIGHT_CHART_TOOLTIP_FG = '#0f172a';
const DARK_CHART_TOOLTIP_FG = '#f8fafc';
const LIGHT_CHART_TOOLTIP_BORDER = 'rgba(148, 163, 184, 0.3)';
const DARK_CHART_TOOLTIP_BORDER = 'rgba(148, 163, 184, 0.35)';
type DynamicXAxisConfig = {
  interval: number | 'preserveStartEnd';
  angle: number;
  textAnchor: 'middle' | 'end';
  height: number;
  tickMargin: number;
  minTickGap: number;
  bottomMargin: number;
  lineChars: number;
};
type WrappedXAxisTickProps = {
  x?: number;
  y?: number;
  payload?: {
    value?: string | number;
  };
};

function areDateRangesEqual(a: ComparableDateRange, b: ComparableDateRange) {
  return a?.startDate === b?.startDate && a?.endDate === b?.endDate;
}

function isValidDateParam(value: string | null | undefined): value is string {
  return Boolean(value && parseDateParam(value));
}

function isCompleteDateRange(
  range: ComparableDateRange
): range is DashboardDateRange {
  return Boolean(range?.startDate && range?.endDate);
}

function getCivilDateRangeDays(range: DashboardDateRange | undefined): number {
  if (!range) return 0;
  const start = parseDateParam(range.startDate);
  const end = parseDateParam(range.endDate);
  if (!start || !end || end < start) return 0;
  return differenceInCalendarDays(end, start) + 1;
}

function getIntersectingCropSeasonIds(
  cropSeasons: CropSeason[],
  range: DashboardDateRange | undefined
): string[] {
  if (!range) return [];
  return cropSeasons
    .filter(
      (cropSeason) =>
        cropSeason.startDate <= range.endDate && cropSeason.endDate >= range.startDate
    )
    .map((cropSeason) => cropSeason.id);
}

function areStringArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function parseDateParam(value: string): Date | undefined {
  if (!DATE_PARAM_REGEX.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  const parsed = new Date(year, month - 1, day);
  if (!isValid(parsed)) return undefined;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }
  return parsed;
}

function formatDateParam(date: Date): string {
  return toOperationalDateYMD(date) ?? format(date, 'yyyy-MM-dd');
}

function formatHectares(value: number | undefined) {
  return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;
}

function formatInteger(value: number | undefined) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function buildTwoLineTickLabel(
  value?: string | number,
  maxCharsPerLine = AXIS_TICK_MAX_CHARS
): [string, string?] {
  const label = String(value ?? '').trim();
  if (!label) return [''];
  if (label.length <= maxCharsPerLine) return [label];

  const firstCut = label.lastIndexOf(' ', maxCharsPerLine);
  const firstBreak = firstCut > Math.floor(maxCharsPerLine * 0.6) ? firstCut : maxCharsPerLine;
  const line1 = label.slice(0, firstBreak).trim();
  const remaining = label.slice(firstBreak).trim();

  if (!remaining) return [line1];
  if (remaining.length <= maxCharsPerLine) return [line1, remaining];

  const secondCut = remaining.lastIndexOf(' ', maxCharsPerLine);
  const secondBreak = secondCut > Math.floor(maxCharsPerLine * 0.6) ? secondCut : maxCharsPerLine;
  const line2Base = remaining.slice(0, secondBreak).trim() || remaining.slice(0, maxCharsPerLine).trim();
  const overflow = remaining.slice(secondBreak).trim();
  if (!overflow) return [line1, line2Base];

  const ellipsed =
    line2Base.length >= maxCharsPerLine - 3
      ? `${line2Base.slice(0, Math.max(maxCharsPerLine - 3, 1)).trimEnd()}...`
      : `${line2Base}...`;

  return [line1, ellipsed];
}

function renderWrappedXAxisTick(props: WrappedXAxisTickProps, lineChars: number, fillColor: string) {
  const x = props.x ?? 0;
  const y = props.y ?? 0;
  const [line1, line2] = buildTwoLineTickLabel(props.payload?.value, lineChars);

  return (
    <text x={x} y={y + 8} fill={fillColor} textAnchor='middle' fontSize={13} fontWeight={500}>
      <tspan x={x} dy='0.71em' fill={fillColor}>
        {line1}
      </tspan>
      {line2 ? (
        <tspan x={x} dy='1.1em' fill={fillColor}>
          {line2}
        </tspan>
      ) : null}
    </text>
  );
}

function getDynamicXAxisConfig(labels: string[]): DynamicXAxisConfig {
  const count = labels.length;
  const maxLabelLength = labels.reduce((max, label) => Math.max(max, String(label || '').trim().length), 0);

  if (count <= 5) {
    return {
      interval: 0,
      angle: 0,
      textAnchor: 'middle',
      height: 80,
      tickMargin: 12,
      minTickGap: 12,
      bottomMargin: 22,
      lineChars: 24,
    };
  }

  const hasManyItems = count >= 8;
  const lineChars = hasManyItems ? 14 : maxLabelLength > 24 ? 18 : 20;

  return {
    interval: 0,
    angle: 0,
    textAnchor: 'middle',
    height: hasManyItems ? 112 : 96,
    tickMargin: hasManyItems ? 18 : 14,
    minTickGap: 0,
    bottomMargin: hasManyItems ? 44 : 32,
    lineChars,
  };
}

function getRangeByMode(
  mode: RangeMode,
  filteredStartDate: string | undefined,
  todayDate: string,
  yesterdayDate: string
) {
  if (mode === 'total') return undefined;
  if (mode === 'month') {
    const referenceDate = parseDateParam(filteredStartDate || todayDate) ?? parseDateParam(todayDate);
    if (!referenceDate) return undefined;
    const monthStart = formatDateParam(startOfMonth(referenceDate));
    const isCurrentMonth =
      referenceDate.getFullYear() === (parseDateParam(todayDate) ?? referenceDate).getFullYear() &&
      referenceDate.getMonth() === (parseDateParam(todayDate) ?? referenceDate).getMonth();
    const monthEnd = isCurrentMonth ? todayDate : formatDateParam(endOfMonth(referenceDate));
    return {
      startDate: monthStart,
      endDate: monthEnd,
    };
  }
  const referenceDay = filteredStartDate || yesterdayDate;
  return {
    startDate: referenceDay,
    endDate: referenceDay,
  };
}

function getCombinedSeasonElapsedDays(
  seasons: Array<{ startDate: string; endDate: string }>,
  todayYmd: string
): number {
  const today = parseDateParam(todayYmd);
  if (!today || seasons.length === 0) return 0;

  const ranges = seasons
    .map((season) => {
      const start = parseDateParam(season.startDate);
      const end = parseDateParam(season.endDate);
      if (!start || !end || today < start) return undefined;
      const effectiveEnd = today <= end ? today : end;
      if (effectiveEnd < start) return undefined;
      return { start, end: effectiveEnd };
    })
    .filter((range): range is { start: Date; end: Date } => Boolean(range))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (ranges.length === 0) return 0;

  const merged: Array<{ start: Date; end: Date }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(range);
      continue;
    }

    const nextDayOfLastEnd = new Date(last.end.getFullYear(), last.end.getMonth(), last.end.getDate() + 1);
    if (range.start <= nextDayOfLastEnd) {
      if (range.end > last.end) {
        last.end = range.end;
      }
      continue;
    }

    merged.push(range);
  }

  return merged.reduce(
    (total, range) => total + Math.max(0, differenceInCalendarDays(range.end, range.start) + 1),
    0
  );
}

function mapLaunchStatusLabel(status: PilotLaunchStatus) {
  if (status === 'launched') return 'Lançado';
  return 'Pendente';
}

function getLaunchStatusBadgeClass(status: PilotLaunchStatus) {
  if (status === 'launched')
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-400/15 dark:text-emerald-200';
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-400/15 dark:text-amber-200';
}

export function PanelDashboardBlocks({ startDate, endDate, yesterday }: PanelDashboardBlocksProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [selectedFarmId, setSelectedFarmId] = useState<string | undefined>(undefined);
  const [selectedPilotId, setSelectedPilotId] = useState<string | undefined>(undefined);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(() => {
    const urlValue = searchParams?.get('productId') || undefined;
    return urlValue || undefined;
  });
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>(() => {
    const urlValue = searchParams?.get('assistantId') || undefined;
    return urlValue || undefined;
  });
  const [selectedDroneId, setSelectedDroneId] = useState<string | undefined>(() => {
    const urlValue = searchParams?.get('droneId') || undefined;
    return urlValue || undefined;
  });
  const [selectedServiceOrderStatus, setSelectedServiceOrderStatus] = useState<
    ServiceOrderStatus | undefined
  >(() => {
    const urlValue = searchParams?.get('serviceOrderStatus');
    if (!urlValue) return undefined;
    if (!VALID_SERVICE_ORDER_STATUS.has(urlValue as ServiceOrderStatus)) return undefined;
    return urlValue as ServiceOrderStatus;
  });
  const [selectedApplicationIssue, setSelectedApplicationIssue] = useState<
    ApplicationIssueFilter | undefined
  >(() => {
    const urlValue = searchParams?.get('applicationIssue');
    if (!urlValue) return undefined;
    if (!VALID_APPLICATION_ISSUES.has(urlValue as ApplicationIssueFilter)) return undefined;
    return urlValue as ApplicationIssueFilter;
  });
  const [selectedCropSeasonIds, setSelectedCropSeasonIds] = useState<string[]>(() =>
    getCropSeasonIdsFromSearchParams(searchParams)
  );
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string } | undefined>(
    () =>
      startDate && endDate
        ? {
            startDate,
            endDate,
          }
        : undefined
  );
  const [hasManualDateRange, setHasManualDateRange] = useState(
    () =>
      isValidDateParam(searchParams?.get('startDate')) &&
      isValidDateParam(searchParams?.get('endDate'))
  );
  const [datePickerResetKey, setDatePickerResetKey] = useState(0);
  const hasProcessedInitialDatePickerChange = useRef(false);
  const [pilotEntityMode, setPilotEntityMode] = useState<'pilots' | 'assistants'>('pilots');
  const [pilotPeriodMode, setPilotPeriodMode] = useState<RangeMode>('total');
  const [customerPeriodMode, setCustomerPeriodMode] = useState<RangeMode>('total');
  const selectedCropSeasonId =
    selectedCropSeasonIds.length === 1 ? selectedCropSeasonIds[0] : undefined;
  const isDarkTheme = resolvedTheme === 'dark';
  const chartTextColor = isDarkTheme ? DARK_CHART_TEXT_COLOR : LIGHT_CHART_TEXT_COLOR;
  const chartAxisColor = isDarkTheme ? DARK_CHART_AXIS_COLOR : LIGHT_CHART_AXIS_COLOR;
  const chartTooltipBg = isDarkTheme ? DARK_CHART_TOOLTIP_BG : LIGHT_CHART_TOOLTIP_BG;
  const chartTooltipFg = isDarkTheme ? DARK_CHART_TOOLTIP_FG : LIGHT_CHART_TOOLTIP_FG;
  const chartTooltipBorder = isDarkTheme
    ? DARK_CHART_TOOLTIP_BORDER
    : LIGHT_CHART_TOOLTIP_BORDER;

  const chartTooltipContentStyle = useMemo<CSSProperties>(
    () => ({
      borderRadius: '0.5rem',
      border: `1px solid ${chartTooltipBorder}`,
      backgroundColor: chartTooltipBg,
      color: chartTooltipFg,
      boxShadow: '0 10px 25px rgba(2, 6, 23, 0.28)',
      padding: '10px 12px',
    }),
    [chartTooltipBg, chartTooltipBorder, chartTooltipFg]
  );
  const chartTooltipLabelStyle = useMemo<CSSProperties>(
    () => ({
      color: chartTooltipFg,
      fontWeight: 600,
      fontSize: '14px',
      marginBottom: '2px',
    }),
    [chartTooltipFg]
  );
  const chartTooltipItemStyle = useMemo<CSSProperties>(
    () => ({
      color: chartTooltipFg,
      fontSize: '13px',
      fontWeight: 500,
    }),
    [chartTooltipFg]
  );

  const todayDate = toOperationalDateYMDOrToday();
  const effectiveStartDate = dateRange?.startDate;
  const effectiveEndDate = dateRange?.endDate;
  const manualDateRange =
    hasManualDateRange && isCompleteDateRange(dateRange) ? dateRange : undefined;
  const pilotChartRange = getRangeByMode(pilotPeriodMode, effectiveStartDate, todayDate, yesterday);
  const customerChartRange = getRangeByMode(customerPeriodMode, effectiveStartDate, todayDate, yesterday);
  const currentMonthStartDate = formatDateParam(
    startOfMonth(parseDateParam(todayDate) ?? new Date())
  );
  const panelBaseFilters = useMemo<ApplicationService.GetStatsApplicationsParams>(
    () => ({
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    productId: selectedProductId,
    assistantId: selectedAssistantId,
    droneId: selectedDroneId,
    serviceOrderStatus: selectedServiceOrderStatus,
    applicationIssue: selectedApplicationIssue,
    cropSeasonId: selectedCropSeasonId,
    cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
    ...(selectedCropSeasonIds.length === 0 && !manualDateRange ? { currentSeason: true } : {}),
    ...(manualDateRange
      ? {
          startDate: manualDateRange.startDate,
          endDate: manualDateRange.endDate,
        }
      : {}),
    }),
    [
      manualDateRange,
      search,
      selectedApplicationIssue,
      selectedAssistantId,
      selectedCropSeasonId,
      selectedCropSeasonIds,
      selectedCustomerId,
      selectedDroneId,
      selectedFarmId,
      selectedPilotId,
      selectedProductId,
      selectedServiceOrderStatus,
    ]
  );
  const buildPanelStatsFilters = useCallback(
    (rangeOverride?: DashboardDateRange): ApplicationService.GetStatsApplicationsParams => ({
      ...panelBaseFilters,
      ...(rangeOverride
        ? {
            currentSeason: undefined,
            startDate: rangeOverride.startDate,
            endDate: rangeOverride.endDate,
          }
        : {}),
    }),
    [panelBaseFilters]
  );
  const cardRangeFilters = buildPanelStatsFilters();
  const currentMonthCardRange = manualDateRange ?? {
    startDate: currentMonthStartDate,
    endDate: todayDate,
  };
  const yesterdayCardRange = manualDateRange ?? {
    startDate: yesterday,
    endDate: yesterday,
  };
  const { data: totalSeasonStats, isPending: isLoadingTotalSeasonStats } =
    useGetStatsApplications(cardRangeFilters);
  const { data: currentMonthStats, isPending: isLoadingCurrentMonthStats } = useGetStatsApplications({
    ...buildPanelStatsFilters(currentMonthCardRange),
  });
  const { data: yesterdayAreaStats, isPending: isLoadingYesterdayAreaStats } = useGetStatsApplications({
    ...buildPanelStatsFilters(yesterdayCardRange),
  });
  const { data: dashboardMetrics, isPending: isLoadingDashboardMetrics } = useGetDashboardMetrics({
    startDate: effectiveStartDate ?? todayDate,
    customerIds: selectedCustomerId ? [selectedCustomerId] : undefined,
    farmIds: selectedFarmId ? [selectedFarmId] : undefined,
    pilotId: selectedPilotId,
    search: search || undefined,
    ...(selectedCropSeasonIds.length === 0 && !manualDateRange ? { currentSeason: true } : {}),
    cropSeasonId: selectedCropSeasonId,
    cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
  }, {
    enabled: selectedCropSeasonIds.length === 0 && !manualDateRange,
  });
  const { data: byPilotStats, isPending: isLoadingByPilotStats } = useGetApplicationsByPilotStats({
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    productId: selectedProductId,
    cropSeasonId: selectedCropSeasonId,
    cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
    serviceOrderStatus: selectedServiceOrderStatus,
    startDate: pilotChartRange?.startDate,
    endDate: pilotChartRange?.endDate,
    limit: 10,
  });
  const { data: byPilotYesterdayStats, isPending: isLoadingByPilotYesterdayStats } =
    useGetAllApplications({
      page: '1',
      limit: '1000',
      search: search || undefined,
      customerId: selectedCustomerId,
      farmId: selectedFarmId,
      pilotId: selectedPilotId,
      productId: selectedProductId,
      cropSeasonId: selectedCropSeasonId,
      cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
      serviceOrderStatus: selectedServiceOrderStatus,
      assistantId: selectedAssistantId,
      droneId: selectedDroneId,
      applicationIssue: selectedApplicationIssue,
      startDate: yesterdayCardRange.startDate,
      endDate: yesterdayCardRange.endDate,
    });

  const { data: customersData, isPending: isLoadingCustomers } = useGetAllCustomers({
    limit: '100',
    search: search || undefined,
  });
  const { data: farmsData, isPending: isLoadingFarms } = useGetAllFarms(selectedCustomerId, {
    limit: '100',
    search: search || undefined,
    includeCustomer: 'true',
  });
  const { data: pilotsData, isPending: isLoadingPilots } = useGetAllUsers({
    type: 'pilot',
    status: 'active',
    limit: '100',
    search: search || undefined,
  });
  const { data: productsData, isPending: isLoadingProducts } = useGetAllProductsInfinite({
    limit: '100',
    status: 'active',
  });
  const { data: assistantsData, isPending: isLoadingAssistants } = useGetAllAssistantsInfinite({
    limit: '100',
    status: 'active',
  });
  const { data: dronesData, isPending: isLoadingDrones } = useGetAllDronesInfinite({
    limit: '100',
    status: 'active',
  });
  const {
    data: cropSeasonsData,
    fetchNextPage: fetchNextPageCropSeasons,
    hasNextPage: hasNextPageCropSeasons,
    isFetchingNextPage: isFetchingNextPageCropSeasons,
    isPending: isLoadingCropSeasons,
  } = useGetAllCropSeasonsInfinite({
    limit: '50',
    status: 'active',
  });
  const { data: currentCropSeasonData, isLoading: isLoadingCurrentCropSeason } = useGetCurrentCropSeason();

  const { data: pilotLaunchesData, isPending: isLoadingPilotLaunches } = useGetAllApplications({
    page: '1',
    limit: '1000',
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    productId: selectedProductId,
    serviceOrderStatus: selectedServiceOrderStatus,
    cropSeasonId: selectedCropSeasonId,
    cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
    assistantId: selectedAssistantId,
    droneId: selectedDroneId,
    applicationIssue: selectedApplicationIssue,
    ...(effectiveStartDate && effectiveEndDate
      ? {
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
        }
      : {}),
    orderBy: ApplicationOrderBy.DATE,
    orderType: ApplicationOrderType.DESC,
  });
  const {
    data: assistantChartApplicationsData,
    isPending: isLoadingAssistantChartApplications,
  } = useGetAllApplications(
    {
      page: '1',
      limit: '5000',
      search: search || undefined,
      customerId: selectedCustomerId,
      farmId: selectedFarmId,
      pilotId: selectedPilotId,
      productId: selectedProductId,
      serviceOrderStatus: selectedServiceOrderStatus,
      cropSeasonId: selectedCropSeasonId,
      cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
      assistantId: selectedAssistantId,
      droneId: selectedDroneId,
      applicationIssue: selectedApplicationIssue,
      ...(pilotChartRange?.startDate && pilotChartRange?.endDate
        ? {
            startDate: pilotChartRange.startDate,
            endDate: pilotChartRange.endDate,
          }
        : {}),
    },
    {
      enabled: pilotEntityMode === 'assistants',
    }
  );

  const { data: openServiceOrdersData, isPending: isLoadingOpenServiceOrders } = useGetAllServiceOrders({
    page: '1',
    limit: '1000',
    search: search || undefined,
    status: 'open',
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    includePlots: 'true',
    includeFarms: 'true',
    includePilots: 'true',
    includeCustomers: 'true',
  });

  const customers = customersData?.data || [];
  const farms = farmsData?.data || [];
  const pilots = pilotsData?.data || [];
  const products =
    (productsData as unknown as InfiniteData<{ data: Product[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];
  const assistants =
    (assistantsData as unknown as InfiniteData<{ data: Assistant[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];
  const drones =
    (dronesData as unknown as InfiniteData<{ data: Drone[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];
  const cropSeasons =
    (cropSeasonsData as unknown as InfiniteData<{ data: CropSeason[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];
  const cropSeasonsWithCurrent = useMemo(() => {
    const seasonsById = new Map(cropSeasons.map((cropSeason) => [cropSeason.id, cropSeason]));
    const currentSeason = currentCropSeasonData?.cropSeason;
    if (currentSeason) {
      seasonsById.set(currentSeason.id, currentSeason);
    }
    return Array.from(seasonsById.values());
  }, [cropSeasons, currentCropSeasonData?.cropSeason]);
  const selectedCropSeasons = useMemo(() => {
    if (selectedCropSeasonIds.length === 0) return [];
    const seasonsById = new Map(
      cropSeasonsWithCurrent.map((cropSeason) => [cropSeason.id, cropSeason])
    );
    return selectedCropSeasonIds
      .map((cropSeasonId) => seasonsById.get(cropSeasonId))
      .filter((cropSeason): cropSeason is CropSeason => Boolean(cropSeason));
  }, [cropSeasonsWithCurrent, selectedCropSeasonIds]);
  const seasonElapsedDays = getCombinedSeasonElapsedDays(selectedCropSeasons, todayDate);
  const manualRangeDays = getCivilDateRangeDays(manualDateRange);
  const elapsedDaysForCards = manualDateRange
    ? manualRangeDays
    : selectedCropSeasonIds.length > 0
      ? seasonElapsedDays
      : dashboardMetrics?.metrics?.daysSinceStart;
  const seasonAverageDailyArea =
    Number(elapsedDaysForCards || 0) > 0
      ? Number(totalSeasonStats?.stats?.totalAreaHectares || 0) / Number(elapsedDaysForCards || 0)
      : 0;
  const openServiceOrders =
    selectedServiceOrderStatus && selectedServiceOrderStatus !== 'open'
      ? []
      : openServiceOrdersData?.data || [];
  const hasFilteredApplicationsMetric = Boolean(
    selectedPilotId ||
      selectedProductId ||
      selectedAssistantId ||
      selectedDroneId ||
      selectedApplicationIssue
  );
  const hasApplicationLevelOsFilters = Boolean(
    selectedProductId || selectedAssistantId || selectedDroneId || selectedApplicationIssue
  );

  const customerAreaQueries = useQueries({
    queries: customers.map((customer) => ({
      queryKey: [
        'panel',
        'customer-hectares',
        customer.id,
        customerPeriodMode,
        customerChartRange?.startDate,
        customerChartRange?.endDate,
        selectedFarmId,
        selectedPilotId,
        selectedProductId,
        selectedCropSeasonId,
        selectedCropSeasonIds.join(','),
        selectedServiceOrderStatus,
        search,
      ],
      queryFn: () => {
        const statsParams: ApplicationService.GetStatsApplicationsParams = {
          search: search || undefined,
          customerId: customer.id,
          farmId: selectedFarmId,
          pilotId: selectedPilotId,
          productId: selectedProductId,
          cropSeasonId: selectedCropSeasonId,
          cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
          serviceOrderStatus: selectedServiceOrderStatus,
          ...(customerChartRange?.startDate && customerChartRange?.endDate
            ? {
                startDate: customerChartRange.startDate,
                endDate: customerChartRange.endDate,
              }
            : {}),
        };
        return ApplicationService.getStatsApplications(statsParams);
      },
      staleTime: 1000 * 60 * 5,
    })),
  });

  const orderYesterdayStatsQueries = useQueries({
    queries: openServiceOrders.map((serviceOrder) => ({
      queryKey: [
        'panel',
        'order-yesterday',
        serviceOrder.id,
        yesterday,
        search,
        selectedProductId,
        selectedPilotId,
        selectedAssistantId,
        selectedDroneId,
        selectedCropSeasonId,
        selectedCropSeasonIds.join(','),
        selectedServiceOrderStatus,
        selectedApplicationIssue,
      ],
      queryFn: () =>
        ApplicationService.getStatsApplications({
          search: search || undefined,
          serviceOrderId: serviceOrder.id,
          pilotId: selectedPilotId,
          productId: selectedProductId,
          cropSeasonId: selectedCropSeasonId,
          cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
          serviceOrderStatus: selectedServiceOrderStatus,
          assistantId: selectedAssistantId,
          droneId: selectedDroneId,
          applicationIssue: selectedApplicationIssue,
          startDate: yesterday,
          endDate: yesterday,
        }),
      staleTime: 1000 * 60 * 3,
    })),
  });

  const orderApplicationsQueries = useQueries({
    queries: openServiceOrders.map((serviceOrder) => ({
      queryKey: [
        'panel',
        'order-applications',
        serviceOrder.id,
        search,
        selectedProductId,
        selectedPilotId,
        selectedAssistantId,
        selectedDroneId,
        selectedCropSeasonId,
        selectedCropSeasonIds.join(','),
        selectedServiceOrderStatus,
        selectedApplicationIssue,
      ],
      queryFn: () =>
        ApplicationService.getAllApplications({
          page: '1',
          limit: '1000',
          search: search || undefined,
          serviceOrderId: serviceOrder.id,
          pilotId: selectedPilotId,
          productId: selectedProductId,
          cropSeasonId: selectedCropSeasonId,
          cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
          assistantId: selectedAssistantId,
          droneId: selectedDroneId,
          serviceOrderStatus: selectedServiceOrderStatus,
          applicationIssue: selectedApplicationIssue,
        }),
      enabled: hasFilteredApplicationsMetric,
      staleTime: 1000 * 60 * 3,
    })),
  });

  const hectaresByCustomerData = useMemo(() => {
    const mapped = customers
      .map((customer, index) => ({
        entityId: customer.id,
        name: customer.name,
        hectares: Number(customerAreaQueries[index]?.data?.stats?.totalAreaHectares || 0),
      }));
    const withData = mapped.filter((item) => item.hectares > 0).sort((a, b) => b.hectares - a.hectares);
    if (withData.length > 0) {
      return withData.slice(0, 6);
    }
    return mapped.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 6);
  }, [customers, customerAreaQueries]);

  const assistantNameById = useMemo(
    () =>
      new Map(
        assistants
          .filter((assistant) => Boolean(assistant.id))
          .map((assistant) => [assistant.id, assistant.name || 'Sem ajudante'])
      ),
    [assistants]
  );
  const assistantChartData = useMemo<EntityChartDataRow[]>(() => {
    const applications = assistantChartApplicationsData?.data || [];
    const groupedByAssistant = new Map<string, EntityChartDataRow>();

    for (const application of applications) {
      const assistantId = application.assistantId || '';
      const assistantName =
        application.assistant?.name ||
        (assistantId ? assistantNameById.get(assistantId) : undefined) ||
        'Sem ajudante';
      const groupKey = assistantId || `missing:${assistantName}`;
      const current = groupedByAssistant.get(groupKey);
      const hectares = Number(application.hectares || 0);
      if (current) {
        current.hectares += hectares;
      } else {
        groupedByAssistant.set(groupKey, {
          entityId: assistantId || undefined,
          name: assistantName,
          hectares,
        });
      }
    }

    const sorted = Array.from(groupedByAssistant.values())
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 10);
    if (sorted.length > 0) return sorted;

    if (pilotPeriodMode === 'day') {
      return assistants
        .filter((assistant) => !selectedAssistantId || assistant.id === selectedAssistantId)
        .map((assistant) => ({
          entityId: assistant.id || undefined,
          name: assistant.name || 'Sem ajudante',
          hectares: 0,
        }))
        .slice(0, 10);
    }

    return [];
  }, [
    assistantChartApplicationsData?.data,
    assistantNameById,
    assistants,
    pilotPeriodMode,
    selectedAssistantId,
  ]);
  const pilotChartData = useMemo<EntityChartDataRow[]>(() => {
    if (pilotEntityMode === 'assistants') {
      return assistantChartData;
    }

    const base = (byPilotStats?.byPilot || []).map((item) => ({
      entityId: item.pilotId || undefined,
      name: item.pilotName || 'Sem piloto',
      hectares: item.totalAreaHectares,
    }));
    if (base.length === 0) {
      return pilots
        .filter((pilot) => !selectedPilotId || pilot.id === selectedPilotId)
        .map((pilot) => ({
          entityId: pilot.id || undefined,
          name: pilot.name || 'Sem piloto',
          hectares: 0,
        }))
        .slice(0, 10);
    }

    return base;
  }, [
    assistantChartData,
    byPilotStats?.byPilot,
    pilotEntityMode,
    pilotPeriodMode,
    pilots,
    selectedPilotId,
  ]);
  const pilotXAxisConfig = useMemo(
    () => getDynamicXAxisConfig(pilotChartData.map((item) => item.name)),
    [pilotChartData]
  );
  const customerXAxisConfig = useMemo(
    () => getDynamicXAxisConfig(hectaresByCustomerData.map((item) => item.name)),
    [hectaresByCustomerData]
  );

  const pilotsActiveYesterdayCount = useMemo(() => {
    const applications = byPilotYesterdayStats?.data || [];
    const uniquePilotIds = new Set(
      applications
        .map((application) => application.pilotId)
        .filter((pilotId): pilotId is string => Boolean(pilotId))
    );
    return uniquePilotIds.size;
  }, [byPilotYesterdayStats?.data]);

  const topCards = [
    {
      title: 'Área total aplicada',
      value: formatHectares(totalSeasonStats?.stats?.totalAreaHectares),
      icon: Sprout,
      isLoading: isLoadingTotalSeasonStats,
    },
    {
      title: 'Este mês',
      value: formatHectares(currentMonthStats?.stats?.totalAreaHectares),
      icon: CalendarClock,
      isLoading: isLoadingCurrentMonthStats,
    },
    {
      title: 'Aplicação de Ontem',
      value: formatHectares(yesterdayAreaStats?.stats?.totalAreaHectares),
      icon: ClipboardList,
      isLoading: isLoadingYesterdayAreaStats,
    },
    {
      title: 'Média Diária Safra',
      value: formatHectares(
        manualDateRange || selectedCropSeasonIds.length > 0
          ? seasonAverageDailyArea
          : dashboardMetrics?.metrics?.averageDailyArea
      ),
      icon: BarChart3,
      isLoading:
        manualDateRange || selectedCropSeasonIds.length > 0
          ? isLoadingTotalSeasonStats
          : isLoadingDashboardMetrics,
    },
    {
      title: 'Dias corridos',
      value: formatInteger(
        manualDateRange || selectedCropSeasonIds.length > 0
          ? elapsedDaysForCards
          : dashboardMetrics?.metrics?.daysSinceStart
      ),
      icon: CalendarClock,
      isLoading:
        manualDateRange || selectedCropSeasonIds.length > 0
          ? manualDateRange
            ? false
            : isLoadingCropSeasons
          : isLoadingDashboardMetrics,
    },
    {
      title: 'Pilotos Ativos Ontem',
      value: formatInteger(pilotsActiveYesterdayCount),
      icon: UserCheck,
      isLoading: isLoadingByPilotYesterdayStats,
    },
  ];

  const removeClearedFlagFromUrl = useCallback(() => {
    if (!searchParams?.has('cleared')) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('cleared');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const syncFilterParamInUrl = useCallback(
    (paramName: string, value: string | undefined) => {
      const nextParams = new URLSearchParams(searchParams?.toString() || '');
      nextParams.delete('cleared');
      if (value) {
        nextParams.set(paramName, value);
      } else {
        nextParams.delete(paramName);
      }
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );
  const syncCropSeasonIdsInUrl = useCallback(
    (cropSeasonIds: string[]) => {
      const nextParams = new URLSearchParams(searchParams?.toString() || '');
      nextParams.delete('cleared');
      nextParams.delete('cropSeasonId');
      nextParams.delete('cropSeasonIds');
      if (cropSeasonIds.length === 1) {
        nextParams.set('cropSeasonId', cropSeasonIds[0]);
      } else if (cropSeasonIds.length > 1) {
        cropSeasonIds.forEach((cropSeasonId) => nextParams.append('cropSeasonIds', cropSeasonId));
      }
      if (manualDateRange) {
        nextParams.set('startDate', manualDateRange.startDate);
        nextParams.set('endDate', manualDateRange.endDate);
      }
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [manualDateRange, pathname, router, searchParams]
  );

  useEffect(() => {
    if (manualDateRange) return;
    if (selectedCropSeasonIds.length > 0 || isLoadingCurrentCropSeason) return;
    const currentId = currentCropSeasonData?.cropSeason?.id;
    if (!currentId) return;
    const nextSelectedIds = [currentId];
    setSelectedCropSeasonIds(nextSelectedIds);
    syncCropSeasonIdsInUrl(nextSelectedIds);
  }, [
    currentCropSeasonData?.cropSeason?.id,
    isLoadingCurrentCropSeason,
    manualDateRange,
    selectedCropSeasonIds.length,
    syncCropSeasonIdsInUrl,
  ]);

  useEffect(() => {
    if (!manualDateRange) return;
    if (isLoadingCropSeasons && cropSeasonsWithCurrent.length === 0) return;

    const nextSelectedIds = getIntersectingCropSeasonIds(cropSeasonsWithCurrent, manualDateRange);
    if (areStringArraysEqual(selectedCropSeasonIds, nextSelectedIds)) return;

    setSelectedCropSeasonIds(nextSelectedIds);
    syncCropSeasonIdsInUrl(nextSelectedIds);
  }, [
    cropSeasonsWithCurrent,
    isLoadingCropSeasons,
    manualDateRange,
    selectedCropSeasonIds,
    syncCropSeasonIdsInUrl,
  ]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCustomerId(undefined);
    setSelectedFarmId(undefined);
    setSelectedPilotId(undefined);
    setSelectedProductId(undefined);
    setSelectedAssistantId(undefined);
    setSelectedDroneId(undefined);
    setSelectedCropSeasonIds([]);
    setSelectedServiceOrderStatus(undefined);
    setSelectedApplicationIssue(undefined);
    setDateRange(undefined);
    setHasManualDateRange(false);
    hasProcessedInitialDatePickerChange.current = false;
    setDatePickerResetKey((prev) => prev + 1);

    const nextParams = new URLSearchParams(searchParams?.toString() || '');
    nextParams.delete('search');
    nextParams.delete('startDate');
    nextParams.delete('endDate');
    nextParams.delete('customerId');
    nextParams.delete('farmId');
    nextParams.delete('pilotId');
    nextParams.delete('productId');
    nextParams.delete('assistantId');
    nextParams.delete('droneId');
    nextParams.delete('cropSeasonId');
    nextParams.delete('cropSeasonIds');
    nextParams.delete('serviceOrderStatus');
    nextParams.delete('applicationIssue');
    nextParams.set('cleared', '1');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };
  const handleDateRangeChange = useCallback(
    (range: { startDate?: string; endDate?: string } | undefined) => {
      const nextRange =
        range?.startDate && range?.endDate
          ? { startDate: range.startDate, endDate: range.endDate }
          : undefined;

      if (!hasProcessedInitialDatePickerChange.current) {
        hasProcessedInitialDatePickerChange.current = true;
        setDateRange((prev) => {
          if (areDateRangesEqual(prev, nextRange)) {
            return prev;
          }
          return nextRange;
        });
        return;
      }

      setHasManualDateRange(Boolean(nextRange));

      setDateRange((prev) => {
        if (areDateRangesEqual(prev, nextRange)) {
          return prev;
        }
        return nextRange;
      });

      const nextParams = new URLSearchParams(searchParams?.toString() || '');
      nextParams.delete('cleared');
      if (nextRange) {
        nextParams.set('startDate', nextRange.startDate);
        nextParams.set('endDate', nextRange.endDate);
      } else {
        nextParams.delete('startDate');
        nextParams.delete('endDate');
      }
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      removeClearedFlagFromUrl();
      setSearch(value);
    },
    [removeClearedFlagFromUrl]
  );

  const handleCustomerChange = useCallback(
    (value: string | undefined) => {
      removeClearedFlagFromUrl();
      setSelectedCustomerId(value);
    },
    [removeClearedFlagFromUrl]
  );

  const handleFarmChange = useCallback(
    (value: string | undefined) => {
      removeClearedFlagFromUrl();
      setSelectedFarmId(value);
    },
    [removeClearedFlagFromUrl]
  );

  const handlePilotChange = useCallback(
    (value: string | undefined) => {
      removeClearedFlagFromUrl();
      setSelectedPilotId(value);
    },
    [removeClearedFlagFromUrl]
  );
  const handleProductChange = useCallback(
    (value: string | undefined) => {
      setSelectedProductId(value);
      syncFilterParamInUrl('productId', value);
    },
    [syncFilterParamInUrl]
  );
  const handleAssistantChange = useCallback(
    (value: string | undefined) => {
      setSelectedAssistantId(value);
      syncFilterParamInUrl('assistantId', value);
    },
    [syncFilterParamInUrl]
  );
  const handleDroneChange = useCallback(
    (value: string | undefined) => {
      setSelectedDroneId(value);
      syncFilterParamInUrl('droneId', value);
    },
    [syncFilterParamInUrl]
  );
  const handleCropSeasonChange = useCallback(
    (value: string[] | undefined) => {
      const nextCropSeasonIds = value ?? [];
      setSelectedCropSeasonIds(nextCropSeasonIds);
      syncCropSeasonIdsInUrl(nextCropSeasonIds);
    },
    [syncCropSeasonIdsInUrl]
  );
  const handleServiceOrderStatusChange = useCallback(
    (value: ServiceOrderStatus | undefined) => {
      setSelectedServiceOrderStatus(value);
      syncFilterParamInUrl('serviceOrderStatus', value);
    },
    [syncFilterParamInUrl]
  );
  const handleApplicationIssueChange = useCallback(
    (value: ApplicationIssueFilter | undefined) => {
      setSelectedApplicationIssue(value);
      syncFilterParamInUrl('applicationIssue', value);
    },
    [syncFilterParamInUrl]
  );
  const selectPilotTotalMode = useCallback(() => {
    setPilotPeriodMode('total');
  }, []);
  const selectPilotMonthMode = useCallback(() => {
    setPilotPeriodMode('month');
  }, []);
  const selectPilotDayMode = useCallback(() => {
    setPilotPeriodMode('day');
  }, []);
  const selectCustomerTotalMode = useCallback(() => {
    setCustomerPeriodMode('total');
  }, []);
  const selectCustomerMonthMode = useCallback(() => {
    setCustomerPeriodMode('month');
  }, []);
  const selectCustomerDayMode = useCallback(() => {
    setCustomerPeriodMode('day');
  }, []);
  const buildApplicationsQueryString = useCallback(
    (
      overrides: Partial<ApplicationsNavigationFilters> = {},
      range?: { startDate?: string; endDate?: string }
    ) => {
      const params = new URLSearchParams();
      const filters: ApplicationsNavigationFilters = {
        cropSeasonId: selectedCropSeasonId,
        cropSeasonIds: selectedCropSeasonIds.length > 0 ? selectedCropSeasonIds : undefined,
        customerId: selectedCustomerId,
        farmId: selectedFarmId,
        pilotId: selectedPilotId,
        assistantId: selectedAssistantId,
        productId: selectedProductId,
        droneId: selectedDroneId,
        serviceOrderStatus: selectedServiceOrderStatus,
        applicationIssue: selectedApplicationIssue,
        ...overrides,
      };

      const append = (key: string, value?: string) => {
        if (!value) return;
        params.set(key, value);
      };

      append('cropSeasonId', filters.cropSeasonId);
      filters.cropSeasonIds?.forEach((cropSeasonId) => params.append('cropSeasonIds', cropSeasonId));
      append('customerId', filters.customerId);
      append('farmId', filters.farmId);
      append('pilotId', filters.pilotId);
      append('assistantId', filters.assistantId);
      append('productId', filters.productId);
      append('droneId', filters.droneId);
      append('serviceOrderStatus', filters.serviceOrderStatus);
      append('applicationIssue', filters.applicationIssue);

      if (range?.startDate && range?.endDate) {
        params.set('startDate', range.startDate);
        params.set('endDate', range.endDate);
      }

      return params.toString();
    },
    [
      selectedApplicationIssue,
      selectedAssistantId,
      selectedCropSeasonId,
      selectedCropSeasonIds,
      selectedCustomerId,
      selectedDroneId,
      selectedFarmId,
      selectedPilotId,
      selectedProductId,
      selectedServiceOrderStatus,
    ]
  );
  const handlePilotChartRowClick = useCallback(
    (row: EntityChartDataRow) => {
      if (!row.entityId) return;
      const range = pilotPeriodMode === 'total' ? undefined : pilotChartRange;
      const overrides =
        pilotEntityMode === 'assistants'
          ? ({ assistantId: row.entityId } as Partial<ApplicationsNavigationFilters>)
          : ({ pilotId: row.entityId } as Partial<ApplicationsNavigationFilters>);
      const query = buildApplicationsQueryString(overrides, range);
      router.push(query ? `/dashboard/applications?${query}` : '/dashboard/applications');
    },
    [buildApplicationsQueryString, pilotChartRange, pilotEntityMode, pilotPeriodMode, router]
  );
  const handleCustomerChartRowClick = useCallback(
    (row: EntityChartDataRow) => {
      if (!row.entityId) return;
      const range = customerPeriodMode === 'total' ? undefined : customerChartRange;
      const query = buildApplicationsQueryString({ customerId: row.entityId }, range);
      router.push(query ? `/dashboard/applications?${query}` : '/dashboard/applications');
    },
    [buildApplicationsQueryString, customerChartRange, customerPeriodMode, router]
  );
  const handleOpenServiceOrderClick = useCallback(
    (serviceOrderId: string) => {
      if (!serviceOrderId) return;
      router.push(`/dashboard/service-orders/${serviceOrderId}`);
    },
    [router]
  );

  const launches = pilotLaunchesData?.data || [];
  const pilotLaunchRows = useMemo<PilotLaunchRow[]>(() => {
    const applicationsByOrderPilot = new Map<string, typeof launches>();
    for (const application of launches) {
      if (!application.serviceOrderId || !application.pilotId) continue;
      const key = `${application.serviceOrderId}:${application.pilotId}`;
      const current = applicationsByOrderPilot.get(key) || [];
      current.push(application);
      applicationsByOrderPilot.set(key, current);
    }

    const rows: PilotLaunchRow[] = [];
    for (const serviceOrder of openServiceOrders) {
      const pilotsFromOrder = serviceOrder.pilots || [];
      const farmsFromOrder = (serviceOrder.farms || [])
        .map((farm) => farm.name)
        .filter((name): name is string => Boolean(name));
      const uniqueFarmNames = Array.from(new Set(farmsFromOrder));
      const farmName = uniqueFarmNames.length > 0 ? uniqueFarmNames.join(', ') : 'N/A';
      const customerName = serviceOrder.customer?.name || 'Cliente não informado';

      for (const pilot of pilotsFromOrder) {
        if (selectedPilotId && pilot.id !== selectedPilotId) continue;
        const key = `${serviceOrder.id}:${pilot.id}`;
        const pilotApplications = applicationsByOrderPilot.get(key) || [];
        const hectares = pilotApplications.reduce(
          (sum, application) => sum + Number(application.hectares || 0),
          0
        );
        const latestDate = pilotApplications
          .map((application) => toOperationalDateYMD(application.date))
          .filter((date): date is string => Boolean(date))
          .sort((a, b) => b.localeCompare(a))[0];

        rows.push({
          id: `${serviceOrder.id}:${pilot.id}`,
          date: latestDate,
          pilotName: pilot.name || 'N/A',
          customerName,
          farmName,
          hectares,
          launchStatus: pilotApplications.length > 0 ? 'launched' : 'pending',
          serviceOrderNumber: serviceOrder.number,
        });
      }
    }

    const normalizedSearch = search.trim().toLowerCase();
    const filteredRows = normalizedSearch
      ? rows.filter((row) => {
          return (
            row.pilotName.toLowerCase().includes(normalizedSearch) ||
            row.customerName.toLowerCase().includes(normalizedSearch) ||
            row.farmName.toLowerCase().includes(normalizedSearch) ||
            String(row.serviceOrderNumber).includes(normalizedSearch)
          );
        })
      : rows;

    return filteredRows.sort((a, b) => {
      if (a.serviceOrderNumber !== b.serviceOrderNumber) {
        return a.serviceOrderNumber - b.serviceOrderNumber;
      }
      return a.pilotName.localeCompare(b.pilotName, 'pt-BR');
    });
  }, [launches, openServiceOrders, search, selectedPilotId]);
  const isLoadingAnyCustomerArea =
    isLoadingCustomers || customerAreaQueries.some((query) => query.isPending);
  const isLoadingPilotLaunchRows = isLoadingPilotLaunches || isLoadingOpenServiceOrders;
  const isLoadingPilotChart =
    pilotEntityMode === 'assistants' ? isLoadingAssistantChartApplications : isLoadingByPilotStats;
  const launchedPilotsCount = pilotLaunchRows.filter((row) => row.launchStatus === 'launched').length;
  const pendingPilotsCount = pilotLaunchRows.filter((row) => row.launchStatus === 'pending').length;
  const isLoadingAnyOrderStats =
    isLoadingOpenServiceOrders ||
    orderYesterdayStatsQueries.some((query) => query.isPending) ||
    (hasFilteredApplicationsMetric && orderApplicationsQueries.some((query) => query.isPending));
  const visibleOpenServiceOrders = useMemo(
    () =>
      openServiceOrders
        .map((serviceOrder, index) => ({
          serviceOrder,
          queryIndex: index,
        }))
        .filter(({ queryIndex }) => {
          if (!hasApplicationLevelOsFilters) return true;
          const applications = orderApplicationsQueries[queryIndex]?.data?.data || [];
          return applications.length > 0;
        }),
    [hasApplicationLevelOsFilters, openServiceOrders, orderApplicationsQueries]
  );

  return (
    <div className='space-y-5'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6'>
        {topCards.map((card, index) => {
          const Icon = card.icon;
          const style = TOP_CARD_STYLES[index];
          return (
            <Card key={card.title} className={`${style.card} min-h-[96px]`}>
              <CardContent className='p-3 sm:p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='space-y-1 min-w-0'>
                    <p className={`text-[13px] leading-tight ${style.label}`}>
                      {card.title}
                    </p>
                    <p className={`text-xl sm:text-[22px] leading-tight font-semibold truncate ${style.value}`}>
                      {card.isLoading ? 'Carregando...' : card.value}
                    </p>
                  </div>
                  <div className={`rounded-md p-1.5 ${style.iconWrap}`}>
                    <Icon className={`h-3.5 w-3.5 ${style.icon}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className='border-border/70'>
        <CardContent className='p-4'>
          <div className='flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'>
            <div className='space-y-2'>
              <div className='flex flex-wrap items-center justify-start gap-2'>
              <div className='relative w-[200px] min-w-0'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder='Busca'
                  className='w-full pl-9'
                />
              </div>
              <div className='w-[180px] min-w-0 max-w-[180px] overflow-hidden'>
                <DateRangePicker
                  key={datePickerResetKey}
                  className='w-full min-w-0'
                  initialValue={
                    effectiveStartDate && effectiveEndDate
                      ? { startDate: effectiveStartDate, endDate: effectiveEndDate }
                      : undefined
                  }
                  onChange={handleDateRangeChange}
                  placeholder='Periodo'
                />
              </div>
              <SearchableSelectQuery
                options={cropSeasons.map((cropSeason) => ({
                  value: cropSeason.id,
                  label: cropSeason.name,
                }))}
                value={selectedCropSeasonIds}
                onValueChange={(value) => handleCropSeasonChange(value as string[] | undefined)}
                placeholder='Safra'
                searchPlaceholder='Buscar safra...'
                className='w-[140px] min-w-0'
                clearable={false}
                isMultipleSelections
                showCheckbox
                isLoading={isLoadingCropSeasons || isLoadingCurrentCropSeason}
                onScrollEnd={fetchNextPageCropSeasons}
                hasNextPage={hasNextPageCropSeasons}
                isFetchingNextPage={isFetchingNextPageCropSeasons}
              />
              <SearchableSelectQuery
                options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
                value={selectedCustomerId}
                onValueChange={(value) => handleCustomerChange(value as string | undefined)}
                placeholder='Cliente'
                searchPlaceholder='Buscar cliente...'
                className='w-[140px] min-w-0'
                clearable
                isLoading={isLoadingCustomers}
              />
              <SearchableSelectQuery
                options={farms.map((farm) => ({ value: farm.id, label: farm.name }))}
                value={selectedFarmId}
                onValueChange={(value) => handleFarmChange(value as string | undefined)}
                placeholder='Fazenda'
                searchPlaceholder='Buscar fazenda...'
                className='w-[140px] min-w-0'
                clearable
                isLoading={isLoadingFarms}
              />
              <SearchableSelectQuery
                options={pilots.map((pilot) => ({ value: pilot.id, label: pilot.name }))}
                value={selectedPilotId}
                onValueChange={(value) => handlePilotChange(value as string | undefined)}
                placeholder='Piloto'
                searchPlaceholder='Buscar piloto...'
                className='w-[140px] min-w-0'
                clearable
                isLoading={isLoadingPilots}
              />
              <SearchableSelectQuery
                options={products.map((product) => ({ value: product.id, label: product.name }))}
                value={selectedProductId}
                onValueChange={(value) => handleProductChange(value as string | undefined)}
                placeholder='Produto'
                searchPlaceholder='Buscar produto...'
                className='w-[140px] min-w-0'
                clearable
                isLoading={isLoadingProducts}
              />
              </div>

              <div className='flex flex-wrap items-center justify-start gap-2'>
                <SearchableSelectQuery
                  options={assistants.map((assistant) => ({ value: assistant.id, label: assistant.name }))}
                  value={selectedAssistantId}
                  onValueChange={(value) => handleAssistantChange(value as string | undefined)}
                  placeholder='Ajudante'
                  searchPlaceholder='Buscar ajudante...'
                  className='w-[140px] min-w-0'
                  clearable
                  isLoading={isLoadingAssistants}
                />
                <SearchableSelectQuery
                  options={SERVICE_ORDER_STATUS_OPTIONS}
                  value={selectedServiceOrderStatus}
                  onValueChange={(value) =>
                    handleServiceOrderStatusChange(value as ServiceOrderStatus | undefined)
                  }
                  placeholder='Status da OS'
                  searchPlaceholder='Buscar status...'
                  className='w-[140px] min-w-0'
                  clearable
                />
                <SearchableSelectQuery
                  options={APPLICATION_ISSUE_OPTIONS}
                  value={selectedApplicationIssue}
                  onValueChange={(value) =>
                    handleApplicationIssueChange(value as ApplicationIssueFilter | undefined)
                  }
                  placeholder='Tipo de aplicacao'
                  searchPlaceholder='Buscar tipo...'
                  className='w-[160px] min-w-0'
                  clearable
                />
                <SearchableSelectQuery
                  options={drones.map((drone) => ({ value: drone.id, label: drone.name }))}
                  value={selectedDroneId}
                  onValueChange={(value) => handleDroneChange(value as string | undefined)}
                  placeholder='Drone'
                  searchPlaceholder='Buscar drone...'
                  className='w-[140px] min-w-0'
                  clearable
                  isLoading={isLoadingDrones}
                />
              </div>
            </div>
            <div className='shrink-0 xl:ml-auto'>
              <Button
                type='button'
                variant='outline'
                onClick={clearFilters}
                className='border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className='border-border/70'>
        <CardHeader className='pb-2'>
          <CardTitle>Lançamentos dos Pilotos</CardTitle>
          {!isLoadingPilotLaunchRows && pilotLaunchRows.length > 0 ? (
            <CardDescription>
              {`Lançado: ${formatInteger(launchedPilotsCount)} · Pendente: ${formatInteger(pendingPilotsCount)}`}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoadingPilotLaunchRows ? (
            <p className='text-sm text-muted-foreground'>Carregando lançamentos...</p>
          ) : pilotLaunchRows.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Nenhum lançamento encontrado para o período.</p>
          ) : (
            <div className='rounded-md border divide-y'>
              {pilotLaunchRows.map((launch) => (
                <div key={launch.id} className='flex items-center justify-between gap-3 px-3 py-2.5'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>{launch.customerName}</p>
                    <p className='truncate text-sm text-muted-foreground'>{launch.pilotName}</p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-muted-foreground'>{`OS #${launch.serviceOrderNumber}`}</span>
                    <Badge variant='outline' className={getLaunchStatusBadgeClass(launch.launchStatus)}>
                      {mapLaunchStatusLabel(launch.launchStatus)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className='border-border/70'>
        <CardHeader className='pb-3'>
          <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
            <CardTitle>Hectares por Piloto/Ajudante</CardTitle>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='flex gap-1 rounded-md border border-border/70 p-1'>
                <Button
                  type='button'
                  size='sm'
                    variant={pilotPeriodMode === 'total' ? 'default' : 'ghost'}
                    className={
                      pilotPeriodMode === 'total' ? PANEL_TOGGLE_ACTIVE_CLASS : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={selectPilotTotalMode}
                  disabled={selectedCropSeasonIds.length === 0}
                >
                  Total Geral
                </Button>
                <Button
                  type='button'
                  size='sm'
                    variant={pilotEntityMode === 'pilots' ? 'default' : 'ghost'}
                    className={
                      pilotEntityMode === 'pilots' ? PANEL_TOGGLE_ACTIVE_CLASS : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={() => setPilotEntityMode('pilots')}
                >
                  Pilotos
                </Button>
                <Button
                  type='button'
                  size='sm'
                    variant={pilotEntityMode === 'assistants' ? 'default' : 'ghost'}
                    className={
                      pilotEntityMode === 'assistants' ? PANEL_TOGGLE_ACTIVE_CLASS : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={() => setPilotEntityMode('assistants')}
                >
                  Ajudantes
                </Button>
              </div>
              <div className='flex gap-1 rounded-md border border-border/70 p-1'>
                <Button
                  type='button'
                  size='sm'
                    variant={pilotPeriodMode === 'month' ? 'default' : 'ghost'}
                    className={
                      pilotPeriodMode === 'month' ? PANEL_TOGGLE_ACTIVE_CLASS : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={selectPilotMonthMode}
                >
                  Mês
                </Button>
                <Button
                  type='button'
                  size='sm'
                    variant={pilotPeriodMode === 'day' ? 'default' : 'ghost'}
                    className={
                      pilotPeriodMode === 'day' ? PANEL_TOGGLE_ACTIVE_CLASS : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={selectPilotDayMode}
                >
                  Dia
                </Button>
              </div>
            </div>
          </div>
          {pilotEntityMode === 'assistants' ? (
            <CardDescription>
              Agrupamento por Ajudante com filtros operacionais do painel.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className='h-[320px] pt-0'>
          {isLoadingPilotChart ? (
            <p className='text-sm text-muted-foreground'>Carregando gráfico...</p>
          ) : pilotChartData.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Sem dados para exibir.</p>
          ) : (
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={pilotChartData}
                margin={{
                  top: 8,
                  right: 8,
                  left: -10,
                  bottom: pilotXAxisConfig.bottomMargin,
                }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke={chartAxisColor} />
                <XAxis
                  dataKey='name'
                  tick={(props) => renderWrappedXAxisTick(props, pilotXAxisConfig.lineChars, chartTextColor)}
                  axisLine={{ stroke: chartAxisColor }}
                  tickLine={{ stroke: chartAxisColor }}
                  interval={pilotXAxisConfig.interval}
                  angle={pilotXAxisConfig.angle}
                  textAnchor={pilotXAxisConfig.textAnchor}
                  height={pilotXAxisConfig.height}
                  tickMargin={pilotXAxisConfig.tickMargin}
                  minTickGap={pilotXAxisConfig.minTickGap}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chartTextColor }}
                  axisLine={{ stroke: chartAxisColor }}
                  tickLine={{ stroke: chartAxisColor }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(100, 116, 139, 0.12)' }}
                  formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} ha`, 'Hectares']}
                  labelFormatter={(label) => String(label || '')}
                  contentStyle={chartTooltipContentStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Bar dataKey='hectares' radius={[4, 4, 0, 0]}>
                  {pilotChartData.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        onClick={entry.entityId ? () => handlePilotChartRowClick(entry) : undefined}
                        style={{ cursor: entry.entityId ? 'pointer' : 'default' }}
                        fill={PILOT_BAR_COLORS[index % PILOT_BAR_COLORS.length]}
                      />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className='border-border/70'>
        <CardHeader className='pb-3'>
          <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
            <CardTitle>Hectares por Cliente</CardTitle>
            <div className='flex gap-1 rounded-md border border-border/70 p-1'>
              <Button
                type='button'
                size='sm'
                variant={customerPeriodMode === 'total' ? 'default' : 'ghost'}
                className={
                  customerPeriodMode === 'total'
                    ? PANEL_TOGGLE_ACTIVE_CLASS
                    : PANEL_TOGGLE_INACTIVE_CLASS
                }
                onClick={selectCustomerTotalMode}
                disabled={selectedCropSeasonIds.length === 0}
              >
                Total Geral
              </Button>
              <Button
                type='button'
                size='sm'
                variant={customerPeriodMode === 'month' ? 'default' : 'ghost'}
                className={
                  customerPeriodMode === 'month'
                    ? PANEL_TOGGLE_ACTIVE_CLASS
                    : PANEL_TOGGLE_INACTIVE_CLASS
                }
                onClick={selectCustomerMonthMode}
              >
                Mês
              </Button>
              <Button
                type='button'
                size='sm'
                variant={customerPeriodMode === 'day' ? 'default' : 'ghost'}
                className={
                  customerPeriodMode === 'day'
                    ? PANEL_TOGGLE_ACTIVE_CLASS
                    : PANEL_TOGGLE_INACTIVE_CLASS
                }
                onClick={selectCustomerDayMode}
              >
                Dia
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className='h-[320px] pt-0'>
          {isLoadingAnyCustomerArea ? (
            <p className='text-sm text-muted-foreground'>Carregando gráfico...</p>
          ) : hectaresByCustomerData.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Sem dados para exibir.</p>
          ) : (
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={hectaresByCustomerData}
                margin={{
                  top: 8,
                  right: 8,
                  left: -10,
                  bottom: customerXAxisConfig.bottomMargin,
                }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke={chartAxisColor} />
                <XAxis
                  dataKey='name'
                  tick={(props) =>
                    renderWrappedXAxisTick(props, customerXAxisConfig.lineChars, chartTextColor)
                  }
                  axisLine={{ stroke: chartAxisColor }}
                  tickLine={{ stroke: chartAxisColor }}
                  interval={customerXAxisConfig.interval}
                  angle={customerXAxisConfig.angle}
                  textAnchor={customerXAxisConfig.textAnchor}
                  height={customerXAxisConfig.height}
                  tickMargin={customerXAxisConfig.tickMargin}
                  minTickGap={customerXAxisConfig.minTickGap}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chartTextColor }}
                  axisLine={{ stroke: chartAxisColor }}
                  tickLine={{ stroke: chartAxisColor }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(100, 116, 139, 0.12)' }}
                  formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} ha`, 'Hectares']}
                  labelFormatter={(label) => String(label || '')}
                  contentStyle={chartTooltipContentStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Bar dataKey='hectares' radius={[4, 4, 0, 0]}>
                  {hectaresByCustomerData.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        onClick={entry.entityId ? () => handleCustomerChartRowClick(entry) : undefined}
                        style={{ cursor: entry.entityId ? 'pointer' : 'default' }}
                        fill={CUSTOMER_BAR_COLORS[index % CUSTOMER_BAR_COLORS.length]}
                      />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className='border-border/70'>
        <CardHeader className='pb-2'>
          <CardTitle>Ordens de Serviços em aberto</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingAnyOrderStats ? (
            <p className='text-sm text-muted-foreground'>Carregando ordens de serviço...</p>
          ) : visibleOpenServiceOrders.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Nenhuma OS em aberto encontrada para o recorte.</p>
          ) : (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {visibleOpenServiceOrders.map(({ serviceOrder, queryIndex }) => {
                const yesterdayStats = orderYesterdayStatsQueries[queryIndex]?.data?.stats;
                const serviceOrderApplications = orderApplicationsQueries[queryIndex]?.data?.data || [];
                const totalPlots = Number(serviceOrder.totalPlots ?? serviceOrder.plots?.length ?? 0);
                const totalHectaresAllPlots = Number(serviceOrder.plannedHectares || 0);
                const totalHectaresApplied = Number(serviceOrder.totalAppliedHectares || 0);
                const filteredHectaresApplied = serviceOrderApplications.reduce(
                  (sum, application) => sum + Number.parseFloat(application.hectares || '0'),
                  0
                );
                const plotsWithApplications = Number(serviceOrder.plotsWithApplications || 0);
                const rawProgress = Number(serviceOrder.progressPercent || 0);
                const progressValue = Math.min(rawProgress, 100);
                const customerName = serviceOrder.customer?.name || 'Cliente não informado';
                const farmsFromOrder = (serviceOrder.farms || [])
                  .map((farm) => farm.name)
                  .filter((name): name is string => Boolean(name));
                const farmDetails =
                  farmsFromOrder.length > 0
                    ? Array.from(new Set(farmsFromOrder)).join(', ')
                    : 'Fazenda não informada';
                const serviceOrderObservation = serviceOrder.observation?.trim();
                return (
                  <Card
                    key={serviceOrder.id}
                    className='cursor-pointer border border-border/70 bg-card shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-muted/20'
                    onClick={() => handleOpenServiceOrderClick(serviceOrder.id)}
                    role='button'
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleOpenServiceOrderClick(serviceOrder.id);
                      }
                    }}
                  >
                    <CardContent className='space-y-4 p-5'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='truncate text-[15px] font-medium'>{customerName}</p>
                          <p className='truncate text-xs text-muted-foreground'>{farmDetails}</p>
                          {serviceOrderObservation ? (
                            <p className='truncate text-xs text-muted-foreground'>
                              {serviceOrderObservation}
                            </p>
                          ) : null}
                        </div>
                        <Badge className='border border-primary/30 bg-primary/10 text-primary hover:bg-primary/10'>
                          OS #{serviceOrder.number}
                        </Badge>
                      </div>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between text-sm'>
                          <span>Progresso real da OS</span>
                          <span className='font-medium text-foreground'>
                            {formatHectares(totalHectaresApplied)} / {formatHectares(totalHectaresAllPlots)}
                          </span>
                        </div>
                        <Progress
                          value={progressValue}
                          className='h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-primary'
                        />
                        <p className='text-xs text-muted-foreground'>{rawProgress.toFixed(1)}% concluído</p>
                        {hasFilteredApplicationsMetric ? (
                          <p className='text-xs text-muted-foreground'>
                            Aplicado no recorte filtrado: {formatHectares(filteredHectaresApplied)}
                          </p>
                        ) : null}
                      </div>
                      <div className='grid grid-cols-2 gap-4 border-t border-border/70 pt-4 text-sm'>
                        <div>
                          <p className='text-muted-foreground'>Aplicação ontem</p>
                          <p className='font-semibold text-primary'>
                            {formatHectares(yesterdayStats?.totalAreaHectares)}
                          </p>
                        </div>
                        <div>
                          <p className='text-muted-foreground'>Mapas</p>
                          <p className='font-semibold flex items-center gap-1 text-primary'>
                            <MapIcon className='h-4 w-4 text-primary' />
                            {`${formatInteger(plotsWithApplications)} concluidos / ${formatInteger(totalPlots)} total`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

