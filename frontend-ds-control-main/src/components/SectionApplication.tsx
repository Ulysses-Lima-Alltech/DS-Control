'use client';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar, CheckCircle, Clock, SprayCan, TrendingUp, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetApplicationsSummary } from '@/queries/application.query';

interface SectionApplicationProps {
  dateParams: {
    startDate: string;
    endDate: string;
  };
}

interface CustomDailyTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      fullDate: string;
      applications: number;
      avgHectarePerApplication: number;
    };
  }>;
}

const CustomDailyTooltip = ({ active, payload }: CustomDailyTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const [year, month, day] = data.payload.fullDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const formattedDate = format(date, 'dd/MM/yyyy', { locale: pt });

  return (
    <div className='rounded-lg border bg-background p-2 shadow-sm'>
      <div className='grid gap-2'>
        <div className='flex flex-col'>
          <span className='text-[0.70rem] uppercase text-muted-foreground mb-1'>
            {formattedDate}
          </span>
          <div className='font-semibold'>Total: {Number(data.value).toFixed(2)} ha</div>
        </div>
        <div className='grid gap-1'>
          <div className='text-sm text-muted-foreground'>
            {data.payload.applications} aplicações
          </div>
          <div className='text-sm text-muted-foreground'>
            Média: {data.payload.avgHectarePerApplication?.toFixed(2) || '0.00'} ha/aplicação
          </div>
        </div>
      </div>
    </div>
  );
};

export const SectionApplication = ({ dateParams }: SectionApplicationProps) => {
  const { startDate, endDate } = dateParams;

  const queryParams = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [startDate, endDate]
  );

  const {
    data: summaryData,
    isPending: isLoadingSummary,
    isError: isErrorOnSummary,
  } = useGetApplicationsSummary(queryParams);

  const monthlyChartData = useMemo(() => {
    if (!summaryData?.summary?.comparisonLastMonths) return [];
    const monthlyAggregation = summaryData.summary.comparisonLastMonths.reduce(
      (acc, dailyData) => {
        const monthKey = dailyData.month;
        if (!acc[monthKey]) {
          acc[monthKey] = {
            month: monthKey,
            hectares: 0,
            totalApplications: 0,
          };
        }
        acc[monthKey].hectares += dailyData.hectares;
        acc[monthKey].totalApplications += dailyData.totalApplications;
        return acc;
      },
      {} as Record<string, { month: string; hectares: number; totalApplications: number }>
    );

    return Object.values(monthlyAggregation)
      .sort((a, b) => new Date(a.month + '-01').getTime() - new Date(b.month + '-01').getTime())
      .slice(-3)
      .map((monthData) => {
        const [year, month] = monthData.month.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
          month: format(date, 'MMM/yy', { locale: pt }),
          hectares: monthData.hectares,
          totalApplications: monthData.totalApplications,
        };
      });
  }, [summaryData?.summary?.comparisonLastMonths]);

  const dailyChartData = useMemo(() => {
    if (!summaryData?.summary?.comparisonLastMonths) return [];

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    const allDays = [];

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const existingData = summaryData.summary.comparisonLastMonths.find(
        (item) => item.day === dateString
      );

      allDays.push({
        day: format(date, 'dd/MM', { locale: pt }),
        fullDate: dateString,
        applications: existingData?.totalApplications || 0,
        hectares: existingData?.hectares || 0,
        avgHectarePerApplication:
          existingData && existingData.totalApplications > 0
            ? existingData.hectares / existingData.totalApplications
            : 0,
      });
    }

    return allDays;
  }, [summaryData?.summary?.comparisonLastMonths, startDate, endDate]);

  if (isLoadingSummary) {
    return <SkeletonLoading />;
  }

  if (isErrorOnSummary || !summaryData?.summary) {
    return <SkeletonError />;
  }

  const { summary } = summaryData;
  const totalOrders =
    summary.openOrdersCount + summary.completedOrdersCount + summary.cancelledOrdersCount;

  const monthlyChartConfig = {
    hectares: {
      label: 'Hectares',
      color: 'var(--chart-2)',
    },
    label: {
      color: 'var(--background)',
    },
  } satisfies ChartConfig;

  const dailyChartConfig = {
    applications: {
      label: 'Aplicações',
      color: 'var(--chart-1)',
    },
    hectares: {
      label: 'Hectares',
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig;

  return (
    <Card className='overflow-hidden shadow-lg'>
      <CardHeader>
        <div className='flex items-center gap-3'>
          <div className='p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 shadow-sm'>
            <Calendar className='w-5 h-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <CardTitle className='text-xl'>Resumo de Aplicações</CardTitle>
            <CardDescription className='mt-1'>
              Visão consolidada das aplicações no período selecionado
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='p-6'>
        <div className='space-y-6'>
          {/* Total de Ordens - Card Destacado */}
          <div className='relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 via-amber-100/50 to-orange-50 dark:from-amber-950/30 dark:via-amber-900/20 dark:to-orange-950/30 p-5 border border-amber-200 dark:border-amber-800 shadow-sm'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 shadow-sm'>
                  <Calendar className='w-5 h-5 text-amber-700 dark:text-amber-400' />
                </div>
                <div>
                  <p className='text-sm font-medium text-amber-900/70 dark:text-amber-200/70'>
                    Total de Ordens
                  </p>
                  <p className='text-3xl font-bold text-amber-900 dark:text-amber-100 mt-0.5'>
                    {totalOrders.toString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de Status - Grid Moderno */}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            {/* Abertas */}
            <div className='group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-blue-50/50 to-blue-100/30 dark:from-blue-950/30 dark:via-blue-900/20 dark:to-blue-950/40 p-4 border border-blue-200/60 dark:border-blue-800/60 shadow-sm hover:shadow-md transition-all duration-200'>
              <div className='flex items-start justify-between mb-3'>
                <div className='flex items-center gap-2.5'>
                  <div className='p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 shadow-sm'>
                    <Clock className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                  </div>
                  <span className='text-sm font-semibold text-blue-900 dark:text-blue-100'>
                    Abertas
                  </span>
                </div>
                <span className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                  {summary.openOrdersCount}
                </span>
              </div>
              <div className='space-y-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/50'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-blue-700/80 dark:text-blue-300/80'>
                    Área Total
                  </span>
                  <span className='text-xs font-semibold text-blue-800 dark:text-blue-200'>
                    {(summary.openOrdersAreaHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-blue-700/80 dark:text-blue-300/80'>
                    Área Aplicada
                  </span>
                  <span className='text-xs font-semibold text-blue-600 dark:text-blue-400'>
                    {(summary.openOrdersAppliedHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
              </div>
            </div>

            {/* Concluídas */}
            <div className='group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-50 via-green-50/50 to-emerald-100/30 dark:from-green-950/30 dark:via-green-900/20 dark:to-emerald-950/40 p-4 border border-green-200/60 dark:border-green-800/60 shadow-sm hover:shadow-md transition-all duration-200'>
              <div className='flex items-start justify-between mb-3'>
                <div className='flex items-center gap-2.5'>
                  <div className='p-2 rounded-lg bg-green-100 dark:bg-green-900/50 shadow-sm'>
                    <CheckCircle className='w-4 h-4 text-green-600 dark:text-green-400' />
                  </div>
                  <span className='text-sm font-semibold text-green-900 dark:text-green-100'>
                    Concluídas
                  </span>
                </div>
                <span className='text-2xl font-bold text-green-600 dark:text-green-400'>
                  {summary.completedOrdersCount}
                </span>
              </div>
              <div className='space-y-2 pt-2 border-t border-green-200/50 dark:border-green-800/50'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-green-700/80 dark:text-green-300/80'>
                    Área Total
                  </span>
                  <span className='text-xs font-semibold text-green-800 dark:text-green-200'>
                    {(summary.completedOrdersAreaHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-green-700/80 dark:text-green-300/80'>
                    Área Aplicada
                  </span>
                  <span className='text-xs font-semibold text-green-600 dark:text-green-400'>
                    {(summary.completedOrdersAppliedHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
              </div>
            </div>

            {/* Canceladas */}
            <div className='group relative overflow-hidden rounded-xl bg-gradient-to-br from-red-50 via-red-50/50 to-rose-100/30 dark:from-red-950/30 dark:via-red-900/20 dark:to-rose-950/40 p-4 border border-red-200/60 dark:border-red-800/60 shadow-sm hover:shadow-md transition-all duration-200'>
              <div className='flex items-start justify-between mb-3'>
                <div className='flex items-center gap-2.5'>
                  <div className='p-2 rounded-lg bg-red-100 dark:bg-red-900/50 shadow-sm'>
                    <XCircle className='w-4 h-4 text-red-600 dark:text-red-400' />
                  </div>
                  <span className='text-sm font-semibold text-red-900 dark:text-red-100'>
                    Canceladas
                  </span>
                </div>
                <span className='text-2xl font-bold text-red-600 dark:text-red-400'>
                  {summary.cancelledOrdersCount}
                </span>
              </div>
              <div className='space-y-2 pt-2 border-t border-red-200/50 dark:border-red-800/50'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-red-700/80 dark:text-red-300/80'>
                    Área Total
                  </span>
                  <span className='text-xs font-semibold text-red-800 dark:text-red-200'>
                    {(summary.cancelledOrdersAreaHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-red-700/80 dark:text-red-300/80'>
                    Área Aplicada
                  </span>
                  <span className='text-xs font-semibold text-red-600 dark:text-red-400'>
                    {(summary.cancelledOrdersAppliedHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas de Média - Cards Modernos */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 shadow-sm'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50'>
                    <TrendingUp className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                  </div>
                  <div>
                    <p className='text-xs font-medium text-muted-foreground'>
                      Média aplicada por dia corrido
                    </p>
                    <p className='text-lg font-bold text-foreground mt-0.5'>
                      {summary.avgDaily.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}{' '}
                      <span className='text-sm font-normal text-muted-foreground'>ha/dia</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className='rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 shadow-sm'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50'>
                    <SprayCan className='w-4 h-4 text-purple-600 dark:text-purple-400' />
                  </div>
                  <div>
                    <p className='text-xs font-medium text-muted-foreground'>
                      Média de hectares por aplicação
                    </p>
                    <p className='text-lg font-bold text-foreground mt-0.5'>
                      {summary.avgHectarebyApplication.toLocaleString('pt-BR', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className='text-sm font-normal text-muted-foreground'>
                        ha/aplicação
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {summary.comparisonLastMonths.length > 0 && (
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6'>
              <Card className='xl:col-span-2 border shadow-sm'>
                <CardHeader>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50'>
                      <Calendar className='w-4 h-4 text-indigo-600 dark:text-indigo-400' />
                    </div>
                    <div>
                      <CardTitle className='text-lg'>Comparação Mensal</CardTitle>
                      <CardDescription className='mt-0.5'>
                        Últimos 3 meses - hectares aplicados
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='p-6 max-h-[330px] w-full'>
                  <ChartContainer
                    config={monthlyChartConfig}
                    className='h-full w-full min-h-[200px]'
                  >
                    <BarChart
                      data={monthlyChartData}
                      layout='vertical'
                      margin={{
                        right: 60,
                        left: 10,
                        top: 10,
                        bottom: 10,
                      }}
                    >
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey='month' type='category' tick={{ fontSize: 12 }} width={80} />
                      <XAxis dataKey='hectares' type='number' tick={{ fontSize: 12 }} hide />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator='line'
                            formatter={(value, name, props) => {
                              if (name === 'hectares') {
                                return [
                                  <div key='hectares' className='space-y-1'>
                                    <div className='font-semibold'>
                                      Total: {Number(value).toFixed(2)} ha
                                    </div>
                                    <div className='text-sm text-muted-foreground'>
                                      {props.payload?.totalApplications} aplicações
                                    </div>
                                    <div className='text-sm text-muted-foreground'>
                                      Média:{' '}
                                      {props.payload?.totalApplications > 0
                                        ? (
                                            props.payload?.hectares /
                                            props.payload?.totalApplications
                                          ).toFixed(2)
                                        : '0.00'}{' '}
                                      ha/aplicação
                                    </div>
                                  </div>,
                                ];
                              }
                              return [value, name];
                            }}
                          />
                        }
                      />
                      <Bar dataKey='hectares' layout='vertical' fill='var(--color-chart-1)'>
                        <LabelList
                          dataKey='hectares'
                          position='right'
                          offset={4}
                          className='fill-foreground'
                          fontSize={11}
                          formatter={(value: number) =>
                            value.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' ha'
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className='col-span-full border shadow-sm'>
                <CardHeader>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 rounded-lg bg-green-100 dark:bg-green-900/50'>
                      <Calendar className='w-4 h-4 text-green-600 dark:text-green-400' />
                    </div>
                    <div>
                      <CardTitle className='text-lg'>Aplicações Diárias</CardTitle>
                      <CardDescription className='mt-0.5'>
                        Evolução das aplicações por dia
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='p-6'>
                  <ChartContainer
                    config={dailyChartConfig}
                    className='h-[250px] sm:h-[300px] lg:h-[350px] w-full'
                  >
                    <AreaChart
                      data={dailyChartData}
                      margin={{
                        left: 5,
                        right: 5,
                        top: 5,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis
                        dataKey='day'
                        tickLine={false}
                        axisLine={false}
                        tickMargin={2}
                        tick={{ fontSize: 10 }}
                        interval='preserveStartEnd'
                        height={30}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={2}
                        tick={{ fontSize: 10 }}
                        width={30}
                      />
                      <ChartTooltip content={<CustomDailyTooltip />} />
                      <Area
                        type='monotone'
                        dataKey='hectares'
                        stroke='var(--color-chart-1)'
                        fill='var(--color-chart-1)'
                        fillOpacity={0.3}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: 'var(--color-chart-1)',
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const SkeletonLoading = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo de Aplicações</CardTitle>
        <CardDescription>Carregando dados...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          <div className='flex items-center justify-between pb-3 border-b border-border'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-16 h-8' />
          </div>
          <div className='space-y-3'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className='rounded-lg p-3 border'>
                <div className='flex items-center justify-between mb-2'>
                  <Skeleton className='w-20 h-4' />
                  <Skeleton className='w-12 h-6' />
                </div>
                <div className='space-y-1 pl-8'>
                  <Skeleton className='w-full h-3' />
                  <Skeleton className='w-full h-3' />
                </div>
              </div>
            ))}
          </div>
          <div className='pt-2 border-t border-border space-y-3'>
            <Skeleton className='w-full h-4' />
            <Skeleton className='w-full h-4' />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className='w-32 h-6' />
              <Skeleton className='w-48 h-4' />
            </CardHeader>
            <CardContent>
              <Skeleton className='w-full h-[300px]' />
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

const SkeletonError = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-red-500'>Erro ao carregar dados</CardTitle>
        <CardDescription>Não foi possível carregar o resumo das aplicações.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='text-center py-8 text-muted-foreground'>
          Tente novamente mais tarde ou verifique as datas selecionadas.
        </div>
      </CardContent>
    </Card>
  );
};
