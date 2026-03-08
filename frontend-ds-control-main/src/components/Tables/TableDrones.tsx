'use client';

import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, Trash } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditDrone from '@/components/Forms/FormEditDrone';
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
import {
  createActionsColumn,
  createDateColumn,
  createTextColumn,
} from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteDroneById } from '@/mutations/drone.mutation';
import { useGetAllDrones } from '@/queries/drone.query';
import { Drone } from '@/types/drone.type';

export const TableDrones = () => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<'active' | 'inactive'>('active');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [droneToDelete, setDroneToDelete] = React.useState<Drone | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [droneToEdit, setDroneToEdit] = React.useState<Drone | null>(null);

  const {
    data,
    isPending: isLoadingDrones,
    isError,
    error,
  } = useGetAllDrones({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    status: selectedStatus,
  });

  const { mutate: deleteDroneById, isPending: isDeletingDrone } = useDeleteDroneById({
    onSuccess: () => {
      toast('Drone deletado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['drones'] });
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

  const handleDeleteClick = (drone: Drone) => {
    setDroneToDelete(drone);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (droneToDelete) {
      deleteDroneById(droneToDelete.id);
      setDeleteDialogOpen(false);
      setDroneToDelete(null);
    }
  };

  type DroneColumnId = 'name' | 'model' | 'aircraftRid' | 'createdAt' | 'actions';

  const initialColumnVisibility: Partial<Record<DroneColumnId, boolean>> = {
    createdAt: false,
  };

  const columns: ColumnDefWithId<Drone>[] = [
    createTextColumn<Drone>('name', 'name', 'Nome'),
    createTextColumn<Drone>('model', 'model', 'Modelo'),
    createTextColumn<Drone>('aircraftRid', 'aircraftRid', 'RID da Aeronave'),
    createDateColumn<Drone>('createdAt', 'createdAt', 'Data de Criação'),
    createActionsColumn<Drone>((drone) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogForm
              form={<FormEditDrone drone={drone} onSuccess={() => setEditDialogOpen(false)} />}
              trigger={
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setDroneToEdit(drone)}
                >
                  <Edit className='h-4 w-4' />
                </Button>
              }
              isOpen={editDialogOpen && droneToEdit?.id === drone.id}
              setIsOpen={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setDroneToEdit(null);
                }
              }}
            />
          </TooltipTrigger>
          <TooltipContent>Editar drone</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              onClick={() => handleDeleteClick(drone)}
              disabled={isDeletingDrone}
            >
              <Trash className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deletar drone</TooltipContent>
        </Tooltip>
      </>
    )),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoadingDrones}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: [
              'drones',
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
          placeholder: 'Buscar drones...',
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
        renderEmptyState={() => 'Nenhum drone encontrado.'}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja deletar o drone &quot;{droneToDelete?.name}&quot;? Esta ação
              não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleConfirmDelete} disabled={isDeletingDrone}>
              {isDeletingDrone ? 'Deletando...' : 'Deletar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
