'use client';

import { subDays } from 'date-fns';
import { Leaf } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { PanelDashboardBlocks } from '@/components/PanelDashboardBlocks';
import { useAuth } from '@/providers/auth.provider';
import { toOperationalDateYMD, toOperationalDateYMDOrToday } from '@/utils/operational-date';

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getYesterdayDateString = () => {
  const todayYmd = toOperationalDateYMDOrToday();
  const [year, month, day] = todayYmd.split('-').map(Number);
  const todayDate = new Date(year, month - 1, day);
  return toOperationalDateYMD(subDays(todayDate, 1)) ?? todayYmd;
};

const isValidDateParam = (value: string | null): value is string => {
  if (!value || !DATE_PARAM_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
};

const resolveInitialDateRange = (
  urlStartDate: string | null,
  urlEndDate: string | null,
  cleared: boolean,
  fallbackDate: string
): { startDate?: string; endDate?: string } => {
  if (cleared) {
    return {};
  }

  const hasValidStart = isValidDateParam(urlStartDate);
  const hasValidEnd = isValidDateParam(urlEndDate);
  if (hasValidStart && hasValidEnd) {
    return { startDate: urlStartDate, endDate: urlEndDate };
  }

  return { startDate: fallbackDate, endDate: fallbackDate };
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const yesterday = getYesterdayDateString();
  const cleared = searchParams.get('cleared') === '1';
  const { startDate, endDate } = resolveInitialDateRange(
    searchParams.get('startDate'),
    searchParams.get('endDate'),
    cleared,
    yesterday
  );

  return (
    <div className='min-h-full w-full space-y-5 p-5 lg:p-6'>
      <div className='relative overflow-hidden rounded-2xl border border-primary/10 bg-card px-6 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]'>
        <div className='pointer-events-none absolute -right-10 -top-14 h-40 w-64 rounded-full bg-primary/10 blur-3xl' />
        <Leaf className='pointer-events-none absolute left-4 top-5 h-7 w-7 -rotate-12 text-primary/35' />
        <Leaf className='pointer-events-none absolute bottom-2 right-10 h-16 w-16 rotate-12 text-primary/20' />
        <h1 className='relative pl-8 text-2xl font-semibold tracking-normal text-foreground'>Olá, {user?.name}</h1>
        <div className='relative pl-8 text-sm text-muted-foreground space-y-1'>
          <div>{user?.email}</div>
        </div>
      </div>

      <PanelDashboardBlocks startDate={startDate} endDate={endDate} yesterday={yesterday} />
    </div>
  );
}
