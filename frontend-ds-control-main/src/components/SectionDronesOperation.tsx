'use client';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Drone, TrendingUp } from 'lucide-react';
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
import { useGetDronesOperation } from '@/queries/drone.query';

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

const CustomStackedTooltip = ({ active, payload, label }: CustomTooltipProps) => {
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
              {totalHectares.toFixed(2)} ha
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
                <span className='text-sm text-muted-foreground'>{entry.value.toFixed(2)} ha</span>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-sm text-muted-foreground italic'>Nenhuma aplicação neste mês</div>
        )}
      </div>
    </div>
  );
};

interface SectionDronesOperationProps {
  dateParams: {
    startDate: string;
    endDate: string;
  };
}

export const SectionDronesOperation = ({ dateParams }: SectionDronesOperationProps) => {
  const { startDate, endDate } = dateParams;

  const queryParams = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [startDate, endDate]
  );

  const {
    data: operationData,
    isPending: isLoadingOperation,
    isError: isErrorOnOperation,
  } = useGetDronesOperation(queryParams);

  const droneHectaresData = useMemo(() => {
    if (!operationData?.operation?.compareLastMonth) return [];
    const droneTotals = operationData.operation.compareLastMonth.reduce(
      (acc, item) => {
        acc[item.droneName] = (acc[item.droneName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(droneTotals)
      .map(([name, hectares]) => ({
        droneName: name.length > 25 ? name.substring(0, 25) + '...' : name,
        fullName: name,
        hectares,
      }))
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 8);
  }, [operationData?.operation?.compareLastMonth]);

  const droneDailyData = useMemo(() => {
    if (!operationData?.operation?.compareLastMonth) return [];

    const droneData = operationData.operation.compareLastMonth.reduce(
      (acc, item) => {
        if (!acc[item.droneName]) {
          acc[item.droneName] = {
            totalHectares: 0,
            workingDays: new Set(),
          };
        }
        acc[item.droneName].totalHectares += item.hectares;
        acc[item.droneName].workingDays.add(item.day);
        return acc;
      },
      {} as Record<string, { totalHectares: number; workingDays: Set<string> }>
    );

    return Object.entries(droneData)
      .map(([name, data]) => ({
        droneName: name.trim(),
        fullName: name,
        dailyAvg: Number((data.totalHectares / data.workingDays.size).toFixed(2)),
      }))
      .sort((a, b) => b.dailyAvg - a.dailyAvg)
      .slice(0, 6);
  }, [operationData?.operation?.compareLastMonth]);

  const dailyStackedData = useMemo(() => {
    if (!operationData?.operation?.compareLastMonth) return [];

    const droneTotals = operationData.operation.compareLastMonth.reduce(
      (acc, item) => {
        acc[item.droneName] = (acc[item.droneName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    const allDrones = Object.entries(droneTotals)
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

      allDrones.forEach((drone) => {
        const droneData = operationData.operation.compareLastMonth.find(
          (item) => item.droneName === drone && item.day === dateString
        );
        const shortName = drone.trim();
        const hectares = droneData?.hectares || 0;
        dayData[shortName] = hectares;
      });

      allDays.push(dayData);
    }

    return allDays;
  }, [operationData?.operation?.compareLastMonth, startDate, endDate]);

  const dailyAllDroneNames = useMemo(() => {
    if (!operationData?.operation?.compareLastMonth) return [];
    const droneTotals = operationData.operation.compareLastMonth.reduce(
      (acc, item) => {
        acc[item.droneName] = (acc[item.droneName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(droneTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name.trim());
  }, [operationData?.operation?.compareLastMonth]);

  const dailyStackedChartConfig = useMemo(() => {
    if (!operationData?.operation?.compareLastMonth) return {} as ChartConfig;
    const allDrones = [
      ...new Set(operationData.operation.compareLastMonth.map((item) => item.droneName)),
    ];

    const tealColors = [
      'hsl(173 58% 39%)',
      'hsl(175 60% 50%)',
      'hsl(176 63% 42%)',
      'hsl(178 65% 35%)',
      'hsl(180 67% 28%)',
      'hsl(174 60% 21%)',
      'hsl(166 70% 85%)',
      'hsl(168 72% 70%)',
      'hsl(170 74% 55%)',
    ];

    return allDrones.reduce((config, name, index) => {
      const shortName = name.trim();
      const colorIndex = index % tealColors.length;
      config[shortName] = {
        label: shortName,
        color: tealColors[colorIndex],
      };
      return config;
    }, {} as ChartConfig);
  }, [operationData?.operation?.compareLastMonth]);

  if (isLoadingOperation) {
    return <SkeletonLoading />;
  }

  if (isErrorOnOperation || !operationData?.operation) {
    return <SkeletonError />;
  }

  const { operation } = operationData;

  const horizontalChartConfig = {
    hectares: {
      label: 'Hectares',
      color: 'hsl(173 58% 39%)',
    },
  } satisfies ChartConfig;

  const verticalChartConfig = {
    dailyAvg: {
      label: 'Média ha/dia',
      color: 'hsl(175 60% 50%)',
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Drone className='w-5 h-5 text-teal-500' />
          Operação dos Drones
        </CardTitle>
        <CardDescription>Análise de performance e produtividade dos drones</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
          <div className='text-center p-4 border rounded-lg'>
            <div className='text-2xl font-bold text-teal-600'>
              {operation.avgHectareByDrones.toFixed(2)}
            </div>
            <div className='text-sm text-muted-foreground'>Média hectares/drone</div>
          </div>
          <div className='text-center p-4 border rounded-lg'>
            <div className='text-2xl font-bold text-green-600'>
              {operation.avgDailyByDrones.toFixed(2)}
            </div>
            <div className='text-sm text-muted-foreground'>Média diária/drone</div>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Hectares por Drone</CardTitle>
              <CardDescription>Todos os drones por área aplicada</CardDescription>
            </CardHeader>
            <CardContent className='max-h-[330px]'>
              <ChartContainer config={horizontalChartConfig} className='h-full w-full'>
                <BarChart
                  data={droneHectaresData}
                  layout='vertical'
                  margin={{ right: 40 }}
                  barSize={28}
                >
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey='droneName' type='category' hide />
                  <XAxis dataKey='hectares' type='number' hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator='line' />} />
                  <Bar dataKey='hectares' layout='vertical' fill='var(--color-hectares)'>
                    <LabelList
                      dataKey='droneName'
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
                      formatter={(value: number) => value.toFixed(1) + ' ha'}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Média Diária</CardTitle>
              <CardDescription>Hectares médios por dia trabalhado dos drones</CardDescription>
            </CardHeader>
            <CardContent className='max-h-[330px]'>
              <ChartContainer config={verticalChartConfig} className='h-full w-full'>
                <BarChart data={droneDailyData} margin={{ top: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey='droneName'
                    tickLine={false}
                    axisLine={false}
                    className='text-xs'
                  />
                  <YAxis hide />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator='line' />} />
                  <Bar dataKey='dailyAvg' fill='var(--color-dailyAvg)' radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey='dailyAvg'
                      position='top'
                      className='fill-foreground'
                      fontSize={11}
                      formatter={(value: number) => value.toFixed(1) + ' ha'}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className='col-span-full'>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <TrendingUp className='w-4 h-4 text-teal-500' />
                Hectares por Dia
              </CardTitle>
              <CardDescription>
                Todos os drones - evolução diária de hectares aplicados
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
                  <ChartTooltip content={<CustomStackedTooltip />} />
                  {dailyAllDroneNames.map((droneName, index) => {
                    const tealColors = [
                      'hsl(173 58% 39%)',
                      'hsl(175 60% 50%)',
                      'hsl(176 63% 42%)',
                      'hsl(178 65% 35%)',
                      'hsl(180 67% 28%)',
                      'hsl(174 60% 21%)',
                      'hsl(166 70% 85%)',
                      'hsl(168 72% 70%)',
                      'hsl(170 74% 55%)',
                    ];
                    const totalDrones = dailyAllDroneNames.length;
                    return (
                      <Bar
                        key={droneName}
                        dataKey={droneName}
                        stackId='a'
                        fill={tealColors[index % tealColors.length]}
                        radius={
                          index === totalDrones - 1
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
          <Drone className='w-5 h-5 text-teal-500' />
          Operação dos Drones
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
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className='w-32 h-5' />
                <Skeleton className='w-24 h-3' />
              </CardHeader>
              <CardContent>
                <Skeleton className='w-full h-[250px]' />
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
          <Drone className='w-5 h-5' />
          Erro ao carregar dados
        </CardTitle>
        <CardDescription>Não foi possível carregar a operação dos drones.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='text-center py-8 text-muted-foreground'>
          Tente novamente mais tarde ou verifique as datas selecionadas.
        </div>
      </CardContent>
    </Card>
  );
};
