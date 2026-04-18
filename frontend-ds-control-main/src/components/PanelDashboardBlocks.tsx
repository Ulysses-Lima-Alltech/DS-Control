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

const PILOT_BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const CUSTOMER_BAR_COLORS = ['#6366f1', '#06b6d4', '#84cc16', '#f97316', '#d946ef', '#0ea5e9'];
const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const AXIS_TICK_MAX_CHARS = 24;
const CHART_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  borderRadius: '0.5rem',
  border: '1px solid hsl(var(--border))',
  backgroundColor: 'hsl(var(--card))',
  boxShadow: '0 10px 25px rgba(2, 6, 23, 0.18)',
  padding: '10px 12px',
};
const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: 'hsl(var(--foreground))',
  fontWeight: 600,
  marginBottom: '2px',
};
const CHART_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
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

function truncateAxisLabel(value?: string, maxChars = AXIS_TICK_MAX_CHARS) {
  const label = String(value || '').trim();
  if (label.length <= maxChars) return label;
  const breakpoint = label.lastIndexOf(' ', maxChars - 1);
  const cutIndex =
    breakpoint > Math.floor(maxChars * 0.65) ? breakpoint : Math.max(maxChars - 3, 1);
  return `${label.slice(0, cutIndex).trim()}...`;
}

function getDominantMapCategory(applications: ApplicationService.GetApplicationsByServiceOrderIdResponse['data']) {
  const categoryCounts = new Map<string, number>();

  for (const application of applications) {
    const category = (application.product?.name || application.culture?.name || '').trim();
    if (!category) continue;
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  return [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
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
  return {
    startDate: totalEndDate,
    endDate: totalEndDate,
  };
}

function mapStatusLabel(status?: string) {
  if (status === 'completed') return 'Concluído';
  if (status === 'open') return 'Em aberto';
  if (status === 'cancelled') return 'Cancelado';
  return 'Sem OS';
}

function getLaunchStatusBadgeClass(status?: string) {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'open') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'cancelled') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function PanelDashboardBlocks({ startDate, endDate, yesterday }: PanelDashboardBlocksProps) {
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

  const { data: applicationsStats, isPending: isLoadingApplicationsStats } = useGetStatsApplications({
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
  });
  const { data: dashboardMetrics, isPending: isLoadingDashboardMetrics } = useGetDashboardMetrics({
    startDate: effectiveStartDate,
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
    limit: '25',
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

  const orderPeriodStatsQueries = useQueries({
    queries: openServiceOrders.map((serviceOrder) => ({
      queryKey: [
        'panel',
        'order-period',
        serviceOrder.id,
        effectiveStartDate,
        effectiveEndDate,
        search,
      ],
      queryFn: () =>
        ApplicationService.getStatsApplications({
          search: search || undefined,
          serviceOrderId: serviceOrder.id,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
        }),
      staleTime: 1000 * 60 * 3,
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
    return customers
      .map((customer, index) => ({
        name: customer.name,
        hectares: Number(customerAreaQueries[index]?.data?.stats?.totalAreaHectares || 0),
      }))
      .filter((item) => item.hectares > 0)
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 6);
  }, [customers, customerAreaQueries]);

  const pilotChartData = useMemo(() => {
    const base = (byPilotStats?.byPilot || []).map((item) => ({
      name: item.pilotName,
      hectares: item.totalAreaHectares,
    }));
    if (pilotEntityMode === 'assistants') {
      return base;
    }
    return base;
  }, [byPilotStats?.byPilot, pilotEntityMode]);

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
      value: formatHectares(applicationsStats?.stats?.totalAreaHectares),
      icon: Sprout,
      isLoading: isLoadingApplicationsStats,
    },
    {
      title: 'Este mês',
      value: formatHectares(applicationsStats?.stats?.totalHectaresByMonth),
      icon: CalendarClock,
      isLoading: isLoadingApplicationsStats,
    },
    {
      title: 'Aplicação de Ontem',
      value: formatHectares(dashboardMetrics?.metrics?.yesterdayStats?.totalArea),
      icon: ClipboardList,
      isLoading: isLoadingDashboardMetrics,
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
  const isLoadingAnyCustomerArea =
    isLoadingCustomers || customerAreaQueries.some((query) => query.isPending);
  const isLoadingAnyOrderStats =
    isLoadingOpenServiceOrders ||
    orderPeriodStatsQueries.some((query) => query.isPending) ||
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
                    <p className='text-[13px] leading-tight text-muted-foreground'>{card.title}</p>
                    <p className='text-xl sm:text-[22px] leading-tight font-semibold truncate'>
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
          {isLoadingPilotLaunches ? (
            <p className='text-sm text-muted-foreground'>Carregando lançamentos...</p>
          ) : launches.length === 0 ? (
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
                  {launches.map((launch) => (
                    <tr key={launch.id} className='border-t'>
                      {visibleColumns.date && (
                        <td className='px-3 py-2'>{formatLaunchDate(launch.date)}</td>
                      )}
                      {visibleColumns.pilot && <td className='px-3 py-2'>{launch.pilot?.name || 'N/A'}</td>}
                      {visibleColumns.farm && <td className='px-3 py-2'>{launch.farm?.name || 'N/A'}</td>}
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
                            className={getLaunchStatusBadgeClass(launch.serviceOrder?.status)}
                          >
                            {mapStatusLabel(launch.serviceOrder?.status)}
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
                      : 'text-blue-700 hover:bg-blue-50'
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
                      : 'text-violet-700 hover:bg-violet-50'
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
                      : 'text-blue-700 hover:bg-blue-50'
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
                      : 'text-indigo-700 hover:bg-indigo-50'
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
                      : 'text-cyan-700 hover:bg-cyan-50'
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
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='hsl(var(--border))' />
                <XAxis
                  dataKey='name'
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  interval='preserveStartEnd'
                  angle={-38}
                  textAnchor='end'
                  height={88}
                  tickMargin={12}
                  minTickGap={10}
                  tickFormatter={truncateAxisLabel}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(100, 116, 139, 0.12)' }}
                  formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} ha`, 'Hectares']}
                  labelFormatter={(label) => String(label || '')}
                  contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                />
                <Bar dataKey='hectares' radius={[4, 4, 0, 0]}>
                  {pilotChartData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
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
                    ? 'bg-indigo-600 text-white hover:bg-indigo-600/90'
                    : 'text-indigo-700 hover:bg-indigo-50'
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
                    : 'text-teal-700 hover:bg-teal-50'
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
                    : 'text-orange-700 hover:bg-orange-50'
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
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='hsl(var(--border))' />
                <XAxis
                  dataKey='name'
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  interval='preserveStartEnd'
                  angle={-38}
                  textAnchor='end'
                  height={88}
                  tickMargin={12}
                  minTickGap={10}
                  tickFormatter={truncateAxisLabel}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(100, 116, 139, 0.12)' }}
                  formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} ha`, 'Hectares']}
                  labelFormatter={(label) => String(label || '')}
                  contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                />
                <Bar dataKey='hectares' radius={[4, 4, 0, 0]}>
                  {hectaresByCustomerData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
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
          ) : openServiceOrders.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Nenhuma OS em aberto encontrada para o recorte.</p>
          ) : (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {openServiceOrders.map((serviceOrder, index) => {
                const periodStats = orderPeriodStatsQueries[index]?.data?.stats;
                const yesterdayStats = orderYesterdayStatsQueries[index]?.data?.stats;
                const serviceOrderApplications = orderApplicationsQueries[index]?.data?.data || [];
                const plannedArea = serviceOrder.plots.reduce(
                  (sum, plot) => sum + Number(plot.hectare || 0),
                  0
                );
                const appliedArea = Number(periodStats?.totalAreaHectares || 0);
                const progress = plannedArea > 0 ? Math.min((appliedArea / plannedArea) * 100, 100) : 0;
                const farmName =
                  serviceOrder.farms?.[0]?.name ||
                  serviceOrder.customer?.name ||
                  'Fazenda não informada';
                const plannedMaps = serviceOrder.plots?.length ?? serviceOrder.plotsIds?.length;
                const serviceOrderPlotIds = new Set(
                  (serviceOrder.plotsIds || []).filter((plotId): plotId is string => Boolean(plotId))
                );
                const completedMapIds = new Set(
                  serviceOrderApplications
                    .map((application) => application.plotId)
                    .filter(
                      (plotId): plotId is string =>
                        typeof plotId === 'string' &&
                        plotId.length > 0 &&
                        (serviceOrderPlotIds.size === 0 || serviceOrderPlotIds.has(plotId))
                    )
                );
                const completedMaps = completedMapIds.size;
                const remainingMaps =
                  typeof plannedMaps === 'number' ? Math.max(plannedMaps - completedMaps, 0) : undefined;
                const mapCategory = getDominantMapCategory(serviceOrderApplications);
                const mapLabel = mapCategory ? `Mapas (${mapCategory})` : 'Mapas';
                return (
                  <Card
                    key={serviceOrder.id}
                    className='border border-border/70 bg-card shadow-sm transition-transform duration-200 hover:-translate-y-0.5'
                  >
                    <CardContent className='space-y-4 p-5'>
                      <div className='flex items-center justify-between gap-2'>
                        <p className='truncate text-[15px] font-medium'>{farmName}</p>
                        <Badge className='border border-emerald-300/70 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10'>
                          OS #{serviceOrder.number}
                        </Badge>
                      </div>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between text-sm'>
                          <span>Progresso da OS</span>
                          <span className='font-medium text-foreground'>
                            {formatHectares(appliedArea)} / {formatHectares(plannedArea)}
                          </span>
                        </div>
                        <Progress
                          value={progress}
                          className='h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-emerald-500'
                        />
                        <p className='text-xs text-muted-foreground'>{progress.toFixed(1)}% concluído</p>
                      </div>
                      <div className='grid grid-cols-2 gap-4 border-t border-border/70 pt-4 text-sm'>
                        <div>
                          <p className='text-muted-foreground'>Aplicação ontem</p>
                          <p className='font-semibold text-emerald-700'>
                            {formatHectares(yesterdayStats?.totalAreaHectares)}
                          </p>
                        </div>
                        <div>
                          <p className='text-muted-foreground'>{mapLabel}</p>
                          <p className='font-semibold flex items-center gap-1 text-cyan-700'>
                            <MapIcon className='h-4 w-4 text-cyan-600' />
                            {typeof remainingMaps === 'number'
                              ? `${completedMaps} feitos / ${remainingMaps} restam`
                              : `${completedMaps} feitos`}
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
