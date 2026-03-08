'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRegisterNewCultureType } from '@/mutations/culture-type.mutation';
import { RegisterNewCultureTypeSchema } from '@/schemas/culture-type.schema';
import { RegisterNewCultureTypeParams } from '@/services/culture-type.service';

export default function FormRegisterNewCultureType() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterNewCultureTypeParams>({
    resolver: zodResolver(RegisterNewCultureTypeSchema),
  });

  const { mutate: registerNewCultureType, isPending } = useRegisterNewCultureType();

  const onSubmit = (data: RegisterNewCultureTypeParams) => {
    registerNewCultureType(data, {
      onSuccess: () => {
        toast('Tipo de cultura criado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['culture-types'] });
        reset({
          name: '',
          description: '',
        });
      },
      onError: (error) => {
        toast(error.message);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <DialogHeader>
        <DialogTitle>Criar novo tipo de cultura</DialogTitle>
        <DialogDescription>Crie um novo tipo de cultura para o sistema.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

        <Input type='text' placeholder='Descrição' {...register('description')} />
        {errors.description && <p className='text-red-500 text-sm'>{errors.description.message}</p>}

        <Button type='submit' disabled={isPending}>
          {isPending ? 'Criando tipo de cultura...' : 'Criar tipo de cultura'}
        </Button>
      </div>
    </form>
  );
}
