'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUpdateProductById } from '@/mutations/product.mutation';
import { UpdateProductByIdSchema } from '@/schemas/product.schema';
import { UpdateProductByIdParams } from '@/services/product.service';
import { Product } from '@/types/product.type';

type FormEditProductProps = {
  product: Product;
  onSuccess?: () => void;
};

export default function FormEditProduct({ product, onSuccess }: FormEditProductProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Omit<UpdateProductByIdParams, 'id'>>({
    resolver: zodResolver(UpdateProductByIdSchema),
    defaultValues: {
      name: product.name,
    },
  });

  const { mutate: updateProductById, isPending } = useUpdateProductById();

  const onSubmit = (data: Omit<UpdateProductByIdParams, 'id'>) => {
    updateProductById(
      { ...data, id: product.id },
      {
        onSuccess: () => {
          toast('Produto atualizado com sucesso');
          queryClient.invalidateQueries({ queryKey: ['products'] });
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
        <DialogTitle>Editar produto</DialogTitle>
        <DialogDescription>Atualize as informações do produto.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Atualizando produto...' : 'Atualizar produto'}
        </Button>
      </div>
    </form>
  );
}
