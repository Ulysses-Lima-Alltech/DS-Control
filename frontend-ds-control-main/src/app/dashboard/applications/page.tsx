'use client';

import { format, subDays } from 'date-fns';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { ApplicationsOverviewDashboard } from '@/components/ApplicationsOverviewDashboard';
import DialogForm from '@/components/DialogForm';
import FormApplication from '@/components/Forms/FormApplication';
import { TableApplications } from '@/components/Tables/TableApplications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ApplicationIssueFilter } from '@/types/applications.type';
import { ServiceOrderStatus } from '@/types/service-order.type';

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getYesterdayDateString = () => format(subDays(new Date(), 1), 'yyyy-MM-dd');

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

  const [activeTab, setActiveTab] = useState('overview');

  // Filter state - lifted from TableApplications
  const [search, setSearch] = useState('');
  const [serviceOrderStatus, setServiceOrderStatus] = useState<ServiceOrderStatus | undefined>(
    undefined
  );
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [pilotId, setPilotId] = useState<string | undefined>(undefined);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [serviceOrderId, setServiceOrderId] = useState<string | undefined>(undefined);
  const [invalidApplication, setInvalidApplication] = useState<boolean | undefined>(undefined);
  const [applicationIssue, setApplicationIssue] = useState<ApplicationIssueFilter | undefined>(
    undefined
  );
  const [startDate, setStartDate] = useState<string | undefined>(initialDateRange.startDate);
  const [endDate, setEndDate] = useState<string | undefined>(initialDateRange.endDate);

  const filterProps = {
    search,
    serviceOrderStatus,
    farmId,
    productId,
    pilotId,
    customerId,
    serviceOrderId,
    invalidApplication,
    startDate,
    endDate,
  };

  const filterChangeHandlers = useMemo(
    () => ({
      setSearch,
      setServiceOrderStatus,
      setFarmId,
      setProductId,
      setPilotId,
      setCustomerId,
      setServiceOrderId,
      setInvalidApplication,
      setApplicationIssue,
      setStartDate,
      setEndDate,
    }),
    []
  );

  const handleNavigateRecordsWithIssue = useCallback((issue: ApplicationIssueFilter) => {
    setApplicationIssue(issue);
    setInvalidApplication(undefined);
    if (issue === 'invalid_open_os') {
      setServiceOrderStatus('open');
    }
    setActiveTab('records');
  }, []);

  const clearOverviewFilters = useCallback(() => {
    const yesterday = getYesterdayDateString();
    setServiceOrderStatus(undefined);
    setFarmId(undefined);
    setProductId(undefined);
    setPilotId(undefined);
    setCustomerId(undefined);
    setStartDate(yesterday);
    setEndDate(yesterday);
  }, []);

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-4'>
        <TabsList>
          <TabsTrigger value='overview'>Visão Geral</TabsTrigger>
          <TabsTrigger value='records'>Registros</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-4'>
          <ApplicationsOverviewDashboard
            {...filterProps}
            onNavigateRecordsWithIssue={handleNavigateRecordsWithIssue}
            onFarmFilterChange={setFarmId}
            onCustomerFilterChange={setCustomerId}
            onProductFilterChange={setProductId}
            onPilotFilterChange={setPilotId}
            onServiceOrderStatusChange={setServiceOrderStatus}
            onDateRangeChange={(range) => {
              if (!range) {
                const yesterday = getYesterdayDateString();
                setStartDate(yesterday);
                setEndDate(yesterday);
                return;
              }
              setStartDate(range.startDate);
              setEndDate(range.endDate);
            }}
            onClearOverviewFilters={clearOverviewFilters}
          />
        </TabsContent>

        <TabsContent value='records' className='space-y-4'>
          <Card className='max-w-full overflow-auto p-0'>
            <CardContent className='ph-6'>
              <TableApplications
                search={search}
                serviceOrderStatus={serviceOrderStatus}
                farmId={farmId}
                productId={productId}
                pilotId={pilotId}
                customerIdFilter={customerId}
                serviceOrderIdFilter={serviceOrderId}
                invalidApplication={invalidApplication}
                applicationIssue={applicationIssue}
                startDate={startDate}
                endDate={endDate}
                onFilterChange={filterChangeHandlers}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
