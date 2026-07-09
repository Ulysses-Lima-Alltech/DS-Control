'use client';

import { subDays } from 'date-fns';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormApplication from '@/components/Forms/FormApplication';
import { TableApplications } from '@/components/Tables/TableApplications';
import { Button } from '@/components/ui/button';
import { useGetCurrentCropSeason } from '@/queries/crop-season.query';
import { ApplicationIssueFilter } from '@/types/applications.type';
import { ServiceOrderStatus } from '@/types/service-order.type';
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
): { startDate: string; endDate: string } | undefined => {
  const hasValidStart = !!urlStartDate && DATE_PARAM_REGEX.test(urlStartDate);
  const hasValidEnd = !!urlEndDate && DATE_PARAM_REGEX.test(urlEndDate);

  if (hasValidStart && hasValidEnd) {
    return {
      startDate: urlStartDate,
      endDate: urlEndDate,
    };
  }

  return undefined;
};

const VALID_SERVICE_ORDER_STATUS = new Set<ServiceOrderStatus>(['open', 'completed', 'cancelled']);
const VALID_APPLICATION_ISSUES = new Set<ApplicationIssueFilter>([
  'invalid_open_os',
  'structural_pending',
  'structural_pending_other',
  'structural_missing_plot',
  'structural_missing_farm',
]);

const parseCropSeasonIds = (searchParams: ReturnType<typeof useSearchParams>): string[] => {
  const fromRepeated = searchParams.getAll('cropSeasonIds').flatMap((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
  const fromSingle = searchParams.get('cropSeasonId');
  const unique = Array.from(new Set([...(fromSingle ? [fromSingle] : []), ...fromRepeated]));
  return unique;
};

export default function AgriculturalApplicationsPage() {
  const searchParams = useSearchParams();
  const initialDateRange = useMemo(
    () => resolveInitialDateRange(searchParams.get('startDate'), searchParams.get('endDate')),
    [searchParams]
  );
  const initialCropSeasonIds = useMemo(() => parseCropSeasonIds(searchParams), [searchParams]);
  const initialCropSeasonId =
    initialCropSeasonIds.length === 1 ? initialCropSeasonIds[0] : undefined;
  const initialCustomerId = useMemo(
    () => searchParams.get('customerId') || undefined,
    [searchParams]
  );
  const initialFarmId = useMemo(() => searchParams.get('farmId') || undefined, [searchParams]);
  const initialPilotId = useMemo(() => searchParams.get('pilotId') || undefined, [searchParams]);
  const initialAssistantId = useMemo(
    () => searchParams.get('assistantId') || undefined,
    [searchParams]
  );
  const initialProductId = useMemo(
    () => searchParams.get('productId') || undefined,
    [searchParams]
  );
  const initialDroneId = useMemo(() => searchParams.get('droneId') || undefined, [searchParams]);
  const initialServiceOrderStatus = useMemo(() => {
    const value = searchParams.get('serviceOrderStatus');
    if (!value || !VALID_SERVICE_ORDER_STATUS.has(value as ServiceOrderStatus)) return undefined;
    return value as ServiceOrderStatus;
  }, [searchParams]);
  const initialApplicationIssue = useMemo(() => {
    const value = searchParams.get('applicationIssue');
    if (!value || !VALID_APPLICATION_ISSUES.has(value as ApplicationIssueFilter)) return undefined;
    return value as ApplicationIssueFilter;
  }, [searchParams]);

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>(initialDateRange?.startDate);
  const [endDate, setEndDate] = useState<string | undefined>(initialDateRange?.endDate);
  const [cropSeasonId, setCropSeasonId] = useState<string | undefined>(initialCropSeasonId);
  const [cropSeasonIds, setCropSeasonIds] = useState<string[] | undefined>(
    initialCropSeasonIds.length > 0 ? initialCropSeasonIds : undefined
  );
  const [serviceOrderStatus, setServiceOrderStatus] = useState<ServiceOrderStatus | undefined>(
    initialServiceOrderStatus
  );
  const [farmId, setFarmId] = useState<string | undefined>(initialFarmId);
  const [productId, setProductId] = useState<string | undefined>(initialProductId);
  const [pilotId, setPilotId] = useState<string | undefined>(initialPilotId);
  const [customerId, setCustomerId] = useState<string | undefined>(initialCustomerId);
  const [assistantId, setAssistantId] = useState<string | undefined>(initialAssistantId);
  const [droneId, setDroneId] = useState<string | undefined>(initialDroneId);
  const [applicationIssue, setApplicationIssue] = useState<ApplicationIssueFilter | undefined>(
    initialApplicationIssue
  );

  const { data: currentCropSeasonData, isLoading: isLoadingCurrentCropSeason } =
    useGetCurrentCropSeason();

  const hasInitializedDefaults = useRef(false);

  useEffect(() => {
    if (hasInitializedDefaults.current || isLoadingCurrentCropSeason) {
      return;
    }

    const currentCropSeasonId = currentCropSeasonData?.cropSeason?.id;
    if (initialCropSeasonIds.length > 0) {
      hasInitializedDefaults.current = true;
      return;
    }

    if (currentCropSeasonId) {
      setCropSeasonId(currentCropSeasonId);
      setCropSeasonIds([currentCropSeasonId]);

      if (!initialDateRange) {
        setStartDate(undefined);
        setEndDate(undefined);
      }

      hasInitializedDefaults.current = true;
      return;
    }

    if (!initialDateRange) {
      const yesterday = getYesterdayDateString();
      setStartDate(yesterday);
      setEndDate(yesterday);
    }

    hasInitializedDefaults.current = true;
  }, [
    currentCropSeasonData?.cropSeason?.id,
    initialCropSeasonIds,
    initialDateRange,
    isLoadingCurrentCropSeason,
  ]);

  const filterChangeHandlers = useMemo(
    () => ({
      setSearch,
      setServiceOrderStatus,
      setFarmId,
      setProductId,
      setPilotId,
      setCustomerId,
      setServiceOrderId: () => undefined,
      setInvalidApplication: () => undefined,
      setApplicationIssue,
      setStartDate,
      setEndDate,
      setCropSeasonId,
      setCropSeasonIds,
      setAssistantId,
      setDroneId,
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
          serviceOrderStatus={serviceOrderStatus}
          farmId={farmId}
          productId={productId}
          startDate={startDate}
          endDate={endDate}
          cropSeasonId={cropSeasonId}
          cropSeasonIds={cropSeasonIds}
          pilotId={pilotId}
          customerIdFilter={customerId}
          assistantIdFilter={assistantId}
          droneIdFilter={droneId}
          applicationIssue={applicationIssue}
          onFilterChange={filterChangeHandlers}
        />
      </div>
    </div>
  );
}
