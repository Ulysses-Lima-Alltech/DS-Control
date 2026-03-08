'use client';

import { MapPin, Mountain } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGetAllApplications } from '@/queries/application.query';
import { useGetAllFarms } from '@/queries/farm.query';

export const DashboardCardCoverageArea = () => {
  const {
    data: applications,
    isPending: isPendingApps,
    isError: isErrorApps,
  } = useGetAllApplications({
    page: '1',
    limit: '1000',
  });

  const {
    data: farms,
    isPending: isPendingFarms,
    isError: isErrorFarms,
  } = useGetAllFarms(undefined, {
    page: '1',
    limit: '1000',
  });

  const totalApplicationArea =
    applications?.data?.reduce((sum, app) => {
      return sum + (parseFloat(app.hectares) || 0);
    }, 0) || 0;

  const totalFarms = farms?.data?.length || 0;
  const totalPlots =
    farms?.data?.reduce((sum, farm) => {
      return sum + (farm.plots?.length || 0);
    }, 0) || 0;

  const averageApplicationSize = applications?.data?.length
    ? totalApplicationArea / applications.data.length
    : 0;

  const isLoading = isPendingApps || isPendingFarms;
  const hasError = isErrorApps || isErrorFarms;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Mountain className='w-5 h-5 text-emerald-500' />
            Área de Cobertura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Carregando...</span>
              <div className='w-12 h-8 bg-muted animate-pulse rounded' />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Mountain className='w-5 h-5 text-red-500' />
            Área de Cobertura
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
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2'>
          <Mountain className='w-5 h-5 text-emerald-500' />
          Área de Cobertura
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>Total Aplicado</span>
            <span className='text-xl font-bold text-emerald-600 dark:text-emerald-400'>
              {totalApplicationArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha
            </span>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Mountain className='w-4 h-4 text-green-500' />
                <span className='text-sm font-medium'>Fazendas</span>
              </div>
              <span className='text-sm font-semibold text-green-600 dark:text-green-400'>
                {totalFarms}
              </span>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <MapPin className='w-4 h-4 text-blue-500' />
                <span className='text-sm font-medium'>Talhões</span>
              </div>
              <span className='text-sm font-semibold text-blue-600 dark:text-blue-400'>
                {totalPlots}
              </span>
            </div>

            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Mountain className='w-4 h-4 text-purple-500' />
                <span className='text-sm font-medium'>Média/App</span>
              </div>
              <span className='text-sm font-semibold text-purple-600 dark:text-purple-400'>
                {averageApplicationSize.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha
              </span>
            </div>
          </div>

          <div className='text-xs text-muted-foreground'>
            {totalApplicationArea > 0
              ? `Cobertura distribuída em ${totalFarms} propriedade${totalFarms !== 1 ? 's' : ''}`
              : 'Nenhuma área aplicada registrada'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
