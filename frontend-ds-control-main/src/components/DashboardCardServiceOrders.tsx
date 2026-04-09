'use client';

import { ArrowRight, CheckCircle, Clock, FileText, User, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  isErrorOnStats,
}: DashboardCardServiceOrdersProps) => {
  const router = useRouter();

  const handleViewServiceOrders = () => {
    router.push('/dashboard/service-orders');
  };

  if (isLoadingStats) {
    return <ServiceOrdersPageSkeleton />;
  }

  if (isErrorOnStats || !stats) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='w-5 h-5 text-red-500' />
            Ordens de Serviço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='text-sm text-muted-foreground'>Erro ao carregar dados</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='w-full max-w-none min-w-0 border-border/70 shadow-sm bg-card/95'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 min-w-0'>
          <FileText className='w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0' />
          <span className='truncate'>Ordens de Serviço</span>
        </CardTitle>

        <CardDescription className='truncate'>Visão geral das ordens de serviço</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-5'>
          <div className='flex items-center justify-between gap-2 min-w-0 pb-4 border-b border-border/70'>
            <span className='text-sm font-medium text-muted-foreground'>
              Total de Ordens
            </span>
            <span className='text-3xl font-semibold text-foreground flex-shrink-0'>
              {(
                stats?.openOrdersCount +
                stats?.completedOrdersCount +
                stats?.cancelledOrdersCount
              ).toString()}
            </span>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <div className='rounded-lg p-3.5 border border-blue-200/80 dark:border-blue-900/70 bg-blue-50/70 dark:bg-blue-950/20'>
              <div className='flex items-center justify-between mb-2 gap-2 min-w-0'>
                <div className='flex items-center gap-2 min-w-0'>
                  <div className='p-1.5 rounded-md bg-blue-100/90 dark:bg-blue-900/60 flex-shrink-0'>
                    <Clock className='w-3.5 h-3.5 text-blue-600 dark:text-blue-400' />
                  </div>
                  <span className='text-sm font-semibold text-foreground truncate'>Abertas</span>
                </div>
                <span className='text-lg font-bold text-blue-600 dark:text-blue-400 flex-shrink-0'>
                  {stats.openOrdersCount}
                </span>
              </div>
              <div className='space-y-1 pl-8 pt-1'>
                <div className='flex items-center justify-between gap-2 min-w-0'>
                  <span className='text-xs text-muted-foreground truncate'>Área Total</span>
                  <span className='text-xs font-medium text-blue-700 dark:text-blue-300 flex-shrink-0'>
                    {(stats.openOrdersAreaHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2 min-w-0'>
                  <span className='text-xs text-muted-foreground truncate'>Área Aplicada</span>
                  <span className='text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0'>
                    {(stats.openOrdersAppliedHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
              </div>
            </div>

            <div className='rounded-lg p-3.5 border border-green-200/80 dark:border-green-900/70 bg-green-50/70 dark:bg-green-950/20'>
              <div className='flex items-center justify-between mb-2 gap-2 min-w-0'>
                <div className='flex items-center gap-2 min-w-0'>
                  <div className='p-1.5 rounded-md bg-green-100/90 dark:bg-green-900/60 flex-shrink-0'>
                    <CheckCircle className='w-3.5 h-3.5 text-green-600 dark:text-green-400' />
                  </div>
                  <span className='text-sm font-semibold text-foreground truncate'>Concluídas</span>
                </div>
                <span className='text-lg font-bold text-green-600 dark:text-green-400 flex-shrink-0'>
                  {stats.completedOrdersCount}
                </span>
              </div>
              <div className='space-y-1 pl-8 pt-1'>
                <div className='flex items-center justify-between gap-2 min-w-0'>
                  <span className='text-xs text-muted-foreground truncate'>Área Total</span>
                  <span className='text-xs font-medium text-green-700 dark:text-green-300 flex-shrink-0'>
                    {(stats.completedOrdersAreaHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2 min-w-0'>
                  <span className='text-xs text-muted-foreground truncate'>Área Aplicada</span>
                  <span className='text-xs font-medium text-green-600 dark:text-green-400 flex-shrink-0'>
                    {(stats.completedOrdersAppliedHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
              </div>
            </div>

            <div className='rounded-lg p-3.5 border border-red-200/80 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/20'>
              <div className='flex items-center justify-between mb-2 gap-2 min-w-0'>
                <div className='flex items-center gap-2 min-w-0'>
                  <div className='p-1.5 rounded-md bg-red-100/90 dark:bg-red-900/60 flex-shrink-0'>
                    <XCircle className='w-3.5 h-3.5 text-red-600 dark:text-red-400' />
                  </div>
                  <span className='text-sm font-semibold text-foreground truncate'>Canceladas</span>
                </div>
                <span className='text-lg font-bold text-red-600 dark:text-red-400 flex-shrink-0'>
                  {stats.cancelledOrdersCount}
                </span>
              </div>
              <div className='space-y-1 pl-8 pt-1'>
                <div className='flex items-center justify-between gap-2 min-w-0'>
                  <span className='text-xs text-muted-foreground truncate'>Área Total</span>
                  <span className='text-xs font-medium text-red-700 dark:text-red-300 flex-shrink-0'>
                    {(stats.cancelledOrdersAreaHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2 min-w-0'>
                  <span className='text-xs text-muted-foreground truncate'>Área Aplicada</span>
                  <span className='text-xs font-medium text-red-600 dark:text-red-400 flex-shrink-0'>
                    {(stats.cancelledOrdersAppliedHectares || 0).toLocaleString('pt-BR', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    ha
                  </span>
                </div>
              </div>
            </div>

            <div className='md:col-span-3 pt-2 border-t border-border/70'>
              <div className='flex items-center justify-between gap-2 min-w-0'>
                <div className='flex items-center gap-2 min-w-0'>
                  <User className='w-4 h-4 text-amber-500 flex-shrink-0' />
                  <span className='text-xs font-medium text-muted-foreground truncate'>
                    Pilotos com Ordens Abertas
                  </span>
                </div>
                <span className='text-sm font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0'>
                  {stats.pilotsWithOpenOrders}
                </span>
              </div>
            </div>
          </div>
        </div>

        {showButton && (
          <Button
            variant='outline'
            size='sm'
            onClick={handleViewServiceOrders}
            className='w-full flex items-center justify-center gap-2 mt-4'
          >
            Ver Ordens de Serviço
            <ArrowRight className='w-4 h-4' />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const ServiceOrdersPageSkeleton = () => {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <FileText className='w-5 h-5 text-blue-500' />
          Ordens de Serviço
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
          <div className='flex items-center justify-between'>
            <Skeleton className='w-24 h-4' />
            <Skeleton className='w-24 h-8' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
