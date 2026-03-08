'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUpdateCultureTypeById } from '@/mutations/culture-type.mutation';
import { UpdateCultureTypeByIdSchema } from '@/schemas/culture-type.schema';
import { UpdateCultureTypeByIdParams } from '@/services/culture-type.service';
import { CultureType } from '@/types/culture-types.type';

type FormEditCultureTypeProps = {
  cultureType: CultureType;
  onSuccess?: () => void;
};

export default function FormEditCultureType({ cultureType, onSuccess }: FormEditCultureTypeProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Omit<UpdateCultureTypeByIdParams, 'id'>>({
    resolver: zodResolver(UpdateCultureTypeByIdSchema),
    defaultValues: {
      name: cultureType.name,
      description: cultureType.description,
    },
  });

  const { mutate: updateCultureTypeById, isPending } = useUpdateCultureTypeById();

  const onSubmit = (data: Omit<UpdateCultureTypeByIdParams, 'id'>) => {
    updateCultureTypeById(
      { ...data, id: cultureType.id },
      {
        onSuccess: () => {
          toast('Tipo de cultura atualizado com sucesso');
          queryClient.invalidateQueries({ queryKey: ['culture-types'] });
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
        <DialogTitle>Editar tipo de cultura</DialogTitle>
        <DialogDescription>Atualize as informações do tipo de cultura.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

        <Input type='text' placeholder='Descrição' {...register('description')} />
        {errors.description && <p className='text-red-500 text-sm'>{errors.description.message}</p>}

        <Button type='submit' disabled={isPending}>
          {isPending ? 'Atualizando tipo de cultura...' : 'Atualizar tipo de cultura'}
        </Button>
      </div>
    </form>
  );
}
