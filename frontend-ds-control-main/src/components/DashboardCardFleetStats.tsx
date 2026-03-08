'use client';

import { Drone, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplicationStats } from '@/types/applications.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardFleetStatsProps {
  stats: ApplicationStats | null;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
}

export const DashboardCardFleetStats = ({
  stats,
  isLoadingStats,
  isErrorOnStats,
}: DashboardCardFleetStatsProps) => {
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
          <Drone className='w-5 h-5 text-orange-500 flex-shrink-0' />
          <span className='truncate'>Estatísticas da Frota</span>
        </CardTitle>
        <CardDescription className='truncate'>
          Performance de pilotos e drones utilizados
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-3'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='text-center min-w-0'>
              <div className='flex items-center justify-center mb-1'>
                <Users className='w-4 h-4 text-blue-500 mr-1 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Pilotos</span>
              </div>
              <span className='text-xl font-bold text-blue-600 dark:text-blue-400'>
                {stats?.pilotsCount || 0}
              </span>
            </div>
            <div className='text-center min-w-0'>
              <div className='flex items-center justify-center mb-1'>
                <Drone className='w-4 h-4 text-orange-500 mr-1 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Drones</span>
              </div>
              <span className='text-xl font-bold text-orange-600 dark:text-orange-400'>
                {stats?.dronesCount || 0}
              </span>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <Users className='w-4 h-4 text-emerald-500 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Média por Piloto</span>
              </div>
              <span className='text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0'>
                {(stats?.averageApplicationByPilot || 0).toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>

            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <Drone className='w-4 h-4 text-purple-500 flex-shrink-0' />
                <span className='text-xs font-medium truncate'>Média por Drone</span>
              </div>
              <span className='text-sm font-semibold text-purple-600 dark:text-purple-400 flex-shrink-0'>
                {(stats?.averageApplicationByDrone || 0).toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
          </div>

          <div className='text-xs text-muted-foreground truncate'>
            {(stats?.applicationCount || 0) > 0
              ? `Performance baseada em ${stats?.applicationCount} aplicações registradas`
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
          <Drone className='w-5 h-5 text-green-500' />
          Estatísticas da Frota
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
          <Drone className='w-5 h-5 text-red-500' />
          Estatísticas da Frota
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
