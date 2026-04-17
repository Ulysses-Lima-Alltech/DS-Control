'use client';

import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, Filter, SearchX, Trash, X } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
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
} from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDeleteApplicationById } from '@/mutations/application.mutation';
import { useGetAllAssistantsInfinite } from '@/queries/assistant.query';
import { useGetAllApplications } from '@/queries/application.query';
import { useGetAllCultureTypesInfinite } from '@/queries/culture-type.query';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllDronesInfinite } from '@/queries/drone.query';
import { useGetAllFarmsInfinite, useGetFarmById } from '@/queries/farm.query';
import { useGetAllProductsInfinite, useGetProductById } from '@/queries/product.query';
import { useGetAllServiceOrdersInfinite } from '@/queries/service-order.query';
import { useGetAllUsersInfinite } from '@/queries/user.query';
import {
  APPLICATION_ISSUE_LABELS,
  Application,
  ApplicationIssueFilter,
  ApplicationOrderBy,
  ApplicationOrderType,
} from '@/types/applications.type';
import { Assistant } from '@/types/assistant.type';
import { CultureType } from '@/types/culture-types.type';
import { Customer } from '@/types/customer.type';
import { Drone } from '@/types/drone.type';
import { Farm } from '@/types/farm.type';
import { Product } from '@/types/product.type';
import { ServiceOrder, ServiceOrderStatus } from '@/types/service-order.type';
import { User } from '@/types/user.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';

interface TableApplicationsProps {
  customerId?: string;
  serviceOrderId?: string;
  defaultStatus?: ServiceOrderStatus;
  disableStatusFilter?: boolean;
  disableCustomerFilter?: boolean;
  simpleMode?: boolean;
  customerName?: string;
  statusLabel?: string;
  // Filter props
  search?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  farmId?: string;
  productId?: string;
  pilotId?: string;
  customerIdFilter?: string;
  serviceOrderIdFilter?: string;
  invalidApplication?: boolean;
  applicationIssue?: ApplicationIssueFilter;
  startDate?: string;
  endDate?: string;
  // Filter change callbacks
  onFilterChange?: {
    setSearch: (value: string) => void;
    setServiceOrderStatus: (value: ServiceOrderStatus | undefined) => void;
    setFarmId: (value: string | undefined) => void;
    setProductId?: (value: string | undefined) => void;
    setPilotId: (value: string | undefined) => void;
    setCustomerId: (value: string | undefined) => void;
    setServiceOrderId: (value: string | undefined) => void;
    setInvalidApplication: (value: boolean | undefined) => void;
    setApplicationIssue?: (value: ApplicationIssueFilter | undefined) => void;
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
  simpleMode = false,
  customerName,
  statusLabel,
  // Filter props
  search: propSearch,
  serviceOrderStatus: propServiceOrderStatus,
  farmId: propFarmId,
  productId: propProductId,
  pilotId: propPilotId,
  customerIdFilter: propCustomerIdFilter,
  serviceOrderIdFilter: propServiceOrderIdFilter,
  invalidApplication: propInvalidApplication,
  applicationIssue: propApplicationIssue,
  startDate: propStartDate,
  endDate: propEndDate,
  // Filter change callbacks
  onFilterChange,
}: TableApplicationsProps) => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [inputSearchValue, setInputSearchValue] = React.useState(propSearch || '');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState(propSearch || '');
  const [customerSearchValue, setCustomerSearchValue] = React.useState('');
  const [farmSearchValue, setFarmSearchValue] = React.useState('');
  const [productSearchValue, setProductSearchValue] = React.useState('');
  const [pilotSearchValue, setPilotSearchValue] = React.useState('');
  const [assistantSearchValue, setAssistantSearchValue] = React.useState('');
  const [droneSearchValue, setDroneSearchValue] = React.useState('');
  const [cultureSearchValue, setCultureSearchValue] = React.useState('');
  const [serviceOrderSearchValue, setServiceOrderSearchValue] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ServiceOrderStatus | undefined>(
    propServiceOrderStatus || defaultStatus
  );
  const [farmFilter, setFarmFilter] = React.useState<string | undefined>(propFarmId);
  const [productFilter, setProductFilter] = React.useState<string | undefined>(propProductId);
  const [pilotFilter, setPilotFilter] = React.useState<string | undefined>(propPilotId);
  const [customerFilter, setCustomerFilter] = React.useState<string | undefined>(propCustomerId);
  const [serviceOrderFilter, setServiceOrderFilter] = React.useState<string | undefined>(
    propServiceOrderId
  );
  const [assistantFilter, setAssistantFilter] = React.useState<string | undefined>(undefined);
  const [droneFilter, setDroneFilter] = React.useState<string | undefined>(undefined);
  const [cultureFilter, setCultureFilter] = React.useState<string | undefined>(undefined);
  const [plotNameFilter, setPlotNameFilter] = React.useState('');
  const [observationsFilter, setObservationsFilter] = React.useState('');
  const [serviceOrderNumberFilter, setServiceOrderNumberFilter] = React.useState('');
  const [hectaresMinFilter, setHectaresMinFilter] = React.useState('');
  const [hectaresMaxFilter, setHectaresMaxFilter] = React.useState('');
  const [flowRateMinFilter, setFlowRateMinFilter] = React.useState('');
  const [flowRateMaxFilter, setFlowRateMaxFilter] = React.useState('');
  const [altitudeMinFilter, setAltitudeMinFilter] = React.useState('');
  const [altitudeMaxFilter, setAltitudeMaxFilter] = React.useState('');
  const [routeSpacingMinFilter, setRouteSpacingMinFilter] = React.useState('');
  const [routeSpacingMaxFilter, setRouteSpacingMaxFilter] = React.useState('');
  const [dropletSizeMinFilter, setDropletSizeMinFilter] = React.useState('');
  const [dropletSizeMaxFilter, setDropletSizeMaxFilter] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState<{startDate: string, endDate:string} | undefined>(
    propStartDate && propEndDate ? { startDate: propStartDate, endDate: propEndDate } : undefined
  )

  const searchParams = useSearchParams();
  const [invalidApplicationFilter, setInvalidApplicationFilter] = React.useState<string>(() => {
    if (propInvalidApplication !== undefined) {
      return propInvalidApplication ? 'true' : 'false';
    }
    const param = searchParams.get('invalidApplication');
    return param === 'true' ? 'true' : 'false';
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [applicationToDelete, setApplicationToDelete] = React.useState<Application | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [applicationToEdit, setApplicationToEdit] = React.useState<Application | null>(null);

  const [orderBy, setOrderBy] = React.useState<ApplicationOrderBy | undefined>(undefined)
  const [orderType, setOrderType] = React.useState<ApplicationOrderType | undefined>(undefined)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false);

  const orderByOptions = [
    { value: 'date' as ApplicationOrderBy, label: 'Data da aplicação' },
    { value: 'pilot' as ApplicationOrderBy, label: 'Piloto' },
    { value: 'product' as ApplicationOrderBy, label: 'Produto' },
  ]

  const orderTypeOptions = [
    { value: 'asc' as ApplicationOrderType, label: 'Ascendente'},
    { value: 'desc' as ApplicationOrderType, label: 'Descendente'},
  ]

  const { data, isLoading, isError, error, refetch } = useGetAllApplications({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: propSearch || debouncedSearchValue || undefined,
    serviceOrderStatus: propServiceOrderStatus || statusFilter,
    farmId: propFarmId || farmFilter,
    productId: propProductId || productFilter,
    pilotId: propPilotId || pilotFilter,
    customerId: propCustomerIdFilter || customerFilter,
    serviceOrderId: propServiceOrderIdFilter || serviceOrderFilter,
    assistantId: assistantFilter,
    droneId: droneFilter,
    cultureId: cultureFilter,
    plotName: plotNameFilter || undefined,
    observations: observationsFilter || undefined,
    serviceOrderNumber: serviceOrderNumberFilter || undefined,
    hectaresMin: hectaresMinFilter || undefined,
    hectaresMax: hectaresMaxFilter || undefined,
    flowRateMin: flowRateMinFilter || undefined,
    flowRateMax: flowRateMaxFilter || undefined,
    altitudeMin: altitudeMinFilter || undefined,
    altitudeMax: altitudeMaxFilter || undefined,
    routeSpacingMin: routeSpacingMinFilter || undefined,
    routeSpacingMax: routeSpacingMaxFilter || undefined,
    dropletSizeMin: dropletSizeMinFilter || undefined,
    dropletSizeMax: dropletSizeMaxFilter || undefined,
    invalidApplication:
      propApplicationIssue !== undefined
        ? undefined
        : propInvalidApplication !== undefined
          ? propInvalidApplication.toString()
          : invalidApplicationFilter,
    applicationIssue: propApplicationIssue,
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
    status: 'active',
    limit: '10',
    search: pilotSearchValue || undefined,
  });

  const allPilots =
    (usersData as unknown as InfiniteData<{ data: User[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const {
    data: assistantsData,
    fetchNextPage: fetchNextPageAssistants,
    hasNextPage: hasNextPageAssistants,
    isFetchingNextPage: isFetchingNextPageAssistants,
    isLoading: isLoadingAssistants,
  } = useGetAllAssistantsInfinite({
    limit: '10',
    search: assistantSearchValue || undefined,
    status: 'active',
  });
  const allAssistants =
    (assistantsData as unknown as InfiniteData<{ data: Assistant[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const {
    data: dronesData,
    fetchNextPage: fetchNextPageDrones,
    hasNextPage: hasNextPageDrones,
    isFetchingNextPage: isFetchingNextPageDrones,
    isLoading: isLoadingDrones,
  } = useGetAllDronesInfinite({
    limit: '10',
    search: droneSearchValue || undefined,
    status: 'active',
  });
  const allDrones =
    (dronesData as unknown as InfiniteData<{ data: Drone[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const {
    data: culturesData,
    fetchNextPage: fetchNextPageCultures,
    hasNextPage: hasNextPageCultures,
    isFetchingNextPage: isFetchingNextPageCultures,
    isLoading: isLoadingCultures,
  } = useGetAllCultureTypesInfinite({
    limit: '10',
    search: cultureSearchValue || undefined,
    status: 'active',
  });
  const allCultures =
    (culturesData as unknown as InfiniteData<{ data: CultureType[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

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

  const {
    data: productsData,
    fetchNextPage: fetchNextPageProducts,
    hasNextPage: hasNextPageProducts,
    isFetchingNextPage: isFetchingNextPageProducts,
    isLoading: isLoadingProducts,
  } = useGetAllProductsInfinite({
    limit: '10',
    search: productSearchValue || undefined,
  });

  const allProducts =
    (productsData as unknown as InfiniteData<{ data: Product[] }>)?.pages?.flatMap(
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
        onFilterChange?.setSearch(searchTerm);
      }, 600),
    [onFilterChange]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    setInputSearchValue(propSearch || '');
    setDebouncedSearchValue(propSearch || '');
  }, [propSearch]);

  useEffect(() => {
    setStatusFilter(propServiceOrderStatus || defaultStatus);
  }, [propServiceOrderStatus, defaultStatus]);

  useEffect(() => {
    setFarmFilter(propFarmId);
  }, [propFarmId]);

  useEffect(() => {
    setProductFilter(propProductId);
  }, [propProductId]);

  useEffect(() => {
    setPilotFilter(propPilotId);
  }, [propPilotId]);

  useEffect(() => {
    setCustomerFilter(propCustomerIdFilter || propCustomerId);
  }, [propCustomerIdFilter, propCustomerId]);

  useEffect(() => {
    setServiceOrderFilter(propServiceOrderIdFilter || propServiceOrderId);
  }, [propServiceOrderIdFilter, propServiceOrderId]);

  useEffect(() => {
    if (propInvalidApplication === undefined) {
      return;
    }
    setInvalidApplicationFilter(propInvalidApplication ? 'true' : 'false');
  }, [propInvalidApplication]);

  useEffect(() => {
    if (propApplicationIssue !== undefined) {
      setInvalidApplicationFilter('false');
    }
  }, [propApplicationIssue]);

  useEffect(() => {
    if (propStartDate && propEndDate) {
      setDateFilter({ startDate: propStartDate, endDate: propEndDate });
      return;
    }

    if (!propStartDate && !propEndDate) {
      setDateFilter(undefined);
    }
  }, [propStartDate, propEndDate]);

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
    productFilter,
    pilotFilter,
    assistantFilter,
    droneFilter,
    cultureFilter,
    plotNameFilter,
    observationsFilter,
    serviceOrderNumberFilter,
    hectaresMinFilter,
    hectaresMaxFilter,
    flowRateMinFilter,
    flowRateMaxFilter,
    altitudeMinFilter,
    altitudeMaxFilter,
    routeSpacingMinFilter,
    routeSpacingMaxFilter,
    dropletSizeMinFilter,
    dropletSizeMaxFilter,
    customerFilter,
    serviceOrderFilter,
    invalidApplicationFilter,
    propApplicationIssue,
    propProductId,
  ]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
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

  const handleProductChange = useCallback(
    (productIdValue: string | undefined) => {
      setProductFilter(productIdValue);
      setCurrentPage(1);
      onFilterChange?.setProductId?.(productIdValue);
    },
    [onFilterChange]
  );

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

  const handleInvalidApplicationChange = useCallback(
    (value: string) => {
      const boolValue = value === 'true';
      setInvalidApplicationFilter(value);
      setCurrentPage(1);
      if (boolValue) {
        onFilterChange?.setApplicationIssue?.(undefined);
      }
      onFilterChange?.setInvalidApplication(boolValue);
    },
    [onFilterChange]
  );

  const handleApplicationIssueChipRemove = useCallback(() => {
    setCurrentPage(1);
    onFilterChange?.setApplicationIssue?.(undefined);
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

  const clearAllFilters = useCallback(() => {
    setInputSearchValue('');
    setDebouncedSearchValue('');
    setStatusFilter(undefined);
    setFarmFilter(undefined);
    setProductFilter(undefined);
    setPilotFilter(undefined);
    setAssistantFilter(undefined);
    setDroneFilter(undefined);
    setCultureFilter(undefined);
    setPlotNameFilter('');
    setObservationsFilter('');
    setServiceOrderNumberFilter('');
    setHectaresMinFilter('');
    setHectaresMaxFilter('');
    setFlowRateMinFilter('');
    setFlowRateMaxFilter('');
    setAltitudeMinFilter('');
    setAltitudeMaxFilter('');
    setRouteSpacingMinFilter('');
    setRouteSpacingMaxFilter('');
    setDropletSizeMinFilter('');
    setDropletSizeMaxFilter('');
    setCustomerFilter(undefined);
    setServiceOrderFilter(undefined);
    setInvalidApplicationFilter('false');
    setDateFilter(undefined);
    setOrderBy(undefined);
    setOrderType(undefined);
    setCurrentPage(1);
    onFilterChange?.setSearch('');
    onFilterChange?.setServiceOrderStatus(undefined);
    onFilterChange?.setFarmId(undefined);
    onFilterChange?.setProductId?.(undefined);
    onFilterChange?.setPilotId(undefined);
    onFilterChange?.setCustomerId(undefined);
    onFilterChange?.setServiceOrderId(undefined);
    onFilterChange?.setInvalidApplication(undefined);
    onFilterChange?.setApplicationIssue?.(undefined);
    onFilterChange?.setStartDate(undefined);
    onFilterChange?.setEndDate(undefined);
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
      minSize: 180,
      cell: ({ row }) => (
        <div className={row.original?.farm ? 'text-foreground whitespace-nowrap' : 'text-red-500 whitespace-nowrap'}>
          {row.original?.farm ? row.original.farm.name : 'Fazenda não cadastrada'}
        </div>
      ),
    },
    {
      id: 'pilot',
      label: 'Piloto',
      header: 'Piloto',
      minSize: 160,
      cell: ({ row }) => <div className='text-foreground whitespace-nowrap'>{row.original.pilot.name}</div>,
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
      minSize: 150,
      cell: ({ row }) => <div className='text-foreground whitespace-nowrap'>{row.original.product.name}</div>,
    },
    {
      id: 'plot',
      label: 'Talhão',
      header: 'Talhão',
      minSize: 150,
      cell: ({ row }) => (
        <div className={row.original.plotId ? 'text-foreground whitespace-nowrap' : 'text-red-500 whitespace-nowrap'}>
          {row.original.plotId ? row.original.plot.name : 'Talhão não cadastrado'}
        </div>
      ),
    },
    {
      id: 'hectares',
      accessorKey: 'hectares',
      label: 'Hectares',
      header: 'Hectares',
      size: 110,
      minSize: 100,
      maxSize: 130,
      cell: ({ row }) => (
        <div className='text-foreground text-right tabular-nums whitespace-nowrap pr-1'>
          {row.original.hectares} ha
        </div>
      ),
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
    {
      id: 'observations',
      accessorKey: 'observations',
      label: 'Observações',
      header: 'Observações',
      minSize: 220,
      cell: ({ row }) => (
        <div className='max-w-[320px] truncate text-foreground' title={row.original.observations || '-'}>
          {row.original.observations || '-'}
        </div>
      ),
    },
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
  const products = allProducts;
  const pilots = allPilots;

  const overviewFarmId = propFarmId || farmFilter;
  const { data: overviewFarmDetail } = useGetFarmById(overviewFarmId ?? null);
  const farmChipName =
    overviewFarmId &&
    (farms.find((farm) => farm.id === overviewFarmId)?.name ??
      overviewFarmDetail?.farm?.name);

  const overviewProductId = propProductId || productFilter;
  const { data: overviewProductDetail } = useGetProductById(overviewProductId ?? '', {
    enabled: !!overviewProductId,
  });
  const productChipName =
    overviewProductId &&
    (products.find((p) => p.id === overviewProductId)?.name ??
      overviewProductDetail?.product?.name);
  const serviceOrders = allServiceOrders;

  const selectedServiceOrder = serviceOrders.find((so) => so.id === serviceOrderFilter);

  const statusDisplayText = disableStatusFilter && statusLabel ? statusLabel : undefined;

  const customerDisplayText = disableCustomerFilter && customerName ? customerName : undefined;

  const serviceOrderDisplayText =
    propServiceOrderId && selectedServiceOrder ? `OS #${selectedServiceOrder.number}` : undefined;

  const activeFilters = [
    !simpleMode && statusFilter
      ? {
          key: 'status',
          label: `Status: ${statusFilter}`,
          onRemove: () => handleStatusChange(undefined),
        }
      : null,
    !simpleMode && customerFilter
      ? {
          key: 'customer',
          label: `Cliente: ${customers.find((c) => c.id === customerFilter)?.name || 'Selecionado'}`,
          onRemove: () => handleCustomerChange(undefined),
        }
      : null,
    !simpleMode && overviewFarmId
      ? {
          key: 'farm',
          label: `Fazenda: ${farmChipName || 'Selecionada'}`,
          onRemove: () => handleFarmChange(undefined),
        }
      : null,
    !simpleMode && overviewProductId
      ? {
          key: 'product',
          label: `Produto: ${productChipName || 'Selecionado'}`,
          onRemove: () => handleProductChange(undefined),
        }
      : null,
    !simpleMode && pilotFilter
      ? {
          key: 'pilot',
          label: `Piloto: ${pilots.find((p) => p.id === pilotFilter)?.name || 'Selecionado'}`,
          onRemove: () => handlePilotChange(undefined),
        }
      : null,
    !simpleMode && assistantFilter
      ? {
          key: 'assistant',
          label: `Ajudante: ${allAssistants.find((a) => a.id === assistantFilter)?.name || 'Selecionado'}`,
          onRemove: () => setAssistantFilter(undefined),
        }
      : null,
    !simpleMode && droneFilter
      ? {
          key: 'drone',
          label: `Drone: ${allDrones.find((d) => d.id === droneFilter)?.name || 'Selecionado'}`,
          onRemove: () => setDroneFilter(undefined),
        }
      : null,
    !simpleMode && cultureFilter
      ? {
          key: 'culture',
          label: `Cultura: ${allCultures.find((c) => c.id === cultureFilter)?.name || 'Selecionada'}`,
          onRemove: () => setCultureFilter(undefined),
        }
      : null,
    !simpleMode && plotNameFilter
      ? {
          key: 'plotName',
          label: `Talhão: ${plotNameFilter}`,
          onRemove: () => setPlotNameFilter(''),
        }
      : null,
    !simpleMode && observationsFilter
      ? {
          key: 'observations',
          label: `Observações: ${observationsFilter}`,
          onRemove: () => setObservationsFilter(''),
        }
      : null,
    !simpleMode && serviceOrderNumberFilter
      ? {
          key: 'serviceOrderNumber',
          label: `OS Nº: ${serviceOrderNumberFilter}`,
          onRemove: () => setServiceOrderNumberFilter(''),
        }
      : null,
    !simpleMode && serviceOrderFilter
      ? {
          key: 'serviceOrder',
          label: `OS: #${serviceOrders.find((so) => so.id === serviceOrderFilter)?.number || 'Selecionada'}`,
          onRemove: () => handleServiceOrderChange(undefined),
        }
      : null,
    propApplicationIssue
      ? {
          key: 'applicationIssue',
          label: `Inconsistência: ${APPLICATION_ISSUE_LABELS[propApplicationIssue]}`,
          onRemove: handleApplicationIssueChipRemove,
        }
      : invalidApplicationFilter === 'true'
        ? {
            key: 'invalid',
            label: 'Somente inválidas',
            onRemove: () => handleInvalidApplicationChange('false'),
          }
        : null,
    orderBy
      ? {
          key: 'orderBy',
          label: `Ordenar por: ${orderByOptions.find((o) => o.value === orderBy)?.label}`,
          onRemove: () => handleOrderByChange(undefined),
        }
      : null,
    orderType
      ? {
          key: 'orderType',
          label: `Ordem: ${orderTypeOptions.find((o) => o.value === orderType)?.label}`,
          onRemove: () => handleOrderTypeChange(undefined),
        }
      : null,
    hectaresMinFilter
      ? {
          key: 'hectaresMin',
          label: `Hectares mín: ${hectaresMinFilter}`,
          onRemove: () => setHectaresMinFilter(''),
        }
      : null,
    hectaresMaxFilter
      ? {
          key: 'hectaresMax',
          label: `Hectares máx: ${hectaresMaxFilter}`,
          onRemove: () => setHectaresMaxFilter(''),
        }
      : null,
    flowRateMinFilter
      ? {
          key: 'flowRateMin',
          label: `Vazão mín: ${flowRateMinFilter}`,
          onRemove: () => setFlowRateMinFilter(''),
        }
      : null,
    flowRateMaxFilter
      ? {
          key: 'flowRateMax',
          label: `Vazão máx: ${flowRateMaxFilter}`,
          onRemove: () => setFlowRateMaxFilter(''),
        }
      : null,
    altitudeMinFilter
      ? {
          key: 'altitudeMin',
          label: `Altitude mín: ${altitudeMinFilter}`,
          onRemove: () => setAltitudeMinFilter(''),
        }
      : null,
    altitudeMaxFilter
      ? {
          key: 'altitudeMax',
          label: `Altitude máx: ${altitudeMaxFilter}`,
          onRemove: () => setAltitudeMaxFilter(''),
        }
      : null,
    routeSpacingMinFilter
      ? {
          key: 'routeSpacingMin',
          label: `Espaçamento mín: ${routeSpacingMinFilter}`,
          onRemove: () => setRouteSpacingMinFilter(''),
        }
      : null,
    routeSpacingMaxFilter
      ? {
          key: 'routeSpacingMax',
          label: `Espaçamento máx: ${routeSpacingMaxFilter}`,
          onRemove: () => setRouteSpacingMaxFilter(''),
        }
      : null,
    dropletSizeMinFilter
      ? {
          key: 'dropletSizeMin',
          label: `Gota mín: ${dropletSizeMinFilter}`,
          onRemove: () => setDropletSizeMinFilter(''),
        }
      : null,
    dropletSizeMaxFilter
      ? {
          key: 'dropletSizeMax',
          label: `Gota máx: ${dropletSizeMaxFilter}`,
          onRemove: () => setDropletSizeMaxFilter(''),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  const hasPeriodFilterActive = Boolean(dateFilter?.startDate && dateFilter?.endDate);
  const hasAnyFilterActive =
    Boolean((propSearch || debouncedSearchValue || '').trim()) ||
    hasPeriodFilterActive ||
    Boolean(
      statusFilter ||
        customerFilter ||
        overviewFarmId ||
        overviewProductId ||
        pilotFilter ||
        assistantFilter ||
        droneFilter ||
        cultureFilter ||
        plotNameFilter ||
        observationsFilter ||
        serviceOrderNumberFilter ||
        serviceOrderFilter ||
        invalidApplicationFilter === 'true' ||
        propApplicationIssue ||
        orderBy ||
        orderType ||
        hectaresMinFilter ||
        hectaresMaxFilter ||
        flowRateMinFilter ||
        flowRateMaxFilter ||
        altitudeMinFilter ||
        altitudeMaxFilter ||
        routeSpacingMinFilter ||
        routeSpacingMaxFilter ||
        dropletSizeMinFilter ||
        dropletSizeMaxFilter
    );

  const showOverviewCards = !simpleMode && !propCustomerId && !propServiceOrderId;
  const overviewSummary = data?.summary;
  const formatSummaryHectares = (value: number | undefined) =>
    value === undefined ? '-- ha' : `${value.toFixed(2).replace('.', ',')} ha`;
  const formatSummaryCount = (value: number | undefined) =>
    value === undefined ? '--' : String(value);

  return (
    <>
      {showOverviewCards && (
        <div className='mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3'>
          <div className='rounded-xl border border-border bg-muted/30 p-4 sm:p-5'>
            <p className='text-sm text-muted-foreground'>Total filtrado</p>
            <p className='mt-8 text-4xl font-semibold text-emerald-500'>
              {formatSummaryHectares(overviewSummary?.totalFilteredHectares)}
            </p>
          </div>
          <div className='rounded-xl border border-border bg-muted/30 p-4 sm:p-5'>
            <p className='text-sm text-muted-foreground'>Total aplicações de ontem</p>
            <p className='mt-8 text-4xl font-semibold text-amber-400'>
              {formatSummaryHectares(overviewSummary?.yesterdayHectares)}
            </p>
          </div>
          <div className='rounded-xl border border-border bg-muted/30 p-4 sm:p-5'>
            <p className='text-sm text-muted-foreground'>Aplicações avulsas</p>
            <div className='mt-6 space-y-4'>
              <div>
                <p className='text-3xl font-semibold text-orange-500'>
                  {formatSummaryCount(overviewSummary?.standaloneCount)}
                </p>
                <p className='text-xs font-semibold tracking-wide text-orange-500'>APLICAÇÕES</p>
              </div>
              <div>
                <p className='text-3xl font-semibold text-red-500'>
                  {formatSummaryHectares(overviewSummary?.standaloneHectares)}
                </p>
                <p className='text-xs font-semibold tracking-wide text-red-500'>ÁREA TOTAL</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className='mb-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5'>
        <div className='flex w-full flex-col gap-4'>
          <div className='grid w-full grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto]'>
            <Input
              placeholder='Buscar aplicações...'
              value={inputSearchValue}
              onChange={(event) => handleSearchChange(event.target.value)}
              className='h-9 w-full'
            />
            <DateRangePicker
              key={`${dateFilter?.startDate ?? 'none'}-${dateFilter?.endDate ?? 'none'}`}
              className='h-9 w-full min-w-0'
              initialValue={dateFilter}
              onChange={handleDateChange}
            />
            <SearchableSelectQuery
              options={farms.map((farm: Farm) => ({
                value: farm.id,
                label: farm.name,
              }))}
              value={farmFilter}
              onValueChange={(value) => handleFarmChange(value as string | undefined)}
              placeholder='Fazenda'
              searchPlaceholder='Buscar fazenda...'
              className='h-9 w-full'
              popoverClassName='w-[260px]'
              clearable
              onSearchChange={setFarmSearchValue}
              onScrollEnd={fetchNextPageFarms}
              hasNextPage={hasNextPageFarms}
              isFetchingNextPage={isFetchingNextPageFarms}
              isLoading={isLoadingFarms}
            />
            <SearchableSelectQuery
              options={products.map((product: Product) => ({
                value: product.id,
                label: product.name,
              }))}
              value={productFilter}
              onValueChange={(value) => handleProductChange(value as string | undefined)}
              placeholder='Produto'
              searchPlaceholder='Buscar produto...'
              className='h-9 w-full'
              popoverClassName='w-[260px]'
              clearable
              onSearchChange={setProductSearchValue}
              onScrollEnd={fetchNextPageProducts}
              hasNextPage={hasNextPageProducts}
              isFetchingNextPage={isFetchingNextPageProducts}
              isLoading={isLoadingProducts}
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
              className='h-9 w-full'
              popoverClassName='w-[260px]'
              clearable
              onSearchChange={setPilotSearchValue}
              onScrollEnd={fetchNextPagePilots}
              hasNextPage={hasNextPagePilots}
              isFetchingNextPage={isFetchingNextPagePilots}
              isLoading={isLoadingPilots}
            />
            <div className='flex flex-wrap items-center gap-2 lg:justify-end'>
              {!simpleMode && (
                <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant='outline' className='h-9 gap-2 px-3'>
                      <Filter className='h-4 w-4' />
                      Mais filtros
                    </Button>
                  </SheetTrigger>
                  <SheetContent side='right' className='w-[96vw] sm:max-w-xl overflow-y-auto'>
                    <SheetHeader>
                      <SheetTitle>Filtros avançados</SheetTitle>
                      <SheetDescription>Refine os registros de aplicações</SheetDescription>
                    </SheetHeader>
                    <div className='px-4 pb-4 space-y-4'>
                      <p className='text-xs text-muted-foreground'>
                        Use os filtros abaixo para refinar os registros. Todos são combináveis.
                      </p>
                      <div className='space-y-2'>
                        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                          Situação geral
                        </p>
                        <Select value={invalidApplicationFilter} onValueChange={handleInvalidApplicationChange}>
                          <SelectTrigger>
                            <SelectValue placeholder='Filtrar aplicações' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='false'>Todas</SelectItem>
                            <SelectItem value='true'>Somente inválidas</SelectItem>
                          </SelectContent>
                        </Select>
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
                            className='w-full'
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
                      </div>
                      <Separator />

                      <div className='space-y-3'>
                        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                          Operação
                        </p>
                        {!propServiceOrderId && (
                          <SearchableSelectQuery
                            options={statusOptions}
                            value={statusFilter}
                            onValueChange={(value) => handleStatusChange(value as string | undefined)}
                            placeholder={
                              disableStatusFilter && statusDisplayText ? statusDisplayText : 'Status da OS'
                            }
                            searchPlaceholder='Buscar status...'
                            className='w-full'
                            clearable={!disableStatusFilter}
                            disabled={disableStatusFilter}
                          />
                        )}
                        {!propServiceOrderId && (
                          <SearchableSelectQuery
                            options={serviceOrders.map((so: ServiceOrder) => ({
                              value: so.id,
                              label: `#${so.number} - ${so.farms?.[0]?.name || 'Sem fazenda'}`,
                            }))}
                            value={serviceOrderFilter}
                            onValueChange={(value) => handleServiceOrderChange(value as string | undefined)}
                            placeholder={serviceOrderDisplayText || 'Selecionar OS'}
                            searchPlaceholder='Buscar OS...'
                            className='w-full'
                            clearable
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
                          className='w-full'
                          clearable
                        />
                        <SearchableSelectQuery
                          options={orderTypeOptions}
                          value={orderType}
                          onValueChange={(value) =>
                            handleOrderTypeChange(value as ApplicationOrderType | undefined)
                          }
                          placeholder='Ordenação'
                          searchPlaceholder='Buscar...'
                          className='w-full'
                          clearable
                        />
                        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                          Faixas numéricas
                        </p>
                        <div className='grid grid-cols-2 gap-3'>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Hectares mín</p>
                            <Input type='number' value={hectaresMinFilter} onChange={(e) => setHectaresMinFilter(e.target.value)} placeholder='0' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Hectares máx</p>
                            <Input type='number' value={hectaresMaxFilter} onChange={(e) => setHectaresMaxFilter(e.target.value)} placeholder='9999' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Vazão mín</p>
                            <Input type='number' value={flowRateMinFilter} onChange={(e) => setFlowRateMinFilter(e.target.value)} placeholder='0' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Vazão máx</p>
                            <Input type='number' value={flowRateMaxFilter} onChange={(e) => setFlowRateMaxFilter(e.target.value)} placeholder='9999' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Altitude mín</p>
                            <Input type='number' value={altitudeMinFilter} onChange={(e) => setAltitudeMinFilter(e.target.value)} placeholder='0' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Altitude máx</p>
                            <Input type='number' value={altitudeMaxFilter} onChange={(e) => setAltitudeMaxFilter(e.target.value)} placeholder='9999' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Espaçamento mín</p>
                            <Input type='number' value={routeSpacingMinFilter} onChange={(e) => setRouteSpacingMinFilter(e.target.value)} placeholder='0' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Espaçamento máx</p>
                            <Input type='number' value={routeSpacingMaxFilter} onChange={(e) => setRouteSpacingMaxFilter(e.target.value)} placeholder='9999' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Gota mín</p>
                            <Input type='number' value={dropletSizeMinFilter} onChange={(e) => setDropletSizeMinFilter(e.target.value)} placeholder='0' />
                          </div>
                          <div className='space-y-1'>
                            <p className='text-xs text-muted-foreground'>Gota máx</p>
                            <Input type='number' value={dropletSizeMaxFilter} onChange={(e) => setDropletSizeMaxFilter(e.target.value)} placeholder='9999' />
                          </div>
                        </div>
                      </div>

                      {hasAnyFilterActive && (
                        <>
                          <Separator />
                          <Button variant='outline' className='w-full' onClick={clearAllFilters}>
                            <X className='h-4 w-4 mr-1' />
                            Limpar todos os filtros
                          </Button>
                        </>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              {hasAnyFilterActive && (
                <Button variant='ghost' className='h-9 px-3 text-sm' onClick={clearAllFilters}>
                  <X className='h-4 w-4 mr-1' />
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
          {!simpleMode && (
            <div className='mt-2'>
              <div className='grid w-full grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-7'>
              <div className='space-y-1.5'>
                <p className='text-sm font-medium text-foreground/90'>Ajudante</p>
                <SearchableSelectQuery
                  options={allAssistants.map((assistant: Assistant) => ({
                    value: assistant.id,
                    label: assistant.name,
                  }))}
                  value={assistantFilter}
                  onValueChange={(value) => setAssistantFilter(value as string | undefined)}
                  placeholder='Selecionar ajudante'
                  searchPlaceholder='Buscar ajudante...'
                  className='h-9 w-full'
                  popoverClassName='w-[250px]'
                  clearable
                  onSearchChange={setAssistantSearchValue}
                  onScrollEnd={fetchNextPageAssistants}
                  hasNextPage={hasNextPageAssistants}
                  isFetchingNextPage={isFetchingNextPageAssistants}
                  isLoading={isLoadingAssistants}
                />
              </div>
              <div className='space-y-1.5'>
                <p className='text-sm font-medium text-foreground/90'>Drone</p>
                <SearchableSelectQuery
                  options={allDrones.map((drone: Drone) => ({
                    value: drone.id,
                    label: drone.name,
                  }))}
                  value={droneFilter}
                  onValueChange={(value) => setDroneFilter(value as string | undefined)}
                  placeholder='Selecionar drone'
                  searchPlaceholder='Buscar drone...'
                  className='h-9 w-full'
                  popoverClassName='w-[250px]'
                  clearable
                  onSearchChange={setDroneSearchValue}
                  onScrollEnd={fetchNextPageDrones}
                  hasNextPage={hasNextPageDrones}
                  isFetchingNextPage={isFetchingNextPageDrones}
                  isLoading={isLoadingDrones}
                />
              </div>
              <div className='space-y-1.5'>
                <p className='text-sm font-medium text-foreground/90'>Cultura</p>
                <SearchableSelectQuery
                  options={allCultures.map((culture: CultureType) => ({
                    value: culture.id,
                    label: culture.name,
                  }))}
                  value={cultureFilter}
                  onValueChange={(value) => setCultureFilter(value as string | undefined)}
                  placeholder='Selecionar cultura'
                  searchPlaceholder='Buscar cultura...'
                  className='h-9 w-full'
                  popoverClassName='w-[250px]'
                  clearable
                  onSearchChange={setCultureSearchValue}
                  onScrollEnd={fetchNextPageCultures}
                  hasNextPage={hasNextPageCultures}
                  isFetchingNextPage={isFetchingNextPageCultures}
                  isLoading={isLoadingCultures}
                />
              </div>
              <div className='space-y-1.5'>
                <p className='text-sm font-medium text-foreground/90'>Talhão</p>
                <Input
                  className='h-9'
                  value={plotNameFilter}
                  onChange={(e) => setPlotNameFilter(e.target.value)}
                  placeholder='Digite parte do nome do talhão'
                />
              </div>
              <div className='space-y-1.5 xl:col-span-1'>
                <p className='text-sm font-medium text-foreground/90'>Número da OS</p>
                <Input
                  className='h-9'
                  value={serviceOrderNumberFilter}
                  onChange={(e) => setServiceOrderNumberFilter(e.target.value)}
                  placeholder='Ex.: 123'
                />
              </div>
              <div className='space-y-1.5 xl:col-span-2'>
                <p className='text-sm font-medium text-foreground/90'>Observações</p>
                <Input
                  className='h-9'
                  value={observationsFilter}
                  onChange={(e) => setObservationsFilter(e.target.value)}
                  placeholder='Buscar por texto nas observações'
                />
              </div>
              </div>
            </div>
          )}
          {activeFilters.length > 0 && (
            <div className='flex flex-wrap items-center gap-2'>
              {activeFilters.map((filter) => (
                <Badge key={filter.key} variant='outline' className='gap-1.5 bg-muted/30 pr-1'>
                  <span>{filter.label}</span>
                  <button
                    type='button'
                    onClick={filter.onRemove}
                    className='rounded-sm p-0.5 hover:bg-muted-foreground/20'
                    aria-label={`Remover filtro ${filter.label}`}
                  >
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className='mt-2 rounded-xl border border-border bg-background p-4 sm:p-5'>
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        renderToolbar={({ columnsControl }) => (
          <div className='mb-3 flex justify-end'>{columnsControl}</div>
        )}
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
        renderEmptyState={() => (
          <div className='flex flex-col items-center justify-center gap-3 py-2 px-2 max-w-md mx-auto'>
            {hasAnyFilterActive ? (
              <>
                <div className='rounded-full bg-muted p-3'>
                  <SearchX className='h-6 w-6 text-muted-foreground' aria-hidden />
                </div>
                <div className='space-y-1 text-center'>
                  <p className='text-sm font-medium text-foreground'>Nenhum registro com os filtros atuais</p>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Ajuste a busca, o período ou os filtros avançados — ou limpe tudo para voltar à lista
                    completa.
                  </p>
                </div>
                <Button type='button' variant='outline' size='sm' onClick={clearAllFilters}>
                  Limpar filtros
                </Button>
              </>
            ) : (
              <>
                <div className='rounded-full bg-muted p-3'>
                  <Filter className='h-6 w-6 text-muted-foreground' aria-hidden />
                </div>
                <div className='space-y-1 text-center'>
                  <p className='text-sm font-medium text-foreground'>Nenhuma aplicação encontrada</p>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Quando houver registros, eles aparecerão nesta tabela. Use &quot;Nova aplicação&quot; para
                    incluir dados.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
        renderErrorState={() => (
          <div className='flex flex-col items-center justify-center gap-3 px-4 py-6 max-w-lg mx-auto text-center'>
            <p className='text-sm font-medium text-foreground'>Não foi possível carregar as aplicações</p>
            <p className='text-xs text-muted-foreground leading-relaxed'>
              {error?.message ||
                'Verifique sua conexão com a internet. Se o problema continuar, tente novamente em instantes.'}
            </p>
            <Button type='button' variant='outline' size='sm' onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
      />
      </div>

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
