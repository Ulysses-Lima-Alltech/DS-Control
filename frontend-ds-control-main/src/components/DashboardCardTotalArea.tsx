'use client';

import { SprayCan } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { ApplicationStats } from '@/types/applications.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardTotalAreaProps {
  stats: ApplicationStats | null;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
  startDate?: string;
  endDate?: string;
}

export const DashboardCardTotalArea = ({
  stats,
  isLoadingStats,
  isErrorOnStats,
  startDate,
  endDate,
}: DashboardCardTotalAreaProps) => {
  if (isLoadingStats) {
    return (
      <Card className='h-full min-h-[132px] border-border/70 bg-card/90 shadow-sm'>
        <CardContent className='px-6 py-5'>
          <div className='flex items-center gap-4 h-full'>
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
      <Card className='h-full min-h-[132px] border-border/70 bg-card/90 shadow-sm'>
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
    <Card className='min-w-0 h-full min-h-[132px] border-emerald-200/60 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 via-card to-card dark:from-emerald-950/20 shadow-sm'>
      <CardContent className='px-6 py-5'>
        <div className='flex items-center gap-4 min-w-0'>
          <div className='rounded-xl p-2.5 bg-emerald-100/80 dark:bg-emerald-900/40 border border-emerald-200/70 dark:border-emerald-800/70'>
            <SprayCan className='w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0' />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-medium text-muted-foreground mb-1 truncate'>
              Área total aplicada
            </div>
            <div className='text-3xl font-semibold text-emerald-700 dark:text-emerald-300 truncate'>
              {typeof stats?.totalAreaHectares === 'number'
                ? `${stats.totalAreaHectares.toLocaleString('pt-BR', {
                    maximumFractionDigits: 1,
                  })} ha`
                : 'N/A'}
            </div>
            {startDate && endDate ? (
              <p className='text-xs text-muted-foreground mt-1 truncate'>
                Período: {startDate} a {endDate}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
