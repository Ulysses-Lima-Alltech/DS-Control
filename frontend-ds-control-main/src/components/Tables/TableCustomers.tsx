'use client';

import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Eye, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import FormEditCustomer from '@/components/Forms/FormEditCustomer';
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
import { createActionsColumn, createColumn } from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteCustomerById } from '@/mutations/customer.mutation';
import { useGetAllCustomers } from '@/queries/customer.query';
import { Customer, CustomerOrderBy, CustomerOrderType } from '@/types/customer.type';
import { documentFormatter } from '@/utils/document-formatter';
import { phoneFormatter } from '@/utils/phone-formatter';

export const TableCustomers = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [customerToDelete, setCustomerToDelete] = React.useState<Customer | null>(null);
  const [customerToEdit, setCustomerToEdit] = React.useState<Customer | null>(null);

  const [orderBy, setOrderBy] = React.useState<CustomerOrderBy | undefined>(undefined)
  const [orderType, setOrderType] = React.useState<CustomerOrderType | undefined>(undefined)

  const orderByOptions = [
    { value: 'name' as CustomerOrderBy, label: 'Nome' },
    { value: 'created_at' as CustomerOrderBy, label: 'Data de criação' },
  ]

  const orderTypeOptions = [
    { value: 'asc' as CustomerOrderType, label: 'Ascendente'},
    { value: 'desc' as CustomerOrderType, label: 'Descendente'},
  ]

  const {
    data,
    isPending: isLoadingUsers,
    isError,
    error,
  } = useGetAllCustomers({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    orderBy: orderBy ?? CustomerOrderBy.CREATEDAT,
    orderType: orderType ?? CustomerOrderType.DESC
  });

  const { mutate: deleteCustomerById, isPending: isDeletingUser } = useDeleteCustomerById({
    onSuccess: () => {
      toast('Cliente deletado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error) => {
      toast(error.message);
    },
  });

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
  }, [debouncedSearchValue]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const handleConfirmDelete = () => {
    if (customerToDelete) {
      deleteCustomerById(customerToDelete.id);
      setCustomerToDelete(null);
    }
  };

  const handleOrderByChange = (orderBy: CustomerOrderBy | undefined) => {
    setOrderBy(orderBy)
    setCurrentPage(1)
  }

  const handleOrderTypeChange = (orderType: CustomerOrderType | undefined) => {
    setOrderType(orderType)
    setCurrentPage(1)
  }

  type CustomerColumnId =
    | 'name'
    | 'razaoSocial'
    | 'document_number'
    | 'entity_type'
    | 'phone'
    | 'createdAt'
    | 'actions';

  const initialColumnVisibility: Partial<Record<CustomerColumnId, boolean>> = {
    document_number: false,
    entity_type: false,
  };

  const columns: ColumnDefWithId<Customer>[] = [
    createColumn<Customer>('name', 'name', 'Nome Fantasia', ({ row }) => (
      <div className='text-foreground'>{row.getValue('name')}</div>
    )),
    createColumn<Customer>('entity_type', 'entity_type', 'Tipo', ({ row }) => (
      <div className='text-foreground'>
        {row.getValue('entity_type') === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
      </div>
    )),
    createColumn<Customer>('razaoSocial', 'razaoSocial', 'Razão Social', ({ row }) => (
      <div className='text-foreground'>
        {row.getValue('entity_type') === 'PJ' ? row.getValue('razaoSocial') || '-' : '-'}
      </div>
    )),
    createColumn<Customer>('document_number', 'document_number', 'CPF/CNPJ', ({ row }) => (
      <div className='text-foreground'>{documentFormatter(row.getValue('document_number'))}</div>
    )),
    createColumn<Customer>('phone', 'phone', 'Telefone', ({ row }) => (
      <div className='text-foreground'>{phoneFormatter(row.getValue('phone'))}</div>
    )),
    createColumn<Customer>('createdAt', 'createdAt', 'Data de Criação', ({ row }) => (
      <div className='text-foreground'>
        {new Date(row.getValue('createdAt')).toLocaleDateString('pt-BR')}
      </div>
    )),
    createActionsColumn<Customer>((customer) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              className='h-8 w-8'
              onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
              disabled={isDeletingUser}
            >
              <Eye className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver cliente</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='icon' className='h-8 w-8' disabled={isDeletingUser}>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={() => setCustomerToEdit(customer)}>
              Editar cliente
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteClick(customer)}
              className='text-destructive'
            >
              Deletar cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoadingUsers}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: [
              'customers',
              {
                page: currentPage.toString(),
                limit: pageSize.toString(),
                search: debouncedSearchValue || undefined,
              },
            ],
          })
        }
        searchConfig={{
          placeholder: 'Buscar clientes...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}

        filters={
          <>
            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as CustomerOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) => handleOrderTypeChange(value as CustomerOrderType | undefined)}
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
          totalPages: data?.totalPages ?? 0,
          totalCount: data?.totalCount,
          onPageChange: setCurrentPage,
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          },
        }}
        initialColumnVisibility={initialColumnVisibility}
        renderEmptyState={() =>
          isError ? (
            <span className='text-destructive'>Erro ao carregar clientes: {error?.message}</span>
          ) : (
            'Nenhum cliente encontrado'
          )
        }
      />

      <Dialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cliente {customerToDelete?.name}? Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCustomerToDelete(null)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleConfirmDelete} disabled={isDeletingUser}>
              {isDeletingUser ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!customerToEdit} onOpenChange={(open) => !open && setCustomerToEdit(null)}>
        <DialogContent>
          {customerToEdit && (
            <FormEditCustomer customer={customerToEdit} onSuccess={() => setCustomerToEdit(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
