'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputDocument } from '@/components/ui/input-document';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegisterNewCustomer } from '@/mutations/customer.mutation';
import { RegisterNewCustomerSchema } from '@/schemas/customer.schema';
import { RegisterNewCustomerParams } from '@/services/customer.service';
import { EntityType } from '@/types/customer.type';

interface FormRegisterNewCustomerProps {
  onSuccess?: () => void;
}

export default function FormRegisterNewCustomer({ onSuccess }: FormRegisterNewCustomerProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterNewCustomerParams>({
    resolver: zodResolver(RegisterNewCustomerSchema),
    defaultValues: {
      entity_type: 'PF',
    },
  });

  const entityType = watch('entity_type');

  const { mutate: registerNewCustomer, isPending } = useRegisterNewCustomer({
    onSuccess: () => {
      toast('Cliente criado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  const onSubmit = (data: RegisterNewCustomerParams) => {
    const submitData = {
      ...data,
      razaoSocial: data.entity_type === 'PF' ? null : data.razaoSocial,
    };
    registerNewCustomer(submitData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <DialogHeader>
        <DialogTitle>Criar novo cliente</DialogTitle>
        <DialogDescription>Crie um novo cliente para o sistema.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Select
          value={entityType}
          onValueChange={(value: EntityType) => setValue('entity_type', value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder='Selecione o tipo de entidade' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='PF'>Pessoa Física (CPF)</SelectItem>
            <SelectItem value='PJ'>Pessoa Jurídica (CNPJ)</SelectItem>
          </SelectContent>
        </Select>
        {errors.entity_type && <p className='text-red-500 text-sm'>{errors.entity_type.message}</p>}

        <Input type='text' placeholder='Nome' {...register('name')} />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

        {entityType === 'PJ' && (
          <>
            <Input type='text' placeholder='Razão social' {...register('razaoSocial')} />
            {errors.razaoSocial && (
              <p className='text-red-500 text-sm'>{errors.razaoSocial.message}</p>
            )}
          </>
        )}

        <InputDocument
          placeholder={entityType === 'PF' ? 'CPF' : 'CNPJ'}
          {...register('document_number')}
        />
        {errors.document_number && (
          <p className='text-red-500 text-sm'>{errors.document_number.message}</p>
        )}

        <Input type='tel' maxLength={15} placeholder='Telefone' {...register('phone')} />
        {errors.phone && <p className='text-red-500 text-sm'>{errors.phone.message}</p>}

        <div className='flex flex-row justify-center'>
          <Button type='submit' disabled={isPending}>
            {isPending ? 'Criando cliente...' : 'Criar cliente'}
          </Button>
        </div>
      </div>
    </form>
  );
}
