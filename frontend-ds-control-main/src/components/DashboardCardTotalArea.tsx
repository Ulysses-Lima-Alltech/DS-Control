'use client';

import { SprayCan } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { ApplicationStats } from '@/types/applications.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardTotalAreaProps {
  stats: ApplicationStats | null;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
}

export const DashboardCardTotalArea = ({
  stats,
  isLoadingStats,
  isErrorOnStats,
}: DashboardCardTotalAreaProps) => {
  if (isLoadingStats) {
    return (
      <Card className='h-[150px]'>
        <CardContent className='px-6 py-0'>
          <div className='flex items-center gap-4'>
            <Skeleton className='w-8 h-6 rounded' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='w-32 h-4' />
              <Skeleton className='w-24 h-8' />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isErrorOnStats || !stats) {
    return (
      <Card>
        <CardContent className='p-6'>
          <div className='flex items-center gap-4'>
            <SprayCan className='w-8 h-8 text-red-500' />
            <div className='flex-1'>
              <div className='text-sm text-muted-foreground'>Erro ao carregar dados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='min-w-0'>
      <CardContent className='px-6'>
        <div className='flex items-center gap-4 min-w-0'>
          <SprayCan className='w-8 h-8 text-emerald-500 flex-shrink-0' />
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-medium text-muted-foreground mb-1 truncate'>
              Área total aplicada
            </div>
            <div className='text-3xl font-bold text-emerald-600 dark:text-emerald-400 truncate'>
              {typeof stats?.totalAreaHectares === 'number'
                ? `${stats.totalAreaHectares.toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })} ha`
                : 'N/A'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
