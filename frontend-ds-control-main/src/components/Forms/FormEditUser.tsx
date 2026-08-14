import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateUserById } from '@/mutations/user.mutation';
import { useGetAllCustomers } from '@/queries/customer.query';
import { UpdateUserByIdSchema } from '@/schemas/user.schema';
import { User, UserType } from '@/types/user.type';

type FormEditUserProps = {
  user: User;
  onSuccess?: () => void;
  isEditingPilot?: boolean;
};

export default function FormEditUser({ user, onSuccess, isEditingPilot }: FormEditUserProps) {
  const queryClient = useQueryClient();
  const isFarmer = user.type === UserType.FARMER.value;
  const [customerSearch, setCustomerSearch] = useState('');

  const { data: customers } = useGetAllCustomers();
  const filteredCustomers = useMemo(() => {
    if (!customers?.data) return [];
    if (!customerSearch.trim()) return customers.data;
    return customers.data.filter((customer) =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers?.data, customerSearch]);

  const { mutate: updateUserById, isPending: isUpdatingUser } = useUpdateUserById({
    onSuccess: () => {
      toast('Usuário atualizado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onSuccess?.();
    },
    onError: (error) => {
      toast('Erro ao atualizar usuário', {
        description: error.message,
      });
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<z.infer<typeof UpdateUserByIdSchema>>({
    defaultValues: {
      name: user.name,
      email: user.email,
      type: user.type,
      customerId: user.customerId ?? undefined,
    },
    resolver: zodResolver(UpdateUserByIdSchema),
  });

  const onSubmit = (data: z.infer<typeof UpdateUserByIdSchema>) => {
    updateUserById({ userId: user.id, data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <DialogHeader>
          <DialogTitle>{isEditingPilot ? 'Editar piloto' : 'Editar usuário'}</DialogTitle>
          <DialogDescription>
            {isEditingPilot
              ? 'Atualize as informações do piloto'
              : 'Atualize as informações do usuário'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='flex flex-col space-y-1.5'>
            <label className='text-sm font-medium text-muted-foreground'>Nome</label>
            <Input {...register('name')} disabled={isUpdatingUser} placeholder='Nome do usuário' />
            {errors.name && <span className='text-red-500 text-sm'>{errors.name.message}</span>}
          </div>

          <div className='flex flex-col space-y-1.5'>
            <label className='text-sm font-medium text-muted-foreground'>Email</label>
            <Input
              {...register('email')}
              disabled={isUpdatingUser}
              placeholder='Email do usuário'
            />
            {errors.email && <span className='text-red-500 text-sm'>{errors.email.message}</span>}
          </div>

          {isFarmer && (
            <div className='flex flex-col space-y-1.5'>
              <label className='text-sm font-medium text-muted-foreground'>Cliente</label>
              <Controller
                name='customerId'
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                    disabled={isUpdatingUser}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder='Selecione um cliente' />
                    </SelectTrigger>
                    <SelectContent>
                      <Input
                        type='text'
                        placeholder='Buscar cliente por nome...'
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className='mb-2'
                      />
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value='404' disabled>
                          Nenhum cliente encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.customerId && (
                <span className='text-red-500 text-sm'>{errors.customerId.message}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <Button type='submit' disabled={isUpdatingUser}>
        {isUpdatingUser ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  );
}
