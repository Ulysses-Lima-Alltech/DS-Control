'use client';

import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, Trash } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditCropSeason from '@/components/Forms/FormEditCropSeason';
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
import { useDeleteCropSeasonById } from '@/mutations/crop-season.mutation';
import { useGetAllCropSeasons } from '@/queries/crop-season.query';
import { CropSeason } from '@/types/crop-season.type';
import { toOperationalDateYMDOrToday } from '@/utils/operational-date';

function formatCivilDateBR(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function isCurrentSeason(cropSeason: CropSeason): boolean {
  const today = toOperationalDateYMDOrToday();
  return cropSeason.startDate <= today && cropSeason.endDate >= today && !cropSeason.deletedAt;
}

export const TableCropSeasons = () => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<'active' | 'inactive'>('active');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [cropSeasonToDelete, setCropSeasonToDelete] = React.useState<CropSeason | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [cropSeasonToEdit, setCropSeasonToEdit] = React.useState<CropSeason | null>(null);

  const { data, isPending: isLoadingCropSeasons, isError, error } = useGetAllCropSeasons({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    status: selectedStatus,
  });

  const { mutate: deleteCropSeasonById, isPending: isDeletingCropSeason } = useDeleteCropSeasonById(
    {
      onSuccess: () => {
        toast('Safra removida com sucesso');
        queryClient.invalidateQueries({ queryKey: ['crop-seasons'] });
      },
      onError: (requestError) => {
        toast(requestError.message);
      },
    }
  );

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

  const handleDeleteClick = (cropSeason: CropSeason) => {
    setCropSeasonToDelete(cropSeason);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (cropSeasonToDelete) {
      deleteCropSeasonById(cropSeasonToDelete.id);
      setDeleteDialogOpen(false);
      setCropSeasonToDelete(null);
    }
  };

  type CropSeasonColumnId = 'name' | 'period' | 'products' | 'status' | 'createdAt' | 'actions';

  const initialColumnVisibility: Partial<Record<CropSeasonColumnId, boolean>> = {
    createdAt: false,
  };

  const columns: ColumnDefWithId<CropSeason>[] = [
    createTextColumn<CropSeason>('name', 'name', 'Nome'),
    {
      id: 'period',
      label: 'Período',
      header: 'Período',
      cell: ({ row }) => (
        <div className='text-foreground whitespace-nowrap'>
          {formatCivilDateBR(row.original.startDate)} - {formatCivilDateBR(row.original.endDate)}
        </div>
      ),
    },
    {
      id: 'products',
      label: 'Produtos',
      header: 'Produtos',
      minSize: 240,
      cell: ({ row }) => (
        <div className='text-foreground truncate max-w-[320px]' title={row.original.products.map((p) => p.name).join(', ')}>
          {row.original.products.length > 0
            ? row.original.products.map((product) => product.name).join(', ')
            : '-'}
        </div>
      ),
    },
    {
      id: 'status',
      label: 'Situação',
      header: 'Situação',
      cell: ({ row }) =>
        isCurrentSeason(row.original) ? (
          <Badge className='bg-emerald-600 hover:bg-emerald-600 text-white'>Safra atual</Badge>
        ) : (
          <Badge variant='outline'>Fora do período</Badge>
        ),
    },
    createDateColumn<CropSeason>('createdAt', 'createdAt', 'Data de Criação'),
    createActionsColumn<CropSeason>((cropSeason) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogForm
              form={
                <FormEditCropSeason
                  cropSeason={cropSeason}
                  onSuccess={() => {
                    setEditDialogOpen(false);
                  }}
                />
              }
              trigger={
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setCropSeasonToEdit(cropSeason)}
                >
                  <Edit className='h-4 w-4' />
                </Button>
              }
              isOpen={editDialogOpen && cropSeasonToEdit?.id === cropSeason.id}
              setIsOpen={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setCropSeasonToEdit(null);
                }
              }}
            />
          </TooltipTrigger>
          <TooltipContent>Editar safra</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              className='h-8 w-8'
              onClick={() => handleDeleteClick(cropSeason)}
              disabled={isDeletingCropSeason}
            >
              <Trash className='h-4 w-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remover safra</TooltipContent>
        </Tooltip>
      </>
    )),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoadingCropSeasons}
        isError={isError}
        error={error}
        onRetry={() =>
          queryClient.invalidateQueries({
            queryKey: [
              'crop-seasons',
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
          placeholder: 'Buscar safras...',
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
        renderEmptyState={() => 'Nenhuma safra encontrada.'}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar remoção</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja remover a safra &quot;{cropSeasonToDelete?.name}&quot;? Esta
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={handleConfirmDelete}
              disabled={isDeletingCropSeason}
            >
              {isDeletingCropSeason ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

