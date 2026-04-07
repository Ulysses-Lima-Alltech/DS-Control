'use client';

import { format, subDays } from 'date-fns';
import { AlertCircle, AlertTriangle, Info, Leaf, Map, RefreshCw, SprayCan, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGetApplicationsEvolution,
  useGetApplicationsTopFarms,
  useGetStatsApplications,
} from '@/queries/application.query';
import { ServiceOrderStatus } from '@/types/service-order.type';

type OverviewFilters = {
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
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

function hasActiveOverviewFilters(f: OverviewFilters): boolean {
  return Boolean(
    (f.search && f.search.trim().length > 0) ||
      f.startDate ||
      f.endDate ||
      f.farmId ||
      f.pilotId ||
      f.customerId ||
      f.serviceOrderId ||
      f.serviceOrderStatus ||
      f.invalidApplication === true
  );
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

export function ApplicationsOverviewDashboard(filters: OverviewFilters) {
  const effectiveDateRange = useMemo(() => {
    const endDate = filters.endDate || format(new Date(), 'yyyy-MM-dd');
    const startDate = filters.startDate || format(subDays(new Date(), 90), 'yyyy-MM-dd');
    return { startDate, endDate };
  }, [filters.endDate, filters.startDate]);

  const filtersActive = useMemo(() => hasActiveOverviewFilters(filters), [filters]);

  const statsQuery = useGetStatsApplications(filters);
  const evolutionQuery = useGetApplicationsEvolution({ ...filters, ...effectiveDateRange, months: 6 });
  const topFarmsQuery = useGetApplicationsTopFarms({ ...filters, limit: 5 });

  const stats = statsQuery.data?.stats;
  const totalApplications = stats?.applicationCount ?? 0;
  const totalAreaHectares = stats?.totalAreaHectares ?? 0;
  const avgHectaresPerApplication = stats?.averageApplicationArea ?? 0;
  const looseCount = stats?.pendingApplicationsCount ?? 0;
  const loosePercent = totalApplications > 0 ? (looseCount / totalApplications) * 100 : 0;

  const evolutionData = (evolutionQuery.data?.evolution || []).map((item) => ({
    month: item.yearMonth.slice(5),
    applications: item.applicationsCount,
  }));

  const productData = [...(stats?.typeOfProducts || [])]
    .sort((a, b) => b.hectares - a.hectares)
    .slice(0, 5)
    .map((item) => ({ name: item.product, hectares: item.hectares }));

  const topFarms = (topFarmsQuery.data?.topFarms || []).map((farm) => ({
    name: farm.farmName,
    hectares: farm.totalAreaHectares,
  }));

  const hasNoAlerts =
    (stats?.pendingApplicationsCount || 0) === 0 &&
    (stats?.pendingApplicationsTotalArea || 0) === 0 &&
    (stats?.pendingFarmsCount || 0) === 0 &&
    (stats?.pendingPlotsCount || 0) === 0 &&
    (stats?.invalidApplication || 0) === 0;

  const emptyChartHint = filtersActive
    ? 'Com os filtros atuais não há pontos neste gráfico. Amplie o período ou revise os filtros na aba Registros.'
    : 'Não há registros no período considerado para montar este gráfico.';

  return (
    <div className='space-y-5'>
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
              title='Total de aplicações'
              value={formatNumber(totalApplications)}
              subtitle='Registros no recorte atual'
              icon={SprayCan}
            />
            <KpiCard
              title='Área total aplicada'
              value={formatNumber(totalAreaHectares)}
              unit='ha'
              subtitle='Soma de hectares aplicados'
              icon={Leaf}
            />
            <KpiCard
              title='Média por aplicação'
              value={formatNumber(avgHectaresPerApplication)}
              unit='ha/aplic.'
              subtitle='Eficiência média por registro'
              icon={TrendingUp}
            />
            <KpiCard
              title='Aplicações avulsas'
              value={formatNumber(looseCount)}
              subtitle={`${formatNumber(loosePercent, '%')} do total`}
              icon={AlertTriangle}
              tone='warning'
            />
          </div>
        </>
      ) : null}

      {/* Evolução */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Evolução temporal de aplicações</CardTitle>
          <CardDescription>Últimos meses com consolidação mensal (quantidade)</CardDescription>
        </CardHeader>
        <CardContent className='min-h-[288px] h-72 pt-1'>
          {evolutionQuery.isPending ? (
            <Skeleton className='h-full w-full min-h-[260px] rounded-md' />
          ) : evolutionQuery.isError ? (
            <SectionError
              compact
              title='Evolução indisponível'
              description={
                evolutionQuery.error?.message ||
                'Não foi possível carregar a série temporal. Tente novamente em instantes.'
              }
              onRetry={() => evolutionQuery.refetch()}
            />
          ) : evolutionData.length === 0 ? (
            <ChartEmptyState
              title='Sem dados de evolução para exibir.'
              hint={emptyChartHint}
            />
          ) : (
            <ChartContainer config={{ applications: { label: 'Aplicações', color: 'var(--chart-1)' } }}>
              <LineChart data={evolutionData} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <XAxis dataKey='month' tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickFormatter={(value) => formatCompact(Number(value))} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} aplicações`, '']}
                    />
                  }
                />
                <Line
                  type='monotone'
                  dataKey='applications'
                  stroke='var(--color-applications)'
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
        {/* Produtos — depende de stats */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Distribuição por produto</CardTitle>
            <CardDescription>Comparativo de área aplicada (top 5)</CardDescription>
          </CardHeader>
          <CardContent className='min-h-[256px] h-64 pt-1'>
            {statsQuery.isPending ? (
              <Skeleton className='h-full w-full min-h-[220px] rounded-md' />
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
              <ChartEmptyState
                title='Sem dados de produto para o período.'
                hint={emptyChartHint}
              />
            ) : (
              <ChartContainer config={{ hectares: { label: 'Hectares', color: 'var(--chart-2)' } }}>
                <BarChart data={productData} layout='vertical' margin={{ left: 6, right: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type='number'
                    tickFormatter={(value) => `${formatCompact(Number(value))} ha`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    dataKey='name'
                    type='category'
                    width={120}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [`${formatNumber(Number(value), ' ha')}`, 'Área']}
                      />
                    }
                  />
                  <Bar dataKey='hectares' fill='var(--color-hectares)' radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Top fazendas */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Top 5 fazendas por área</CardTitle>
            <CardDescription>Ranking operacional de aplicação no período</CardDescription>
          </CardHeader>
          <CardContent className='min-h-[256px] h-64 pt-1'>
            {topFarmsQuery.isPending ? (
              <Skeleton className='h-full w-full min-h-[220px] rounded-md' />
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
              <ChartEmptyState
                title='Sem dados de fazendas para exibir.'
                hint={emptyChartHint}
              />
            ) : (
              <ChartContainer config={{ hectares: { label: 'Hectares', color: 'var(--chart-3)' } }}>
                <BarChart data={topFarms} layout='vertical' margin={{ left: 6, right: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type='number'
                    tickFormatter={(value) => `${formatCompact(Number(value))} ha`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    dataKey='name'
                    type='category'
                    width={120}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [`${formatNumber(Number(value), ' ha')}`, 'Área']}
                      />
                    }
                  />
                  <Bar dataKey='hectares' fill='var(--color-hectares)' radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
              <AlertRow
                label='Inconsistências'
                value={formatNumber(stats.invalidApplication)}
                tone={(stats.invalidApplication || 0) > 0 ? 'danger' : 'neutral'}
              />
            </div>
          </CardContent>
        </Card>
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
  icon: typeof SprayCan;
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
        <Map className='h-3.5 w-3.5' />
        <span className='text-xs font-medium'>{label}</span>
      </div>
      <div className='mt-2 text-xl font-semibold leading-none'>{value}</div>
    </div>
  );
}
