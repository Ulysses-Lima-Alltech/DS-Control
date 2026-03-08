'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import DialogForm from '@/components/DialogForm';
import FormApplication from '@/components/Forms/FormApplication';
import { PendingApplicationsPanel } from '@/components/PendingApplicationsPanel';
import { StatsApplications } from '@/components/StatsApplications';
import { TableApplications } from '@/components/Tables/TableApplications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-6'>
        <StatsApplications {...filterProps} />

        <PendingApplicationsPanel {...filterProps} />
      </div>

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
            onFilterChange={{
              setSearch,
              setServiceOrderStatus,
              setFarmId,
              setPilotId,
              setCustomerId,
              setServiceOrderId,
              setInvalidApplication,
              setStartDate,
              setEndDate,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
