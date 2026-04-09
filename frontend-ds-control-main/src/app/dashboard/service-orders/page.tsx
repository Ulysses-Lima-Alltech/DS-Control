'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DashboardCardServiceOrders } from '@/components/DashboardCardServiceOrders';
import DialogForm from '@/components/DialogForm';
import FormRegisterNewServiceOrder from '@/components/Forms/FormRegisterNewServiceOrder';
import { TableServiceOrders } from '@/components/Tables/TableServiceOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGetStatsServiceorders } from '@/queries/service-order.query';
import { ServiceOrderStatus } from '@/types/service-order.type';

export default function ServiceOrdersPage() {
  const [isDialogNewServiceOrderOpen, setIsDialogNewServiceOrderOpen] = useState(false);

  // Filter state lifted to page level
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | undefined>(undefined);
  const [farmFilter, setFarmFilter] = useState<string | undefined>(undefined);
  const [pilotFilter, setPilotFilter] = useState<string | undefined>(undefined);
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(undefined);
  const [plannedDateFilter, setPlannedDateFilter] = useState<
    { startDate: string; endDate: string } | undefined
  >(undefined);

  // Prepare filter params for stats
  const statsParams = {
    status: statusFilter,
    farmId: farmFilter,
    pilotId: pilotFilter,
    customerId: customerFilter,
    startDate: plannedDateFilter?.startDate,
    endDate: plannedDateFilter?.endDate,
  };

  const {
    data: stats,
    isPending: isLoadingStats,
    isError: isErrorOnStats,
  } = useGetStatsServiceorders(statsParams);

  return (
    <div className='p-6 space-y-6 min-h-full max-w-screen'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Ordens de Serviço</h1>
          <p>Gerencie todas as ordens de serviço do sistema</p>
        </div>
        <DialogForm
          form={
            <FormRegisterNewServiceOrder
              closeDialog={() => setIsDialogNewServiceOrderOpen(false)}
            />
          }
          isOpen={isDialogNewServiceOrderOpen}
          setIsOpen={setIsDialogNewServiceOrderOpen}
          trigger={
            <Button variant='default' onClick={() => setIsDialogNewServiceOrderOpen(true)}>
              <Plus className='w-4 h-4 mr-2' />
              Nova OS
            </Button>
          }
          className='sm:max-w-6xl h-[700px] max-h-[90vh] flex flex-col'
        />
      </div>

      <div className='w-full max-w-none'>
        <DashboardCardServiceOrders
          stats={stats?.stats || null}
          isLoadingStats={isLoadingStats}
          isErrorOnStats={isErrorOnStats}
          showButton={false}
        />
      </div>

      <Card className='max-w-full overflow-auto p-0'>
        <CardContent className='ph-6'>
          <TableServiceOrders
            customerId={undefined}
            statusFilter={statusFilter}
            farmFilter={farmFilter}
            pilotFilter={pilotFilter}
            customerFilter={customerFilter}
            plannedDateFilter={plannedDateFilter}
            onStatusFilterChange={setStatusFilter}
            onFarmFilterChange={setFarmFilter}
            onPilotFilterChange={setPilotFilter}
            onCustomerFilterChange={setCustomerFilter}
            onPlannedDateFilterChange={setPlannedDateFilter}
          />
        </CardContent>
      </Card>
    </div>
  );
}
