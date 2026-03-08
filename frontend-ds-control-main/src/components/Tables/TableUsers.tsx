'use client';

import { useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { Edit, MoreHorizontal } from 'lucide-react';
import * as React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditUser from '@/components/Forms/FormEditUser';
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type ColumnDefWithId } from '@/components/ui/table-data';
import { createActionsColumn, createColumn, createTextColumn } from '@/components/ui/table-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteUserById, useRequestResetUserPasswordByEmail } from '@/mutations/user.mutation';
import { useGetAllUsers } from '@/queries/user.query';
import { User, UserOrderBy, UserOrderType, UserType } from '@/types/user.type';

type TableUsersProps = {
  userType?: 'backoffice' | 'pilot' | 'farmer';
  title: string;
  emptyMessage?: string;
  showTypeFilter?: boolean;
  showStatusFilter?: boolean;
};

export const TableUsers = ({
  userType,
  title,
  emptyMessage,
  showTypeFilter = false,
  showStatusFilter = false,
}: TableUsersProps) => {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [inputSearchValue, setInputSearchValue] = React.useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = React.useState('');
  const [selectedUserType, setSelectedUserType] = React.useState<
    'backoffice' | 'pilot' | 'farmer' | undefined
  >(userType);
  const [selectedStatus, setSelectedStatus] = React.useState<'active' | 'inactive'>('active');
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [userToEdit, setUserToEdit] = React.useState<User | null>(null);

  const [orderBy, setOrderBy] = React.useState<UserOrderBy | undefined>(undefined)
  const [orderType, setOrderType] = React.useState<UserOrderType | undefined>(undefined)

  const orderByOptions = [
    { value: 'name' as UserOrderBy, label: 'Nome' },
    { value: 'created_at' as UserOrderBy, label: 'Data de criação' },
  ]

  const orderTypeOptions = [
    { value: 'asc' as UserOrderType, label: 'Ascendente'},
    { value: 'desc' as UserOrderType, label: 'Descendente'},
  ]

  const {
    data,
    isPending: isLoadingUsers,
    isError,
    error,
  } = useGetAllUsers({
    page: currentPage.toString(),
    limit: pageSize.toString(),
    search: debouncedSearchValue || undefined,
    type: selectedUserType,
    status: selectedStatus,
    orderBy: orderBy ?? UserOrderBy.CREATEDAT,
    orderType: orderType ?? UserOrderType.DESC

  });

  const { mutate: deleteUserById, isPending: isDeletingUser } = useDeleteUserById({
    onSuccess: () => {
      toast(`${title} deletado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  const { mutate: requestResetUserPasswordByEmail, isPending: isRequestingResetPassword } =
    useRequestResetUserPasswordByEmail({
      onSuccess: () => {
        toast('Solicitação de redefinição de senha enviada com sucesso para o email do usuário');
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
  }, [debouncedSearchValue, selectedUserType, selectedStatus]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setInputSearchValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  const handleTypeChange = useCallback((type: string | undefined) => {
    setSelectedUserType(type as 'backoffice' | 'pilot' | 'farmer' | undefined);
    setCurrentPage(1);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status as 'active' | 'inactive');
    setCurrentPage(1);
  }, []);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUserById(userToDelete.id);
      setUserToDelete(null);
    }
  };

  const handleOrderByChange = (orderBy: UserOrderBy | undefined) => {
    setOrderBy(orderBy)
    setCurrentPage(1)
  }

  const handleOrderTypeChange = (orderType: UserOrderType | undefined) => {
    setOrderType(orderType)
    setCurrentPage(1)
  }

  const isPending = isDeletingUser || isRequestingResetPassword;

  type UserColumnId = 'name' | 'email' | 'type' | 'actions';

  const initialColumnVisibility: Partial<Record<UserColumnId, boolean>> = {};

  const typeOptions = [
    { value: 'backoffice', label: 'Administrador' },
    { value: 'pilot', label: 'Piloto' },
    { value: 'farmer', label: 'Fazendeiro' },
  ];

  const columns: ColumnDefWithId<User>[] = [
    createTextColumn<User>('name', 'name', 'Nome'),
    createTextColumn<User>('email', 'email', 'Email', {
      className: 'lowercase',
    }),
    createColumn<User>('type', 'type', 'Tipo', ({ row }) => {
      const typeValue = row.getValue('type')?.toString() || '';
      const typeKey = Object.keys(UserType).find(
        (key) => UserType[key as keyof typeof UserType].value === typeValue
      );
      return (
        <div className='capitalize text-foreground'>
          {typeKey ? UserType[typeKey as keyof typeof UserType].label : typeValue}
        </div>
      );
    }),
    createActionsColumn<User>((user) => (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogForm
              form={
                <FormEditUser
                  user={user}
                  onSuccess={() => setEditDialogOpen(false)}
                  isEditingPilot={userType === 'pilot'}
                />
              }
              trigger={
                <Button
                  variant='outline'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => setUserToEdit(user)}
                  disabled={isPending}
                >
                  <Edit className='h-4 w-4' />
                </Button>
              }
              isOpen={editDialogOpen && userToEdit?.id === user.id}
              setIsOpen={(open) => {
                setEditDialogOpen(open);
                if (!open) {
                  setUserToEdit(null);
                }
              }}
            />
          </TooltipTrigger>
          <TooltipContent>Editar {title.toLowerCase()}</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='icon' className='h-8 w-8' disabled={isPending}>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              onClick={() => requestResetUserPasswordByEmail({ email: user.email })}
              disabled={isRequestingResetPassword}
            >
              Redefinir senha
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteClick(user)} className='text-destructive'>
              Deletar {title.toLowerCase()}
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
              'users',
              {
                page: currentPage.toString(),
                limit: pageSize.toString(),
                search: debouncedSearchValue || undefined,
                type: selectedUserType,
                status: selectedStatus,
              },
            ],
          })
        }
        searchConfig={{
          placeholder: `Buscar ${title.toLowerCase()}s...`,
          searchValue: inputSearchValue,
          onSearchChange: handleSearchChange,
        }}
        filters={
          <div className='flex items-center gap-2'>
            {showTypeFilter && (
              <SearchableSelect
                options={typeOptions}
                value={selectedUserType}
                onValueChange={handleTypeChange}
                placeholder='Todos os tipos'
                searchPlaceholder='Buscar tipo...'
                className='w-[150px]'
                clearable
              />
            )}
            {showStatusFilter && (
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className='w-[140px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='active'>Ativo</SelectItem>
                  <SelectItem value='inactive'>Inativo</SelectItem>
                </SelectContent>
              </Select>
            )}

            <SearchableSelectQuery
              options={orderByOptions}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as UserOrderBy | undefined)}
              placeholder='Ordenar por'
              searchPlaceholder='Buscar...'
              className='w-[150px]'
              clearable
            />

            <SearchableSelectQuery
              options={orderTypeOptions}
              value={orderType}
              onValueChange={(value) => handleOrderTypeChange(value as UserOrderType | undefined)}
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
          totalPages: data?.totalPages ?? 0,
          totalCount: data?.totalCount,
          onPageChange: setCurrentPage,
          onPageSizeChange: (newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1);
          },
        }}
        initialColumnVisibility={initialColumnVisibility}
        renderEmptyState={() => emptyMessage || `Nenhum ${title.toLowerCase()} encontrado.`}
      />

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o {title.toLowerCase()} {userToDelete?.name}? Esta ação
              não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setUserToDelete(null)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleConfirmDelete} disabled={isDeletingUser}>
              {isDeletingUser ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
