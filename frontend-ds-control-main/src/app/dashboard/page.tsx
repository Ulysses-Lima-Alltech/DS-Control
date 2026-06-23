'use client';

import { subDays } from 'date-fns';
import { Sprout } from 'lucide-react';
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
    <div className='relative min-h-full w-full overflow-hidden p-5 lg:p-8'>
      <div className='pointer-events-none absolute bottom-0 right-0 h-44 w-[46rem] rounded-tl-full bg-[color:color-mix(in_oklch,var(--brand-secondary)_12%,white)]' />
      <div className='relative z-10 space-y-6'>
        <div className='flex items-center gap-5 px-2 py-2'>
          <Sprout className='h-16 w-16 shrink-0 -rotate-12 text-primary/45' />
          <div>
            <h1 className='text-3xl font-semibold tracking-normal text-foreground'>
              Olá, {user?.name}
            </h1>
            <div className='space-y-1 text-sm text-muted-foreground'>
              <div>{user?.email}</div>
            </div>
          </div>
        </div>

        <PanelDashboardBlocks startDate={startDate} endDate={endDate} yesterday={yesterday} />
      </div>
    </div>
  );
}
