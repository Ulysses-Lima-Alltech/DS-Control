'use client';

import { Badge } from '@/components/ui/badge';
import { useGetStatsApplications } from '@/queries/application.query';
import { ServiceOrderStatus } from '@/types/service-order.type';

interface StatsApplicationsProps {
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  customerId?: string;
  serviceOrderId?: string;
  startDate?: string;
  endDate?: string;
}

export const StatsApplications = ({
  search,
  serviceOrderStatus,
  farmId,
  pilotId,
  customerId,
  serviceOrderId,
  startDate,
  endDate,
}: StatsApplicationsProps) => {
  const {
    data: stats,
    isPending,
    isError,
  } = useGetStatsApplications({
    search,
    serviceOrderStatus,
    farmId,
    pilotId,
    customerId,
    serviceOrderId,
    startDate,
    endDate,
  });

  if (isPending) {
    return <SkeletonLoadingStats />;
  }

  if (isError) {
    return <SkeletonErrorStats />;
  }

  const totalHectares = stats?.stats?.totalAreaHectares || 0;
  const totalHectaresPerDay = stats?.stats?.totalHectaresPerDay || 0;
  const totalHectaresByMonth = stats?.stats?.totalHectaresByMonth || 0;
  const totalHectaresByMonthPerDay = stats?.stats?.totalHectaresByMonthPerDay || 0;

  const statsData = [
    {
      title: 'Aplicações Agrícolas',
      count: `${totalHectares.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`,
      values: [
        {
          label: `${totalHectares.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`,
          status: 'TOTAL',
          statusColor: 'text-blue-600',
          count: `${totalHectaresPerDay.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha/dia`,
        },
        {
          label: `${totalHectaresByMonth.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`,
          status: 'ESTE MÊS',
          statusColor: 'text-green-600',
          count: `${totalHectaresByMonthPerDay.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha/dia`,
        },
      ],
    },
  ];

  return (
    <div className='w-full h-full'>
      {statsData.map((stat, index) => (
        <div
          key={index}
          className='bg-card rounded-lg border border-border p-6 h-full flex flex-col'
        >
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-sm font-medium text-card-foreground'>{stat.title}</h3>
            <Badge variant='secondary' className='bg-muted text-muted-foreground text-xs'>
              {stat.count}
            </Badge>
          </div>

          <div className='space-y-3'>
            {stat.values.map((value, valueIndex) => (
              <div key={valueIndex} className='flex items-center justify-between gap-4'>
                <div className='flex items-center space-x-2 min-w-0'>
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      value.status === 'TOTAL'
                        ? 'bg-blue-500'
                        : value.status === 'ESTE MÊS'
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                    }`}
                  />
                  <span className='text-lg font-semibold text-card-foreground'>{value.label}</span>
                </div>
                <div className='text-right flex-shrink-0'>
                  <div className={`text-xs font-medium ${value.statusColor}`}>{value.status}</div>
                  <div className='text-xs text-muted-foreground'>{value.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const SkeletonLoadingStats = () => {
  return (
    <div className='w-full h-full'>
      <div className='bg-card rounded-lg border border-border p-6 h-full flex flex-col'>
        <div className='flex items-center justify-between mb-4'>
          <div className='w-32 h-5 bg-muted animate-pulse rounded' />
          <div className='w-20 h-5 bg-muted animate-pulse rounded' />
        </div>
        <div className='space-y-3'>
          {[...Array(2)].map((_, index) => (
            <div key={index} className='flex items-center justify-between gap-4'>
              <div className='flex items-center space-x-2 min-w-0'>
                <div className='w-2 h-2 bg-muted animate-pulse rounded-full flex-shrink-0' />
                <div className='w-24 h-6 bg-muted animate-pulse rounded' />
              </div>
              <div className='text-right space-y-1 flex-shrink-0'>
                <div className='w-16 h-4 bg-muted animate-pulse rounded' />
                <div className='w-20 h-4 bg-muted animate-pulse rounded' />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SkeletonErrorStats = () => {
  return (
    <div className='w-full h-full'>
      <div className='bg-card rounded-lg border border-border p-6 h-full flex items-center justify-center'>
        <div className='text-center text-muted-foreground'>
          Erro ao carregar estatísticas das aplicações
        </div>
      </div>
    </div>
  );
};
