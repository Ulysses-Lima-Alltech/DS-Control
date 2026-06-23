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

  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | undefined>(undefined);
  const [farmFilter, setFarmFilter] = useState<string | undefined>(undefined);
  const [pilotFilter, setPilotFilter] = useState<string | undefined>(undefined);
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(undefined);
  const [plannedDateFilter, setPlannedDateFilter] = useState<
    { startDate: string; endDate: string } | undefined
  >(undefined);

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
    <div className='relative min-h-full max-w-screen overflow-hidden p-5 lg:p-8'>
      <div className='pointer-events-none absolute right-0 top-0 h-72 w-[46rem] overflow-hidden opacity-80'>
        <div className='absolute -right-16 top-0 h-40 w-[34rem] rounded-bl-[80%] bg-[color:color-mix(in_oklch,var(--brand-secondary)_14%,white)]' />
        <div className='absolute right-16 top-24 h-28 w-[34rem] rounded-tl-full bg-[color:color-mix(in_oklch,var(--brand-primary)_9%,white)]' />
      </div>
      <div className='relative z-10 mb-9 flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div>
          <h1 className='text-3xl font-semibold tracking-normal text-[color:color-mix(in_oklch,var(--brand-primary)_72%,black)]'>
            Ordens de Serviço
          </h1>
          <p className='text-base text-muted-foreground'>
            Gerencie todas as ordens de serviço do sistema
          </p>
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
            <Button
              variant='default'
              onClick={() => setIsDialogNewServiceOrderOpen(true)}
              className='h-14 rounded-2xl bg-[#0AAA50] px-7 text-sm font-semibold shadow-[0_10px_22px_rgba(10,170,80,0.24)] hover:bg-[#099044]'
            >
              <Plus className='mr-2 h-5 w-5' />
              Nova OS
            </Button>
          }
          className='sm:max-w-6xl h-[700px] max-h-[90vh] flex flex-col'
        />
      </div>

      <div className='relative z-10 w-full max-w-none'>
        <DashboardCardServiceOrders
          stats={stats?.stats || null}
          isLoadingStats={isLoadingStats}
          isErrorOnStats={isErrorOnStats}
          showButton={false}
        />
      </div>

      <Card className='relative z-10 mt-6 max-w-full overflow-hidden rounded-[22px] border-border/60 bg-card/95 p-0 shadow-[0_14px_34px_rgba(15,23,42,0.06)]'>
        <CardContent className='p-6'>
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
