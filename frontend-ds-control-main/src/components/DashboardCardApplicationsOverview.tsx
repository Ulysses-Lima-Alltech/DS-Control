'use client';

import { ArrowRight, Calendar, Droplets, SprayCan, Sprout } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplicationStats } from '@/types/applications.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardApplicationsOverviewProps {
  stats: ApplicationStats | null;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
}

export const DashboardCardApplicationsOverview = ({
  stats,
  isLoadingStats,
  isErrorOnStats,
}: DashboardCardApplicationsOverviewProps) => {
  const router = useRouter();

  const handleViewApplications = () => {
    router.push('/dashboard/applications');
  };

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
          <Sprout className='w-5 h-5 text-green-500 flex-shrink-0' />
          <span className='truncate'>Aplicações</span>
        </CardTitle>
        <CardDescription className='truncate'>Visão geral das aplicações</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-3'>
          <div className='flex items-center justify-between gap-2 min-w-0'>
            <div className='flex items-center gap-2 min-w-0'>
              <SprayCan className='w-5 h-5 text-emerald-500 flex-shrink-0' />
              <span className='text-sm font-medium truncate'>Área Total Aplicada</span>
            </div>
            <span className='text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0'>
              {typeof stats?.totalAreaHectares === 'number'
                ? `${stats.totalAreaHectares.toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })} ha`
                : 'N/A'}
            </span>
          </div>

          <div className='text-xs text-muted-foreground truncate'>
            {stats?.applicationCount > 0
              ? `Média: ${(stats?.averageApplicationArea).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha/aplicação`
              : 'Nenhuma aplicação registrada'}
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between gap-2 min-w-0'>
              <span className='text-xs font-medium truncate'>Total de Aplicações</span>
              <span className='text-sm font-semibold text-green-600 dark:text-green-400 flex-shrink-0'>
                {stats?.applicationCount || 'N/A'}
              </span>
            </div>

            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <Calendar className='w-4 h-4 text-blue-500 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Este mês</span>
              </div>
              <span className='text-sm font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0'>
                {stats?.applicationCountByMonth || 'N/A'}
              </span>
            </div>
            <div className='text-xs text-muted-foreground truncate'>
              {stats?.applicationCountByMonth && stats?.applicationCountByMonth > 0
                ? `Média: ${((stats?.applicationCountByMonth || 0) / new Date().getDate()).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} aplicações/dia`
                : 'Nenhuma aplicação neste mês'}
            </div>

            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <Sprout className='w-4 h-4 text-purple-500 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Tipos de Cultura Aplicadas</span>
              </div>
              <span className='text-sm font-semibold text-purple-600 dark:text-purple-400 flex-shrink-0'>
                {stats?.culturesCount || 'N/A'}
              </span>
            </div>

            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <Droplets className='w-4 h-4 text-amber-500 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Tipos de Aplicação</span>
              </div>
              <span className='text-sm font-semibold text-amber-400 dark:text-amber-400 flex-shrink-0'>
                {stats?.typeOfProducts.length || 'N/A'}
              </span>
            </div>
          </div>
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

const SkeletonLoadingCard = () => {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <Sprout className='w-5 h-5 text-green-500' />
          Aplicações
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
          <Sprout className='w-5 h-5 text-red-500' />
          Aplicações
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
