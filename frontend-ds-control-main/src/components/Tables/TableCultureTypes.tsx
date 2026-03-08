'use client';

import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, Trash } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditCultureType from '@/components/Forms/FormEditCultureType';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type ColumnDefWithId } from '@/components/ui/table-data';
import { createActionsColumn, createColumn } from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteCultureTypeById } from '@/mutations/culture-type.mutation';
import { useGetAllCultureTypes } from '@/queries/culture-type.query';
import { CultureType } from '@/types/culture-types.type';

export const TableCultureTypes = () => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<'active' | 'inactive'>('active');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [cultureTypeToDelete, setCultureTypeToDelete] = React.useState<CultureType | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [cultureTypeToEdit, setCultureTypeToEdit] = React.useState<CultureType | null>(null);

  const {
    data,
    isPending: isLoadingCultureTypes,
    isError,
    error,
  } = useGetAllCultureTypes({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    status: selectedStatus,
  });

  const { mutate: deleteCultureTypeById, isPending: isDeletingCultureType } =
    useDeleteCultureTypeById({
      onSuccess: () => {
        toast('Tipo de cultura deletado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['culture-types'] });
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
  }, [debouncedSearchValue, selectedStatus]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status as 'active' | 'inactive');
    setCurrentPage(1);
  }, []);

  const handleDeleteClick = (cultureType: CultureType) => {
    setCultureTypeToDelete(cultureType);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (cultureTypeToDelete) {
      deleteCultureTypeById(cultureTypeToDelete.id);
      setDeleteDialogOpen(false);
      setCultureTypeToDelete(null);
    }
  };

  type CultureTypeColumnId = 'name' | 'description' | 'createdAt' | 'actions';

  const initialColumnVisibility: Partial<Record<CultureTypeColumnId, boolean>> = {
    createdAt: false,
  };

  const columns: ColumnDefWithId<CultureType>[] = [
    createColumn<CultureType>('name', 'name', 'Nome', ({ row }) => (
      <div className='text-foreground'>{row.getValue('name')}</div>
    )),
    createColumn<CultureType>('description', 'description', 'Descrição', ({ row }) => (
      <div className='text-foreground'>{row.getValue('description')}</div>
    )),
    createColumn<CultureType>('createdAt', 'createdAt', 'Data de Criação', ({ row }) => {
      const date = new Date(row.getValue('createdAt'));
      return <div className='text-foreground'>{date.toLocaleDateString('pt-BR')}</div>;
    }),
    createActionsColumn<CultureType>((cultureType) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogForm
              form={
                <FormEditCultureType
                  cultureType={cultureType}
                  onSuccess={() => setEditDialogOpen(false)}
                />
              }
              trigger={
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setCultureTypeToEdit(cultureType)}
                >
                  <Edit className='h-4 w-4' />
                </Button>
              }
              isOpen={editDialogOpen && cultureTypeToEdit?.id === cultureType.id}
              setIsOpen={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setCultureTypeToEdit(null);
                }
              }}
            />
          </TooltipTrigger>
          <TooltipContent>Editar tipo de cultura</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              onClick={() => handleDeleteClick(cultureType)}
              disabled={isDeletingCultureType}
            >
              <Trash className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deletar tipo de cultura</TooltipContent>
        </Tooltip>
      </>
    )),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoadingCultureTypes}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: [
              'culture-types',
              {
                page: currentPage.toString(),
                limit: pageSize.toString(),
                search: debouncedSearchValue || undefined,
                status: selectedStatus,
              },
            ],
          })
        }
        searchConfig={{
          placeholder: 'Buscar tipos de cultura...',
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}
        filters={
          <div className='flex items-center gap-2'>
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className='w-[140px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='active'>Ativo</SelectItem>
                <SelectItem value='inactive'>Inativo</SelectItem>
              </SelectContent>
            </Select>
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
        renderEmptyState={() => 'Nenhum tipo de cultura encontrado.'}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja deletar o tipo de cultura &quot;{cultureTypeToDelete?.name}
              &quot;? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={handleConfirmDelete}
              disabled={isDeletingCultureType}
            >
              {isDeletingCultureType ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
