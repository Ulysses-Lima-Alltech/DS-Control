'use client';

import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Leaf, TrendingUp } from 'lucide-react';
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
import { useGetCultureTypesStats } from '@/queries/culture-type.query';

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
          <div className='text-sm text-muted-foreground italic'>Nenhuma aplicação neste dia</div>
        )}
      </div>
    </div>
  );
};

interface SectionCultureTypesStatsProps {
  dateParams: {
    startDate: string;
    endDate: string;
  };
}

export const SectionCultureTypesStats = ({ dateParams }: SectionCultureTypesStatsProps) => {
  const { startDate, endDate } = dateParams;

  const queryParams = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [startDate, endDate]
  );

  const {
    data: statsData,
    isPending: isLoadingStats,
    isError: isErrorOnStats,
  } = useGetCultureTypesStats(queryParams);

  const cultureHectaresData = useMemo(() => {
    if (!statsData?.statsCulture?.compareLastMonth) return [];
    const cultureTotals = statsData.statsCulture.compareLastMonth.reduce(
      (acc, item) => {
        acc[item.cultureTypeName] = (acc[item.cultureTypeName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(cultureTotals)
      .map(([name, hectares]) => ({
        cultureName: name.length > 25 ? name.substring(0, 25) + '...' : name,
        fullName: name,
        hectares,
      }))
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 8);
  }, [statsData?.statsCulture?.compareLastMonth]);

  const cultureDailyData = useMemo(() => {
    if (!statsData?.statsCulture?.compareLastMonth) return [];

    const cultureData = statsData.statsCulture.compareLastMonth.reduce(
      (acc, item) => {
        if (!acc[item.cultureTypeName]) {
          acc[item.cultureTypeName] = {
            totalHectares: 0,
            workingDays: new Set(),
          };
        }
        acc[item.cultureTypeName].totalHectares += item.hectares;
        acc[item.cultureTypeName].workingDays.add(item.day);
        return acc;
      },
      {} as Record<string, { totalHectares: number; workingDays: Set<string> }>
    );

    return Object.entries(cultureData)
      .map(([name, data]) => ({
        cultureName: name.length > 15 ? name.substring(0, 15) + '...' : name,
        fullName: name,
        dailyAvg: Number((data.totalHectares / data.workingDays.size).toFixed(2)),
      }))
      .sort((a, b) => b.dailyAvg - a.dailyAvg)
      .slice(0, 6);
  }, [statsData?.statsCulture?.compareLastMonth]);

  const dailyStackedData = useMemo(() => {
    if (!statsData?.statsCulture?.compareLastMonth) return [];

    const cultureTotals = statsData.statsCulture.compareLastMonth.reduce(
      (acc, item) => {
        acc[item.cultureTypeName] = (acc[item.cultureTypeName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    const allCultures = Object.entries(cultureTotals)
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

      allCultures.forEach((culture) => {
        const cultureData = statsData.statsCulture.compareLastMonth.find(
          (item) => item.cultureTypeName === culture && item.day === dateString
        );
        const shortName = culture.length > 15 ? culture.substring(0, 15) + '...' : culture;
        const hectares = cultureData?.hectares || 0;
        dayData[shortName] = hectares;
      });

      allDays.push(dayData);
    }

    return allDays;
  }, [statsData?.statsCulture?.compareLastMonth, startDate, endDate]);

  const dailyAllCultureNames = useMemo(() => {
    if (!statsData?.statsCulture?.compareLastMonth) return [];
    const cultureTotals = statsData.statsCulture.compareLastMonth.reduce(
      (acc, item) => {
        acc[item.cultureTypeName] = (acc[item.cultureTypeName] || 0) + item.hectares;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(cultureTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => (name.length > 15 ? name.substring(0, 15) + '...' : name));
  }, [statsData?.statsCulture?.compareLastMonth]);

  const dailyStackedChartConfig = useMemo(() => {
    if (!statsData?.statsCulture?.compareLastMonth) return {} as ChartConfig;
    const allCultures = [
      ...new Set(statsData.statsCulture.compareLastMonth.map((item) => item.cultureTypeName)),
    ];

    const emeraldColors = [
      'hsl(158 64% 52%)',
      'hsl(160 84% 39%)',
      'hsl(161 94% 30%)',
      'hsl(162 85% 25%)',
      'hsl(164 86% 20%)',
      'hsl(166 76% 37%)',
      'hsl(152 81% 96%)',
      'hsl(149 80% 90%)',
      'hsl(152 76% 80%)',
    ];

    return allCultures.reduce((config, name, index) => {
      const shortName = name.length > 15 ? name.substring(0, 15) + '...' : name;
      const colorIndex = index % emeraldColors.length;
      config[shortName] = {
        label: shortName,
        color: emeraldColors[colorIndex],
      };
      return config;
    }, {} as ChartConfig);
  }, [statsData?.statsCulture?.compareLastMonth]);

  const cultureIndividualAverages = useMemo(() => {
    if (!statsData?.statsCulture?.compareLastMonth) return [];

    const cultureData = statsData.statsCulture.compareLastMonth.reduce(
      (acc, item) => {
        if (!acc[item.cultureTypeName]) {
          acc[item.cultureTypeName] = {
            totalHectares: 0,
            totalApplications: 0,
            workingDays: new Set(),
          };
        }
        acc[item.cultureTypeName].totalHectares += item.hectares;
        acc[item.cultureTypeName].totalApplications += item.applications;
        acc[item.cultureTypeName].workingDays.add(item.day);
        return acc;
      },
      {} as Record<
        string,
        { totalHectares: number; totalApplications: number; workingDays: Set<string> }
      >
    );

    return Object.entries(cultureData)
      .map(([name, data]) => ({
        cultureName: name,
        totalHectares: data.totalHectares,
        avgHectaresPerApplication:
          data.totalApplications > 0
            ? Number((data.totalHectares / data.totalApplications).toFixed(2))
            : 0,
        avgDaily:
          data.workingDays.size > 0
            ? Number((data.totalHectares / data.workingDays.size).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.totalHectares - a.totalHectares);
  }, [statsData?.statsCulture?.compareLastMonth]);

  if (isLoadingStats) {
    return <SkeletonLoading />;
  }

  if (isErrorOnStats || !statsData?.statsCulture) {
    return <SkeletonError />;
  }

  const horizontalChartConfig = {
    hectares: {
      label: 'Hectares',
      color: 'hsl(158 64% 52%)',
    },
  } satisfies ChartConfig;

  const verticalChartConfig = {
    dailyAvg: {
      label: 'Média ha/dia',
      color: 'hsl(160 84% 39%)',
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Leaf className='w-5 h-5 text-emerald-500' />
          Estatísticas por Tipo de Cultura
        </CardTitle>
        <CardDescription>Análise de performance por tipo de cultura</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <TrendingUp className='w-4 h-4 text-emerald-500' />
                Médias por Tipo de Cultura
              </CardTitle>
              <CardDescription>
                Média individual de hectares e diária por cada tipo de cultura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-left py-3 px-4 font-semibold text-sm'>Cultura</th>
                      <th className='text-right py-3 px-4 font-semibold text-sm'>Total (ha)</th>
                      <th className='text-right py-3 px-4 font-semibold text-sm'>
                        Média ha/aplicação
                      </th>
                      <th className='text-right py-3 px-4 font-semibold text-sm'>Média ha/dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cultureIndividualAverages.length > 0 ? (
                      cultureIndividualAverages.map((culture, index) => (
                        <tr
                          key={culture.cultureName}
                          className={`border-b hover:bg-muted/50 transition-colors ${
                            index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                          }`}
                        >
                          <td className='py-3 px-4 font-medium'>{culture.cultureName}</td>
                          <td className='py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400'>
                            {culture.totalHectares.toLocaleString('pt-BR', {
                              maximumFractionDigits: 2,
                            })}{' '}
                            ha
                          </td>
                          <td className='py-3 px-4 text-right text-muted-foreground'>
                            {culture.avgHectaresPerApplication.toLocaleString('pt-BR', {
                              maximumFractionDigits: 2,
                            })}{' '}
                            ha
                          </td>
                          <td className='py-3 px-4 text-right text-muted-foreground'>
                            {culture.avgDaily.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}{' '}
                            ha
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className='py-8 text-center text-muted-foreground'>
                          Nenhuma cultura encontrada no período selecionado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Hectares por Cultura</CardTitle>
                <CardDescription>Todos os tipos de cultura por área aplicada</CardDescription>
              </CardHeader>
              <CardContent className='max-h-[330px]'>
                <ChartContainer config={horizontalChartConfig} className='h-full w-full'>
                  <BarChart
                    data={cultureHectaresData}
                    layout='vertical'
                    margin={{ right: 40 }}
                    barSize={28}
                  >
                    <CartesianGrid horizontal={false} />
                    <YAxis dataKey='cultureName' type='category' hide />
                    <XAxis dataKey='hectares' type='number' hide />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator='line' />}
                    />
                    <Bar dataKey='hectares' layout='vertical' fill='var(--color-hectares)'>
                      <LabelList
                        dataKey='cultureName'
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
                <CardDescription>
                  Hectares médios por dia trabalhado dos tipos de cultura
                </CardDescription>
              </CardHeader>
              <CardContent className='max-h-[330px]'>
                <ChartContainer config={verticalChartConfig} className='h-full w-full'>
                  <BarChart data={cultureDailyData} margin={{ top: 20 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey='cultureName'
                      tickLine={false}
                      axisLine={false}
                      className='text-xs'
                    />
                    <YAxis hide />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator='line' />}
                    />
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
                  <TrendingUp className='w-4 h-4 text-emerald-500' />
                  Hectares por Dia
                </CardTitle>
                <CardDescription>
                  Todos os tipos de cultura - evolução diária de hectares aplicados
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
                    {dailyAllCultureNames.map((cultureName, index) => {
                      const emeraldColors = [
                        'hsl(158 64% 52%)',
                        'hsl(160 84% 39%)',
                        'hsl(161 94% 30%)',
                        'hsl(162 85% 25%)',
                        'hsl(164 86% 20%)',
                        'hsl(166 76% 37%)',
                        'hsl(152 81% 96%)',
                        'hsl(149 80% 90%)',
                        'hsl(152 76% 80%)',
                      ];
                      const totalCultures = dailyAllCultureNames.length;
                      return (
                        <Bar
                          key={cultureName}
                          dataKey={cultureName}
                          stackId='a'
                          fill={emeraldColors[index % emeraldColors.length]}
                          radius={
                            index === totalCultures - 1
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
          <Leaf className='w-5 h-5 text-emerald-500' />
          Estatísticas por Tipo de Cultura
        </CardTitle>
        <CardDescription>Carregando dados...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <Skeleton className='w-48 h-6' />
              <Skeleton className='w-64 h-4 mt-2' />
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className='w-full h-12' />
                ))}
              </div>
            </CardContent>
          </Card>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6'>
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
          <Leaf className='w-5 h-5' />
          Erro ao carregar dados
        </CardTitle>
        <CardDescription>
          Não foi possível carregar as estatísticas dos tipos de cultura.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='text-center py-8 text-muted-foreground'>
          Tente novamente mais tarde ou verifique as datas selecionadas.
        </div>
      </CardContent>
    </Card>
  );
};
