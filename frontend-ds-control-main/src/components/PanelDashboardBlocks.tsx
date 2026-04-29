'use client';

import { InfiniteData, useQueries } from '@tanstack/react-query';
import { format, isValid, startOfMonth } from 'date-fns';
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
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
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
  name: string;
  hectares: number;
};

const TOP_CARD_STYLES = [
  {
    card: 'border-t-4 border-t-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: 'text-emerald-600 dark:text-emerald-300',
  },
  {
    card: 'border-t-4 border-t-amber-500 bg-amber-50/40 dark:bg-amber-950/20',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/40',
    icon: 'text-amber-600 dark:text-amber-300',
  },
  {
    card: 'border-t-4 border-t-orange-500 bg-orange-50/40 dark:bg-orange-950/20',
    iconWrap: 'bg-orange-100 dark:bg-orange-900/40',
    icon: 'text-orange-600 dark:text-orange-300',
  },
  {
    card: 'border-t-4 border-t-violet-500 bg-violet-50/40 dark:bg-violet-950/20',
    iconWrap: 'bg-violet-100 dark:bg-violet-900/40',
    icon: 'text-violet-600 dark:text-violet-300',
  },
  {
    card: 'border-t-4 border-t-sky-500 bg-sky-50/40 dark:bg-sky-950/20',
    iconWrap: 'bg-sky-100 dark:bg-sky-900/40',
    icon: 'text-sky-600 dark:text-sky-300',
  },
  {
    card: 'border-t-4 border-t-fuchsia-500 bg-fuchsia-50/40 dark:bg-fuchsia-950/20',
    iconWrap: 'bg-fuchsia-100 dark:bg-fuchsia-900/40',
    icon: 'text-fuchsia-600 dark:text-fuchsia-300',
  },
];

const PILOT_NEON_RETRO_BAR_COLORS = [
  '#00E5FF',
  '#FF4FD8',
  '#FFD400',
  '#7C4DFF',
  '#A3FF12',
  '#FF8A00',
  '#00F5A0',
  '#FF5C8A',
];
const CUSTOMER_NEON_RETRO_BAR_COLORS = [
  '#7C4DFF',
  '#FF8A00',
  '#00E5FF',
  '#FF4FD8',
  '#00F5A0',
  '#FFD400',
  '#A3FF12',
  '#FF5C8A',
];
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

function getRangeByMode(mode: RangeMode, filteredStartDate: string, filteredEndDate: string) {
  if (mode === 'total') return undefined;
  if (mode === 'month') {
    const end = parseDateParam(filteredEndDate);
    if (!end) {
      return { startDate: filteredStartDate, endDate: filteredEndDate };
    }
    return {
      startDate: formatDateParam(startOfMonth(end)),
      endDate: filteredEndDate,
    };
  }
  if (filteredStartDate === filteredEndDate) {
    return {
      startDate: filteredEndDate,
      endDate: filteredEndDate,
    };
  }
  return {
    startDate: filteredEndDate,
    endDate: filteredEndDate,
  };
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
  const [selectedCropSeasonId, setSelectedCropSeasonId] = useState<string | undefined>(() => {
    const urlValue = searchParams?.get('cropSeasonId') || undefined;
    return urlValue || undefined;
  });
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string } | undefined>(
    () =>
      startDate && endDate
        ? {
            startDate,
            endDate,
          }
        : undefined
  );
  const [datePickerResetKey, setDatePickerResetKey] = useState(0);
  const [pilotEntityMode, setPilotEntityMode] = useState<'pilots' | 'assistants'>('pilots');
  const [pilotPeriodMode, setPilotPeriodMode] = useState<RangeMode>('total');
  const [customerPeriodMode, setCustomerPeriodMode] = useState<RangeMode>('total');
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
  const hasDateFilter = Boolean(effectiveStartDate && effectiveEndDate);
  const hasAnyPanelFilter = Boolean(
    search.trim() ||
      hasDateFilter ||
      selectedCustomerId ||
      selectedFarmId ||
      selectedPilotId ||
      selectedProductId ||
      selectedAssistantId ||
      selectedDroneId ||
      selectedCropSeasonId ||
      selectedServiceOrderStatus ||
      selectedApplicationIssue
  );
  const shouldApplyChartDateFilter = hasAnyPanelFilter && hasDateFilter;
  const pilotChartRange =
    shouldApplyChartDateFilter && effectiveStartDate && effectiveEndDate
      ? getRangeByMode(pilotPeriodMode, effectiveStartDate, effectiveEndDate)
      : undefined;
  const customerChartRange =
    shouldApplyChartDateFilter && effectiveStartDate && effectiveEndDate
      ? getRangeByMode(customerPeriodMode, effectiveStartDate, effectiveEndDate)
      : undefined;
  const currentMonthStartDate = formatDateParam(
    startOfMonth(parseDateParam(todayDate) ?? new Date())
  );
  const kpiBaseFilters = {
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    cropSeasonId: selectedCropSeasonId,
  };
  const { data: totalSeasonStats, isPending: isLoadingTotalSeasonStats } =
    useGetStatsApplications({
      ...kpiBaseFilters,
      ...(selectedCropSeasonId ? {} : { currentSeason: true }),
    });
  const { data: currentMonthStats, isPending: isLoadingCurrentMonthStats } = useGetStatsApplications({
    ...kpiBaseFilters,
    startDate: currentMonthStartDate,
    endDate: todayDate,
  });
  const { data: yesterdayAreaStats, isPending: isLoadingYesterdayAreaStats } = useGetStatsApplications({
    ...kpiBaseFilters,
    startDate: yesterday,
    endDate: yesterday,
  });
  const { data: dashboardMetrics, isPending: isLoadingDashboardMetrics } = useGetDashboardMetrics({
    startDate: effectiveStartDate ?? todayDate,
    customerIds: selectedCustomerId ? [selectedCustomerId] : undefined,
    farmIds: selectedFarmId ? [selectedFarmId] : undefined,
    pilotId: selectedPilotId,
    search: search || undefined,
    ...(selectedCropSeasonId ? {} : { currentSeason: true }),
    cropSeasonId: selectedCropSeasonId,
  });
  const { data: byPilotStats, isPending: isLoadingByPilotStats } = useGetApplicationsByPilotStats({
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    productId: selectedProductId,
    cropSeasonId: selectedCropSeasonId,
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
      serviceOrderStatus: selectedServiceOrderStatus,
      assistantId: selectedAssistantId,
      droneId: selectedDroneId,
      applicationIssue: selectedApplicationIssue,
      startDate: yesterday,
      endDate: yesterday,
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
  const openServiceOrders =
    selectedServiceOrderStatus && selectedServiceOrderStatus !== 'open'
      ? []
      : openServiceOrdersData?.data || [];

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
          assistantId: selectedAssistantId,
          droneId: selectedDroneId,
          serviceOrderStatus: selectedServiceOrderStatus,
          applicationIssue: selectedApplicationIssue,
        }),
      staleTime: 1000 * 60 * 3,
    })),
  });

  const hectaresByCustomerData = useMemo(() => {
    const mapped = customers
      .map((customer, index) => ({
        name: customer.name,
        hectares: Number(customerAreaQueries[index]?.data?.stats?.totalAreaHectares || 0),
      }));
    const withData = mapped.filter((item) => item.hectares > 0).sort((a, b) => b.hectares - a.hectares);
    if (withData.length > 0) {
      return withData.slice(0, 6);
    }
    if (customerPeriodMode === 'day') {
      return mapped.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 6);
    }
    return [];
  }, [customers, customerAreaQueries, customerPeriodMode]);

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
      name: item.pilotName || 'Sem piloto',
      hectares: item.totalAreaHectares,
    }));
    if (base.length === 0 && pilotPeriodMode === 'day') {
      return pilots
        .filter((pilot) => !selectedPilotId || pilot.id === selectedPilotId)
        .map((pilot) => ({
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
      value: formatHectares(dashboardMetrics?.metrics?.averageDailyArea),
      icon: BarChart3,
      isLoading: isLoadingDashboardMetrics,
    },
    {
      title: 'Dias corridos',
      value: formatInteger(dashboardMetrics?.metrics?.daysSinceStart),
      icon: CalendarClock,
      isLoading: isLoadingDashboardMetrics,
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

  useEffect(() => {
    if (selectedCropSeasonId || isLoadingCurrentCropSeason) return;
    const currentId = currentCropSeasonData?.cropSeason?.id;
    if (!currentId) return;
    setSelectedCropSeasonId(currentId);
    syncFilterParamInUrl('cropSeasonId', currentId);
  }, [
    currentCropSeasonData?.cropSeason?.id,
    isLoadingCurrentCropSeason,
    selectedCropSeasonId,
    syncFilterParamInUrl,
  ]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCustomerId(undefined);
    setSelectedFarmId(undefined);
    setSelectedPilotId(undefined);
    setSelectedProductId(undefined);
    setSelectedAssistantId(undefined);
    setSelectedDroneId(undefined);
    setSelectedCropSeasonId(undefined);
    setSelectedServiceOrderStatus(undefined);
    setSelectedApplicationIssue(undefined);
    setDateRange(undefined);
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
    nextParams.delete('serviceOrderStatus');
    nextParams.delete('applicationIssue');
    nextParams.set('cleared', '1');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };
  const handleDateRangeChange = useCallback(
    (range: { startDate?: string; endDate?: string } | undefined) => {
      if (range?.startDate && range?.endDate) {
        removeClearedFlagFromUrl();
      }

      const nextRange =
        range?.startDate && range?.endDate
          ? { startDate: range.startDate, endDate: range.endDate }
          : undefined;

      setDateRange((prev) => {
        if (areDateRangesEqual(prev, nextRange)) {
          return prev;
        }
        return nextRange;
      });
    },
    [removeClearedFlagFromUrl]
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
    (value: string | undefined) => {
      setSelectedCropSeasonId(value);
      syncFilterParamInUrl('cropSeasonId', value);
    },
    [syncFilterParamInUrl]
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
    orderApplicationsQueries.some((query) => query.isPending);
  const hasApplicationLevelOsFilters = Boolean(
    selectedProductId || selectedAssistantId || selectedDroneId || selectedApplicationIssue
  );
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
                    <p className='text-[13px] leading-tight text-muted-foreground dark:text-slate-300'>
                      {card.title}
                    </p>
                    <p className='text-xl sm:text-[22px] leading-tight font-semibold truncate text-foreground dark:text-slate-50'>
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
          <div className='grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder='Busca'
                className='pl-9'
              />
            </div>
            <DateRangePicker
              key={datePickerResetKey}
              initialValue={
                effectiveStartDate && effectiveEndDate
                  ? { startDate: effectiveStartDate, endDate: effectiveEndDate }
                  : undefined
              }
              onChange={handleDateRangeChange}
              placeholder='Período'
            />
            <SearchableSelectQuery
              options={cropSeasons.map((cropSeason) => ({
                value: cropSeason.id,
                label: cropSeason.name,
              }))}
              value={selectedCropSeasonId}
              onValueChange={(value) => handleCropSeasonChange(value as string | undefined)}
              placeholder='Safra'
              searchPlaceholder='Buscar safra...'
              clearable
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
              clearable
              isLoading={isLoadingCustomers}
            />
            <SearchableSelectQuery
              options={farms.map((farm) => ({ value: farm.id, label: farm.name }))}
              value={selectedFarmId}
              onValueChange={(value) => handleFarmChange(value as string | undefined)}
              placeholder='Fazenda'
              searchPlaceholder='Buscar fazenda...'
              clearable
              isLoading={isLoadingFarms}
            />
            <SearchableSelectQuery
              options={pilots.map((pilot) => ({ value: pilot.id, label: pilot.name }))}
              value={selectedPilotId}
              onValueChange={(value) => handlePilotChange(value as string | undefined)}
              placeholder='Piloto'
              searchPlaceholder='Buscar piloto...'
              clearable
              isLoading={isLoadingPilots}
            />
            <SearchableSelectQuery
              options={products.map((product) => ({ value: product.id, label: product.name }))}
              value={selectedProductId}
              onValueChange={(value) => handleProductChange(value as string | undefined)}
              placeholder='Produto'
              searchPlaceholder='Buscar produto...'
              clearable
              isLoading={isLoadingProducts}
            />
            <SearchableSelectQuery
              options={assistants.map((assistant) => ({ value: assistant.id, label: assistant.name }))}
              value={selectedAssistantId}
              onValueChange={(value) => handleAssistantChange(value as string | undefined)}
              placeholder='Ajudante'
              searchPlaceholder='Buscar ajudante...'
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
              clearable
            />
            <SearchableSelectQuery
              options={drones.map((drone) => ({ value: drone.id, label: drone.name }))}
              value={selectedDroneId}
              onValueChange={(value) => handleDroneChange(value as string | undefined)}
              placeholder='Drone'
              searchPlaceholder='Buscar drone...'
              clearable
              isLoading={isLoadingDrones}
            />
            <Button type='button' variant='outline' onClick={clearFilters}>
              Limpar Filtros
            </Button>
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
                      pilotPeriodMode === 'total'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-600/90'
                        : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={selectPilotTotalMode}
                  disabled={!selectedCropSeasonId}
                >
                  Total Geral
                </Button>
                <Button
                  type='button'
                  size='sm'
                    variant={pilotEntityMode === 'pilots' ? 'default' : 'ghost'}
                    className={
                      pilotEntityMode === 'pilots'
                        ? 'bg-blue-600 text-white hover:bg-blue-600/90'
                        : PANEL_TOGGLE_INACTIVE_CLASS
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
                      pilotEntityMode === 'assistants'
                        ? 'bg-violet-600 text-white hover:bg-violet-600/90'
                        : PANEL_TOGGLE_INACTIVE_CLASS
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
                      pilotPeriodMode === 'month'
                        ? 'bg-indigo-600 text-white hover:bg-indigo-600/90'
                        : PANEL_TOGGLE_INACTIVE_CLASS
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
                      pilotPeriodMode === 'day'
                        ? 'bg-cyan-600 text-white hover:bg-cyan-600/90'
                        : PANEL_TOGGLE_INACTIVE_CLASS
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
                        fill={
                          PILOT_NEON_RETRO_BAR_COLORS[index % PILOT_NEON_RETRO_BAR_COLORS.length]
                        }
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
                    ? 'bg-emerald-600 text-white hover:bg-emerald-600/90'
                    : PANEL_TOGGLE_INACTIVE_CLASS
                }
                onClick={selectCustomerTotalMode}
                disabled={!selectedCropSeasonId}
              >
                Total Geral
              </Button>
              <Button
                type='button'
                size='sm'
                variant={customerPeriodMode === 'month' ? 'default' : 'ghost'}
                className={
                  customerPeriodMode === 'month'
                    ? 'bg-teal-600 text-white hover:bg-teal-600/90'
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
                    ? 'bg-orange-600 text-white hover:bg-orange-600/90'
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
                        fill={
                          CUSTOMER_NEON_RETRO_BAR_COLORS[index % CUSTOMER_NEON_RETRO_BAR_COLORS.length]
                        }
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
                const totalPlots = serviceOrder.plots?.length || 0;
                const totalHectaresAllPlots = (serviceOrder.plots || []).reduce(
                  (sum, plot) => sum + Number.parseFloat(plot.hectare || '0'),
                  0
                );
                const totalHectaresApplied = serviceOrderApplications.reduce(
                  (sum, application) => sum + Number.parseFloat(application.hectares || '0'),
                  0
                );
                const uniquePlotIdsWithApplications = new Set(
                  serviceOrderApplications
                    .filter((application) => application.plotId !== null)
                    .map((application) => application.plotId)
                );
                const plotsWithApplications = uniquePlotIdsWithApplications.size;
                const rawProgress =
                  totalHectaresAllPlots > 0 ? (totalHectaresApplied / totalHectaresAllPlots) * 100 : 0;
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
                    className='border border-border/70 bg-card shadow-sm transition-transform duration-200 hover:-translate-y-0.5'
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
                        <Badge className='border border-emerald-300/70 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:border-emerald-800/70 dark:bg-emerald-400/15 dark:text-emerald-200'>
                          OS #{serviceOrder.number}
                        </Badge>
                      </div>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between text-sm'>
                          <span>Progresso da OS</span>
                          <span className='font-medium text-foreground'>
                            {formatHectares(totalHectaresApplied)} / {formatHectares(totalHectaresAllPlots)}
                          </span>
                        </div>
                        <Progress
                          value={progressValue}
                          className='h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-emerald-500'
                        />
                        <p className='text-xs text-muted-foreground'>{rawProgress.toFixed(1)}% concluído</p>
                      </div>
                      <div className='grid grid-cols-2 gap-4 border-t border-border/70 pt-4 text-sm'>
                        <div>
                          <p className='text-muted-foreground'>Aplicação ontem</p>
                          <p className='font-semibold text-emerald-700 dark:text-emerald-300'>
                            {formatHectares(yesterdayStats?.totalAreaHectares)}
                          </p>
                        </div>
                        <div>
                          <p className='text-muted-foreground'>Mapas</p>
                          <p className='font-semibold flex items-center gap-1 text-cyan-700 dark:text-cyan-300'>
                            <MapIcon className='h-4 w-4 text-cyan-600 dark:text-cyan-300' />
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

