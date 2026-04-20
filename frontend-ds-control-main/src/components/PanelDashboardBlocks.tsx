'use client';

import { useQueries } from '@tanstack/react-query';
import { format, isValid, startOfMonth } from 'date-fns';
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Map as MapIcon,
  Search,
  Sprout,
  UserCheck,
} from 'lucide-react';
import { CSSProperties, useCallback, useMemo, useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { useGetAllApplications, useGetApplicationsByPilotStats, useGetDashboardMetrics, useGetStatsApplications } from '@/queries/application.query';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetAllFarms } from '@/queries/farm.query';
import { useGetAllServiceOrders } from '@/queries/service-order.query';
import { useGetAllUsers } from '@/queries/user.query';
import * as ApplicationService from '@/services/application.service';
import { ApplicationOrderBy, ApplicationOrderType } from '@/types/applications.type';

interface PanelDashboardBlocksProps {
  startDate: string;
  endDate: string;
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

function formatLaunchDate(dateValue?: string): string {
  if (!dateValue) return '-';
  const parsed = new Date(dateValue);
  if (!isValid(parsed)) return '-';
  return format(parsed, 'dd/MM/yyyy');
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
  const lineChars = hasManyItems ? 15 : maxLabelLength > 24 ? 18 : 20;

  return {
    interval: hasManyItems ? 'preserveStartEnd' : 0,
    angle: 0,
    textAnchor: 'middle',
    height: hasManyItems ? 96 : 88,
    tickMargin: hasManyItems ? 16 : 12,
    minTickGap: hasManyItems ? 24 : 16,
    bottomMargin: hasManyItems ? 34 : 26,
    lineChars,
  };
}

function getRangeByMode(mode: RangeMode, baseEndDate: string, totalStartDate: string, totalEndDate: string) {
  if (mode === 'total') {
    return { startDate: totalStartDate, endDate: totalEndDate };
  }
  if (mode === 'month') {
    const end = parseDateParam(baseEndDate);
    if (!end) {
      return { startDate: totalStartDate, endDate: totalEndDate };
    }
    return {
      startDate: format(startOfMonth(end), 'yyyy-MM-dd'),
      endDate: totalEndDate,
    };
  }
  if (totalStartDate === totalEndDate) {
    return {
      startDate: totalEndDate,
      endDate: totalEndDate,
    };
  }
  return {
    startDate: totalStartDate,
    endDate: totalEndDate,
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
  const { resolvedTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [selectedFarmId, setSelectedFarmId] = useState<string | undefined>(undefined);
  const [selectedPilotId, setSelectedPilotId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate,
    endDate,
  });
  const [pilotEntityMode, setPilotEntityMode] = useState<'pilots' | 'assistants'>('pilots');
  const [pilotPeriodMode, setPilotPeriodMode] = useState<RangeMode>('total');
  const [customerPeriodMode, setCustomerPeriodMode] = useState<RangeMode>('total');
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    pilot: true,
    farm: true,
    hectares: true,
    status: true,
  });
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

  const effectiveStartDate = dateRange.startDate;
  const effectiveEndDate = dateRange.endDate;
  const pilotChartRange = getRangeByMode(
    pilotPeriodMode,
    effectiveEndDate,
    effectiveStartDate,
    effectiveEndDate
  );
  const customerChartRange = getRangeByMode(
    customerPeriodMode,
    effectiveEndDate,
    effectiveStartDate,
    effectiveEndDate
  );

  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const currentMonthStartDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const kpiBaseFilters = {
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
  };
  const { data: totalSeasonStats, isPending: isLoadingTotalSeasonStats } =
    useGetStatsApplications({
      ...kpiBaseFilters,
      currentSeason: true,
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
    startDate: effectiveStartDate,
    customerIds: selectedCustomerId ? [selectedCustomerId] : undefined,
    farmIds: selectedFarmId ? [selectedFarmId] : undefined,
  });
  const { data: byPilotStats, isPending: isLoadingByPilotStats } = useGetApplicationsByPilotStats({
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    startDate: pilotChartRange.startDate,
    endDate: pilotChartRange.endDate,
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

  const { data: pilotLaunchesData, isPending: isLoadingPilotLaunches } = useGetAllApplications({
    page: '1',
    limit: '1000',
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    orderBy: ApplicationOrderBy.DATE,
    orderType: ApplicationOrderType.DESC,
  });

  const { data: openServiceOrdersData, isPending: isLoadingOpenServiceOrders } = useGetAllServiceOrders({
    page: '1',
    limit: '100',
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
  const openServiceOrders = openServiceOrdersData?.data || [];

  const customerAreaQueries = useQueries({
    queries: customers.map((customer) => ({
      queryKey: [
        'panel',
        'customer-hectares',
        customer.id,
        customerChartRange.startDate,
        customerChartRange.endDate,
        selectedFarmId,
        selectedPilotId,
        search,
      ],
      queryFn: () =>
        ApplicationService.getStatsApplications({
          search: search || undefined,
          customerId: customer.id,
          farmId: selectedFarmId,
          pilotId: selectedPilotId,
          startDate: customerChartRange.startDate,
          endDate: customerChartRange.endDate,
        }),
      enabled: Boolean(customerChartRange.startDate && customerChartRange.endDate),
      staleTime: 1000 * 60 * 5,
    })),
  });

  const orderYesterdayStatsQueries = useQueries({
    queries: openServiceOrders.map((serviceOrder) => ({
      queryKey: ['panel', 'order-yesterday', serviceOrder.id, yesterday, search],
      queryFn: () =>
        ApplicationService.getStatsApplications({
          search: search || undefined,
          serviceOrderId: serviceOrder.id,
          startDate: yesterday,
          endDate: yesterday,
        }),
      staleTime: 1000 * 60 * 3,
    })),
  });

  const orderApplicationsQueries = useQueries({
    queries: openServiceOrders.map((serviceOrder) => ({
      queryKey: ['panel', 'order-applications', serviceOrder.id],
      queryFn: () => ApplicationService.getApplicationsByServiceOrderId(serviceOrder.id),
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

  const pilotChartData = useMemo(() => {
    const base = (byPilotStats?.byPilot || []).map((item) => ({
      name: item.pilotName,
      hectares: item.totalAreaHectares,
    }));
    if (base.length === 0 && pilotPeriodMode === 'day') {
      return pilots
        .filter((pilot) => !selectedPilotId || pilot.id === selectedPilotId)
        .map((pilot) => ({
          name: pilot.name,
          hectares: 0,
        }))
        .slice(0, 10);
    }
    if (pilotEntityMode === 'assistants') {
      return base;
    }
    return base;
  }, [byPilotStats?.byPilot, pilotEntityMode, pilotPeriodMode, pilots, selectedPilotId]);
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

  const clearFilters = () => {
    setSearch('');
    setSelectedCustomerId(undefined);
    setSelectedFarmId(undefined);
    setSelectedPilotId(undefined);
    setDateRange({ startDate, endDate });
  };
  const handleDateRangeChange = useCallback(
    (range: { startDate?: string; endDate?: string } | undefined) => {
      const nextRange =
        range?.startDate && range?.endDate
          ? { startDate: range.startDate, endDate: range.endDate }
          : { startDate, endDate };

      setDateRange((prev) => {
        if (areDateRangesEqual(prev, nextRange)) {
          return prev;
        }
        return nextRange;
      });
    },
    [startDate, endDate]
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
          .map((application) => application.date)
          .filter((date): date is string => Boolean(date))
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

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
  const isLoadingAnyOrderStats =
    isLoadingOpenServiceOrders ||
    orderYesterdayStatsQueries.some((query) => query.isPending) ||
    orderApplicationsQueries.some((query) => query.isPending);

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
          <div className='grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_auto_auto]'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Busca'
                className='pl-9'
              />
            </div>
            <DateRangePicker
              initialValue={{ startDate: effectiveStartDate, endDate: effectiveEndDate }}
              onChange={handleDateRangeChange}
              placeholder='Período'
            />
            <SearchableSelectQuery
              options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
              value={selectedCustomerId}
              onValueChange={(value) => setSelectedCustomerId(value as string | undefined)}
              placeholder='Cliente'
              searchPlaceholder='Buscar cliente...'
              clearable
              isLoading={isLoadingCustomers}
            />
            <SearchableSelectQuery
              options={farms.map((farm) => ({ value: farm.id, label: farm.name }))}
              value={selectedFarmId}
              onValueChange={(value) => setSelectedFarmId(value as string | undefined)}
              placeholder='Fazenda'
              searchPlaceholder='Buscar fazenda...'
              clearable
              isLoading={isLoadingFarms}
            />
            <SearchableSelectQuery
              options={pilots.map((pilot) => ({ value: pilot.id, label: pilot.name }))}
              value={selectedPilotId}
              onValueChange={(value) => setSelectedPilotId(value as string | undefined)}
              placeholder='Piloto'
              searchPlaceholder='Buscar piloto...'
              clearable
              isLoading={isLoadingPilots}
            />
            <Button type='button' variant='outline' onClick={clearFilters}>
              Limpar Filtros
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type='button' variant='outline'>
                  Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuLabel>Colunas</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.date}
                  onCheckedChange={(value) =>
                    setVisibleColumns((prev) => ({ ...prev, date: Boolean(value) }))
                  }
                >
                  Data
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.pilot}
                  onCheckedChange={(value) =>
                    setVisibleColumns((prev) => ({ ...prev, pilot: Boolean(value) }))
                  }
                >
                  Nome do Piloto
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.farm}
                  onCheckedChange={(value) =>
                    setVisibleColumns((prev) => ({ ...prev, farm: Boolean(value) }))
                  }
                >
                  Fazenda
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.hectares}
                  onCheckedChange={(value) =>
                    setVisibleColumns((prev) => ({ ...prev, hectares: Boolean(value) }))
                  }
                >
                  Total de Hectares
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.status}
                  onCheckedChange={(value) =>
                    setVisibleColumns((prev) => ({ ...prev, status: Boolean(value) }))
                  }
                >
                  Status de Lançamento
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Card className='border-border/70'>
        <CardHeader className='pb-2'>
          <CardTitle>Lançamentos dos Pilotos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPilotLaunchRows ? (
            <p className='text-sm text-muted-foreground'>Carregando lançamentos...</p>
          ) : pilotLaunchRows.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Nenhum lançamento encontrado para o período.</p>
          ) : (
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/40'>
                  <tr>
                    {visibleColumns.date && <th className='px-3 py-2 text-left font-medium'>Data</th>}
                    {visibleColumns.pilot && (
                      <th className='px-3 py-2 text-left font-medium'>Nome do Piloto</th>
                    )}
                    {visibleColumns.farm && <th className='px-3 py-2 text-left font-medium'>Fazenda</th>}
                    {visibleColumns.hectares && (
                      <th className='px-3 py-2 text-right font-medium'>Total de Hectares</th>
                    )}
                    {visibleColumns.status && (
                      <th className='px-3 py-2 text-left font-medium'>Status de Lançamento</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pilotLaunchRows.map((launch) => (
                    <tr key={launch.id} className='border-t'>
                      {visibleColumns.date && (
                        <td className='px-3 py-2'>{formatLaunchDate(launch.date)}</td>
                      )}
                      {visibleColumns.pilot && <td className='px-3 py-2'>{launch.pilotName}</td>}
                      {visibleColumns.farm && <td className='px-3 py-2'>{launch.farmName}</td>}
                      {visibleColumns.hectares && (
                        <td className='px-3 py-2 text-right tabular-nums'>
                          {Number(launch.hectares || 0).toLocaleString('pt-BR', {
                            maximumFractionDigits: 2,
                          })}{' '}
                          ha
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className='px-3 py-2'>
                          <Badge
                            variant='outline'
                            className={getLaunchStatusBadgeClass(launch.launchStatus)}
                          >
                            {mapLaunchStatusLabel(launch.launchStatus)}
                          </Badge>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    variant={pilotPeriodMode === 'total' ? 'default' : 'ghost'}
                    className={
                      pilotPeriodMode === 'total'
                        ? 'bg-blue-600 text-white hover:bg-blue-600/90'
                        : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={() => setPilotPeriodMode('total')}
                >
                  Total Geral
                </Button>
                <Button
                  type='button'
                  size='sm'
                    variant={pilotPeriodMode === 'month' ? 'default' : 'ghost'}
                    className={
                      pilotPeriodMode === 'month'
                        ? 'bg-indigo-600 text-white hover:bg-indigo-600/90'
                        : PANEL_TOGGLE_INACTIVE_CLASS
                    }
                  onClick={() => setPilotPeriodMode('month')}
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
                  onClick={() => setPilotPeriodMode('day')}
                >
                  Dia
                </Button>
              </div>
            </div>
          </div>
          {pilotEntityMode === 'assistants' ? (
            <CardDescription>
              Modo Ajudantes adaptado com dados operacionais disponíveis atualmente.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className='h-[320px] pt-0'>
          {isLoadingByPilotStats ? (
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
                    ? 'bg-indigo-600 text-white hover:bg-indigo-600/90'
                    : PANEL_TOGGLE_INACTIVE_CLASS
                }
                onClick={() => setCustomerPeriodMode('total')}
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
                onClick={() => setCustomerPeriodMode('month')}
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
                onClick={() => setCustomerPeriodMode('day')}
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
          ) : openServiceOrders.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Nenhuma OS em aberto encontrada para o recorte.</p>
          ) : (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {openServiceOrders.map((serviceOrder, index) => {
                const yesterdayStats = orderYesterdayStatsQueries[index]?.data?.stats;
                const serviceOrderApplications = orderApplicationsQueries[index]?.data?.data || [];
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

