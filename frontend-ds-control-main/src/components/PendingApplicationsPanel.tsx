'use client';

import { useGetStatsApplications } from '@/queries/application.query';
import { ServiceOrderStatus } from '@/types/service-order.type';

interface PendingApplicationsPanelProps {
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  customerId?: string;
  serviceOrderId?: string;
  invalidApplication?: boolean;
  startDate?: string;
  endDate?: string;
}

export const PendingApplicationsPanel = ({
  search,
  serviceOrderStatus,
  farmId,
  pilotId,
  customerId,
  serviceOrderId,
  invalidApplication,
  startDate,
  endDate,
}: PendingApplicationsPanelProps) => {
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
    invalidApplication,
    startDate,
    endDate,
  });

  if (isPending) {
    return <SkeletonLoadingPanel />;
  }

  if (isError) {
    return <SkeletonErrorPanel />;
  }

  const pendingApplicationsCount = stats?.stats?.pendingApplicationsCount || 0;
  const pendingApplicationsTotalArea = stats?.stats?.pendingApplicationsTotalArea || 0;
  const pendingFarmsCount = stats?.stats?.pendingFarmsCount || 0;
  const pendingPlotsCount = stats?.stats?.pendingPlotsCount || 0;

  const statsData = [
    {
      title: 'Aplicações avulsas',
      count: `${pendingApplicationsCount.toLocaleString('pt-BR')}`,
      values: [
        {
          label: `${pendingApplicationsCount.toLocaleString('pt-BR')}`,
          status: 'APLICAÇÕES',
          statusColor: 'text-orange-600',
          count: 'Aplicações sem ordem de serviço, fazenda ou talhão',
        },
        {
          label: `${pendingApplicationsTotalArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`,
          status: 'ÁREA TOTAL',
          statusColor: 'text-red-600',
          count: 'Hectares de aplicações avulsas',
        },
      ],
    },
  ];

  return (
    <>
      {statsData.map((stat, index) => (
        <div key={index} className='bg-card rounded-lg border border-border p-6 min-w-0'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-sm font-medium text-card-foreground'>{stat.title}</h3>
          </div>

          <p className='text-xs text-muted-foreground italic mb-4'>
            Aplicações avulsas referem-se a registros que não estão associados a uma ordem de serviço, fazenda ou talhão. É necessário revisar e regularizar esses dados manualmente para garantir a correta rastreabilidade e gestão das aplicações.
          </p>

          <div className='space-y-3'>
            {stat.values.map((value, valueIndex) => (
              <div key={valueIndex} className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      value.status === 'APLICAÇÕES'
                        ? 'bg-orange-500'
                        : value.status === 'ÁREA TOTAL'
                          ? 'bg-red-500'
                          : value.status === 'FAZENDAS'
                            ? 'bg-yellow-500'
                            : value.status === 'TALHÕES'
                              ? 'bg-purple-500'
                              : 'bg-gray-400'
                    }`}
                  />
                  <span className='text-lg font-semibold text-card-foreground'>{value.label}</span>
                </div>
                <div className='text-right'>
                  <div className={`text-xs font-medium ${value.statusColor}`}>{value.status}</div>
                  <div className='text-xs text-muted-foreground'>{value.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

const SkeletonLoadingPanel = () => {
  return (
    <div className='bg-card rounded-lg border border-border p-6 min-w-0'>
      <div className='flex items-center justify-between mb-4'>
        <div className='w-32 h-5 bg-muted animate-pulse rounded' />
        <div className='w-20 h-5 bg-muted animate-pulse rounded' />
      </div>
      <div className='space-y-3'>
        {[...Array(4)].map((_, valueIndex) => (
          <div key={valueIndex} className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <div className='w-2 h-2 bg-muted animate-pulse rounded-full' />
              <div className='w-24 h-6 bg-muted animate-pulse rounded' />
            </div>
            <div className='text-right space-y-1'>
              <div className='w-16 h-4 bg-muted animate-pulse rounded' />
              <div className='w-20 h-4 bg-muted animate-pulse rounded' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SkeletonErrorPanel = () => {
  return (
    <div className='bg-card rounded-lg border border-border p-6 min-w-0'>
      <div className='text-center text-muted-foreground'>
        Erro ao carregar estatísticas de aplicações pendentes
      </div>
    </div>
  );
};
