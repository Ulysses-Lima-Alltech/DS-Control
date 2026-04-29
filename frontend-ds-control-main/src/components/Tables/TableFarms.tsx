'use client';

import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Calendar, ChevronDown, MapPin, MoreHorizontal, Users, VectorSquare } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import DialogPlotDetails from '@/components/DialogPlotDetails';
import FormEditFarm from '@/components/Forms/FormEditFarm';
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
import { useDeleteFarmById } from '@/mutations/farm.mutation';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarms } from '@/queries/farm.query';
import { Customer } from '@/types/customer.type';
import { Farm, FarmOrderBy, FarmOrderType } from '@/types/farm.type';
import { Plot } from '@/types/plot.type';
import { formatTimestamp } from '@/utils/timestamp-formatter';

type TableFarmsProps = {
  customerId?: string;
};

export default function TableFarms({ customerId: initialCustomerId }: TableFarmsProps) {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [customerSearchValue, setCustomerSearchValue] = React.useState('');
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | undefined>(
    initialCustomerId
  );
  const [farmToDelete, setFarmToDelete] = React.useState<Farm | null>(null);
  const [farmToEdit, setFarmToEdit] = React.useState<Farm | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [orderBy, setOrderBy] = React.useState<FarmOrderBy | undefined>(undefined)
  const [orderType, setOrderType] = React.useState<FarmOrderType | undefined>(undefined)

  const orderByOptions = [
    { value: 'name' as FarmOrderBy, label: 'Nome' },
    { value: 'created_at' as FarmOrderBy, label: 'Data de criação' },
    { value: 'customer' as FarmOrderBy, label: 'Cliente' },
  ]

  const orderTypeOptions = [
    { value: 'asc' as FarmOrderType, label: 'Ascendente'},
    { value: 'desc' as FarmOrderType, label: 'Descendente'},
  ]

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
    isLoading,
    isError,
    error,
  } = useGetAllFarms(selectedCustomerId, {
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    includeCustomer: 'true',
    includePlots: 'true',
    includeGeoJson: 'false',
    orderBy: orderBy ?? FarmOrderBy.CREATEDAT,
    orderType: orderType ?? FarmOrderType.DESC
  });

  const { mutate: deleteFarmById, isPending: isDeletingFarm } = useDeleteFarmById({
    onSuccess: () => {
      toast('Farm deleted successfully');
      queryClient.invalidateQueries({
        queryKey: ['farms'],
      });
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  const handleDeleteClick = useCallback((farm: Farm) => {
    setFarmToDelete(farm);
  }, []);

  const handleEditClick = useCallback((farm: Farm) => {
    setFarmToEdit(farm);
    setIsEditDialogOpen(true);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setFarmToEdit(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (farmToDelete) {
      deleteFarmById(farmToDelete.id);
      setFarmToDelete(null);
    }
  }, [farmToDelete, deleteFarmById]);

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
    if (farmsData && farmsData.totalPages > 0 && currentPage > farmsData.totalPages) {
      setCurrentPage(1);
    }
  }, [farmsData?.totalPages, currentPage]);

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
        setCurrentPage(1);
      }
    },
    [initialCustomerId]
  );

  const handleOrderByChange = (orderBy: FarmOrderBy | undefined) => {
      setOrderBy(orderBy)
      setCurrentPage(1)
  }

  const handleOrderTypeChange = (orderType: FarmOrderType | undefined) => {
    setOrderType(orderType)
    setCurrentPage(1)
  }

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
      const allFarmIds = farmsData?.data?.map((_, index) => index.toString()) || [];
      setExpandedRows(new Set(allFarmIds));
    } else {
      setExpandedRows(new Set());
    }
  };

  type FarmColumnId = 'name' | 'customer' | 'createdAt' | 'actions' | 'expand';

  const initialColumnVisibility: Partial<Record<FarmColumnId, boolean>> = {
    createdAt: false,
  };

  const columns: ColumnDefWithId<Farm>[] = [
    createClickableColumn<Farm>(
      'name',
      'name',
      'Fazenda',
      ({ row }) => {
        const farm = row.original;
        const validPlots = getValidPlots(farm);
        const totalHectares = getTotalHectares(farm);

        return (
          <div className='flex items-start space-x-3 py-2'>
            <div className='flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center'>
              <MapPin className='h-5 w-5 text-black dark:text-white' />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center space-x-2'>
                <h4 className='text-sm font-semibold text-foreground truncate'>{farm.name}</h4>
                <Badge variant='outline' className='text-xs bg-accent'>
                  {validPlots.length} talh{validPlots.length > 1 ? 'ões' : 'ão'}
                </Badge>
              </div>
              <div className='flex items-center space-x-4 mt-1 text-xs text-muted-foreground'>
                <div className='flex items-center space-x-1'>
                  <VectorSquare className='h-3 w-3' />
                  <span>{totalHectares.toFixed(2)} ha</span>
                </div>
                <div className='flex items-center space-x-1'>
                  <Calendar className='h-3 w-3' />
                  <span>{formatTimestamp(farm.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      },
      (farm) => {
        const rowIndex = farmsData?.data?.findIndex((f) => f.id === farm.id)?.toString() || '0';
        toggleRowExpansion(rowIndex);
      }
    ),
    createClickableColumn<Farm>(
      'customer',
      'customer',
      'Proprietário',
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
      (farm) => {
        const rowIndex = farmsData?.data?.findIndex((f) => f.id === farm.id)?.toString() || '0';
        toggleRowExpansion(rowIndex);
      }
    ),
    createClickableColumn<Farm>(
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
      (farm) => {
        const rowIndex = farmsData?.data?.findIndex((f) => f.id === farm.id)?.toString() || '0';
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
        const farm = row.original;

        return (
          <div className='flex justify-center gap-2'>
            <DialogPlotDetails farmId={farm.id} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='icon' className='h-8 w-8' disabled={isDeletingFarm}>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => handleEditClick(farm)}>
                  Editar fazenda
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteClick(farm)}
                  className='text-destructive'
                >
                  Deletar fazenda
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

  const getValidPlots = (farm: Farm) => {
    return farm.plots.filter((plot: Plot) => !plot.deletedAt);
  };

  const getTotalHectares = (farm: Farm) => {
    return getValidPlots(farm).reduce((sum, plot) => sum + (Number(plot.hectare) || 0), 0);
  };

  const renderExpandedRow = (farm: Farm) => {
    const validPlots = getValidPlots(farm);

    return (
      <div className='border-l-4'>
        <div className='p-4'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center space-x-3'>
              <div className='w-8 h-8 rounded-full flex items-center justify-center'>
                <MapPin className='h-4 w-4 text-black dark:text-white' />
              </div>
              <div>
                <h3 className='text-lg font-semibold text-foreground'>Talhões de {farm.name}</h3>
                <p className='text-sm text-muted-foreground'>
                  {validPlots.length} talh{validPlots.length > 1 ? 'ões' : 'ão'} •{' '}
                  {getTotalHectares(farm).toFixed(2)} ha total
                </p>
              </div>
            </div>
            <Badge variant='outline' className='text-xs'>
              Área Total: {getTotalHectares(farm).toFixed(2)} ha
            </Badge>
          </div>

          <div className='grid gap-3'>
            {validPlots.map((plot: Plot, index: number) => (
              <div
                key={plot.id}
                className='bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 p-4 hover:bg-background/50 transition-all duration-200 hover:shadow-sm hover:border-1 hover:border-secondary/10'
              >
                <div className='flex items-center justify-between'>
                  <div className='flex items-center space-x-3 flex-1'>
                    <div className='flex-shrink-0 w-10 h-10 bg-accent rounded-lg flex items-center justify-center'>
                      <span className='text-black font-semibold text-sm dark:text-white'>
                        {index + 1}
                      </span>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center space-x-2 mb-1'>
                        <h4 className='text-sm font-semibold text-foreground'>{plot.name}</h4>
                      </div>
                      <div className='flex items-center space-x-4 text-xs text-muted-foreground'>
                        <div className='flex items-center space-x-1'>
                          <VectorSquare className='h-3 w-3' />
                          <span>Área: {plot.hectare ?? '0'} ha</span>
                        </div>
                        {plot.createdAt && (
                          <div className='flex items-center space-x-1'>
                            <Calendar className='h-3 w-3' />
                            <span>Criado: {formatTimestamp(plot.createdAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogPlotDetails farmId={farm.id} plotId={plot.id} />
                      </TooltipTrigger>
                      <TooltipContent>Ver detalhes do talhão</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {validPlots.length === 0 && (
            <div className='text-center py-8'>
              <div className='w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3'>
                <MapPin className='h-8 w-8 text-muted-foreground' />
              </div>
              <p className='text-muted-foreground'>Nenhum talhão encontrado nesta fazenda</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='w-full'>
      <Dialog open={!!farmToDelete} onOpenChange={(open) => !open && setFarmToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar a fazenda {farmToDelete?.name}? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setFarmToDelete(null)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleConfirmDelete} disabled={isDeletingFarm}>
              {isDeletingFarm ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {farmToEdit && (
        <DialogForm
          form={<FormEditFarm farmId={farmToEdit.id} closeDialog={handleCloseEditDialog} />}
          trigger={null}
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          className='sm:max-w-5xl p-0'
        />
      )}

      <DataTable
        columns={columns}
        data={farmsData?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: [
              'farms',
              selectedCustomerId,
              {
                page: currentPage.toString(),
                limit: pageSize.toString(),
                search: debouncedSearchValue || undefined,
              },
            ],
          })
        }
        searchConfig={{
          placeholder: 'Buscar fazendas...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}

        filters={
          <>

            {!initialCustomerId &&
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
              onScrollEnd={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              isLoading={isLoadingCustomers}
            />}

            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as FarmOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) => handleOrderTypeChange(value as FarmOrderType | undefined)}
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
          totalPages: farmsData?.totalPages ?? 0,
          totalCount: farmsData?.totalCount,
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
              <MapPin className='h-8 w-8 text-muted-foreground' />
            </div>
            <p className='text-muted-foreground'>Nenhuma fazenda encontrada</p>
          </div>
        )}
      />
    </div>
  );
}
