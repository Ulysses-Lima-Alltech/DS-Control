'use client';

import { ArrowRight, MapPin, Tractor, VectorSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsServiceOrders } from '@/types/service-order.type';

import { Skeleton } from './ui/skeleton';

interface DashboardCardFarmsOverviewProps {
  showButton?: boolean;
  stats: StatsServiceOrders | null;
  isLoadingStats: boolean;
  isErrorOnStats: boolean;
}

export const DashboardCardFarmsOverview = ({
  stats,
  isLoadingStats,
  isErrorOnStats,
}: DashboardCardFarmsOverviewProps) => {
  const router = useRouter();

  const totalFarms = stats?.farmsCount || 0;
  const totalPlots = stats?.plotsCount || 0;

  const totalArea = stats?.totalAreaHectares || 0;

  const handleViewFarms = () => {
    router.push('/dashboard/farms');
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
          <Tractor className='w-5 h-5 text-emerald-500 flex-shrink-0' />
          <span className='truncate'>Fazendas & Talhões</span>
        </CardTitle>
        <CardDescription className='truncate'>Visão geral das fazendas e talhões</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col h-full'>
        <div className='flex-1 space-y-3'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <Tractor className='w-4 h-4 text-emerald-500 flex-shrink-0' />
                <span className='text-sm font-medium truncate'>Fazendas Cadastradas</span>
              </div>
              <span className='text-xl font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0'>
                {totalFarms}
              </span>
            </div>

            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <MapPin className='w-4 h-4 text-blue-500 flex-shrink-0' />
                <span className='text-sm font-medium truncate'>Talhões Cadastrados</span>
              </div>
              <span className='text-xl font-bold text-blue-600 dark:text-blue-400 flex-shrink-0'>
                {totalPlots}
              </span>
            </div>
            <div className='text-xs text-muted-foreground truncate'>
              {totalPlots > 0 && totalFarms > 0
                ? `Média: ${(totalPlots / totalFarms).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} talhões/fazenda`
                : 'Nenhuma fazenda cadastrada'}
            </div>

            <div className='flex items-center justify-between gap-2 min-w-0'>
              <div className='flex items-center gap-2 min-w-0'>
                <VectorSquare className='w-4 h-4 text-green-500 flex-shrink-0' />
                <span className='text-sm font-medium truncate'>Área Total (ha)</span>
              </div>
              <span className='text-xl font-bold text-green-600 dark:text-green-400 flex-shrink-0'>
                {totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha
              </span>
            </div>
          </div>

          <div className='flex flex-row justify-between gap-2'>
            <div className='text-xs text-muted-foreground truncate'>
              {totalFarms > 0
                ? `Média: ${(totalArea / totalFarms).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha/fazenda`
                : 'Nenhuma fazenda cadastrada'}
            </div>
            <div className='text-xs text-muted-foreground truncate'>
              {totalPlots > 0
                ? `Média: ${(totalArea / totalPlots).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha/talhão`
                : 'Nenhuma fazenda cadastrada'}
            </div>
          </div>
        </div>

        <Button
          variant='outline'
          size='sm'
          onClick={handleViewFarms}
          className='w-full flex items-center justify-center gap-2 mt-4'
        >
          Ver Fazendas
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
          <Tractor className='w-5 h-5 text-green-500' />
          Fazendas & Talhões
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
          <Tractor className='w-5 h-5 text-red-500' />
          Fazendas & Talhões
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
