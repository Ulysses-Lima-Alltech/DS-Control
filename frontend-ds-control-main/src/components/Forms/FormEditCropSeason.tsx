'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { InfiniteData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MultiInfiniteSearchableSelect } from '@/components/ui/multi-infinite-searchable-select';
import { useUpdateCropSeasonById } from '@/mutations/crop-season.mutation';
import { useGetAllProductsInfinite } from '@/queries/product.query';
import { UpdateCropSeasonByIdSchema } from '@/schemas/crop-season.schema';
import { UpdateCropSeasonByIdParams } from '@/services/crop-season.service';
import * as ProductService from '@/services/product.service';
import { CropSeason } from '@/types/crop-season.type';
import { Product } from '@/types/product.type';

type FormEditCropSeasonProps = {
  cropSeason: CropSeason;
  onSuccess?: () => void;
};

export default function FormEditCropSeason({ cropSeason, onSuccess }: FormEditCropSeasonProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Omit<UpdateCropSeasonByIdParams, 'id'>>({
    resolver: zodResolver(UpdateCropSeasonByIdSchema),
    defaultValues: {
      name: cropSeason.name,
      startDate: cropSeason.startDate,
      endDate: cropSeason.endDate,
      productIds: cropSeason.products.map((product) => product.id),
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
  const { data: allProductIds = [] } = useQuery({
    queryKey: ['products', 'active', 'all-ids'],
    queryFn: ProductService.getAllActiveProductIds,
    staleTime: 1000 * 60 * 10,
  });

  const { mutate: updateCropSeasonById, isPending } = useUpdateCropSeasonById();

  const onSubmit = (data: Omit<UpdateCropSeasonByIdParams, 'id'>) => {
    updateCropSeasonById(
      { ...data, id: cropSeason.id },
      {
        onSuccess: () => {
          toast('Safra atualizada com sucesso');
          queryClient.invalidateQueries({ queryKey: ['crop-seasons'] });
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
        <DialogTitle>Editar safra</DialogTitle>
        <DialogDescription>Atualize o período e os produtos vinculados.</DialogDescription>
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
            selectAllValues={allProductIds}
          />
          {errors.productIds && <p className='text-red-500 text-sm'>{errors.productIds.message}</p>}
        </div>
      </div>

      <Button type='submit' disabled={isPending}>
        {isPending ? 'Atualizando safra...' : 'Atualizar safra'}
      </Button>
    </form>
  );
}
