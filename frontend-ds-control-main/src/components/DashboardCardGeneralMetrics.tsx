'use client';

import { useQueries } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar, Plane, SprayCan, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChartConfig } from '@/components/ui/chart';
import { DatePicker } from '@/components/ui/date-picker';
import { MultiInfiniteSearchableSelect } from '@/components/ui/multi-infinite-searchable-select';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetDashboardMetrics } from '@/queries/application.query';
import { useGetAllContracts } from '@/queries/contract.query';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import * as FarmService from '@/services/farm.service';
import { Farm } from '@/types/farm.type';
import { parseOperationalDateToPickerDate, toOperationalDateYMD } from '@/utils/operational-date';

interface DashboardCardGeneralMetricsProps {
  startDate: string;
  onStartDateChange: (startDate: string) => void;
}

const toDateParam = (date: Date) => toOperationalDateYMD(date) ?? format(date, 'yyyy-MM-dd');

export const DashboardCardGeneralMetrics = ({
  startDate,
  onStartDateChange,
}: DashboardCardGeneralMetricsProps) => {
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([]);
  const [farmSearch, setFarmSearch] = useState('');
  const { data: contractsData, isPending: isLoadingContracts } = useGetAllContracts({
    limit: '100',
  });

  const { data: customersData, isPending: isLoadingCustomers } = useGetAllCustomers({
    limit: '100',
  });

  const customerIdsFromContracts = useMemo(() => {
    if (!contractsData?.data || selectedContractIds.length === 0) return [];
    return contractsData.data
      .filter((c) => selectedContractIds.includes(c.id))
      .map((c) => c.customerId);
  }, [contractsData, selectedContractIds]);

  const effectiveCustomerIds = useMemo(() => {
    const combined = [...new Set([...selectedCustomerIds, ...customerIdsFromContracts])];
    return combined;
  }, [selectedCustomerIds, customerIdsFromContracts]);

  const hasCustomerOrContractSelected = useMemo(() => {
    return selectedCustomerIds.length > 0 || selectedContractIds.length > 0;
  }, [selectedCustomerIds, selectedContractIds]);

  const {
    data: farmsInfiniteData,
    fetchNextPage: fetchNextFarmsPage,
    hasNextPage: hasNextFarmsPage,
    isFetchingNextPage: isFetchingNextFarmsPage,
  } = useGetAllFarmsInfinite(undefined, {
    limit: '20',
    search: farmSearch || undefined,
    includeCustomer: 'true',
  });

  const allFarmsQueries = useQueries({
    queries: effectiveCustomerIds.map((customerId) => ({
      queryKey: ['farms', 'all', customerId],
      queryFn: () => FarmService.getLiterallyAllFarms({ customerId }),
      enabled: hasCustomerOrContractSelected,
    })),
  });

  const isLoadingAllFarms = allFarmsQueries.some((query) => query.isPending);

  const allFarmsData = useMemo(() => {
    const allFarms: Farm[] = [];
    allFarmsQueries.forEach((query) => {
      if (query.data?.farms) {
        allFarms.push(...query.data.farms);
      }
    });
    return allFarms;
  }, [allFarmsQueries]);

  const farmOptionsFromInfinite = useMemo(() => {
    const pages = (farmsInfiniteData as { pages?: { data: Farm[] }[] } | undefined)?.pages;
    if (!pages) return [];

    const allFarms = pages.flatMap((page) => page.data);

    if (effectiveCustomerIds.length > 0) {
      return allFarms
        .filter((farm: Farm) => effectiveCustomerIds.includes(farm.customer?.id))
        .map((farm: Farm) => ({
          value: farm.id,
          label: `${farm.name} (${farm.customer?.name || 'N/A'})`,
        }));
    }

    return allFarms.map((farm: Farm) => ({
      value: farm.id,
      label: `${farm.name} (${farm.customer?.name || 'N/A'})`,
    }));
  }, [farmsInfiniteData, effectiveCustomerIds]);

  const farmOptionsFromAll = useMemo(() => {
    if (!allFarmsData.length) return [];
    return allFarmsData.map((farm: Farm) => ({
      value: farm.id,
      label: farm.name,
    }));
  }, [allFarmsData]);

  const contractOptions = useMemo(() => {
    if (!contractsData?.data) return [];

    const filteredContracts =
      selectedCustomerIds.length > 0
        ? contractsData.data.filter((contract) => selectedCustomerIds.includes(contract.customerId))
        : contractsData.data;

    return filteredContracts.map((contract) => ({
      value: contract.id,
      label: `${contract.name} (${contract.customer?.name || 'N/A'})`,
    }));
  }, [contractsData, selectedCustomerIds]);

  const customerOptions = useMemo(() => {
    if (!customersData?.data) return [];
    return customersData.data.map((customer) => ({
      value: customer.id,
      label: customer.name,
    }));
  }, [customersData]);

  const queryParams = useMemo(() => {
    return {
      contractIds: selectedContractIds.length > 0 ? selectedContractIds : undefined,
      customerIds: effectiveCustomerIds.length > 0 ? effectiveCustomerIds : undefined,
      farmIds: selectedFarmIds.length > 0 ? selectedFarmIds : undefined,
      startDate: startDate,
    };
  }, [selectedContractIds, effectiveCustomerIds, selectedFarmIds, startDate]);

  const handleDatePreset = (preset: 'year' | '3months' | '6months') => {
    const today = new Date();
    let start = new Date();

    switch (preset) {
      case 'year':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      case '3months':
        start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        break;
      case '6months':
        start = new Date(today.getFullYear(), today.getMonth() - 6, 1);
        break;
    }

    onStartDateChange(toDateParam(start));
  };

  const {
    data: metricsData,
    isPending: isLoadingMetrics,
    isError: isErrorOnMetrics,
  } = useGetDashboardMetrics(queryParams);

  const handleContractChange = (values: string[]) => {
    setSelectedContractIds(values);
    setSelectedFarmIds([]);
  };

  const handleCustomerChange = (values: string[]) => {
    setSelectedCustomerIds(values);
    setSelectedFarmIds([]);
    setSelectedContractIds([]);
  };

  const handleFarmChange = (values: string[]) => {
    setSelectedFarmIds(values);
  };

  const chartConfig = {
    hectares: {
      label: 'Hectares',
      color: 'var(--brand-primary)',
    },
    label: {
      color: 'hsl(var(--background))',
    },
  } satisfies ChartConfig;

  if (isLoadingMetrics) {
    return <GeneralMetricsSkeleton />;
  }

  if (isErrorOnMetrics || !metricsData?.metrics) {
    return (
      <Card>
        <CardContent className='p-6'>
          <div className='text-sm text-muted-foreground'>Erro ao carregar dados</div>
        </CardContent>
      </Card>
    );
  }

  const { metrics } = metricsData;

  return (
    <div className='space-y-6'>
      <Card className='min-w-0'>
        <CardContent className='p-6'>
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
            <div className='lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 order-last lg:order-first'>
              <MetricCard
                icon={<SprayCan className='w-6 h-6 text-primary' />}
                label='Área pulverizada total'
                value={`${metrics.totalAreaHectares.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`}
                colorClass='text-primary'
              />

              <MetricCard
                icon={<Calendar className='w-6 h-6 text-primary' />}
                label='Dias corridos'
                value={metrics.daysSinceStart.toString()}
                colorClass='text-primary'
              />

              <MetricCard
                icon={<TrendingUp className='w-6 h-6 text-primary' />}
                label='Área pulverizada - Média diária'
                value={`${metrics.averageDailyArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`}
                colorClass='text-primary'
              />

              <MetricCard
                icon={<SprayCan className='w-6 h-6 text-primary' />}
                label='Área pulverizada (ontem)'
                value={`${metrics.yesterdayStats.totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`}
                colorClass='text-primary'
              />

              <MetricCard
                icon={<Plane className='w-6 h-6 text-primary' />}
                label='Quantidade de drones (ontem)'
                value={metrics.yesterdayStats.dronesCount.toString()}
                colorClass='text-primary'
              />

              <MetricCard
                icon={<TrendingUp className='w-6 h-6 text-primary' />}
                label='Hectares por drone (ontem)'
                value={`${metrics.yesterdayStats.areaPerDrone.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`}
                colorClass='text-primary'
              />
            </div>

            <div className='flex flex-col gap-3 order-first lg:order-last'>
              <div className='text-sm font-medium text-muted-foreground mb-1'>Filtros</div>

              {/* Date Filter */}
              <div className='space-y-2'>
                <div className='text-xs font-medium text-muted-foreground'>
                  Data inicial do período
                </div>
                <DatePicker
                  value={startDate}
                  onChange={onStartDateChange}
                  placeholder='Selecione a data inicial'
                  defaultMonth={parseOperationalDateToPickerDate(startDate)}
                  className='w-full'
                />
                <div className='flex flex-wrap gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleDatePreset('year')}
                    className='text-xs h-7'
                  >
                    Ano atual
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleDatePreset('3months')}
                    className='text-xs h-7'
                  >
                    3 meses
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleDatePreset('6months')}
                    className='text-xs h-7'
                  >
                    6 meses
                  </Button>
                </div>
              </div>

              <div className='flex flex-col gap-3'>
                <MultiSearchableSelect
                  options={customerOptions}
                  values={selectedCustomerIds}
                  onValuesChange={handleCustomerChange}
                  placeholder='Clientes'
                  searchPlaceholder='Buscar cliente...'
                  emptyText='Nenhum cliente encontrado.'
                  className='w-full'
                  disabled={isLoadingCustomers}
                />

                <MultiSearchableSelect
                  options={contractOptions}
                  values={selectedContractIds}
                  onValuesChange={handleContractChange}
                  placeholder='Contratos'
                  searchPlaceholder='Buscar contrato...'
                  emptyText='Nenhum contrato encontrado.'
                  className='w-full'
                  disabled={isLoadingContracts}
                />

                {hasCustomerOrContractSelected ? (
                  <MultiSearchableSelect
                    options={farmOptionsFromAll}
                    values={selectedFarmIds}
                    onValuesChange={handleFarmChange}
                    placeholder='Fazendas'
                    searchPlaceholder='Buscar fazenda...'
                    emptyText='Nenhuma fazenda encontrada.'
                    className='w-full'
                    disabled={isLoadingAllFarms}
                  />
                ) : (
                  <MultiInfiniteSearchableSelect
                    options={farmOptionsFromInfinite}
                    values={selectedFarmIds}
                    onValuesChange={handleFarmChange}
                    placeholder='Fazendas'
                    searchPlaceholder='Buscar fazenda...'
                    emptyText='Nenhuma fazenda encontrada.'
                    className='w-full'
                    onSearchChange={setFarmSearch}
                    onLoadMore={fetchNextFarmsPage}
                    hasNextPage={hasNextFarmsPage}
                    isFetchingNextPage={isFetchingNextFarmsPage}
                  />
                )}
              </div>

              <p className='text-xs text-muted-foreground mt-2'>
                OBS.: Os dados dependem da data que o piloto registrou, sendo a data de início das
                aplicações, atrasos nos lançamentos afetam as informações apresentadas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Sprayed Area Chart */}
      {/* {metrics.monthlySprayedArea && metrics.monthlySprayedArea.length > 0 && (
        <Card className='min-w-0'>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <div className='p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 shadow-sm'>
                <SprayCan className='w-5 h-5 text-emerald-600 dark:text-emerald-400' />
              </div>
              <div>
                <CardTitle className='text-lg'>Área pulverizada por mês</CardTitle>
                <CardDescription className='mt-0.5'>
                  Evolução mensal da área pulverizada (hectares)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='p-6'>
            <ChartContainer config={chartConfig} className='h-[350px] w-full'>
              <BarChart
                data={metrics.monthlySprayedArea}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} />
                <XAxis
                  dataKey='month'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-45}
                  textAnchor='end'
                  height={80}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    value >= 1000
                      ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
                      : value.toLocaleString('pt-BR')
                  }
                />
                <ChartTooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [
                        <span key='value' className='font-semibold'>
                          {Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha
                        </span>,
                      ]}
                    />
                  }
                />
                <Bar dataKey='hectares' fill='hsl(142, 76%, 36%)' radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey='hectares'
                    position='top'
                    offset={8}
                    className='fill-foreground'
                    fontSize={10}
                    formatter={(value: number) =>
                      value >= 1000
                        ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mil`
                        : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                    }
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass: string;
  isLoading?: boolean;
}

const MetricCard = ({ icon, label, value, colorClass, isLoading }: MetricCardProps) => {
  return (
    <div className='bg-card rounded-lg p-4 border border-primary/10'>
      <div className='flex items-center gap-3 min-w-0'>
        <div className='flex-shrink-0'>{icon}</div>
        <div className='flex-1 min-w-0'>
          <div className='text-xs font-medium text-muted-foreground mb-1 truncate'>{label}</div>
          {isLoading ? (
            <Skeleton className='w-16 h-6' />
          ) : (
            <div className={`text-2xl font-bold truncate ${colorClass}`}>{value}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const GeneralMetricsSkeleton = () => {
  return (
    <div className='space-y-6'>
      <Card>
        <CardContent className='p-6'>
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
            <div className='lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 order-last lg:order-first'>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className='bg-muted/50 rounded-lg p-4 border'>
                  <div className='flex items-center gap-3'>
                    <Skeleton className='w-6 h-6 rounded' />
                    <div className='flex-1 space-y-2'>
                      <Skeleton className='w-24 h-3' />
                      <Skeleton className='w-16 h-6' />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className='flex flex-col gap-3 order-first lg:order-last'>
              <Skeleton className='w-16 h-4 mb-1' />
              <div className='flex flex-col gap-3'>
                <Skeleton className='w-full h-9' />
                <Skeleton className='w-full h-9' />
                <Skeleton className='w-full h-9' />
              </div>
              <Skeleton className='w-full h-12 mt-2' />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <Skeleton className='w-9 h-9 rounded-lg' />
            <div className='space-y-2'>
              <Skeleton className='w-48 h-5' />
              <Skeleton className='w-64 h-4' />
            </div>
          </div>
        </CardHeader>
        <CardContent className='p-6'>
          <Skeleton className='w-full h-[350px]' />
        </CardContent>
      </Card>
    </div>
  );
};
