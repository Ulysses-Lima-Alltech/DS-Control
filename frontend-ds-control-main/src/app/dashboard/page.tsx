'use client';

import { subDays } from 'date-fns';
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
  cleared: boolean
): { startDate?: string; endDate?: string } => {
  if (cleared) {
    return {};
  }

  const hasValidStart = isValidDateParam(urlStartDate);
  const hasValidEnd = isValidDateParam(urlEndDate);
  if (hasValidStart && hasValidEnd) {
    return { startDate: urlStartDate, endDate: urlEndDate };
  }

  return {};
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const cleared = searchParams.get('cleared') === '1';
  const { startDate, endDate } = resolveInitialDateRange(
    searchParams.get('startDate'),
    searchParams.get('endDate'),
    cleared
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
