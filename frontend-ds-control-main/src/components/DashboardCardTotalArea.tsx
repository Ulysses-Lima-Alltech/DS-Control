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
            <SprayCan className='w-8 h-8 text-destructive' />
            <div className='flex-1'>
              <div className='text-sm text-muted-foreground'>Erro ao carregar dados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='min-w-0 h-full min-h-[132px] border-primary/30 bg-gradient-to-br from-primary/20 via-card to-card shadow-sm'>
      <CardContent className='px-6 py-5'>
        <div className='flex items-center gap-4 min-w-0'>
          <div className='rounded-xl p-2.5 bg-primary/15 border border-primary/25'>
            <SprayCan className='w-6 h-6 text-primary flex-shrink-0' />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-medium text-muted-foreground mb-1 truncate'>
              Área total aplicada
            </div>
            <div className='text-3xl font-semibold text-primary truncate'>
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
