'use client';

import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { type CellContext } from '@tanstack/react-table';
import { debounce } from 'lodash';
import { CheckCircle, Clock, Edit, Eye, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import DateRangePicker from '@/components/DateRangePicker';
import DialogForm from '@/components/DialogForm';
import FormEditServiceOrder from '@/components/Forms/FormEditServiceOrder';
import { Button } from '@/components/ui/button';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { DataTable, type ColumnDefWithId } from '@/components/ui/table-data';
import {
    createActionsColumn,
    createBadgesColumn,
    createColumn,
    createDateColumn,
} from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllServiceOrders } from '@/queries/service-order.query';
import { useGetAllUsersInfinite } from '@/queries/user.query';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import { ServiceOrder, ServiceOrderBy, ServiceOrderStatus, ServiceOrderType } from '@/types/service-order.type';
import { User } from '@/types/user.type';

type TableServiceOrdersProps = {
  customerId: string | undefined;
  statusFilter?: ServiceOrderStatus;
  farmFilter?: string;
  pilotFilter?: string;
  customerFilter?: string;
  plannedDateFilter?: {startDate: string, endDate: string};
  onStatusFilterChange: (status: ServiceOrderStatus | undefined) => void;
  onFarmFilterChange: (farmId: string | undefined) => void;
  onPilotFilterChange: (pilotId: string | undefined) => void;
  onCustomerFilterChange: (customerId: string | undefined) => void;
  onPlannedDateFilterChange: (dateFilter: {startDate: string, endDate: string} | undefined) => void;
};

export const TableServiceOrders = ({
  customerId,
  statusFilter,
  farmFilter,
  pilotFilter,
  customerFilter,
  plannedDateFilter,
  onStatusFilterChange,
  onFarmFilterChange,
  onPilotFilterChange,
  onCustomerFilterChange,
  onPlannedDateFilterChange
}: TableServiceOrdersProps) => {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [serviceOrderToEdit, setServiceOrderToEdit] = React.useState<ServiceOrder | null>(null);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [customerSearchValue, setCustomerSearchValue] = React.useState('');
  const [farmSearchValue, setFarmSearchValue] = React.useState('');
  const [pilotSearchValue, setPilotSearchValue] = React.useState('');

  const [orderBy, setOrderBy] = React.useState<ServiceOrderBy | undefined>(undefined)
  const [orderType, setOrderType] = React.useState<ServiceOrderType | undefined>(undefined)

  const orderByOptions = [
    { value: 'name' as ServiceOrderBy, label: 'Nome' },
    { value: 'customer' as ServiceOrderBy, label: 'Cliente' },
    { value: 'planned_date' as ServiceOrderBy, label: 'Data planejada' },
  ]

  const orderTypeOptions = [
    { value: 'asc' as ServiceOrderType, label: 'Ascendente'},
    { value: 'desc' as ServiceOrderType, label: 'Descendente'},
  ]

  const {
    data: serviceOrdersData,
    isLoading,
    isError,
    error,
  } = useGetAllServiceOrders({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    status: statusFilter,
    farmId: farmFilter,
    pilotId: pilotFilter,
    customerId: customerFilter || customerId,
    startDate: plannedDateFilter?.startDate,
    endDate: plannedDateFilter?.endDate,
    includeGeoJson: 'false',
    includeContracts: 'true',
    includeFarms: 'true',
    includePlots: 'true',
    includePilots: 'true',
    includeCustomers: 'true',
    orderBy,
    orderType
  });

  const {
    data: customersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingCustomers,
  } = useGetAllCustomersInfinite({
    limit: '10',
    search: customerSearchValue || undefined,
  });

  const allCustomers =
    (customersData as unknown as InfiniteData<{ data: Customer[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const {
    data: farmsData,
    fetchNextPage: fetchNextPageFarms,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    isLoading: isLoadingFarms,
  } = useGetAllFarmsInfinite(customerId, {
    limit: '10',
    search: farmSearchValue || undefined,
  });

  const allFarms =
    (farmsData as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const {
    data: usersData,
    fetchNextPage: fetchNextPagePilots,
    hasNextPage: hasNextPagePilots,
    isFetchingNextPage: isFetchingNextPagePilots,
    isLoading: isLoadingPilots,
  } = useGetAllUsersInfinite({
    type: 'pilot',
    limit: '10',
    search: pilotSearchValue || undefined,
  });

  const allPilots =
    (usersData as unknown as InfiniteData<{ data: User[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const debouncedSearch = useMemo(
    () =>
      debounce((searchTerm: string) => {
        setDebouncedSearchValue(searchTerm);
        setCurrentPage(1);
      }, 600),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  {
    /* const handleGenerateStrategicMap = async (serviceOrder: ServiceOrder) => {
    try {
      await generateStrategicMap(serviceOrder);
      toast('Mapa estratégico gerado com sucesso');
    } catch (error) {
      toast((error as Error).message || 'Erro ao gerar mapa estratégico');
    }
  }; */
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className='h-4 w-4 text-green-500' />;
      case 'cancelled':
        return <XCircle className='h-4 w-4 text-red-500' />;
      case 'open':
        return <Clock className='h-4 w-4 text-blue-500' />;
      default:
        return <XCircle className='h-4 w-4 text-red-500' />;
    }
  };

  const getStatusTooltip = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'cancelled':
        return 'Cancelado';
      case 'open':
        return 'Aberto';
      default:
        return 'ERROR: Status desconhecido';
    }
  };

  const handleOrderByChange = (orderBy: ServiceOrderBy | undefined) => {
    setOrderBy(orderBy)
    setCurrentPage(1)
  }

  const handleOrderTypeChange = (orderType: ServiceOrderType | undefined) => {
    setOrderType(orderType)
    setCurrentPage(1)
  }

  type ServiceOrderColumnId =
    | 'number'
    | 'customer'
    | 'contract'
    | 'farms'
    | 'plots'
    | 'pilots'
    | 'observation'
    | 'createdAt'
    | 'plannedDate'
    | 'actions';

  const initialColumnVisibility: Partial<Record<ServiceOrderColumnId, boolean>> = {
    contract: false,
    farms: false,
    plots: false,
    createdAt: false,
  };

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const columns: ColumnDefWithId<ServiceOrder>[] = [
    createColumn<ServiceOrder>(
      'number',
      'number',
      'Número',
      ({ row }: CellContext<ServiceOrder, unknown>) => (
        <div className='flex items-center gap-2 min-w-0'>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className='flex-shrink-0'>{getStatusIcon(row.original.status)}</div>
            </TooltipTrigger>
            <TooltipContent>{getStatusTooltip(row.original.status)}</TooltipContent>
          </Tooltip>
          <div className='text-foreground whitespace-nowrap'>#{row.original.number || 'N/A'}</div>
        </div>
      ),
      { width: 120 }
    ),
    createColumn<ServiceOrder>('customer', 'customer.name', 'Cliente', ({ row }) => (
      <div className='text-foreground'>{row.original.customer?.name || 'N/A'}</div>
    )),
    createColumn<ServiceOrder>('contract', 'contract.name', 'Contrato', ({ row }) => (
      <div className='text-foreground'>{row.original.contract?.name || 'N/A'}</div>
    )),
    createBadgesColumn<ServiceOrder>('farms', 'farms', 'Fazendas', (row) => row.farms || [], {
      width: 200,
      maxItems: 3,
    }),
    createBadgesColumn<ServiceOrder>('plots', 'plots', 'Talhões', (row) => row.plots || [], {
      width: 200,
      maxItems: 3,
    }),
    createBadgesColumn<ServiceOrder>('pilots', 'pilots', 'Pilotos', (row) => row.pilots || [], {
      width: 200,
      maxItems: 3,
      onClick: (row) => toggleRow(row.id),
      isExpanded: (row) => !!expandedRows[row.id],
    }),
    {
      id: 'observation',
      accessorKey: 'observation',
      label: 'Observação',
      header: 'Observação',
      cell: ({ row }) => (
        <div className='text-foreground max-w-[200px] truncate'>
          {row.original.observation || 'N/A'}
        </div>
      ),
    },
    createDateColumn<ServiceOrder>('plannedDate', 'plannedDate', 'Data Planejada'),
    createDateColumn<ServiceOrder>('createdAt', 'createdAt', 'Data de Criação'),
    createActionsColumn<ServiceOrder>((serviceOrder) => (
      <div className='flex justify-center gap-2'>
        <Tooltip>
          <TooltipTrigger>
            <Button asChild variant='outline' size='icon' className='h-8 w-8'>
              <Link href={`/dashboard/service-orders/${serviceOrder.id}`}>
                <Eye className='h-4 w-4' />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Visualizar detalhes</TooltipContent>
        </Tooltip>
        <DialogForm
          form={
            <FormEditServiceOrder
              serviceOrderId={serviceOrder.id}
              onSuccess={() => setEditDialogOpen(false)}
            />
          }
          trigger={
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() => setServiceOrderToEdit(serviceOrder)}
              disabled={serviceOrder.status === 'completed' || serviceOrder.status === 'cancelled'}
            >
              <Edit className='h-4 w-4' />
            </Button>
          }
          className='sm:max-w-[150vh] max-h-[90vh] h-[90vh] flex flex-col'
          isOpen={editDialogOpen && serviceOrderToEdit?.id === serviceOrder.id}
          setIsOpen={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setServiceOrderToEdit(null);
            }
          }}
        />
      </div>
    )),
  ];

  const handleStatusChange = React.useCallback(
    (status: string | undefined) => {
      onStatusFilterChange(status as ServiceOrderStatus | undefined);
      setCurrentPage(1);
    },
    [onStatusFilterChange]
  );

  const handleCustomerChange = React.useCallback(
    (newCustomerId: string | undefined) => {
      if (!customerId) {
        onCustomerFilterChange(newCustomerId);
        setCurrentPage(1);
      }
    },
    [onCustomerFilterChange, customerId]
  );

  const handleFarmChange = React.useCallback(
    (farmId: string | undefined) => {
      onFarmFilterChange(farmId);
      setCurrentPage(1);
    },
    [onFarmFilterChange]
  );

  const handlePilotChange = React.useCallback(
    (pilotId: string | undefined) => {
      onPilotFilterChange(pilotId);
      setCurrentPage(1);
    },
    [onPilotFilterChange]
  );

  React.useEffect(() => {
    if (serviceOrdersData?.totalPages && currentPage > serviceOrdersData.totalPages) {
      setCurrentPage(1);
    }
  }, [serviceOrdersData?.totalPages, currentPage, setCurrentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const statusOptions = [
    { value: 'open' as ServiceOrderStatus, label: 'Aberto' },
    { value: 'completed' as ServiceOrderStatus, label: 'Concluído' },
    { value: 'cancelled' as ServiceOrderStatus, label: 'Cancelado' },
  ];

  const customers = allCustomers;
  const farms = allFarms;
  const pilots = allPilots;

  return (
    <>
      <DataTable
        columns={columns}
        data={serviceOrdersData?.data || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['service-orders'] })}
        searchConfig={{
          placeholder: 'Buscar ordens de serviço...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}
        filters={
          <div className='flex gap-2'>
            <SearchableSelectQuery
              options={statusOptions}
              value={statusFilter}
              onValueChange={(value) => handleStatusChange(value as ServiceOrderStatus | undefined)}
              placeholder='Status'
              searchPlaceholder='Buscar status...'
              clearable
              className='w-[120px]'
            />
            <DateRangePicker onChange={onPlannedDateFilterChange} initialValue={plannedDateFilter} className='w-[300px]'/>
            {!customerId &&
              <SearchableSelectQuery
              options={customers.map((customer: Customer) => ({
                value: customer.id,
                label: customer.name,
              }))}
              value={customerFilter}
              onValueChange={(value) => handleCustomerChange(value as string | undefined)}
              placeholder='Cliente'
              searchPlaceholder='Buscar cliente...'
              clearable
              disabled={!!customerId}
              onSearchChange={setCustomerSearchValue}
              onScrollEnd={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              isLoading={isLoadingCustomers}
              className='w-[120px]'
              popoverClassName='w-[250px]'
            />}
            <SearchableSelectQuery
              options={farms.map((farm: Farm) => ({
                value: farm.id,
                label: farm.name,
              }))}
              value={farmFilter}
              onValueChange={(value) => handleFarmChange(value as string | undefined)}
              placeholder='Fazenda'
              searchPlaceholder='Buscar fazenda...'
              clearable
              onSearchChange={setFarmSearchValue}
              onScrollEnd={fetchNextPageFarms}
              hasNextPage={hasNextPageFarms}
              isFetchingNextPage={isFetchingNextPageFarms}
              isLoading={isLoadingFarms}
              className='w-[120px]'
              popoverClassName='w-[250px]'
            />
            <SearchableSelectQuery
              options={pilots.map((pilot: User) => ({
                value: pilot.id,
                label: pilot.name,
              }))}
              value={pilotFilter}
              onValueChange={(value) => handlePilotChange(value as string | undefined)}
              placeholder='Piloto'
              searchPlaceholder='Buscar piloto...'
              clearable
              onSearchChange={setPilotSearchValue}
              onScrollEnd={fetchNextPagePilots}
              hasNextPage={hasNextPagePilots}
              isFetchingNextPage={isFetchingNextPagePilots}
              isLoading={isLoadingPilots}
              className='w-[120px]'
              popoverClassName='w-[250px]'
            />

            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as ServiceOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) => handleOrderTypeChange(value as ServiceOrderType | undefined)}
              placeholder='Ordenação'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />
          </div>
        }
        pagination={{
          manual: true,
          currentPage,
          pageSize,
          totalPages: serviceOrdersData?.totalPages || 1,
          totalCount: serviceOrdersData?.totalCount,
          onPageChange: setCurrentPage,
          onPageSizeChange: setPageSize,
        }}
        initialColumnVisibility={initialColumnVisibility}
        renderEmptyState={() => 'Nenhuma ordem de serviço encontrada.'}
      />
    </>

  );
};
