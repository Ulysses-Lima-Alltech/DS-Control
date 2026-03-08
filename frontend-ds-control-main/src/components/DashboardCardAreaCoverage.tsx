'use client';

import { Target, VectorSquare } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplicationStats } from '@/types/applications.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardAreaCoverageProps {
  stats: ApplicationStats | null;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
}

export const DashboardCardAreaCoverage = ({
  stats,
  isLoadingStats,
  isErrorOnStats,
}: DashboardCardAreaCoverageProps) => {
  if (isLoadingStats) {
    return <SkeletonLoadingCard />;
  }

  if (isErrorOnStats || !stats) {
    return <SkeletonErrorCard />;
  }

  return (
    <Card className='min-w-0'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 min-w-0'>
          <VectorSquare className='w-5 h-5 text-blue-500 flex-shrink-0' />
          <span className='truncate'>Área de cobertura</span>
        </CardTitle>
        <CardDescription className='truncate'>Estatísticas de área aplicada</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-3'>
          <div className='flex items-center justify-between gap-2 min-w-0'>
            <span className='text-sm font-medium truncate'>Área Total</span>
            <span className='text-2xl font-bold text-blue-600 dark:text-blue-400 flex-shrink-0'>
              {(stats?.totalAreaHectares || 0).toLocaleString('pt-BR', {
                maximumFractionDigits: 1,
              })}{' '}
              ha
            </span>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <Target className='w-4 h-4 text-emerald-500 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Média por Aplicação</span>
              </div>
              <span className='text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0'>
                {(stats?.averageApplicationArea || 0).toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}{' '}
                ha
              </span>
            </div>
          </div>

          <div className='text-xs text-muted-foreground truncate'>
            {(stats?.applicationCount || 0) > 0
              ? `Total de ${stats?.applicationCount} aplicações realizadas`
              : 'Nenhuma aplicação registrada'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SkeletonLoadingCard = () => {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <VectorSquare className='w-5 h-5 text-green-500' />
          Área de cobertura
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

const SkeletonErrorCard = () => {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <VectorSquare className='w-5 h-5 text-red-500' />
          Área de cobertura
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='text-sm text-muted-foreground'>Erro ao carregar dados</div>
        </div>
      </CardContent>
    </Card>
  );
};
