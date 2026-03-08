import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { useUpdateCustomerById } from '@/mutations/customer.mutation';
import { UpdateCustomerByIdSchema } from '@/schemas/customer.schema';
import type { Customer, EntityType } from '@/types/customer.type';
import { documentFormatter } from '@/utils/document-formatter';
import { phoneFormatter } from '@/utils/phone-formatter';

type FormEditCustomerProps = {
  customer: Customer;
  onSuccess?: () => void;
};

export default function FormEditCustomer({ customer, onSuccess }: FormEditCustomerProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof UpdateCustomerByIdSchema>>({
    resolver: zodResolver(UpdateCustomerByIdSchema),
    defaultValues: {
      entity_type: customer?.entity_type || 'PF',
    },
  });

  const entityType = watch('entity_type');

  const { mutate: updateCustomerById, isPending: isUpdatingCustomer } = useUpdateCustomerById({
    onSuccess: () => {
      toast('Cliente atualizado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSuccess?.();
    },
    onError: (error) => {
      toast('Erro ao atualizar cliente', {
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        razaoSocial: customer.razaoSocial || '',
        document_number: documentFormatter(customer.document_number ?? ''),
        entity_type: customer.entity_type,
        phone: phoneFormatter(customer.phone),
      });
    }
  }, [customer, reset]);

  const onSubmit = (formData: z.infer<typeof UpdateCustomerByIdSchema>) => {
    const submitData = {
      ...formData,
      razaoSocial: formData.entity_type === 'PF' ? null : formData.razaoSocial,
    };
    updateCustomerById({
      id: customer.id,
      data: submitData,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>Atualize as informações do cliente</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <Select
            value={entityType}
            onValueChange={(value: EntityType) => setValue('entity_type', value)}
            disabled={isUpdatingCustomer}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Selecione o tipo de cliente' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='PF'>Pessoa Física (CPF)</SelectItem>
              <SelectItem value='PJ'>Pessoa Jurídica (CNPJ)</SelectItem>
            </SelectContent>
          </Select>
          {errors.entity_type && (
            <span className='text-red-500 text-sm'>{errors.entity_type.message}</span>
          )}

          <div className='flex flex-col space-y-1.5'>
            <label className='text-sm font-medium text-muted-foreground'>Nome identificador</label>
            <Input
              {...register('name')}
              disabled={isUpdatingCustomer}
              placeholder='Nome identificador'
            />
            {errors.name && <span className='text-red-500 text-sm'>{errors.name.message}</span>}
          </div>

          {entityType === 'PJ' && (
            <div className='flex flex-col space-y-1.5'>
              <label className='text-sm font-medium text-muted-foreground'>Razão social</label>
              <Input
                {...register('razaoSocial')}
                disabled={isUpdatingCustomer}
                placeholder='Razão social'
              />
              {errors.razaoSocial && (
                <span className='text-red-500 text-sm'>{errors.razaoSocial.message}</span>
              )}
            </div>
          )}

          <div className='flex flex-col space-y-1.5'>
            <label className='text-sm font-medium text-muted-foreground'>
              {entityType === 'PF' ? 'CPF' : 'CNPJ'}
            </label>
            <InputDocument
              {...register('document_number')}
              disabled={isUpdatingCustomer}
              placeholder={entityType === 'PF' ? 'CPF' : 'CNPJ'}
            />
            {errors.document_number && (
              <span className='text-red-500 text-sm'>{errors.document_number.message}</span>
            )}
          </div>

          <div className='flex flex-col space-y-1.5'>
            <label className='text-sm font-medium text-muted-foreground'>Telefone</label>
            <Input
              type='tel'
              maxLength={20}
              {...register('phone')}
              disabled={isUpdatingCustomer}
              placeholder='Telefone'
            />
            {errors.phone && <span className='text-red-500 text-sm'>{errors.phone.message}</span>}
          </div>
        </div>
      </div>

      <Button type='submit' disabled={isUpdatingCustomer}>
        {isUpdatingCustomer ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  );
}
