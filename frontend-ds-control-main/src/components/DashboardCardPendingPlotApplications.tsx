'use client';

import { AlertTriangle, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Skeleton } from './ui/skeleton';

interface DashboardCardPendingPlotApplicationsProps {
  invalidApplications: number | undefined;
  invalidServiceOrders: number | undefined;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
}

export const DashboardCardPendingPlotApplications = ({
  invalidApplications,
  invalidServiceOrders,
  isLoadingStats,
  isErrorOnStats,
}: DashboardCardPendingPlotApplicationsProps) => {
  const router = useRouter();

  const pendingPlotApplications = invalidApplications ?? 0;
  const pendingServiceOrders = invalidServiceOrders ?? 0;

  const handleViewApplications = () => {
    router.push('/dashboard/applications?invalidApplication=true');
  };

  if (isLoadingStats) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <AlertTriangle className='w-5 h-5 text-amber-500' />
            Aplicações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4 flex flex-col gap-4 h-full justify-between'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <Skeleton className='w-40 h-4' />
                <Skeleton className='w-8 h-6' />
              </div>
              <div className='flex items-center justify-between'>
                <Skeleton className='w-44 h-4' />
                <Skeleton className='w-8 h-6' />
              </div>
            </div>
            <Skeleton className='w-full h-8' />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isErrorOnStats) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <AlertTriangle className='w-5 h-5 text-red-500' />
            Aplicações Pendentes
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

  if (pendingPlotApplications === 0 && pendingServiceOrders === 0) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <CheckCircle className='w-5 h-5 text-green-500' />
            Aplicações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col h-full'>
          <div className='flex-1 space-y-4'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between gap-2 min-w-0'>
                <span className='text-sm font-medium truncate'>
                  Ordens de serviço com aplicações inválidas
                </span>
                <span className='text-lg font-bold text-green-600 dark:text-green-400 flex-shrink-0'>
                  {pendingServiceOrders}
                </span>
              </div>
              <div className='flex items-center justify-between gap-2 min-w-0'>
                <span className='text-sm font-medium truncate'>
                  Aplicações sem talhão cadastrado
                </span>
                <span className='text-lg font-bold text-green-600 dark:text-green-400 flex-shrink-0'>
                  {pendingPlotApplications}
                </span>
              </div>
            </div>

            <div className='text-xs text-muted-foreground'>
              Todas as aplicações possuem talhões cadastrados
            </div>
          </div>

          <Button
            variant='outline'
            size='sm'
            onClick={handleViewApplications}
            className='w-full flex items-center justify-center gap-2 mt-4'
            disabled={true}
          >
            Ver Aplicações
            <ArrowRight className='w-4 h-4' />
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (
    (pendingPlotApplications > 0 || pendingServiceOrders > 0) &&
    pendingPlotApplications + pendingServiceOrders < 20
  ) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <AlertTriangle className='w-5 h-5 text-amber-500' />
            Aplicações Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col h-full'>
          <div className='flex-1 space-y-4'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between gap-2 min-w-0'>
                <span className='text-sm font-medium truncate'>
                  Ordens de serviço com aplicações inválidas
                </span>
                <span className='text-lg font-bold text-amber-600 dark:text-amber-400 flex-shrink-0'>
                  {pendingServiceOrders}
                </span>
              </div>
              <div className='flex items-center justify-between gap-2 min-w-0'>
                <span className='text-sm font-medium truncate'>
                  Aplicações sem talhão cadastrado
                </span>
                <span className='text-lg font-bold text-amber-600 dark:text-amber-400 flex-shrink-0'>
                  {pendingPlotApplications}
                </span>
              </div>
            </div>

            <div className='text-xs text-muted-foreground'>Itens pendentes requerem atenção</div>
          </div>

          <Button
            variant='outline'
            size='sm'
            onClick={handleViewApplications}
            className='w-full flex items-center justify-center gap-2 mt-4'
          >
            Ver Aplicações
            <ArrowRight className='w-4 h-4' />
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <XCircle className='w-5 h-5 text-red-500' />
          Aplicações Pendentes
        </CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-4'>
          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-2 min-w-0'>
              <span className='text-sm font-medium truncate'>
                Ordens de serviço com aplicações inválidas
              </span>
              <span className='text-lg font-bold text-red-600 dark:text-red-400 flex-shrink-0'>
                {pendingServiceOrders}
              </span>
            </div>
            <div className='flex items-center justify-between gap-2 min-w-0'>
              <span className='text-sm font-medium truncate'>Aplicações sem talhão cadastrado</span>
              <span className='text-lg font-bold text-red-600 dark:text-red-400 flex-shrink-0'>
                {pendingPlotApplications}
              </span>
            </div>
          </div>

          <div className='text-xs text-muted-foreground'>Itens pendentes requerem ação urgente</div>
        </div>

        <Button
          variant='outline'
          size='sm'
          onClick={handleViewApplications}
          className='w-full flex items-center justify-center gap-2 mt-4'
        >
          Ver Aplicações
          <ArrowRight className='w-4 h-4' />
        </Button>
      </CardContent>
    </Card>
  );
};
