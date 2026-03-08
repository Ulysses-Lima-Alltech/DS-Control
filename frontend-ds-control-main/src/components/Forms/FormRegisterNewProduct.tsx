'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRegisterNewProduct } from '@/mutations/product.mutation';
import { RegisterNewProductSchema } from '@/schemas/product.schema';
import { RegisterNewProductParams } from '@/services/product.service';

export default function FormRegisterNewProduct() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterNewProductParams>({
    resolver: zodResolver(RegisterNewProductSchema),
  });

  const { mutate: registerNewProduct, isPending } = useRegisterNewProduct();

  const onSubmit = (data: RegisterNewProductParams) => {
    registerNewProduct(data, {
      onSuccess: () => {
        toast('Produto criado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['products'] });
        reset({
          name: '',
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
        <DialogTitle>Criar novo produto</DialogTitle>
        <DialogDescription>Crie um novo produto para o sistema.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Criando produto...' : 'Criar produto'}
        </Button>
      </div>
    </form>
  );
}
