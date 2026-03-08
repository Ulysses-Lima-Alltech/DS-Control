'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { useRegisterNewUser } from '@/mutations/user.mutation';
import { useGetAllCustomers } from '@/queries/customer.query';
import { RegisterNewUserSchema } from '@/schemas/user.schema';
import { RegisterNewUserParams } from '@/services/user.service';
import { UserType } from '@/types/user.type';

type FormRegisterNewUserProps = {
  defaultUserType?: 'backoffice' | 'pilot' | 'farmer';
  onSuccess?: () => void;
};

export default function FormRegisterNewUser({
  defaultUserType,
  onSuccess,
}: FormRegisterNewUserProps) {
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');

  const { data: customers } = useGetAllCustomers();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
    watch,
  } = useForm<RegisterNewUserParams>({
    resolver: zodResolver(RegisterNewUserSchema),
    defaultValues: {
      customerId: undefined,
      type: defaultUserType,
    },
  });

  const selectedType = watch('type');

  const { mutate: registerNewUser, isPending } = useRegisterNewUser();

  const filteredCustomers = useMemo(() => {
    if (!customers?.data) return [];

    if (!customerSearch.trim()) return customers.data;

    return customers.data.filter((customer) =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers?.data, customerSearch]);

  const onSubmit = (data: RegisterNewUserParams) => {
    registerNewUser(
      {
        ...data,
        customerId: data.customerId || undefined,
      },
      {
        onSuccess: () => {
          toast('Usuário criado com sucesso');
          queryClient.invalidateQueries({ queryKey: ['users'] });
          reset({
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
            type: undefined,
            customerId: '',
          });
          setCustomerSearch('');
          onSuccess?.();
        },
        onError: (error) => {
          toast(error.message);
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <DialogHeader>
        <DialogTitle>Criar novo usuário</DialogTitle>
        <DialogDescription>Crie um novo usuário para o sistema.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
        <Input type='email' placeholder='Email' {...register('email')} autoComplete='email' />
        {errors.email && <p className='text-red-500 text-sm'>{errors.email.message}</p>}
        <Input
          type='password'
          placeholder='Senha'
          {...register('password')}
          autoComplete='new-password'
        />
        {errors.password && <p className='text-red-500 text-sm'>{errors.password.message}</p>}
        <Input
          type='password'
          placeholder='Confirmar senha'
          {...register('confirmPassword')}
          autoComplete='new-password'
        />
        {errors.confirmPassword && (
          <p className='text-red-500 text-sm'>{errors.confirmPassword.message}</p>
        )}
        <Controller
          name='type'
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Tipo de acesso' />
              </SelectTrigger>
              <SelectContent>
                {Object.values(UserType).map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.type && <p className='text-red-500 text-sm'>{errors.type.message}</p>}
        {selectedType === UserType.FARMER.value && customers?.data && customers.data.length > 0 && (
          <div className='flex flex-col gap-2'>
            <Controller
              name='customerId'
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ''}>
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
              <p className='text-red-500 text-sm'>{errors.customerId.message}</p>
            )}
          </div>
        )}
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Criando usuário...' : 'Criar usuário'}
        </Button>
      </div>
    </form>
  );
}
