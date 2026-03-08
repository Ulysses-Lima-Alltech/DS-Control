'use client';

import { format } from 'date-fns';
import { useState } from 'react';

import { DashboardCardGeneralMetrics } from '@/components/DashboardCardGeneralMetrics';
import { DashboardCardProductsDistribution } from '@/components/DashboardCardProductsDistribution';
import { DashboardCardServiceOrders } from '@/components/DashboardCardServiceOrders';
import { DashboardCardTotalArea } from '@/components/DashboardCardTotalArea';
import { DateParams } from '@/components/DashboardDateFilter';
import { PendingApplicationsPanel } from '@/components/PendingApplicationsPanel';
import { useAuth } from '@/providers/auth.provider';
import { useGetStatsApplications } from '@/queries/application.query';
import { useGetStatsServiceorders } from '@/queries/service-order.query';

export default function DashboardPage() {
  const { user } = useAuth();

  const [dateParams, setDateParams] = useState<DateParams>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return {
      startDate: format(date, 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    };
  });

  const handleDateChange = (newDateParams: DateParams) => {
    setDateParams(newDateParams);
  };

  const {
    data: statsServiceOrders,
    isPending: isLoadingStatsServiceOrders,
    isError: isErrorOnStatsServiceOrders,
  } = useGetStatsServiceorders();

  const {
    data: statsApplications,
    isPending: isLoadingStatsApplications,
    isError: isErrorOnStatsApplications,
  } = useGetStatsApplications();

  return (
    <div className='p-6 space-y-6 min-h-full w-full'>
      <div className='flex flex-col md:flex-row gap-6 items-start md:items-center justify-between'>
        <div className='space-y-2'>
          <h1 className='text-2xl font-bold'>Olá, {user?.name}</h1>
          <div className='text-sm text-muted-foreground space-y-1'>
            <div>{user?.email}</div>
          </div>
        </div>
        <div className='w-full md:max-h-[200px] md:w-auto md:min-w-[400px]'>
          <DashboardCardTotalArea
            stats={statsApplications?.stats || null}
            isLoadingStats={isLoadingStatsApplications}
            isErrorOnStats={isErrorOnStatsApplications}
          />
        </div>
      </div>

      <div className='space-y-6'>
        <DashboardCardGeneralMetrics />

        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <PendingApplicationsPanel />

          <DashboardCardServiceOrders
            stats={statsServiceOrders?.stats || null}
            isLoadingStats={isLoadingStatsServiceOrders}
            isErrorOnStats={isErrorOnStatsServiceOrders}
          />
        </div>

        <div className='w-full'>
          <DashboardCardProductsDistribution />
        </div>
      </div>

      {/* <DashboardDateFilter onDateChange={handleDateChange} /> */}
      {/* <SectionApplication dateParams={dateParams} /> */}
      {/* <SectionPilotsPerformance dateParams={dateParams} /> */}
      {/* <SectionDronesOperation dateParams={dateParams} /> */}
      {/* <SectionCultureTypesStats dateParams={dateParams} /> */}
    </div>
  );
}
