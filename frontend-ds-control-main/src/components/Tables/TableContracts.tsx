'use client';

import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, Trash } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditContract from '@/components/Forms/FormEditContract';
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
import { DataTable, type ColumnDefWithId } from '@/components/ui/table-data';
import {
  createActionsColumn,
  createColumn,
  createDateColumn,
  createTextColumn,
} from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteContractById } from '@/mutations/contract.mutation';
import { useGetAllContracts, useGetContractsByCustomerId } from '@/queries/contract.query';
import { Contract, ContractOrderBy, ContractOrderType } from '@/types/contracts.type';

interface TableContractsProps {
  customerId?: string;
}

export const TableContracts = ({ customerId }: TableContractsProps = {}) => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [contractToDelete, setContractToDelete] = React.useState<Contract | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [contractToEdit, setContractToEdit] = React.useState<Contract | null>(null);

  const [orderBy, setOrderBy] = React.useState<ContractOrderBy | undefined>(undefined);
  const [orderType, setOrderType] = React.useState<ContractOrderType | undefined>(undefined);

  const orderByOptions = [
    { value: 'name' as ContractOrderBy, label: 'Nome' },
    { value: 'created_at' as ContractOrderBy, label: 'Data de criação' },
  ];

  const orderTypeOptions = [
    { value: 'asc' as ContractOrderType, label: 'Ascendente' },
    { value: 'desc' as ContractOrderType, label: 'Descendente' },
  ];

  const queryParams = {
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    orderBy: orderBy ?? ContractOrderBy.CREATEDAT,
    orderType: orderType ?? ContractOrderType.DESC,
  };

  const allContractsQuery = useGetAllContracts(queryParams);
  const customerContractsQuery = useGetContractsByCustomerId(customerId || '', queryParams);

  const {
    data,
    isPending: isLoadingContracts,
    isError,
    error,
  } = customerId ? customerContractsQuery : allContractsQuery;

  const { mutate: deleteContractById, isPending: isDeletingContract } = useDeleteContractById({
    onSuccess: () => {
      toast('Contrato deletado com sucesso');
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['contracts', 'customer', customerId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['contracts'] });
      }
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

  const handleDeleteClick = (contract: Contract) => {
    setContractToDelete(contract);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (contractToDelete) {
      deleteContractById(contractToDelete.id);
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    }
  };

  const handleOrderByChange = (orderBy: ContractOrderBy | undefined) => {
    setOrderBy(orderBy);
    setCurrentPage(1);
  };

  const handleOrderTypeChange = (orderType: ContractOrderType | undefined) => {
    setOrderType(orderType);
    setCurrentPage(1);
  };

  type ContractColumnId =
    | 'name'
    | 'customer'
    | 'dateStart'
    | 'dateEnd'
    | 'observation'
    | 'createdAt'
    | 'actions';

  const initialColumnVisibility: Partial<Record<ContractColumnId, boolean>> = {
    createdAt: false,
    observation: false,
  };

  const columns: ColumnDefWithId<Contract>[] = [
    createTextColumn<Contract>('name', 'name', 'Nome'),
    ...(customerId
      ? []
      : [
          createColumn<Contract>('customer', 'customer.name', 'Cliente', ({ row }) => (
            <div className='text-foreground'>{row.original.customer?.name || 'N/A'}</div>
          )),
        ]),
    createDateColumn<Contract>('dateStart', 'dateStart', 'Data de Início'),
    createDateColumn<Contract>('dateEnd', 'dateEnd', 'Data de Fim'),
    createTextColumn<Contract>('observation', 'observation', 'Observações', {
      maxWidth: 150,
    }),
    createDateColumn<Contract>('createdAt', 'createdAt', 'Data de Criação'),
    createActionsColumn<Contract>((contract) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogForm
              form={
                <FormEditContract contract={contract} onSuccess={() => setEditDialogOpen(false)} />
              }
              trigger={
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setContractToEdit(contract)}
                >
                  <Edit className='h-4 w-4' />
                </Button>
              }
              isOpen={editDialogOpen && contractToEdit?.id === contract.id}
              setIsOpen={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setContractToEdit(null);
                }
              }}
            />
          </TooltipTrigger>
          <TooltipContent>Editar contrato</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              onClick={() => handleDeleteClick(contract)}
              disabled={isDeletingContract}
            >
              <Trash className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deletar contrato</TooltipContent>
        </Tooltip>
      </>
    )),
  ];

  const getQueryKey = () => {
    if (customerId) {
      return [
        'contracts',
        'customer',
        customerId,
        {
          page: currentPage.toString(),
          limit: pageSize.toString(),
          search: debouncedSearchValue || undefined,
        },
      ];
    }
    return [
      'contracts',
      {
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: debouncedSearchValue || undefined,
      },
    ];
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoadingContracts}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: getQueryKey(),
          })
        }
        searchConfig={{
          placeholder: 'Buscar contratos...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}
        filters={
          <>
            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as ContractOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) =>
                handleOrderTypeChange(value as ContractOrderType | undefined)
              }
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
          totalPages: data?.totalPages || 1,
          totalCount: data?.totalCount,
          onPageChange: setCurrentPage,
          onPageSizeChange: setPageSize,
        }}
        initialColumnVisibility={initialColumnVisibility}
        renderEmptyState={() =>
          isError ? (
            <span className='text-destructive'>Erro ao carregar contratos: {error?.message}</span>
          ) : (
            'Nenhum contrato encontrado'
          )
        }
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja deletar o contrato &quot;{contractToDelete?.name}&quot;?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={handleConfirmDelete}
              disabled={isDeletingContract}
            >
              {isDeletingContract ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
