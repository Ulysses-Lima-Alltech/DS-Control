'use client';

import { subDays } from 'date-fns';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormApplication from '@/components/Forms/FormApplication';
import { TableApplications } from '@/components/Tables/TableApplications';
import { Button } from '@/components/ui/button';
import { toOperationalDateYMD, toOperationalDateYMDOrToday } from '@/utils/operational-date';

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getYesterdayDateString = () => {
  const todayYmd = toOperationalDateYMDOrToday();
  const [year, month, day] = todayYmd.split('-').map(Number);
  const todayDate = new Date(year, month - 1, day);
  return toOperationalDateYMD(subDays(todayDate, 1)) ?? todayYmd;
};

const resolveInitialDateRange = (
  urlStartDate: string | null,
  urlEndDate: string | null
): { startDate: string; endDate: string } => {
  const hasValidStart = !!urlStartDate && DATE_PARAM_REGEX.test(urlStartDate);
  const hasValidEnd = !!urlEndDate && DATE_PARAM_REGEX.test(urlEndDate);

  if (hasValidStart && hasValidEnd) {
    return {
      startDate: urlStartDate,
      endDate: urlEndDate,
    };
  }

  const yesterday = getYesterdayDateString();
  return {
    startDate: yesterday,
    endDate: yesterday,
  };
};

export default function AgriculturalApplicationsPage() {
  const searchParams = useSearchParams();
  const initialDateRange = useMemo(
    () => resolveInitialDateRange(searchParams.get('startDate'), searchParams.get('endDate')),
    [searchParams]
  );

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>(initialDateRange.startDate);
  const [endDate, setEndDate] = useState<string | undefined>(initialDateRange.endDate);

  const filterChangeHandlers = useMemo(
    () => ({
      setSearch,
      setServiceOrderStatus: (_value: unknown) => undefined,
      setFarmId: (_value: unknown) => undefined,
      setProductId: (_value: unknown) => undefined,
      setPilotId: (_value: unknown) => undefined,
      setCustomerId: (_value: unknown) => undefined,
      setServiceOrderId: (_value: unknown) => undefined,
      setInvalidApplication: (_value: unknown) => undefined,
      setApplicationIssue: (_value: unknown) => undefined,
      setStartDate,
      setEndDate,
    }),
    []
  );

  return (
    <div className='p-6 space-y-6 min-h-full max-w-screen'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Aplicações</h1>
          <p>Gerencie todas as aplicações de produto do sistema</p>
        </div>
        <DialogForm
          form={<FormApplication />}
          trigger={
            <Button variant='default'>
              <Plus className='w-4 h-4 mr-2' />
              Nova Aplicação
            </Button>
          }
          className='sm:max-w-4xl h-[700px] max-h-[90vh] flex flex-col'
        />
      </div>

      <div className='max-w-full overflow-auto'>
        <TableApplications
          search={search}
          startDate={startDate}
          endDate={endDate}
          onFilterChange={filterChangeHandlers}
        />
      </div>
    </div>
  );
}
