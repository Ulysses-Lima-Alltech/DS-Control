'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { use, useMemo, useState } from 'react';

import CardServiceOrderDetails from '@/components/CardServiceOrderDetails';
import { StatsServiceOrderPlotProgress } from '@/components/StatsServiceOrderPlotProgress';
import { TableApplications } from '@/components/Tables/TableApplications';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGetApplicationsByServiceOrderId } from '@/queries/application.query';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import { ServiceOrderStatus } from '@/types/service-order.type';

export default function ServiceOrderPage({
  params,
}: {
  params: Promise<{ idServiceOrder: string }>;
}) {
  const { idServiceOrder } = use(params);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { data: applicationsData } = useGetApplicationsByServiceOrderId(idServiceOrder);

  const hasApplicationsWithNullPlot = useMemo(() => {
    if (!applicationsData) return false;

    return applicationsData.data.some((application) => {
      return application.plot === null;
    });
  }, [applicationsData]);

  const {
    data: serviceOrderData,
    isPending: isServiceOrderLoading,
    isError: isServiceOrderError,
  } = useGetServiceOrderById(idServiceOrder, {
    includePlots: 'true',
    includeGeoJson: 'false',
    includePilots: 'true',
    includeFarms: 'true',
    includeContracts: 'true',
    includeCustomers: 'true',
  });

  const getStatusLabel = (status: ServiceOrderStatus | undefined) => {
    switch (status) {
      case 'open':
        return 'Aberto';
      case 'completed':
        return 'Concluído';
      case 'cancelled':
        return 'Cancelado';
      default:
        return undefined;
    }
  };

  return (
    <div className='flex h-[calc(100vh-4rem)]'>
      <div
        className={`flex-1 relative overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]  ${isSidebarOpen ? '' : 'pr-2'}`}
      >
        <div className='transition-all duration-300 flex-1 flex flex-col'>
          <div className={`h-full flex flex-col p-8`}>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
              {/* <StatsServiceOrderPerformance applications={applicationsData?.data || []} /> */}
              <StatsServiceOrderPlotProgress
                plots={serviceOrderData?.plots || []}
                applications={applicationsData?.data || []}
              />
            </div>

            <Card className='h-full flex flex-col gap-0 py-2'>
              <div className='flex-1 min-h-0 p-0'>
                <div className='flex-1 min-h-0 px-8 pb-8 pt-6'>
                  <TableApplications
                    serviceOrderId={idServiceOrder}
                    customerId={serviceOrderData?.customerId}
                    customerName={serviceOrderData?.customer?.name}
                    defaultStatus={serviceOrderData?.status}
                    statusLabel={getStatusLabel(serviceOrderData?.status)}
                    disableStatusFilter={true}
                    disableCustomerFilter={true}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
        <SidebarToggle isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      </div>

      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? 'w-1/5' : 'w-0'
        } flex-shrink-0 overflow-hidden`}
      >
        {isSidebarOpen && (
          <div className={`h-full p-0 ${isSidebarOpen ? '' : 'ml-0'}`}>
            <CardServiceOrderDetails
              serviceOrder={serviceOrderData}
              isLoading={isServiceOrderLoading}
              isError={isServiceOrderError}
              hasApplicationsWithNullPlot={hasApplicationsWithNullPlot}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarToggle({
  isSidebarOpen,
  setIsSidebarOpen,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}) {
  return (
    <Button
      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      variant='outline'
      size='sm'
      className={`absolute ${isSidebarOpen ? '-right-1' : '-right-1'} top-8 z-50 h-8 w-8 p-0 shadow-md bg-white border-2`}
    >
      {isSidebarOpen ? <ChevronRight className='h-4 w-4' /> : <ChevronLeft className='h-4 w-4' />}
    </Button>
  );
}
