'use client';

import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, Trash } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DateRangePicker from '@/components/DateRangePicker';
import DialogForm from '@/components/DialogForm';
import FormApplication from '@/components/Forms/FormApplication';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DataTable, type ColumnDefWithId } from '@/components/ui/table-data';
import {
    createActionsColumn,
    createDateColumn,
    createTextColumn,
} from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteApplicationById } from '@/mutations/application.mutation';
import { useGetAllApplications } from '@/queries/application.query';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllServiceOrdersInfinite } from '@/queries/service-order.query';
import { useGetAllUsersInfinite } from '@/queries/user.query';
import { Application, ApplicationOrderBy, ApplicationOrderType } from '@/types/applications.type';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import { ServiceOrder, ServiceOrderStatus } from '@/types/service-order.type';
import { User } from '@/types/user.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';

interface TableApplicationsProps {
  customerId?: string;
  serviceOrderId?: string;
  defaultStatus?: ServiceOrderStatus;
  disableStatusFilter?: boolean;
  disableCustomerFilter?: boolean;
  customerName?: string;
  statusLabel?: string;
  // Filter props
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  pilotId?: string;
  customerIdFilter?: string;
  serviceOrderIdFilter?: string;
  invalidApplication?: boolean;
  startDate?: string;
  endDate?: string;
  // Filter change callbacks
  onFilterChange?: {
    setSearch: (value: string) => void;
    setServiceOrderStatus: (value: ServiceOrderStatus | undefined) => void;
    setFarmId: (value: string | undefined) => void;
    setPilotId: (value: string | undefined) => void;
    setCustomerId: (value: string | undefined) => void;
    setServiceOrderId: (value: string | undefined) => void;
    setInvalidApplication: (value: boolean | undefined) => void;
    setStartDate: (value: string | undefined) => void;
    setEndDate: (value: string | undefined) => void;
  };
}

export const TableApplications = ({
  customerId: propCustomerId,
  serviceOrderId: propServiceOrderId,
  defaultStatus,
  disableStatusFilter = false,
  disableCustomerFilter = false,
  customerName,
  statusLabel,
  // Filter props
  search: propSearch,
  serviceOrderStatus: propServiceOrderStatus,
  farmId: propFarmId,
  pilotId: propPilotId,
  customerIdFilter: propCustomerIdFilter,
  serviceOrderIdFilter: propServiceOrderIdFilter,
  invalidApplication: propInvalidApplication,
  startDate: propStartDate,
  endDate: propEndDate,
  // Filter change callbacks
  onFilterChange,
}: TableApplicationsProps) => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [customerSearchValue, setCustomerSearchValue] = React.useState('');
  const [farmSearchValue, setFarmSearchValue] = React.useState('');
  const [pilotSearchValue, setPilotSearchValue] = React.useState('');
  const [serviceOrderSearchValue, setServiceOrderSearchValue] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ServiceOrderStatus | undefined>(
    defaultStatus
  );
  const [farmFilter, setFarmFilter] = React.useState<string | undefined>(undefined);
  const [pilotFilter, setPilotFilter] = React.useState<string | undefined>(undefined);
  const [customerFilter, setCustomerFilter] = React.useState<string | undefined>(propCustomerId);
  const [serviceOrderFilter, setServiceOrderFilter] = React.useState<string | undefined>(
    propServiceOrderId
  );
  const [dateFilter, setDateFilter] = React.useState<{startDate: string, endDate:string} | undefined>(undefined)

  const searchParams = useSearchParams();
  const [invalidApplicationFilter, setInvalidApplicationFilter] = React.useState<string>(() => {
    const param = searchParams.get('invalidApplication');
    return param === 'true' ? 'true' : 'false';
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [applicationToDelete, setApplicationToDelete] = React.useState<Application | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [applicationToEdit, setApplicationToEdit] = React.useState<Application | null>(null);

  const [orderBy, setOrderBy] = React.useState<ApplicationOrderBy | undefined>(undefined)
  const [orderType, setOrderType] = React.useState<ApplicationOrderType | undefined>(undefined)

  const orderByOptions = [
    { value: 'date' as ApplicationOrderBy, label: 'Data da aplicação' },
    { value: 'pilot' as ApplicationOrderBy, label: 'Piloto' },
    { value: 'product' as ApplicationOrderBy, label: 'Produto' },
  ]

  const orderTypeOptions = [
    { value: 'asc' as ApplicationOrderType, label: 'Ascendente'},
    { value: 'desc' as ApplicationOrderType, label: 'Descendente'},
  ]

  const { data, isLoading, isError, error } = useGetAllApplications({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: propSearch || debouncedSearchValue || undefined,
    serviceOrderStatus: propServiceOrderStatus || statusFilter,
    farmId: propFarmId || farmFilter,
    pilotId: propPilotId || pilotFilter,
    customerId: propCustomerIdFilter || customerFilter,
    serviceOrderId: propServiceOrderIdFilter || serviceOrderFilter,
    invalidApplication: propInvalidApplication !== undefined ? propInvalidApplication.toString() : invalidApplicationFilter,
    startDate: propStartDate || dateFilter?.startDate,
    endDate: propEndDate || dateFilter?.endDate,
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
  } = useGetAllFarmsInfinite(propCustomerId, {
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

  const {
    data: serviceOrdersData,
    fetchNextPage: fetchNextPageServiceOrders,
    hasNextPage: hasNextPageServiceOrders,
    isFetchingNextPage: isFetchingNextPageServiceOrders,
    isLoading: isLoadingServiceOrders,
  } = useGetAllServiceOrdersInfinite({
    limit: '10',
    search: serviceOrderSearchValue || undefined,
  });

  const allServiceOrders =
    (serviceOrdersData as unknown as InfiniteData<{ data: ServiceOrder[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const { mutate: deleteApplicationById, isPending: isDeletingApplication } =
    useDeleteApplicationById({
      onSuccess: () => {
        toast('Aplicação deletada com sucesso');
        queryClient.invalidateQueries({ queryKey: ['applications'] });
      },
      onError: (error) => {
        toast(error.message);
      },
    });

  const handleDeleteClick = (application: Application) => {
    setApplicationToDelete(application);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (applicationToDelete) {
      deleteApplicationById(applicationToDelete.id);
      setDeleteDialogOpen(false);
      setApplicationToDelete(null);
    }
  };

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

  useEffect(() => {
    if (data && data.totalPages > 0 && currentPage > data.totalPages) {
      setCurrentPage(1);
    }
  }, [data?.totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchValue,
    statusFilter,
    farmFilter,
    pilotFilter,
    customerFilter,
    serviceOrderFilter,
    invalidApplicationFilter,
  ]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
      onFilterChange?.setSearch(value);
    },
    [debouncedSearch, onFilterChange]
  );

  const handleStatusChange = useCallback((status: string | undefined) => {
    const newStatus = status as ServiceOrderStatus | undefined;
    setStatusFilter(newStatus);
    setCurrentPage(1);
    onFilterChange?.setServiceOrderStatus(newStatus);
  }, [onFilterChange]);

  const handleCustomerChange = useCallback(
    (newCustomerId: string | undefined) => {
      if (!propCustomerId && !disableCustomerFilter) {
        setCustomerFilter(newCustomerId);
        setCurrentPage(1);
        onFilterChange?.setCustomerId(newCustomerId);
      }
    },
    [propCustomerId, disableCustomerFilter, onFilterChange]
  );

  const handleFarmChange = useCallback((farmId: string | undefined) => {
    setFarmFilter(farmId);
    setCurrentPage(1);
    onFilterChange?.setFarmId(farmId);
  }, [onFilterChange]);

  const handlePilotChange = useCallback((pilotId: string | undefined) => {
    setPilotFilter(pilotId);
    setCurrentPage(1);
    onFilterChange?.setPilotId(pilotId);
  }, [onFilterChange]);

  const handleServiceOrderChange = useCallback(
    (newServiceOrderId: string | undefined) => {
      if (!propServiceOrderId) {
        setServiceOrderFilter(newServiceOrderId);
        setCurrentPage(1);
        onFilterChange?.setServiceOrderId(newServiceOrderId);
      }
    },
    [propServiceOrderId, onFilterChange]
  );

  const handleInvalidApplicationChange = useCallback((value: string) => {
    const boolValue = value === 'true';
    setInvalidApplicationFilter(value);
    setCurrentPage(1);
    onFilterChange?.setInvalidApplication(boolValue);
  }, [onFilterChange]);

  const handleOrderByChange = (orderBy: ApplicationOrderBy | undefined) => {
      setOrderBy(orderBy)
      setCurrentPage(1)
    }

  const handleDateChange = useCallback((dateRange: {startDate: string, endDate: string} | undefined) => {
    setDateFilter(dateRange);
    setCurrentPage(1);
    onFilterChange?.setStartDate(dateRange?.startDate);
    onFilterChange?.setEndDate(dateRange?.endDate);
  }, [onFilterChange]);

    const handleOrderTypeChange = (orderType: ApplicationOrderType | undefined) => {
      setOrderType(orderType)
      setCurrentPage(1)
    }

  type ApplicationColumnId =
    | 'date'
    | 'serviceOrder'
    | 'farm'
    | 'customer'
    | 'pilot'
    | 'assistant'
    | 'drone'
    | 'culture'
    | 'product'
    | 'plot'
    | 'hectares'
    | 'observations'
    | 'createdAt'
    | 'actions'
    | 'flowRate'
    | 'altitude'
    | 'routeSpacing'
    | 'dropletSize';

  const initialColumnVisibility: Partial<Record<ApplicationColumnId, boolean>> = {
    createdAt: false,
    culture: false,
    drone: false,
    serviceOrder: false,
    assistant: false,
    flowRate: false,
    altitude: false,
    routeSpacing: false,
    dropletSize: false,
    customer: false
  };

  const columns: ColumnDefWithId<Application>[] = [
    {
      id: 'date',
      accessorKey: 'date',
      label: 'Data da Aplicação',
      header: 'Data da Aplicação',
      size: 120,
      minSize: 100,
      maxSize: 150,
      cell: ({ row }) => (
        <div className='text-foreground font-mono text-sm whitespace-nowrap'>
          {formatApplicationDate(row.original.date)}
        </div>
      ),
    },
    {
      id: 'serviceOrder',
      label: 'Ordem de Serviço',
      header: 'OS',
      cell: ({ row }) => (
        <div className={row.original?.serviceOrder ? 'text-foreground' : 'text-red-500'}>
          {row.original?.serviceOrder ? `OS #${row.original?.serviceOrder?.number}` : '-'}
        </div>
      ),
    },
    {
      id: 'customer',
      label: 'Cliente',
      header: 'Cliente',
      cell: ({ row }) => (
        <div className={row.original?.farm?.customer ? 'text-foreground' : 'text-red-500'}>
          {row.original?.farm?.customer ? row.original.farm.customer.name : 'Cliente não cadastrado'}
        </div>
      ),
    },
    {
      id: 'farm',
      label: 'Fazenda',
      header: 'Fazenda',
      cell: ({ row }) => (
        <div className={row.original?.farm ? 'text-foreground' : 'text-red-500'}>
          {row.original?.farm ? row.original.farm.name : 'Fazenda não cadastrada'}
        </div>
      ),
    },
    {
      id: 'pilot',
      label: 'Piloto',
      header: 'Piloto',
      cell: ({ row }) => <div className='text-foreground'>{row.original.pilot.name}</div>,
    },
    {
      id: 'assistant',
      label: 'Assistente',
      header: 'Assistente',
      cell: ({ row }) => <div className='text-foreground'>{row.original.assistant.name}</div>,
    },
    {
      id: 'drone',
      label: 'Drone',
      header: 'Drone',
      cell: ({ row }) => <div className='text-foreground'>{row.original.drone.name}</div>,
    },
    {
      id: 'culture',
      label: 'Cultura',
      header: 'Cultura',
      cell: ({ row }) => <div className='text-foreground'>{row.original.culture.name}</div>,
    },
    {
      id: 'product',
      label: 'Produto',
      header: 'Produto',
      cell: ({ row }) => <div className='text-foreground'>{row.original.product.name}</div>,
    },
    {
      id: 'plot',
      label: 'Talhão',
      header: 'Talhão',
      cell: ({ row }) => (
        <div className={row.original.plotId ? 'text-foreground' : 'text-red-500'}>
          {row.original.plotId ? row.original.plot.name : 'Talhão não cadastrado'}
        </div>
      ),
    },
    {
      id: 'hectares',
      accessorKey: 'hectares',
      label: 'Hectares',
      header: 'Hectares',
      cell: ({ row }) => <div className='text-foreground'>{row.original.hectares} ha</div>,
    },
    {
      id: 'flowRate',
      accessorKey: 'flowRate',
      label: 'Vazão',
      header: 'Vazão',
      cell: ({ row }) => <div className='text-foreground'>{row.original.flowRate} L/ha</div>,
    },
    {
      id: 'altitude',
      accessorKey: 'altitude',
      label: 'Altitude',
      header: 'Altitude',
      cell: ({ row }) => <div className='text-foreground'>{row.original.altitude} m</div>,
    },
    {
      id: 'routeSpacing',
      accessorKey: 'routeSpacing',
      label: 'Espaçamento da rota',
      header: 'Espaçamento da rota',
      cell: ({ row }) => <div className='text-foreground'>{row?.original?.routeSpacing} m</div>,
    },
    {
      id: 'dropletSize',
      accessorKey: 'dropletSize',
      label: 'Tamanho da gota',
      header: 'Tamanho da gota',
      cell: ({ row }) => <div className='text-foreground'>{row?.original?.dropletSize} μm</div>,
    },
    createTextColumn<Application>('observations', 'observations', 'Observações'),
    createDateColumn<Application>('createdAt', 'createdAt', 'Data de Criação'),
    createActionsColumn<Application>((application) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogForm
              form={
                <FormApplication
                  initialValues={application}
                  isEditMode={true}
                  onSuccess={() => setEditDialogOpen(false)}
                />
              }
              trigger={
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setApplicationToEdit(application)}
                >
                  <Edit className='h-4 w-4' />
                </Button>
              }
              isOpen={editDialogOpen && applicationToEdit?.id === application.id}
              setIsOpen={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setApplicationToEdit(null);
                }
              }}
              className='sm:max-w-4xl h-[700px] max-h-[90vh] flex flex-col'
            />
          </TooltipTrigger>
          <TooltipContent>Editar aplicação</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              onClick={() => handleDeleteClick(application)}
              disabled={isDeletingApplication}
            >
              <Trash className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deletar aplicação</TooltipContent>
        </Tooltip>
      </>
    )),
  ];

  const statusOptions = [
    { value: 'open' as ServiceOrderStatus, label: 'Aberto' },
    { value: 'completed' as ServiceOrderStatus, label: 'Concluído' },
    { value: 'cancelled' as ServiceOrderStatus, label: 'Cancelado' },
  ];

  const customers = allCustomers;
  const farms = allFarms;
  const pilots = allPilots;
  const serviceOrders = allServiceOrders;

  const selectedServiceOrder = serviceOrders.find((so) => so.id === serviceOrderFilter);

  const statusDisplayText = disableStatusFilter && statusLabel ? statusLabel : undefined;

  const customerDisplayText = disableCustomerFilter && customerName ? customerName : undefined;

  const serviceOrderDisplayText =
    propServiceOrderId && selectedServiceOrder ? `OS #${selectedServiceOrder.number}` : undefined;

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['applications'] })}
        searchConfig={{
          placeholder: 'Buscar aplicações...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}
        filters={
          <div className='flex gap-2 w-full overflow-auto'>
            <Select value={invalidApplicationFilter} onValueChange={handleInvalidApplicationChange}>
              <SelectTrigger className='w-[160px]'>
                <SelectValue placeholder='Filtrar aplicações' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='false'>Todas</SelectItem>
                <SelectItem value='true'>Somente inválidas</SelectItem>
              </SelectContent>
            </Select>

            <DateRangePicker className='w-[300px]' initialValue={dateFilter} onChange={handleDateChange}/>

            {!propServiceOrderId && (
              <SearchableSelectQuery
                options={statusOptions}
                value={statusFilter}
                onValueChange={(value) => handleStatusChange(value as string | undefined)}
                placeholder={
                  disableStatusFilter && statusDisplayText ? statusDisplayText : 'Status da OS'
                }
                searchPlaceholder='Buscar status...'
                className='w-[140px]'
                clearable={!disableStatusFilter}
                disabled={disableStatusFilter}
              />
            )}
            {!propCustomerId && (
              <SearchableSelectQuery
                options={customers.map((customer: Customer) => ({
                  value: customer.id,
                  label: customer.name,
                }))}
                value={customerFilter}
                onValueChange={(value) => handleCustomerChange(value as string | undefined)}
                placeholder={customerDisplayText || 'Cliente'}
                searchPlaceholder='Buscar cliente...'
                className='w-auto'
                popoverClassName='w-[250px]'
                clearable={!disableCustomerFilter && !propCustomerId}
                disabled={!!propCustomerId || disableCustomerFilter}
                onSearchChange={setCustomerSearchValue}
                onScrollEnd={fetchNextPage}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                isLoading={isLoadingCustomers}
              />
            )}
            <SearchableSelectQuery
              options={farms.map((farm: Farm) => ({
                value: farm.id,
                label: farm.name,
              }))}
              value={farmFilter}
              onValueChange={(value) => handleFarmChange(value as string | undefined)}
              placeholder='Fazenda'
              searchPlaceholder='Buscar fazenda...'
              className='w-auto'
              popoverClassName='w-[250px]'
              clearable
              onSearchChange={setFarmSearchValue}
              onScrollEnd={fetchNextPageFarms}
              hasNextPage={hasNextPageFarms}
              isFetchingNextPage={isFetchingNextPageFarms}
              isLoading={isLoadingFarms}
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
              className='w-auto'
              popoverClassName='w-[250px]'
              clearable
              onSearchChange={setPilotSearchValue}
              onScrollEnd={fetchNextPagePilots}
              hasNextPage={hasNextPagePilots}
              isFetchingNextPage={isFetchingNextPagePilots}
              isLoading={isLoadingPilots}
            />
            {!propServiceOrderId && (
              <SearchableSelectQuery
                options={serviceOrders.map((serviceOrder: ServiceOrder) => ({
                  value: serviceOrder.id,
                  label: `OS #${serviceOrder.number}`,
                }))}
                value={serviceOrderFilter}
                onValueChange={(value) => handleServiceOrderChange(value as string | undefined)}
                placeholder={serviceOrderDisplayText || 'Ordem de Serviço'}
                searchPlaceholder='Buscar OS...'
                className='w-auto'
                popoverClassName='w-[250px]'
                clearable={!propServiceOrderId}
                disabled={!!propServiceOrderId}
                onSearchChange={setServiceOrderSearchValue}
                onScrollEnd={fetchNextPageServiceOrders}
                hasNextPage={hasNextPageServiceOrders}
                isFetchingNextPage={isFetchingNextPageServiceOrders}
                isLoading={isLoadingServiceOrders}
              />
            )}

            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as ApplicationOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) => handleOrderTypeChange(value as ApplicationOrderType | undefined)}
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
          totalPages: data?.totalPages || 1,
          totalCount: data?.totalCount,
          onPageChange: setCurrentPage,
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          },
        }}
        initialColumnVisibility={initialColumnVisibility}
        renderEmptyState={() => 'Nenhuma aplicação encontrada.'}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja deletar esta aplicação? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={handleConfirmDelete}
              disabled={isDeletingApplication}
            >
              {isDeletingApplication ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
