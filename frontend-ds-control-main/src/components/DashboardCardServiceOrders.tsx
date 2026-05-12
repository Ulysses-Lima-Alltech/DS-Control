'use client';

import { ArrowRight, CheckCircle, Clock, FileText, Map, Sprout, User, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsServiceOrders } from '@/types/service-order.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardServiceOrdersProps {
  showButton?: boolean;
  stats: StatsServiceOrders | null;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
}

export const DashboardCardServiceOrders = ({
  showButton = true,
  stats,
  isLoadingStats,
}: DashboardCardServiceOrdersProps) => {
  const router = useRouter();

  const handleViewServiceOrders = () => {
    router.push('/dashboard/service-orders');
  };

  if (isLoadingStats) {
    return <ServiceOrdersPageSkeleton />;
  }

  const openOrdersCount = stats?.openOrdersCount ?? 0;
  const completedOrdersCount = stats?.completedOrdersCount ?? 0;
  const cancelledOrdersCount = stats?.cancelledOrdersCount ?? 0;
  const totalOrders = openOrdersCount + completedOrdersCount + cancelledOrdersCount;

  const openOrdersAreaHectares = stats?.openOrdersAreaHectares ?? 0;
  const completedOrdersAreaHectares = stats?.completedOrdersAreaHectares ?? 0;
  const cancelledOrdersAreaHectares = stats?.cancelledOrdersAreaHectares ?? 0;

  const totalAreaHectares =
    stats?.totalAreaHectares ??
    openOrdersAreaHectares + completedOrdersAreaHectares + cancelledOrdersAreaHectares;

  const totalAppliedHectares =
    (stats?.openOrdersAppliedHectares ?? 0) +
    (stats?.completedOrdersAppliedHectares ?? 0) +
    (stats?.cancelledOrdersAppliedHectares ?? 0);

  const pilotsWithOpenOrders = stats?.pilotsWithOpenOrders ?? 0;

  const formatCount = (value: number) => value.toLocaleString('pt-BR');
  const formatHectare = (value: number) =>
    `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;

  return (
    <Card className='w-full max-w-none min-w-0 border-border/70 shadow-sm bg-card/95'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 min-w-0'>
          <FileText className='w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0' />
          <span className='truncate'>Ordens de Servico</span>
        </CardTitle>

        <CardDescription className='truncate'>Visao geral das ordens de servico</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col h-full pt-0'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7'>
          <SummaryItem
            icon={<FileText className='h-4 w-4 text-blue-600 dark:text-blue-400' />}
            label='Total de Ordens'
            value={formatCount(totalOrders)}
          />
          <SummaryItem
            icon={<Clock className='h-4 w-4 text-sky-600 dark:text-sky-400' />}
            label='Abertas'
            value={formatCount(openOrdersCount)}
          />
          <SummaryItem
            icon={<CheckCircle className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />}
            label='Concluídas'
            value={formatCount(completedOrdersCount)}
          />
          <SummaryItem
            icon={<XCircle className='h-4 w-4 text-rose-600 dark:text-rose-400' />}
            label='Canceladas'
            value={formatCount(cancelledOrdersCount)}
          />
          <SummaryItem
            icon={<Map className='h-4 w-4 text-indigo-600 dark:text-indigo-400' />}
            label='Área Total'
            value={formatHectare(totalAreaHectares)}
          />
          <SummaryItem
            icon={<Sprout className='h-4 w-4 text-teal-600 dark:text-teal-400' />}
            label='Área Aplicada'
            value={formatHectare(totalAppliedHectares)}
          />
          <SummaryItem
            icon={<User className='h-4 w-4 text-amber-600 dark:text-amber-400' />}
            label='Pilotos com Ordens Abertas'
            value={formatCount(pilotsWithOpenOrders)}
          />
        </div>

        {showButton && (
          <Button
            variant='outline'
            size='sm'
            onClick={handleViewServiceOrders}
            className='w-full flex items-center justify-center gap-2 mt-4'
          >
            Ver Ordens de Servico
            <ArrowRight className='w-4 h-4' />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className='rounded-lg border border-border bg-background/70 p-3'>
      <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
        {icon}
        <span className='truncate'>{label}</span>
      </div>
      <p className='mt-2 text-lg font-semibold text-foreground truncate'>{value}</p>
    </div>
  );
}

const ServiceOrdersPageSkeleton = () => {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <FileText className='w-5 h-5 text-blue-500' />
          Ordens de Servico
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7'>
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className='rounded-lg border border-border bg-background/70 p-3'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='mt-2 h-6 w-24' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
