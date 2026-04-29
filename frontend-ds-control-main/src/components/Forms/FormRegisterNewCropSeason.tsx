'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MultiInfiniteSearchableSelect } from '@/components/ui/multi-infinite-searchable-select';
import { useRegisterNewCropSeason } from '@/mutations/crop-season.mutation';
import { useGetAllProductsInfinite } from '@/queries/product.query';
import { RegisterNewCropSeasonSchema } from '@/schemas/crop-season.schema';
import { RegisterNewCropSeasonParams } from '@/services/crop-season.service';
import { Product } from '@/types/product.type';

export default function FormRegisterNewCropSeason() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RegisterNewCropSeasonParams>({
    resolver: zodResolver(RegisterNewCropSeasonSchema),
    defaultValues: {
      name: '',
      startDate: '',
      endDate: '',
      productIds: [],
    },
  });

  const selectedProductIds = watch('productIds');

  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingProducts,
  } = useGetAllProductsInfinite({
    limit: '10',
    status: 'active',
  });

  const allProducts =
    (productsData as unknown as InfiniteData<{ data: Product[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const { mutate: registerNewCropSeason, isPending } = useRegisterNewCropSeason();

  const onSubmit = (data: RegisterNewCropSeasonParams) => {
    registerNewCropSeason(data, {
      onSuccess: () => {
        toast('Safra criada com sucesso');
        queryClient.invalidateQueries({ queryKey: ['crop-seasons'] });
        reset({
          name: '',
          startDate: '',
          endDate: '',
          productIds: [],
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
        <DialogTitle>Criar nova safra</DialogTitle>
        <DialogDescription>Cadastre a safra e selecione os produtos vinculados.</DialogDescription>
      </DialogHeader>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2 space-y-1'>
          <Input type='text' placeholder='Nome da safra' {...register('name')} autoComplete='off' />
          {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
        </div>

        <div className='space-y-1'>
          <Input type='date' {...register('startDate')} />
          {errors.startDate && <p className='text-red-500 text-sm'>{errors.startDate.message}</p>}
        </div>

        <div className='space-y-1'>
          <Input type='date' {...register('endDate')} />
          {errors.endDate && <p className='text-red-500 text-sm'>{errors.endDate.message}</p>}
        </div>

        <div className='sm:col-span-2 space-y-1'>
          <MultiInfiniteSearchableSelect
            options={allProducts.map((product) => ({
              value: product.id,
              label: product.name,
            }))}
            values={selectedProductIds || []}
            onValuesChange={(values) => {
              setValue('productIds', values, { shouldDirty: true, shouldValidate: true });
            }}
            placeholder='Selecionar produtos'
            searchPlaceholder='Buscar produto...'
            onLoadMore={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            disabled={isLoadingProducts}
          />
          {errors.productIds && <p className='text-red-500 text-sm'>{errors.productIds.message}</p>}
        </div>
      </div>

      <Button type='submit' disabled={isPending}>
        {isPending ? 'Criando safra...' : 'Criar safra'}
      </Button>
    </form>
  );
}

