'use client';

import { format, subDays } from 'date-fns';
import { useSearchParams } from 'next/navigation';

import { PanelDashboardBlocks } from '@/components/PanelDashboardBlocks';
import { useAuth } from '@/providers/auth.provider';

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
  const { startDate, endDate } = resolveInitialDateRange(
    searchParams.get('startDate'),
    searchParams.get('endDate')
  );
  const yesterday = getYesterdayDateString();

  return (
    <div className='p-6 space-y-6 min-h-full w-full'>
      <div className='space-y-2'>
        <h1 className='text-2xl font-bold'>Olá, {user?.name}</h1>
        <div className='text-sm text-muted-foreground space-y-1'>
          <div>{user?.email}</div>
        </div>
      </div>

      <PanelDashboardBlocks startDate={startDate} endDate={endDate} yesterday={yesterday} />
    </div>
  );
}

