'use client';

import { CheckCircle, Clock, FileText, MapPin, Users, XCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceOrder } from '@/types/service-order.type';

interface StatsServiceOrdersProps {
  serviceOrders: ServiceOrder[];
}

export const StatsServiceOrders = ({ serviceOrders }: StatsServiceOrdersProps) => {
  const stats = {
    total: serviceOrders.length,
    open: serviceOrders.filter((os) => os.status === 'open').length,
    completed: serviceOrders.filter((os) => os.status === 'completed').length,
    cancelled: serviceOrders.filter((os) => os.status === 'cancelled').length,
    areaTotal: serviceOrders.reduce((sum, os) => {
      const plotsArea =
        os.plots?.reduce((plotSum, plot) => {
          return plotSum + (parseFloat(plot.hectare) || 0);
        }, 0) || 0;
      return sum + plotsArea;
    }, 0),
    totalFarms: serviceOrders.reduce((sum, os) => sum + (os.farms?.length || 0), 0),
    totalPilots: serviceOrders.reduce((sum, os) => sum + (os.pilots?.length || 0), 0),
    totalPlots: serviceOrders.reduce((sum, os) => sum + (os.plots?.length || 0), 0),
  };

  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <FileText className='w-5 h-5' />
            Ordens de Serviço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Clock className='w-4 h-4 text-blue-500' />
                  <span className='text-sm font-medium'>Abertas</span>
                </div>
                <span className='text-lg font-semibold text-blue-600 dark:text-blue-400'>
                  {stats.open}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='w-4 h-4 text-green-500' />
                  <span className='text-sm font-medium'>Concluídas</span>
                </div>
                <span className='text-lg font-semibold text-green-600 dark:text-green-400'>
                  {stats.completed}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <XCircle className='w-4 h-4 text-red-500' />
                  <span className='text-sm font-medium'>Canceladas</span>
                </div>
                <span className='text-lg font-semibold text-red-600 dark:text-red-400'>
                  {stats.cancelled}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <MapPin className='w-5 h-5' />
            Dados das Fazendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Fazendas</span>
              <span className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                {stats.totalFarms}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Talhões</span>
              <span className='text-lg font-semibold'>{stats.totalPlots}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Área Total</span>
              <div className='text-right'>
                <span className='text-lg font-semibold'>
                  {stats.areaTotal > 0 ? stats.areaTotal.toFixed(1) : '--'}
                </span>
                <span className='text-xs text-muted-foreground ml-1'>ha</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2'>
            <Users className='w-5 h-5' />
            Outras Informações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Pilotos Alocados</span>
              <span className='text-2xl font-bold text-green-600 dark:text-green-400'>
                {stats.totalPilots}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Média de Talhões/OS</span>
              <span className='text-lg font-semibold'>
                {stats.total > 0 ? (stats.totalPlots / stats.total).toFixed(1) : '--'}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Área Média/OS</span>
              <div className='text-right'>
                <span className='text-lg font-semibold'>
                  {stats.total > 0 && stats.areaTotal > 0
                    ? (stats.areaTotal / stats.total).toFixed(1)
                    : '--'}
                </span>
                <span className='text-xs text-muted-foreground ml-1'>ha</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
