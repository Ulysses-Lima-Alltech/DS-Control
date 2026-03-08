'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegisterNewContract } from '@/mutations/contract.mutation';
import { useGetAllCustomers } from '@/queries/customer.query';
import { RegisterNewContractSchema } from '@/schemas/contract.schema';
import { RegisterNewContractParams } from '@/services/contract.service';

interface FormRegisterNewContractProps {
  customerId?: string;
  closeDialog?: () => void;
}

export default function FormRegisterNewContract({
  customerId,
  closeDialog,
}: FormRegisterNewContractProps) {
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');

  const { data: customers } = useGetAllCustomers();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
  } = useForm<RegisterNewContractParams>({
    resolver: zodResolver(RegisterNewContractSchema),
    defaultValues: {
      customerId: customerId || '',
      name: '',
      dateStart: '',
      dateEnd: '',
      observation: '',
    },
  });

  const { mutate: registerNewContract, isPending } = useRegisterNewContract();

  const filteredCustomers = useMemo(() => {
    if (!customers?.data) return [];

    if (!customerSearch.trim()) return customers.data;

    return customers.data.filter((customer) =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers?.data, customerSearch]);

  const onSubmit = (data: RegisterNewContractParams) => {
    registerNewContract(data, {
      onSuccess: () => {
        toast('Contrato criado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['contracts'] });
        queryClient.invalidateQueries({ queryKey: ['contracts', 'customer', customerId] });
        reset({
          customerId: customerId || '',
          name: '',
          dateStart: '',
          dateEnd: '',
          observation: '',
        });
        setCustomerSearch('');
        closeDialog?.();
      },
      onError: (error) => {
        toast(error.message);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <DialogHeader>
        <DialogTitle>Criar novo contrato</DialogTitle>
        <DialogDescription>Crie um novo contrato para o sistema.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Controller
          name='customerId'
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={field.onChange}
              value={field.value || ''}
              disabled={!!customerId}
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
        {errors.customerId && <p className='text-red-500 text-sm'>{errors.customerId.message}</p>}

        <Input
          type='text'
          placeholder='Nome do contrato'
          {...register('name')}
          autoComplete='name'
        />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

        <Controller
          name='dateStart'
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              placeholder='Data de início'
              className='w-full'
            />
          )}
        />
        {errors.dateStart && <p className='text-red-500 text-sm'>{errors.dateStart.message}</p>}

        <Controller
          name='dateEnd'
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              placeholder='Data de fim'
              className='w-full'
            />
          )}
        />
        {errors.dateEnd && <p className='text-red-500 text-sm'>{errors.dateEnd.message}</p>}

        <Input type='text' placeholder='Observação' {...register('observation')} />
        {errors.observation && <p className='text-red-500 text-sm'>{errors.observation.message}</p>}

        <Button type='submit' disabled={isPending}>
          {isPending ? 'Criando contrato...' : 'Criar contrato'}
        </Button>
      </div>
    </form>
  );
}
