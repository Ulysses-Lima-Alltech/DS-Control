'use client';

import { Badge } from '@/components/ui/badge';
import { Application } from '@/types/applications.type';
import { Farm } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';

function toLocalYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getApplicationCivilDateKey(value: string): string | null {
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

interface StatsCustomerPerformanceProps {
  serviceOrders: ServiceOrder[];
  farms: Farm[];
  applications: Application[];
  customerId: string;
}

export function StatsCustomerPerformance({
  serviceOrders,
  farms,
  applications,
  customerId,
}: StatsCustomerPerformanceProps) {
  const customerServiceOrders = serviceOrders.filter(
    (so) => so.customerId === customerId || so.customer?.id === customerId
  );

  const openOrders = customerServiceOrders.filter((so) => so.status === 'open');
  const completedOrders = customerServiceOrders.filter((so) => so.status === 'completed');
  const cancelledOrders = customerServiceOrders.filter((so) => so.status === 'cancelled');

  const calculateServiceOrderArea = (orders: ServiceOrder[]) => {
    return orders.reduce((sum, so) => {
      if (so.plots && so.plots.length > 0) {
        return (
          sum +
          so.plots.reduce((plotSum, plot) => {
            return plotSum + (parseFloat(plot.hectare) || 0);
          }, 0)
        );
      }
      return sum;
    }, 0);
  };

  const openOrdersArea = calculateServiceOrderArea(openOrders);
  const completedOrdersArea = calculateServiceOrderArea(completedOrders);
  const cancelledOrdersArea = calculateServiceOrderArea(cancelledOrders);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalApplications = applications.length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalApplicationsArea = applications.reduce(
    (sum, app) => sum + parseFloat(app.hectares || '0'),
    0
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentApplicationsCutoff = toLocalYMD(thirtyDaysAgo);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const recentApplications = applications.filter(
    (app) => {
      const applicationCivilDate = getApplicationCivilDateKey(String(app.date));
      if (!applicationCivilDate) return false;
      return applicationCivilDate >= recentApplicationsCutoff;
    }
  ).length;

  const totalFarms = farms.length;
  const activeFarms = farms.length;

  const validPlots = farms.reduce((allPlots: Plot[], farm) => {
    if (farm.plots) {
      const farmValidPlots = farm.plots.filter((plot) => !plot.deletedAt);
      return [...allPlots, ...farmValidPlots];
    }
    return allPlots;
  }, []);

  const totalPlots = validPlots.length;
  const totalArea = validPlots.reduce((sum, plot) => sum + (parseFloat(plot.hectare) || 0), 0);

  const stats = [
    {
      title: 'Ordens de Serviço',
      count: customerServiceOrders.length.toString(),
      values: [
        {
          label: openOrders.length.toString(),
          status: 'ABERTAS',
          statusColor: 'text-blue-600',
          count: `${openOrdersArea.toLocaleString()} ha`,
        },
        {
          label: completedOrders.length.toString(),
          status: 'CONCLUÍDAS',
          statusColor: 'text-green-600',
          count: `${completedOrdersArea.toLocaleString()} ha`,
        },
        {
          label: cancelledOrders.length.toString(),
          status: 'CANCELADAS',
          statusColor: 'text-red-600',
          count: `${cancelledOrdersArea.toLocaleString()} ha`,
        },
      ],
    },
    // Removido por não ter endpoint q pegue mais que 100 applications de um customer por vez
    //{
    //   title: 'Aplicações Agrícolas',
    //   count: `${totalApplicationsArea.toFixed(1)} ha`,
    //   values: [
    //     {
    //       label: totalApplicationsArea.toFixed(1),
    //       status: 'TOTAL',
    //       statusColor: 'text-blue-600',
    //       count: `${totalApplications} aplicações`,
    //     },
    //     {
    //       label: recentApplications.toString(),
    //       status: 'RECENTES',
    //       statusColor: 'text-green-600',
    //       count: 'últimos 30 dias',
    //     },
    //     {
    //       label:
    //         totalApplications > 0
    //           ? Math.round(totalApplicationsArea / totalApplications).toString()
    //           : '0',
    //       status: 'ÁREA MÉDIA',
    //       statusColor: 'text-purple-600',
    //       count: 'ha por aplicação',
    //     },
    //   ],
    // },
    {
      title: 'Fazendas',
      count: `${totalFarms} fazendas`,
      values: [
        {
          label: activeFarms.toString(),
          status: 'ATIVAS',
          statusColor: 'text-green-600',
          count: `${totalArea.toLocaleString()} ha`,
        },
        {
          label: totalPlots.toString(),
          status: 'TALHÕES',
          statusColor: 'text-blue-600',
          count: `${(totalArea / totalPlots || 0).toFixed(1)} ha média`,
        },
        // {
        //   label: recentApplications.toString(),
        //   status: 'APLICAÇÕES RECENTES',
        //   statusColor: 'text-amber-600',
        //   count: 'últimos 30 dias',
        // },
      ],
    },
  ];

  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
      {stats.map((stat, index) => (
        <div key={index} className='bg-card rounded-lg border border-border p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-sm font-medium text-card-foreground'>{stat.title}</h3>
            <Badge variant='secondary' className='bg-muted text-muted-foreground text-xs'>
              {stat.count}
            </Badge>
          </div>

          <div className='space-y-3'>
            {stat.values.map((value, valueIndex) => (
              <div key={valueIndex} className='flex items-center justify-between'>
                <div className='flex items-center space-x-2'>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      value.status === 'ABERTAS' || value.status === 'TALHÕES'
                        ? 'bg-blue-500'
                        : value.status === 'CONCLUÍDAS' || value.status === 'ATIVAS'
                          ? 'bg-green-500'
                          : value.status === 'CANCELADAS'
                            ? 'bg-red-500'
                            : value.status === 'TOTAL'
                              ? 'bg-blue-500'
                              : value.status === 'RECENTES'
                                ? 'bg-green-500'
                                : value.status === 'ÁREA MÉDIA'
                                  ? 'bg-purple-500'
                                  : value.status === 'APLICAÇÕES RECENTES'
                                    ? 'bg-amber-500'
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
    </div>
  );
}
