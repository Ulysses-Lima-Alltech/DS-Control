'use client';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { TrendingUp, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetApplicationsPerformance } from '@/queries/application.query';

interface TooltipPayloadEntry {
  color: string;
  dataKey: string;
  value: number;
  payload?: Record<string, unknown>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

const CustomAreaTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const sortedData = payload
    .filter((entry: TooltipPayloadEntry) => entry.value > 0)
    .sort((a: TooltipPayloadEntry, b: TooltipPayloadEntry) => b.value - a.value);

  const totalHectares = sortedData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className='rounded-lg border bg-background p-2 shadow-sm'>
      <div className='grid gap-2'>
        <div className='flex flex-col'>
          <span className='text-[0.70rem] uppercase text-muted-foreground'>{label}</span>
          <div className='flex items-center justify-between mt-1'>
            <span className='text-sm font-semibold'>Total:</span>
            <span className='text-sm font-semibold text-primary'>
              {totalHectares.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha
            </span>
          </div>
        </div>
        {sortedData.length > 0 ? (
          <div className='grid gap-1'>
            {sortedData.map((entry: TooltipPayloadEntry, index: number) => (
              <div key={`${entry.dataKey}-${index}`} className='flex items-center gap-2'>
                <div
                  className='h-2.5 w-2.5 shrink-0 rounded-[2px]'
                  style={{ backgroundColor: entry.color }}
                />
                <span className='text-sm font-medium'>{entry.dataKey}:</span>
                <span className='text-sm text-muted-foreground'>
                  {entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-sm text-muted-foreground italic'>Nenhuma aplicação neste dia</div>
        )}
      </div>
    </div>
  );
};

interface SectionPilotsPerformanceProps {
  dateParams: {
    startDate: string;
    endDate: string;
  };
}

export const SectionPilotsPerformance = ({ dateParams }: SectionPilotsPerformanceProps) => {
  const { startDate, endDate } = dateParams;

  const queryParams = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [startDate, endDate]
  );

  const {
    data: performanceData,
    isPending: isLoadingPerformance,
    isError: isErrorOnPerformance,
  } = useGetApplicationsPerformance(queryParams);

  const pilotApplicationsData = useMemo(() => {
    if (!performanceData?.pilots?.comparelaLastMonth) return [];
    const pilotTotals = performanceData.pilots.comparelaLastMonth.reduce(
      (acc, item) => {
        acc[item.pilotName] = (acc[item.pilotName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(pilotTotals)
      .map(([name, hectares]) => ({
        pilotName: name.split(' ')[0],
        fullName: name,
        hectares,
      }))
      .sort((a, b) => b.hectares - a.hectares);
  }, [performanceData?.pilots?.comparelaLastMonth]);

  const pilotDailyData = useMemo(() => {
    if (!performanceData?.pilots?.comparelaLastMonth) return [];

    const pilotData = performanceData.pilots.comparelaLastMonth.reduce(
      (acc, item) => {
        if (!acc[item.pilotName]) {
          acc[item.pilotName] = {
            totalHectares: 0,
            workingDays: new Set(),
          };
        }
        acc[item.pilotName].totalHectares += item.hectares;
        acc[item.pilotName].workingDays.add(item.day);
        return acc;
      },
      {} as Record<string, { totalHectares: number; workingDays: Set<string> }>
    );

    return Object.entries(pilotData)
      .map(([name, data]) => ({
        pilotName: name.split(' ')[0],
        fullName: name,
        dailyAvg: Number((data.totalHectares / data.workingDays.size).toFixed(2)),
      }))
      .sort((a, b) => b.dailyAvg - a.dailyAvg);
  }, [performanceData?.pilots?.comparelaLastMonth]);

  const dailyStackedData = useMemo(() => {
    if (!performanceData?.pilots?.comparelaLastMonth) return [];

    const pilotTotals = performanceData.pilots.comparelaLastMonth.reduce(
      (acc, item) => {
        acc[item.pilotName] = (acc[item.pilotName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    const allPilots = Object.entries(pilotTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);

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

      const dayData: { [key: string]: string | number } = {
        day: format(date, 'dd/MM', { locale: pt }),
        fullDate: dateString,
      };

      allPilots.forEach((pilot) => {
        const pilotData = performanceData.pilots.comparelaLastMonth.find(
          (item) => item.pilotName === pilot && item.day === dateString
        );
        const shortName = pilot.split(' ')[0];
        const hectares = pilotData?.hectares || 0;
        dayData[shortName] = hectares;
      });

      allDays.push(dayData);
    }

    return allDays;
  }, [performanceData?.pilots?.comparelaLastMonth, startDate, endDate]);

  const dailyStackedChartConfig = useMemo(() => {
    if (!performanceData?.pilots?.comparelaLastMonth) return {} as ChartConfig;

    const pilotTotals = performanceData.pilots.comparelaLastMonth.reduce(
      (acc, item) => {
        acc[item.pilotName] = (acc[item.pilotName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    const allPilots = Object.entries(pilotTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name.split(' ')[0]);

    const amberColors = [
      'hsl(45 93% 47%)',
      'hsl(43 96% 56%)',
      'hsl(38 92% 50%)',
      'hsl(32 95% 44%)',
      'hsl(26 90% 37%)',
      'hsl(22 82% 31%)',
      'hsl(48 96% 89%)',
      'hsl(48 97% 77%)',
      'hsl(45 97% 64%)',
    ];

    return allPilots.reduce((config, name, index) => {
      config[name] = {
        label: name,
        color: amberColors[index % amberColors.length],
      };
      return config;
    }, {} as ChartConfig);
  }, [performanceData?.pilots?.comparelaLastMonth]);

  if (isLoadingPerformance) {
    return <SkeletonLoading />;
  }

  if (isErrorOnPerformance || !performanceData?.pilots) {
    return <SkeletonError />;
  }

  const { pilots } = performanceData;

  const horizontalChartConfig = {
    hectares: {
      label: 'Hectares',
      color: 'hsl(45 93% 47%)',
    },
  } satisfies ChartConfig;

  const verticalChartConfig = {
    dailyAvg: {
      label: 'Média ha/dia trabalhado',
      color: 'hsl(43 96% 56%)',
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Users className='w-5 h-5 text-blue-500' />
          Desempenho dos Pilotos
        </CardTitle>
        <CardDescription>Análise de performance e produtividade dos pilotos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
          <div className='text-center p-4 border rounded-lg'>
            <div className='text-2xl font-bold text-blue-600'>
              {pilots.avgHectaresByPilot.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            </div>
            <div className='text-sm text-muted-foreground'>Média hectares/piloto</div>
          </div>
          <div className='text-center p-4 border rounded-lg'>
            <div className='text-2xl font-bold text-green-600'>
              {pilots.avgDailyByPilot.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </div>
            <div className='text-sm text-muted-foreground'>Média diária/piloto</div>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Hectares por Piloto</CardTitle>
              <CardDescription>Todos os pilotos por área aplicada</CardDescription>
            </CardHeader>
            <CardContent className='max-h-[330px]'>
              <ChartContainer config={horizontalChartConfig} className='h-full w-full'>
                <BarChart
                  data={pilotApplicationsData}
                  layout='vertical'
                  margin={{ right: 40 }}
                  barSize={28}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey='pilotName' type='category' hide />
                  <XAxis dataKey='hectares' type='number' hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator='line' />} />
                  <Bar dataKey='hectares' layout='vertical' fill='var(--color-hectares)'>
                    <LabelList
                      dataKey='pilotName'
                      position='insideLeft'
                      offset={8}
                      className='fill-background'
                      fontSize={11}
                    />
                    <LabelList
                      dataKey='hectares'
                      position='right'
                      offset={4}
                      className='fill-foreground'
                      fontSize={11}
                      formatter={(value: number) =>
                        value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ha'
                      }
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Média Diária por Piloto</CardTitle>
              <CardDescription>Hectares médios por dia trabalhado dos pilotos</CardDescription>
            </CardHeader>
            <CardContent className='max-h-[330px]'>
              <ChartContainer config={verticalChartConfig} className='h-full w-full'>
                <BarChart data={pilotDailyData} margin={{ top: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey='pilotName'
                    tickLine={false}
                    axisLine={false}
                    className='text-xs'
                  />
                  <YAxis hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Bar dataKey='dailyAvg' fill='var(--color-dailyAvg)' radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey='dailyAvg'
                      position='top'
                      className='fill-foreground'
                      fontSize={11}
                      formatter={(value: number) =>
                        value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ha'
                      }
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className='col-span-full'>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <TrendingUp className='w-4 h-4 text-blue-500' />
                Hectares por Dia
              </CardTitle>
              <CardDescription>
                Todos os pilotos - evolução diária de hectares aplicados
              </CardDescription>
            </CardHeader>
            <CardContent className='max-h-[330px]'>
              <ChartContainer config={dailyStackedChartConfig} className='h-full w-full'>
                <BarChart data={dailyStackedData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey='day'
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    interval='equidistantPreserveStart'
                    height={80}
                    textAnchor='end'
                    fontSize={10}
                  />
                  <ChartTooltip content={<CustomAreaTooltip />} />
                  {Object.keys(dailyStackedChartConfig).map((pilotName, index) => {
                    const amberColors = [
                      'hsl(45 93% 47%)',
                      'hsl(43 96% 56%)',
                      'hsl(38 92% 50%)',
                      'hsl(32 95% 44%)',
                      'hsl(26 90% 37%)',
                      'hsl(22 82% 31%)',
                      'hsl(48 96% 89%)',
                      'hsl(48 97% 77%)',
                      'hsl(45 97% 64%)',
                    ];
                    const totalPilots = Object.keys(dailyStackedChartConfig).length;
                    return (
                      <Bar
                        key={pilotName}
                        dataKey={pilotName}
                        stackId='a'
                        fill={amberColors[index % amberColors.length]}
                        radius={
                          index === totalPilots - 1
                            ? [4, 4, 0, 0]
                            : index === 0
                              ? [0, 0, 4, 4]
                              : [0, 0, 0, 0]
                        }
                      />
                    );
                  })}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

const SkeletonLoading = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Users className='w-5 h-5 text-blue-500' />
          Desempenho dos Pilotos
        </CardTitle>
        <CardDescription>Carregando dados...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
          <div className='text-center p-4 border rounded-lg'>
            <Skeleton className='w-16 h-8 mx-auto mb-2' />
            <Skeleton className='w-32 h-4 mx-auto' />
          </div>
          <div className='text-center p-4 border rounded-lg'>
            <Skeleton className='w-16 h-8 mx-auto mb-2' />
            <Skeleton className='w-24 h-4 mx-auto' />
          </div>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className='w-40 h-6' />
                <Skeleton className='w-56 h-4' />
              </CardHeader>
              <CardContent>
                <Skeleton className='w-full h-[300px]' />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const SkeletonError = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-red-500 flex items-center gap-2'>
          <Users className='w-5 h-5' />
          Erro ao carregar dados
        </CardTitle>
        <CardDescription>Não foi possível carregar o desempenho dos pilotos.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='text-center py-8 text-muted-foreground'>
          Tente novamente mais tarde ou verifique as datas selecionadas.
        </div>
      </CardContent>
    </Card>
  );
};
