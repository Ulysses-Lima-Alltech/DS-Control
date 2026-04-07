'use client';

import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ApplicationsOverviewDashboard } from '@/components/ApplicationsOverviewDashboard';
import DialogForm from '@/components/DialogForm';
import FormApplication from '@/components/Forms/FormApplication';
import { TableApplications } from '@/components/Tables/TableApplications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServiceOrderStatus } from '@/types/service-order.type';

export default function AgriculturalApplicationsPage() {
  // Filter state - lifted from TableApplications
  const [search, setSearch] = useState('');
  const [serviceOrderStatus, setServiceOrderStatus] = useState<ServiceOrderStatus | undefined>(
    undefined
  );
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [pilotId, setPilotId] = useState<string | undefined>(undefined);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [serviceOrderId, setServiceOrderId] = useState<string | undefined>(undefined);
  const [invalidApplication, setInvalidApplication] = useState<boolean | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const filterProps = {
    search,
    serviceOrderStatus,
    farmId,
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
      setPilotId,
      setCustomerId,
      setServiceOrderId,
      setInvalidApplication,
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

      <Tabs defaultValue='overview' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='overview'>Visão Geral</TabsTrigger>
          <TabsTrigger value='records'>Registros</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-4'>
          <ApplicationsOverviewDashboard {...filterProps} />
        </TabsContent>

        <TabsContent value='records' className='space-y-4'>
          <Card className='max-w-full overflow-auto p-0'>
            <CardContent className='ph-6'>
              <TableApplications
                search={search}
                serviceOrderStatus={serviceOrderStatus}
                farmId={farmId}
                pilotId={pilotId}
                customerIdFilter={customerId}
                serviceOrderIdFilter={serviceOrderId}
                invalidApplication={invalidApplication}
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
