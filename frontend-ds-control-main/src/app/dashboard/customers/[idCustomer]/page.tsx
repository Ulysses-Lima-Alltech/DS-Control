'use client';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { use, useState } from 'react';

import CardCustomerDetails from '@/components/CardCustomerDetails';
import DialogForm from '@/components/DialogForm';
import FormApplication from '@/components/Forms/FormApplication';
import FormRegisterNewContract from '@/components/Forms/FormRegisterNewContract';
import FormRegisterNewFarm from '@/components/Forms/FormRegisterNewFarm';
import FormRegisterNewServiceOrder from '@/components/Forms/FormRegisterNewServiceOrder';
import { StatsCustomerPerformance } from '@/components/StatsCustomerPerformance';
import { TableApplications } from '@/components/Tables/TableApplications';
import { TableContracts } from '@/components/Tables/TableContracts';
import TableFarms from '@/components/Tables/TableFarms';
import { TableServiceOrders } from '@/components/Tables/TableServiceOrders';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetAllApplications } from '@/queries/application.query';
import { useGetContractsByCustomerId } from '@/queries/contract.query';
import { useGetCustomerById } from '@/queries/customer.query';
import { useGetAllFarms } from '@/queries/farm.query';
import { useGetAllServiceOrders } from '@/queries/service-order.query';
import { GetCustomerByIdResponse } from '@/services/customer.service';

export default function CustomerPage({ params }: { params: Promise<{ idCustomer: string }> }) {
  const { idCustomer } = use(params);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className='flex h-[calc(100vh-4rem)]'>
      <div
        className={`flex-1 relative overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]  ${isSidebarOpen ? '' : 'pr-2'}`}
      >
        <TabsSection customerId={idCustomer} />
        <SidebarToggle isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      </div>
      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? 'w-1/5' : 'w-0'
        } flex-shrink-0 overflow-hidden`}
      >
        {isSidebarOpen && (
          <div className={`h-full p-0 ${isSidebarOpen ? '' : 'ml-0'}`}>
            <CardCustomerDetails customerId={idCustomer} />
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

function TabsSection({ customerId }: { customerId: string }) {
  const { data: customerData } = useGetCustomerById(customerId);
  const { data: farmsData } = useGetAllFarms(customerId, { includePlots: 'true' });
  const { data: allServiceOrdersData } = useGetAllServiceOrders({
    customerId,
    includePlots: 'true',
    includeFarms: 'true',
    includeCustomers: 'true',
  });
  const { data: contractsData } = useGetContractsByCustomerId(customerId);
  const { data: applicationsData } = useGetAllApplications({ customerId });

  const serviceOrdersCount = allServiceOrdersData?.totalCount || 0;
  const farmsCount = farmsData?.data.length || 0;
  const applicationsCount = applicationsData?.totalCount || 0;
  const contractsCount = contractsData?.totalCount || 0;

  return (
    <div className='transition-all duration-300 flex-1 flex flex-col'>
      <div className={`h-full flex flex-col p-8`}>
        <StatsCustomerPerformance
          serviceOrders={allServiceOrdersData?.data || []}
          farms={farmsData?.data || []}
          applications={applicationsData?.data || []}
          customerId={customerId}
        />
        <Card className='h-full flex flex-col gap-0 py-2'>
          <div className='flex-1 min-h-0 p-0'>
            <Tabs defaultValue='service-orders' className='h-full flex flex-col'>
              <div className='overflow-x-auto overflow-y-hidden scrollbar-hide px-6'>
                <TabsList className='flex flex-row gap-4 w-full border-b'>
                  <TabsTrigger value='service-orders' className='whitespace-nowrap'>
                    Ordens de Serviço ({serviceOrdersCount})
                  </TabsTrigger>
                  <TabsTrigger value='applications' className='whitespace-nowrap'>
                    Aplicações ({applicationsCount})
                  </TabsTrigger>
                  <TabsTrigger value='contracts' className='whitespace-nowrap'>
                    Contratos ({contractsCount})
                  </TabsTrigger>
                  <TabsTrigger value='farms' className='whitespace-nowrap'>
                    Fazendas ({farmsCount})
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value='farms' className='flex-1 mt-6 px-8'>
                <FarmTableSection customerId={customerId} customerData={customerData} />
              </TabsContent>
              <TabsContent value='service-orders' className='flex-1 mt-6  px-8'>
                <ServiceOrdersTableSection customerId={customerId} />
              </TabsContent>
              <TabsContent value='applications' className='flex-1 mt-6 px-8'>
                <ApplicationsTableSection customerId={customerId} />
              </TabsContent>
              <TabsContent value='contracts' className='flex-1 mt-6 px-8'>
                <ContractsTableSection customerId={customerId} customerData={customerData} />
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FarmTableSection({
  customerId,
  customerData,
}: {
  customerId: string;
  customerData: GetCustomerByIdResponse | undefined;
}) {
  const [isNewFarmDialogOpen, setIsNewFarmDialogOpen] = useState(false);

  return (
    <div className='h-full flex flex-col'>
      <div className='flex justify-between items-center mb-4'>
        <h3 className='text-lg font-semibold'>
          {customerData?.customer?.name ? `Fazendas do ${customerData.customer.name}` : 'Fazendas'}
        </h3>
        {customerData?.customer ? (
          <DialogForm
            form={
              <FormRegisterNewFarm
                customer={customerData.customer}
                closeDialog={() => {
                  setIsNewFarmDialogOpen(false);
                }}
              />
            }
            isOpen={isNewFarmDialogOpen}
            setIsOpen={setIsNewFarmDialogOpen}
            trigger={
              <Button onClick={() => setIsNewFarmDialogOpen(!isNewFarmDialogOpen)}>
                <Plus className='h-4 w-4' />
                Nova fazenda
              </Button>
            }
            className='sm:max-w-5xl p-0'
          />
        ) : (
          <Button disabled>
            <Plus className='h-4 w-4' />
            Nova fazenda
          </Button>
        )}
      </div>
      <div className='flex-1 min-h-0'>
        <TableFarms customerId={customerId} />
      </div>
    </div>
  );
}

function ServiceOrdersTableSection({ customerId }: { customerId: string }) {
  const [isNewServiceOrderDialogOpen, setIsNewServiceOrderDialogOpen] = useState(false);

  return (
    <div className='h-full flex flex-col'>
      <div className='flex justify-between items-center mb-4'>
        <h3 className='text-lg font-semibold'>Ordens de Serviço</h3>
        <DialogForm
          form={
            <FormRegisterNewServiceOrder
              closeDialog={() => setIsNewServiceOrderDialogOpen(false)}
            />
          }
          isOpen={isNewServiceOrderDialogOpen}
          setIsOpen={setIsNewServiceOrderDialogOpen}
          trigger={
            <Button variant='default' onClick={() => setIsNewServiceOrderDialogOpen(true)}>
              <Plus className='w-4 h-4 mr-2' />
              Nova OS
            </Button>
          }
          className='sm:max-w-6xl h-[700px] max-h-[90vh] flex flex-col'
        />
      </div>
      <div className='flex-1 min-h-0'>
        <TableServiceOrders
          customerId={customerId}
          onStatusFilterChange={() => {}}
          onFarmFilterChange={() => {}}
          onPilotFilterChange={() => {}}
          onCustomerFilterChange={() => {}}
          onPlannedDateFilterChange={() => {}}
        />
      </div>
    </div>
  );
}

function ApplicationsTableSection({ customerId }: { customerId: string }) {
  const [isNewApplicationDialogOpen, setIsNewApplicationDialogOpen] = useState(false);

  return (
    <div className='h-full flex flex-col'>
      <div className='flex justify-between items-center mb-4'>
        <h3 className='text-lg font-semibold'>Aplicações Agrícolas</h3>
        <DialogForm
          form={<FormApplication />}
          isOpen={isNewApplicationDialogOpen}
          setIsOpen={setIsNewApplicationDialogOpen}
          trigger={
            <Button variant='default' onClick={() => setIsNewApplicationDialogOpen(true)}>
              <Plus className='w-4 h-4 mr-2' />
              Nova Aplicação
            </Button>
          }
          className='sm:max-w-4xl h-[700px] max-h-[90vh] flex flex-col'
        />
      </div>
      <div className='flex-1 min-h-0'>
        <TableApplications customerId={customerId} />
      </div>
    </div>
  );
}

function ContractsTableSection({
  customerId,
  customerData,
}: {
  customerId: string;
  customerData: GetCustomerByIdResponse | undefined;
}) {
  const [isNewContractDialogOpen, setIsNewContractDialogOpen] = useState(false);

  return (
    <div className='h-full flex flex-col'>
      <div className='flex justify-between items-center mb-4'>
        <h3 className='text-lg font-semibold'>
          {customerData?.customer?.name
            ? `Contratos do ${customerData.customer.name}`
            : 'Contratos'}
        </h3>
        {customerData?.customer ? (
          <DialogForm
            form={
              <FormRegisterNewContract
                customerId={customerId}
                closeDialog={() => setIsNewContractDialogOpen(false)}
              />
            }
            isOpen={isNewContractDialogOpen}
            setIsOpen={setIsNewContractDialogOpen}
            trigger={
              <Button onClick={() => setIsNewContractDialogOpen(!isNewContractDialogOpen)}>
                <Plus className='h-4 w-4' />
                Novo contrato
              </Button>
            }
            className='sm:max-w-4xl p-0'
          />
        ) : (
          <Button disabled>
            <Plus className='h-4 w-4' />
            Novo contrato
          </Button>
        )}
      </div>
      <div className='flex-1 min-h-0'>
        <TableContracts customerId={customerId} />
      </div>
    </div>
  );
}
