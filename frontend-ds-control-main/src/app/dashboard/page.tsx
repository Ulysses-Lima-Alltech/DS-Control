'use client';

import { format, subDays } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ApplicationsOverviewDashboard } from '@/components/ApplicationsOverviewDashboard';
import { DashboardCardGeneralMetrics } from '@/components/DashboardCardGeneralMetrics';
import { DashboardCardProductsDistribution } from '@/components/DashboardCardProductsDistribution';
import { DashboardCardServiceOrders } from '@/components/DashboardCardServiceOrders';
import { DashboardCardTotalArea } from '@/components/DashboardCardTotalArea';
import { PendingApplicationsPanel } from '@/components/PendingApplicationsPanel';
import { useAuth } from '@/providers/auth.provider';
import { useGetStatsApplications } from '@/queries/application.query';
import { useGetStatsServiceorders } from '@/queries/service-order.query';
import type { ServiceOrderStatus } from '@/types/service-order.type';

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getYesterdayDateString = () => format(subDays(new Date(), 1), 'yyyy-MM-dd');

const resolveInitialDateRange = (
  urlStartDate: string | null,
  urlEndDate: string | null
): { startDate: string; endDate: string } => {
  const hasValidStart = !!urlStartDate && DATE_PARAM_REGEX.test(urlStartDate);
  const hasValidEnd = !!urlEndDate && DATE_PARAM_REGEX.test(urlEndDate);
  if (hasValidStart && hasValidEnd) {
    return { startDate: urlStartDate, endDate: urlEndDate };
  }

  const yesterday = getYesterdayDateString();
  return { startDate: yesterday, endDate: yesterday };
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const initialDateRange = resolveInitialDateRange(
    searchParams.get('startDate'),
    searchParams.get('endDate')
  );
  const yesterday = getYesterdayDateString();
  const [applicationsPanelSearch, setApplicationsPanelSearch] = useState('');
  const [applicationsPanelServiceOrderStatus, setApplicationsPanelServiceOrderStatus] = useState<
    ServiceOrderStatus | undefined
  >(undefined);
  const [applicationsPanelFarmId, setApplicationsPanelFarmId] = useState<string | undefined>(
    undefined
  );
  const [applicationsPanelProductId, setApplicationsPanelProductId] = useState<string | undefined>(
    undefined
  );
  const [applicationsPanelPilotId, setApplicationsPanelPilotId] = useState<string | undefined>(
    undefined
  );
  const [applicationsPanelCustomerId, setApplicationsPanelCustomerId] = useState<string | undefined>(
    undefined
  );
  const [applicationsPanelStartDate, setApplicationsPanelStartDate] = useState<string | undefined>(
    initialDateRange.startDate
  );
  const [applicationsPanelEndDate, setApplicationsPanelEndDate] = useState<string | undefined>(
    initialDateRange.endDate
  );

  const {
    data: statsServiceOrders,
    isPending: isLoadingStatsServiceOrders,
    isError: isErrorOnStatsServiceOrders,
  } = useGetStatsServiceorders({
    startDate: applicationsPanelStartDate,
    endDate: applicationsPanelEndDate,
  });

  const {
    data: statsApplications,
    isPending: isLoadingStatsApplications,
    isError: isErrorOnStatsApplications,
  } = useGetStatsApplications({
    startDate: applicationsPanelStartDate,
    endDate: applicationsPanelEndDate,
  });

  return (
    <div className='p-6 space-y-6 min-h-full w-full'>
      <div className='space-y-2'>
        <h1 className='text-2xl font-bold'>Olá, {user?.name}</h1>
        <div className='text-sm text-muted-foreground space-y-1'>
          <div>{user?.email}</div>
        </div>
      </div>

      <div className='space-y-6'>
        <DashboardCardGeneralMetrics
          startDate={applicationsPanelStartDate ?? yesterday}
          onStartDateChange={(startDate) => {
            setApplicationsPanelStartDate(startDate);
            if (!applicationsPanelEndDate) {
              setApplicationsPanelEndDate(yesterday);
            }
          }}
        />

        <div className='grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch'>
          <div className='xl:col-span-2'>
            <DashboardCardTotalArea
              stats={statsApplications?.stats || null}
              isLoadingStats={isLoadingStatsApplications}
              isErrorOnStats={isErrorOnStatsApplications}
              startDate={applicationsPanelStartDate}
              endDate={applicationsPanelEndDate}
            />
          </div>
          <DashboardCardServiceOrders
            stats={statsServiceOrders?.stats || null}
            isLoadingStats={isLoadingStatsServiceOrders}
            isErrorOnStats={isErrorOnStatsServiceOrders}
          />
        </div>

        <ApplicationsOverviewDashboard
          search={applicationsPanelSearch}
          serviceOrderStatus={applicationsPanelServiceOrderStatus}
          farmId={applicationsPanelFarmId}
          productId={applicationsPanelProductId}
          pilotId={applicationsPanelPilotId}
          customerId={applicationsPanelCustomerId}
          startDate={applicationsPanelStartDate}
          endDate={applicationsPanelEndDate}
          onFarmFilterChange={setApplicationsPanelFarmId}
          onCustomerFilterChange={setApplicationsPanelCustomerId}
          onProductFilterChange={setApplicationsPanelProductId}
          onPilotFilterChange={setApplicationsPanelPilotId}
          onServiceOrderStatusChange={setApplicationsPanelServiceOrderStatus}
          onDateRangeChange={(range) => {
            if (!range) {
              setApplicationsPanelStartDate(yesterday);
              setApplicationsPanelEndDate(yesterday);
              return;
            }
            setApplicationsPanelStartDate(range.startDate);
            setApplicationsPanelEndDate(range.endDate);
          }}
          onClearOverviewFilters={() => {
            setApplicationsPanelSearch('');
            setApplicationsPanelServiceOrderStatus(undefined);
            setApplicationsPanelFarmId(undefined);
            setApplicationsPanelProductId(undefined);
            setApplicationsPanelPilotId(undefined);
            setApplicationsPanelCustomerId(undefined);
            setApplicationsPanelStartDate(yesterday);
            setApplicationsPanelEndDate(yesterday);
          }}
        />

        <PendingApplicationsPanel />

        <div className='w-full'>
          <DashboardCardProductsDistribution
            startDate={applicationsPanelStartDate}
            endDate={applicationsPanelEndDate}
          />
        </div>
      </div>
    </div>
  );
}
