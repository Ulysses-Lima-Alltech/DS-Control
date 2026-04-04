'use client';

import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import {
  Calendar,
  ChevronDown,
  MapPin,
  MoreHorizontal,
  Route as RouteIcon,
  Users,
} from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditRoute from '@/components/Forms/FormEditRoute';
import MapViewer from '@/components/MapViewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { DataTable, type ColumnDefWithId } from '@/components/ui/table-data';
import { createClickableColumn } from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteRouteById } from '@/mutations/route.mutation';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllRoutes } from '@/queries/route.query';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import { Route, RouteOrderBy, RouteOrderType, RouteWithFarmAndCustomer } from '@/types/route.type';
import { formatTimestamp } from '@/utils/timestamp-formatter';

type TableRoutesProps = {
  customerId?: string;
  farmId?: string;
};

export default function TableRoutes({
  customerId: initialCustomerId,
  farmId: initialFarmId,
}: TableRoutesProps) {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [customerSearchValue, setCustomerSearchValue] = React.useState('');
  const [farmSearchValue, setFarmSearchValue] = React.useState('');
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | undefined>(
    initialCustomerId
  );
  const [selectedFarmId, setSelectedFarmId] = React.useState<string | undefined>(initialFarmId);
  const [routeToDelete, setRouteToDelete] = React.useState<Route | null>(null);
  const [routeToEdit, setRouteToEdit] = React.useState<Route | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [orderBy, setOrderBy] = React.useState<RouteOrderBy | undefined>(undefined);
  const [orderType, setOrderType] = React.useState<RouteOrderType | undefined>(undefined);

  const orderByOptions = [
    { value: 'name' as RouteOrderBy, label: 'Nome' },
    { value: 'created_at' as RouteOrderBy, label: 'Data de criação' },
    { value: 'farm' as RouteOrderBy, label: 'Fazenda' },
    { value: 'customer' as RouteOrderBy, label: 'Cliente' },
  ];

  const orderTypeOptions = [
    { value: 'asc' as RouteOrderType, label: 'Ascendente' },
    { value: 'desc' as RouteOrderType, label: 'Descendente' },
  ];

  const {
    data: customersData,
    fetchNextPage: fetchNextCustomerPage,
    hasNextPage: hasNextCustomerPage,
    isFetchingNextPage: isFetchingNextCustomerPage,
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
    fetchNextPage: fetchNextFarmPage,
    hasNextPage: hasNextFarmPage,
    isFetchingNextPage: isFetchingNextFarmPage,
    isLoading: isLoadingFarms,
  } = useGetAllFarmsInfinite(selectedCustomerId, {
    limit: '10',
    search: farmSearchValue || undefined,
  });

  const allFarms =
    (farmsData as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap((page) => page.data) ||
    [];

  const {
    data: routesData,
    isLoading,
    isError,
    error,
  } = useGetAllRoutes({
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    includeCustomer: 'true',
    includeFarm: 'true',
    includeGeoJson: 'false',
    orderBy: orderBy ?? RouteOrderBy.CREATEDAT,
    orderType: orderType ?? RouteOrderType.DESC,
  });

  const { mutate: deleteRouteById, isPending: isDeletingRoute } = useDeleteRouteById({
    onSuccess: () => {
      toast('Rota deletada com sucesso');
      queryClient.invalidateQueries({
        queryKey: ['routes'],
      });
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  const handleDeleteClick = useCallback((route: Route) => {
    setRouteToDelete(route);
  }, []);

  const handleEditClick = useCallback((route: Route) => {
    setRouteToEdit(route);
    setIsEditDialogOpen(true);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setRouteToEdit(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (routeToDelete) {
      deleteRouteById(routeToDelete.id);
      setRouteToDelete(null);
    }
  }, [routeToDelete, deleteRouteById]);

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
    if (routesData && routesData.totalPages > 0 && currentPage > routesData.totalPages) {
      setCurrentPage(1);
    }
  }, [routesData?.totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchValue]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleCustomerChange = useCallback(
    (customerId: string | undefined) => {
      if (!initialCustomerId) {
        setSelectedCustomerId(customerId);
        setSelectedFarmId(undefined);
        setCurrentPage(1);
      }
    },
    [initialCustomerId]
  );

  const handleFarmChange = useCallback(
    (farmId: string | undefined) => {
      if (!initialFarmId) {
        setSelectedFarmId(farmId);
        setCurrentPage(1);
      }
    },
    [initialFarmId]
  );

  const handleOrderByChange = (orderBy: RouteOrderBy | undefined) => {
    setOrderBy(orderBy);
    setCurrentPage(1);
  };

  const handleOrderTypeChange = (orderType: RouteOrderType | undefined) => {
    setOrderType(orderType);
    setCurrentPage(1);
  };

  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const toggleAllRows = () => {
    if (expandedRows.size === 0) {
      const allRouteIds = routesData?.data?.map((_, index) => index.toString()) || [];
      setExpandedRows(new Set(allRouteIds));
    } else {
      setExpandedRows(new Set());
    }
  };

  type RouteColumnId = 'name' | 'farm' | 'customer' | 'createdAt' | 'actions' | 'expand';

  const initialColumnVisibility: Partial<Record<RouteColumnId, boolean>> = {
    createdAt: false,
  };

  const columns: ColumnDefWithId<RouteWithFarmAndCustomer>[] = [
    createClickableColumn<RouteWithFarmAndCustomer>(
      'name',
      'name',
      'Rota',
      ({ row }) => {
        const route = row.original;

        return (
          <div className='flex items-start space-x-3 py-2'>
            <div className='flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center'>
              <RouteIcon className='h-5 w-5 text-black dark:text-white' />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center space-x-2'>
                <h4 className='text-sm font-semibold text-foreground truncate'>{route.name}</h4>
              </div>
              <div className='flex items-center space-x-4 mt-1 text-xs text-muted-foreground'>
                <div className='flex items-center space-x-1'>
                  <Calendar className='h-3 w-3' />
                  <span>{formatTimestamp(new Date(route.createdAt))}</span>
                </div>
              </div>
            </div>
          </div>
        );
      },
      (route) => {
        const rowIndex = routesData?.data?.findIndex((r) => r.id === route.id)?.toString() || '0';
        toggleRowExpansion(rowIndex);
      }
    ),
    createClickableColumn<RouteWithFarmAndCustomer>(
      'farm',
      'farm',
      'Fazenda',
      ({ row }) => (
        <div className='flex items-center space-x-2 py-2'>
          <div className='flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center'>
            <MapPin className='h-4 w-4 text-black dark:text-white' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-medium text-foreground truncate'>
              {(row.getValue('farm') as { name: string }).name}
            </p>
          </div>
        </div>
      ),
      (route) => {
        const rowIndex = routesData?.data?.findIndex((r) => r.id === route.id)?.toString() || '0';
        toggleRowExpansion(rowIndex);
      }
    ),
    createClickableColumn<RouteWithFarmAndCustomer>(
      'customer',
      'customer',
      'Cliente',
      ({ row }) => (
        <div className='flex items-center space-x-2 py-2'>
          <div className='flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center'>
            <Users className='h-4 w-4 text-black dark:text-white' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-medium text-foreground truncate'>
              {(row.getValue('customer') as { name: string }).name}
            </p>
          </div>
        </div>
      ),
      (route) => {
        const rowIndex = routesData?.data?.findIndex((r) => r.id === route.id)?.toString() || '0';
        toggleRowExpansion(rowIndex);
      }
    ),
    createClickableColumn<RouteWithFarmAndCustomer>(
      'createdAt',
      'createdAt',
      'Data de criação',
      ({ row }) => (
        <div className='flex items-center space-x-2 py-2'>
          <Calendar className='h-4 w-4 text-muted-foreground' />
          <span className='text-sm text-foreground'>
            {formatTimestamp(row.getValue('createdAt'))}
          </span>
        </div>
      ),
      (route) => {
        const rowIndex = routesData?.data?.findIndex((r) => r.id === route.id)?.toString() || '0';
        toggleRowExpansion(rowIndex);
      }
    ),
    {
      id: 'actions',
      header: () => <div className='flex justify-center'>Ações</div>,
      label: 'Ações',
      enableHiding: false,
      size: 120,
      cell: ({ row }) => {
        const route = row.original;

        return (
          <div className='flex justify-center gap-2'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  disabled={isDeletingRoute}
                >
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => handleEditClick(route)}>
                  Editar rota
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteClick(route)}
                  className='text-destructive'
                >
                  Deletar rota
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
    {
      id: 'expand',
      label: 'Expandir',
      header: () => (
        <div className='flex justify-center'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8' onClick={toggleAllRows}>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${expandedRows.size > 0 ? 'rotate-270' : ''}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {expandedRows.size > 0 ? 'Recolher todos' : 'Expandir todos'}
            </TooltipContent>
          </Tooltip>
        </div>
      ),
      cell: ({ row }) => {
        const isExpanded = expandedRows.has(row.id);
        return (
          <div className='flex justify-center'>
            <Button
              variant='ghost'
              size='icon'
              className='h-8 w-8'
              onClick={() => toggleRowExpansion(row.id)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-270' : ''}`}
                  />
                </TooltipTrigger>
                <TooltipContent>{isExpanded ? 'Recolher' : 'Expandir'}</TooltipContent>
              </Tooltip>
            </Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      size: 50,
      minSize: 40,
      maxSize: 60,
    },
  ];

  const renderExpandedRow = (route: RouteWithFarmAndCustomer) => {
    return (
      <div className='border-l-4'>
        <div className='p-4'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center space-x-3'>
              <div className='w-8 h-8 rounded-full flex items-center justify-center'>
                <RouteIcon className='h-4 w-4 text-black dark:text-white' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-foreground'>Detalhes de {route.name}</h3>
                <p className='text-sm text-muted-foreground'>
                  Fazenda: {route.farm.name} • Cliente: {route.customer.name}
                </p>
              </div>
            </div>
            <Badge variant='outline' className='text-xs'>
              Visualização da rota
            </Badge>
          </div>

          <div className='rounded-lg border overflow-hidden' style={{ height: '400px' }}>
            {/* eslint-disable-next-line */}
            <MapViewer geoData={route.geoJson as any} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='w-full'>
      <Dialog open={!!routeToDelete} onOpenChange={(open) => !open && setRouteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar a rota {routeToDelete?.name}? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRouteToDelete(null)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleConfirmDelete} disabled={isDeletingRoute}>
              {isDeletingRoute ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {routeToEdit && (
        <DialogForm
          form={<FormEditRoute routeId={routeToEdit.id} closeDialog={handleCloseEditDialog} />}
          trigger={null}
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          className='sm:max-w-5xl p-0'
        />
      )}

      <DataTable
        columns={columns}
        data={(routesData?.data as RouteWithFarmAndCustomer[]) ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: ['routes'],
          })
        }
        searchConfig={{
          placeholder: 'Buscar rotas...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}
        filters={
          <>
            {!initialCustomerId && (
              <SearchableSelectQuery
                options={allCustomers.map((customer: Customer) => ({
                  value: customer.id,
                  label: customer.name,
                }))}
                value={selectedCustomerId}
                onValueChange={(value) => handleCustomerChange(value as string | undefined)}
                placeholder='Todos os clientes'
                searchPlaceholder='Buscar cliente...'
                className='w-[200px]'
                clearable
                disabled={!!initialCustomerId}
                onSearchChange={(search) => {
                  setCustomerSearchValue(search);
                }}
                onScrollEnd={fetchNextCustomerPage}
                hasNextPage={hasNextCustomerPage}
                isFetchingNextPage={isFetchingNextCustomerPage}
                isLoading={isLoadingCustomers}
              />
            )}

            {!initialFarmId && (
              <SearchableSelectQuery
                options={allFarms.map((farm: Farm) => ({
                  value: farm.id,
                  label: farm.name,
                }))}
                value={selectedFarmId}
                onValueChange={(value) => handleFarmChange(value as string | undefined)}
                placeholder='Todas as fazendas'
                searchPlaceholder='Buscar fazenda...'
                className='w-[200px]'
                clearable
                disabled={!!initialFarmId}
                onSearchChange={(search) => {
                  setFarmSearchValue(search);
                }}
                onScrollEnd={fetchNextFarmPage}
                hasNextPage={hasNextFarmPage}
                isFetchingNextPage={isFetchingNextFarmPage}
                isLoading={isLoadingFarms}
              />
            )}

            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as RouteOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) => handleOrderTypeChange(value as RouteOrderType | undefined)}
              placeholder='Ordenação'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />
          </>
        }
        pagination={{
          manual: true,
          currentPage,
          pageSize,
          totalPages: routesData?.totalPages ?? 0,
          totalCount: routesData?.totalCount,
          onPageChange: setCurrentPage,
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          },
        }}
        initialColumnVisibility={initialColumnVisibility}
        expandedRows={expandedRows}
        renderExpandedRow={renderExpandedRow}
        renderEmptyState={() => (
          <div className='text-center py-8'>
            <div className='w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3'>
              <RouteIcon className='h-8 w-8 text-muted-foreground' />
            </div>
            <p className='text-muted-foreground'>Nenhuma rota encontrada</p>
          </div>
        )}
      />
    </div>
  );
}
