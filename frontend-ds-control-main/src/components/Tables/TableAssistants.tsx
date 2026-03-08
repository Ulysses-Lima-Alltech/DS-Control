'use client';

import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, Trash } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditAssistant from '@/components/Forms/FormEditAssistant';
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
import { useDeleteAssistantById } from '@/mutations/assistant.mutation';
import { useGetAllAssistants } from '@/queries/assistant.query';
import { Assistant } from '@/types/assistant.type';

export const TableAssistants = () => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<'active' | 'inactive'>('active');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [assistantToDelete, setAssistantToDelete] = React.useState<Assistant | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [assistantToEdit, setAssistantToEdit] = React.useState<Assistant | null>(null);

  const {
    data,
    isPending: isLoadingAssistants,
    isError,
    error,
  } = useGetAllAssistants({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    status: selectedStatus,
  });

  const { mutate: deleteAssistantById, isPending: isDeletingAssistant } = useDeleteAssistantById({
    onSuccess: () => {
      toast('Assistente deletado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
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

  const handleDeleteClick = (assistant: Assistant) => {
    setAssistantToDelete(assistant);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (assistantToDelete) {
      deleteAssistantById(assistantToDelete.id);
      setDeleteDialogOpen(false);
      setAssistantToDelete(null);
    }
  };

  type AssistantColumnId = 'name' | 'createdAt' | 'actions';

  const initialColumnVisibility: Partial<Record<AssistantColumnId, boolean>> = {
    createdAt: false,
  };

  const columns: ColumnDefWithId<Assistant>[] = [
    createColumn<Assistant>('name', 'name', 'Nome', ({ row }) => (
      <div className='text-foreground'>{row.getValue('name')}</div>
    )),
    createColumn<Assistant>('createdAt', 'createdAt', 'Data de Criação', ({ row }) => {
      const date = new Date(row.getValue('createdAt'));
      return <div className='text-foreground'>{date.toLocaleDateString('pt-BR')}</div>;
    }),
    createActionsColumn<Assistant>((assistant) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogForm
              form={
                <FormEditAssistant
                  assistant={assistant}
                  onSuccess={() => setEditDialogOpen(false)}
                />
              }
              trigger={
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setAssistantToEdit(assistant)}
                >
                  <Edit className='h-4 w-4' />
                </Button>
              }
              isOpen={editDialogOpen && assistantToEdit?.id === assistant.id}
              setIsOpen={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setAssistantToEdit(null);
                }
              }}
            />
          </TooltipTrigger>
          <TooltipContent>Editar assistente</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              onClick={() => handleDeleteClick(assistant)}
              disabled={isDeletingAssistant}
            >
              <Trash className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deletar assistente</TooltipContent>
        </Tooltip>
      </>
    )),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoadingAssistants}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: [
              'assistants',
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
          placeholder: 'Buscar assistentes...',
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
        renderEmptyState={() => 'Nenhum assistente encontrado.'}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja deletar o assistente &quot;{assistantToDelete?.name}&quot;?
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
              disabled={isDeletingAssistant}
            >
              {isDeletingAssistant ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
