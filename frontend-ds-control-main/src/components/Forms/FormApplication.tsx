'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  useRegisterNewApplication,
  useUpdateApplicationById,
} from '@/mutations/application.mutation';
import { useGetAllAssistantsInfinite, useGetAssistantById } from '@/queries/assistant.query';
import { useGetAllCultureTypesInfinite, useGetCultureTypeById } from '@/queries/culture-type.query';
import { useGetAllDronesInfinite, useGetDroneById } from '@/queries/drone.query';
import { useGetAllFarms, useGetFarmById } from '@/queries/farm.query';
import { useGetAllProductsInfinite, useGetProductById } from '@/queries/product.query';
import {
  useGetAllServiceOrdersInfinite,
  useGetServiceOrderById,
} from '@/queries/service-order.query';
import { useGetAllUsersInfinite, useGetUserById } from '@/queries/user.query';
import {
  RegisterNewApplicationSchema,
  UpdateApplicationByIdSchema,
} from '@/schemas/application.schema';
import { RegisterNewApplicationParams } from '@/services/application.service';
import { Application } from '@/types/applications.type';
import { Assistant } from '@/types/assistant.type';
import { CultureType } from '@/types/culture-types.type';
import { Drone } from '@/types/drone.type';
import { Farm } from '@/types/farm.type';
import { Product } from '@/types/product.type';
import { ServiceOrder } from '@/types/service-order.type';
import { User } from '@/types/user.type';
import { toOperationalDateYMDOrToday } from '@/utils/operational-date';

type FormApplicationProps = {
  initialValues?: Partial<Application>;
  isEditMode?: boolean;
  onSuccess?: () => void;
};

function normalizeOperationalDateInput(value?: string | null): string {
  return toOperationalDateYMDOrToday(value);
}

export default function FormApplication({
  initialValues,
  isEditMode = false,
  onSuccess,
}: FormApplicationProps) {
  const queryClient = useQueryClient();

  const [serviceOrderSearch, setServiceOrderSearch] = useState('');
  const [farmSearch, setFarmSearch] = useState('');
  const [pilotSearch, setPilotSearch] = useState('');
  const [assistantSearch, setAssistantSearch] = useState('');
  const [droneSearch, setDroneSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [cultureTypeSearch, setCultureTypeSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RegisterNewApplicationParams>({
    resolver: zodResolver(isEditMode ? UpdateApplicationByIdSchema : RegisterNewApplicationSchema),
    defaultValues: {
      serviceOrderId: initialValues?.serviceOrderId ?? null,
      farmId: initialValues?.farmId ?? null,
      pilotId: initialValues?.pilotId ?? '',
      assistantId: initialValues?.assistantId ?? '',
      droneId: initialValues?.droneId ?? '',
      cultureId: initialValues?.cultureId ?? '',
      hectares: initialValues?.hectares ?? '',
      flowRate: initialValues?.flowRate ?? '',
      altitude: initialValues?.altitude ?? '',
      routeSpacing: initialValues?.routeSpacing ?? '',
      dropletSize: initialValues?.dropletSize ?? '',
      date: normalizeOperationalDateInput(initialValues?.date),
      productId: initialValues?.productId ?? '',
      plotId: initialValues?.plotId ?? null,
      observations: initialValues?.observations ?? '',
    },
  });

  const { mutate: registerNewApplication, isPending: isCreatingApplication } =
    useRegisterNewApplication();
  const { mutate: updateApplicationById, isPending: isUpdatingApplication } =
    useUpdateApplicationById();

  // SERVICE ORDERS
  const { data: initialServiceOrder, isFetching: isFetchingInitialServiceOrder } =
    useGetServiceOrderById(
      initialValues?.serviceOrderId ?? '',
      {
        includeFarms: 'true',
        includePlots: 'true',
        includeCustomers: 'true',
      },
      {
        queryKey: ['service-orders', 'FormApplication', 'initial', initialValues?.serviceOrderId],
        enabled: !!initialValues?.serviceOrderId && isEditMode,
      }
    );

  const {
    data: serviceOrdersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingServiceOrders,
  } = useGetAllServiceOrdersInfinite(
    {
      limit: '10',
      search: serviceOrderSearch || undefined,
      includeCustomers: 'true',
      includeFarms: 'true',
    },
    {
      queryKey: ['service-orders', 'FormApplication', 'infinite', serviceOrderSearch || '', 'true'],
    }
  );

  const allServiceOrders = [
    initialServiceOrder ? initialServiceOrder : undefined,
    ...((serviceOrdersData as unknown as InfiniteData<{ data: ServiceOrder[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || []),
  ];

  const allListedServiceOrders = allServiceOrders
    .filter((serviceOrder) => serviceOrder !== undefined)
    .filter(
      (serviceOrder, index, self) => index === self.findIndex((so) => so?.id === serviceOrder?.id)
    );

  const selectedServideOrder = allListedServiceOrders.find(
    (serviceOrder) => serviceOrder?.id === watch('serviceOrderId')
  );

  // FARMS
  const {
    data: farmsData,
    isLoading: isLoadingFarms,
    isFetching: isFetchingFarms,
  } = useGetAllFarms(undefined, {
    limit: '10',
    search: farmSearch || undefined,
  });

  const availableFarms: Farm[] = selectedServideOrder
    ? selectedServideOrder?.farms
    : (farmsData?.data ?? []);

  // PILOTS

  const { data: initialPilot, isFetching: isFetchingInitialPilot } = useGetUserById(
    initialValues?.pilotId ?? '',
    {
      queryKey: ['users', 'FormApplication', 'initial', initialValues?.pilotId],
      enabled: !!initialValues?.pilotId && isEditMode,
    }
  );

  const {
    data: pilotsData,
    fetchNextPage: fetchNextPagePilots,
    hasNextPage: hasNextPagePilots,
    isFetchingNextPage: isFetchingNextPagePilots,
    isLoading: isLoadingPilots,
  } = useGetAllUsersInfinite(
    {
      type: 'pilot',
      status: 'active',
      limit: '10',
      search: pilotSearch || undefined,
    },
    {
      queryKey: ['users', 'FormApplication', 'infinite', 'pilot', 'active', '10', pilotSearch || ''],
    }
  );

  const allPilots = [
    initialPilot ? initialPilot : undefined,
    ...((pilotsData as unknown as InfiniteData<{ data: User[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || []),
  ];

  const allListedPilots = allPilots
    .filter((pilot) => pilot !== undefined)
    .filter((pilot, index, self) => index === self.findIndex((p) => p?.id === pilot?.id));

  // ASSISTANTS

  const { data: initialAssistant, isFetching: isFetchingInitialAssistant } = useGetAssistantById(
    initialValues?.assistantId ?? '',
    {
      queryKey: ['assistants', 'FormApplication', 'initial', initialValues?.assistantId],
      enabled: !!initialValues?.assistantId && isEditMode,
    }
  );

  const {
    data: assistantsData,
    fetchNextPage: fetchNextPageAssistants,
    hasNextPage: hasNextPageAssistants,
    isFetchingNextPage: isFetchingNextPageAssistants,
    isLoading: isLoadingAssistants,
  } = useGetAllAssistantsInfinite({
    limit: '10',
    search: assistantSearch || undefined,
  });

  const allAssistants = [
    initialAssistant ? initialAssistant.assistant : undefined,
    ...((assistantsData as unknown as InfiniteData<{ data: Assistant[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || []),
  ];

  const allListedAssistants = allAssistants
    .filter((assistant) => assistant !== undefined)
    .filter((assistant, index, self) => index === self.findIndex((a) => a?.id === assistant?.id));

  // DRONES
  const {
    data: initialDroneData,
    isFetching: isFetchingInitialDrone,
    isError: isInitialDroneError,
  } = useGetDroneById(initialValues?.droneId ?? '', {
    enabled: !!initialValues?.droneId && isEditMode,
  });

  const {
    data: dronesData,
    fetchNextPage: fetchNextPageDrones,
    hasNextPage: hasNextPageDrones,
    isFetchingNextPage: isFetchingNextPageDrones,
    isLoading: isLoadingDrones,
  } = useGetAllDronesInfinite(
    {
      limit: '10',
      search: droneSearch || undefined,
    },
    {
      queryKey: ['drones', 'FormApplication', 'infinite', '10', droneSearch || ''],
    }
  );

  const allDrones = [
    isInitialDroneError ? undefined : initialDroneData?.drone,
    ...((dronesData as unknown as InfiniteData<{ data: Drone[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || []),
  ];

  const allListedDrones = allDrones
    .filter((drone) => drone !== undefined)
    .filter((drone, index, self) => index === self.findIndex((d) => d?.id === drone?.id));

  // PRODUCTS
  const {
    data: initialProductData,
    isFetching: isFetchingInitialProduct,
    isError: isProductError,
  } = useGetProductById(initialValues?.productId ?? '', {
    enabled: !!initialValues?.productId && isEditMode,
  });

  const {
    data: productsData,
    fetchNextPage: fetchNextPageProducts,
    hasNextPage: hasNextPageProducts,
    isFetchingNextPage: isFetchingNextPageProducts,
    isLoading: isLoadingProducts,
  } = useGetAllProductsInfinite(
    {
      limit: '10',
      search: productSearch || undefined,
    },
    {
      queryKey: ['products', 'FormApplication', 'infinite', '10', productSearch || ''],
    }
  );

  const allProducts = [
    isProductError ? undefined : initialProductData?.product,
    ...((productsData as unknown as InfiniteData<{ data: Product[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || []),
  ];

  const allListedProducts = allProducts
    .filter((product) => product !== undefined)
    .filter((product, index, self) => index === self.findIndex((p) => p?.id === product?.id));

  // CULTURE TYPES
  const { data: initialCultureType, isFetching: isFetchingInitialCultureType } =
    useGetCultureTypeById(initialValues?.cultureId ?? '', {
      queryKey: ['culture-types', 'FormApplication', 'initial', initialValues?.cultureId],
      enabled: !!initialValues?.cultureId && isEditMode,
    });

  const {
    data: cultureTypesData,
    fetchNextPage: fetchNextPageCultureTypes,
    hasNextPage: hasNextPageCultureTypes,
    isFetchingNextPage: isFetchingNextPageCultureTypes,
    isLoading: isLoadingCultureTypes,
  } = useGetAllCultureTypesInfinite({
    limit: '10',
    search: cultureTypeSearch || undefined,
  });

  const allCultureTypes = [
    initialCultureType ? initialCultureType.cultureType : undefined,
    ...((cultureTypesData as unknown as InfiniteData<{ data: CultureType[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || []),
  ];

  const allListedCultureTypes = allCultureTypes
    .filter((cultureType) => cultureType !== undefined)
    .filter(
      (cultureType, index, self) => index === self.findIndex((ct) => ct?.id === cultureType?.id)
    );

  const { data: farmData } = useGetFarmById(
    watch('farmId') || null,
    {
      includePlots: 'true',
    },
    {
      enabled: !!watch('farmId'),
      queryKey: ['farms', 'FormApplication', 'initial', watch('serviceOrderId')],
    }
  );

  const selectedFarmId = watch('farmId');
  const availablePlots = farmData?.farm.plots || [];

  const onSubmit = (data: RegisterNewApplicationParams) => {
    if (isEditMode && initialValues?.id) {
      updateApplicationById(
        { ...data, id: initialValues.id },
        {
          onSuccess: () => {
            toast('Aplicação atualizada com sucesso');
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            onSuccess?.();
          },
          onError: (error) => {
            toast(error.message);
          },
        }
      );
    } else {
      registerNewApplication(data, {
        onSuccess: () => {
          toast('Aplicação criada com sucesso');
          queryClient.invalidateQueries({ queryKey: ['applications'] });
          reset({
            serviceOrderId: '',
            farmId: '',
            pilotId: '',
            assistantId: '',
            droneId: '',
            cultureId: '',
            hectares: '',
            flowRate: '',
            altitude: '',
            routeSpacing: '',
            dropletSize: '',
            date: toOperationalDateYMDOrToday(),
            productId: '',
            plotId: undefined,
            observations: '',
          });
          setServiceOrderSearch('');
          setFarmSearch('');
          setPilotSearch('');
          setAssistantSearch('');
          setDroneSearch('');
          setProductSearch('');
          setCultureTypeSearch('');
          onSuccess?.();
        },
        onError: (error) => {
          toast(error.message);
        },
      });
    }
  };

  const isApplyingChanges = isCreatingApplication || isUpdatingApplication;

  if (
    isFetchingInitialServiceOrder ||
    isFetchingInitialAssistant ||
    isFetchingInitialDrone ||
    isFetchingInitialProduct ||
    isFetchingInitialCultureType ||
    isFetchingInitialPilot
  ) {
    return <SkeletonFormApplication />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4 overflow-auto'>
      <DialogHeader>
        <DialogTitle>{isEditMode ? 'Editar aplicação' : 'Criar nova aplicação'}</DialogTitle>
        <DialogDescription>
          {isEditMode
            ? 'Atualize as informações da aplicação agrícola.'
            : 'Crie uma nova aplicação agrícola para o sistema.'}
        </DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4 w-full'>
        <SearchableSelectQuery
          options={allListedServiceOrders.map((serviceOrder: ServiceOrder) => ({
            value: serviceOrder.id,
            label: `OS #${serviceOrder.number} - ${serviceOrder.customer?.name}`,
          }))}
          value={watch('serviceOrderId') || undefined}
          onValueChange={(value) => {
            setValue('serviceOrderId', (value as string) || '');
            setValue('plotId', undefined);
            setValue('farmId', null);
          }}
          placeholder='Selecione uma ordem de serviço'
          searchPlaceholder='Buscar ordem de serviço...'
          onSearchChange={setServiceOrderSearch}
          onScrollEnd={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isLoading={isLoadingServiceOrders}
          disabled={isApplyingChanges}
          className='w-full'
        />
        {errors.serviceOrderId && (
          <p className='text-red-500 text-sm'>{errors.serviceOrderId.message}</p>
        )}

        <SearchableSelectQuery
          options={
            availableFarms?.map((farm: Farm) => ({
              value: farm.id,
              label: farm.name,
            })) ?? []
          }
          value={watch('farmId') || undefined}
          onValueChange={(value) => {
            setValue('farmId', (value as string) || null);
            setValue('plotId', undefined);
          }}
          placeholder='Selecione uma fazenda'
          searchPlaceholder='Buscar fazenda...'
          onSearchChange={setFarmSearch}
          isFetchingNextPage={isFetchingFarms}
          isLoading={isLoadingFarms}
          disabled={isApplyingChanges}
          className='w-full'
        />
        {errors.serviceOrderId && (
          <p className='text-red-500 text-sm'>{errors.serviceOrderId.message}</p>
        )}

        <SearchableSelectQuery
          options={allListedPilots.map((pilot) => ({
            value: pilot.id,
            label: pilot.name,
          }))}
          value={watch('pilotId')}
          onValueChange={(value) => setValue('pilotId', (value as string) || '')}
          placeholder='Selecione um piloto'
          searchPlaceholder='Buscar piloto...'
          onSearchChange={setPilotSearch}
          onScrollEnd={fetchNextPagePilots}
          hasNextPage={hasNextPagePilots}
          isFetchingNextPage={isFetchingNextPagePilots}
          isLoading={isLoadingPilots}
          disabled={isApplyingChanges}
          className='w-full'
        />
        {errors.pilotId && <p className='text-red-500 text-sm'>{errors.pilotId.message}</p>}

        <SearchableSelectQuery
          options={allListedAssistants.map((assistant) => ({
            value: assistant.id,
            label: assistant.name,
          }))}
          value={watch('assistantId')}
          onValueChange={(value) => setValue('assistantId', (value as string) || '')}
          placeholder='Selecione um assistente'
          searchPlaceholder='Buscar assistente...'
          onSearchChange={setAssistantSearch}
          onScrollEnd={fetchNextPageAssistants}
          hasNextPage={hasNextPageAssistants}
          isFetchingNextPage={isFetchingNextPageAssistants}
          isLoading={isLoadingAssistants}
          disabled={isApplyingChanges}
          className='w-full'
        />
        {errors.assistantId && <p className='text-red-500 text-sm'>{errors.assistantId.message}</p>}

        <SearchableSelectQuery
          options={allListedDrones.map((drone: Drone) => ({
            value: drone.id,
            label: `${drone.name} - ${drone.model}`,
          }))}
          value={watch('droneId')}
          onValueChange={(value) => setValue('droneId', (value as string) || '')}
          placeholder='Selecione um drone'
          searchPlaceholder='Buscar drone...'
          onSearchChange={setDroneSearch}
          onScrollEnd={fetchNextPageDrones}
          hasNextPage={hasNextPageDrones}
          isFetchingNextPage={isFetchingNextPageDrones}
          isLoading={isLoadingDrones}
          disabled={isApplyingChanges}
          className='w-full'
        />
        {errors.droneId && <p className='text-red-500 text-sm'>{errors.droneId.message}</p>}

        <SearchableSelectQuery
          options={allListedCultureTypes.map((cultureType) => ({
            value: cultureType.id,
            label: cultureType.name,
          }))}
          value={watch('cultureId')}
          onValueChange={(value) => setValue('cultureId', (value as string) || '')}
          placeholder='Selecione um tipo de cultura'
          searchPlaceholder='Buscar tipo de cultura...'
          onSearchChange={setCultureTypeSearch}
          onScrollEnd={fetchNextPageCultureTypes}
          hasNextPage={hasNextPageCultureTypes}
          isFetchingNextPage={isFetchingNextPageCultureTypes}
          isLoading={isLoadingCultureTypes}
          disabled={isApplyingChanges}
          className='w-full'
        />
        {errors.cultureId && <p className='text-red-500 text-sm'>{errors.cultureId.message}</p>}

        <SearchableSelectQuery
          options={allListedProducts.map((product) => ({
            value: product.id,
            label: product.name,
          }))}
          value={watch('productId')}
          onValueChange={(value) => setValue('productId', (value as string) || '')}
          placeholder='Selecione um produto'
          searchPlaceholder='Buscar produto...'
          onSearchChange={setProductSearch}
          onScrollEnd={fetchNextPageProducts}
          hasNextPage={hasNextPageProducts}
          isFetchingNextPage={isFetchingNextPageProducts}
          isLoading={isLoadingProducts}
          disabled={isApplyingChanges}
          className='w-full'
        />
        {errors.productId && <p className='text-red-500 text-sm'>{errors.productId.message}</p>}

        <SearchableSelect
          options={availablePlots.map((plot) => ({
            value: plot.id!,
            label: `${plot.name} - ${plot.hectare} ha`,
          }))}
          value={watch('plotId') || undefined}
          onValueChange={(value) => setValue('plotId', (value as string) || undefined)}
          placeholder={selectedFarmId ? 'Selecione um talhão' : 'Selecione uma fazenda primeiro'}
          searchPlaceholder='Buscar talhão...'
          disabled={!selectedFarmId || isApplyingChanges}
          className='w-full'
        />
        {errors.plotId && <p className='text-red-500 text-sm'>{errors.plotId.message}</p>}

        <Input
          type='number'
          step='0.01'
          placeholder='Hectares aplicados'
          {...register('hectares')}
          autoComplete='off'
          className='w-full'
          min={0.01}
          disabled={isApplyingChanges}
        />
        {errors.hectares && <p className='text-red-500 text-sm'>{errors.hectares.message}</p>}

        <Input
          type='number'
          step='0.01'
          placeholder='Vazão média (L/ha)'
          {...register('flowRate')}
          autoComplete='off'
          className='w-full'
          min={0.01}
          disabled={isApplyingChanges}
        />
        {errors.flowRate && <p className='text-red-500 text-sm'>{errors.flowRate.message}</p>}

        <Input
          type='number'
          step='0.01'
          placeholder='Altitude (m)'
          {...register('altitude')}
          autoComplete='off'
          className='w-full'
          min={0.01}
          disabled={isApplyingChanges}
        />
        {errors.altitude && <p className='text-red-500 text-sm'>{errors.altitude.message}</p>}

        <Input
          type='number'
          step='0.01'
          placeholder='Espaçamento da rota (m)'
          {...register('routeSpacing')}
          autoComplete='off'
          className='w-full'
          min={0.01}
          disabled={isApplyingChanges}
        />
        {errors.routeSpacing && (
          <p className='text-red-500 text-sm'>{errors.routeSpacing.message}</p>
        )}

        <Input
          type='number'
          step='0.01'
          placeholder='Tamanho da gota (μm)'
          {...register('dropletSize')}
          autoComplete='off'
          className='w-full'
          min={0.01}
          disabled={isApplyingChanges}
        />
        {errors.dropletSize && <p className='text-red-500 text-sm'>{errors.dropletSize.message}</p>}

        <DatePicker
          value={watch('date')}
          onChange={(value) => setValue('date', value)}
          placeholder='Data da aplicação'
          disabled={isApplyingChanges}
        />
        {errors.date && <p className='text-red-500 text-sm'>{errors.date.message}</p>}

        <Textarea
          placeholder={
            !watch('plotId')
              ? 'Observações (obrigatório quando nenhum talhão é selecionado)'
              : 'Observações (opcional)'
          }
          {...register('observations')}
          rows={3}
          disabled={isApplyingChanges}
        />
        {errors.observations && (
          <p className='text-red-500 text-sm'>{errors.observations.message}</p>
        )}

        <Button type='submit' disabled={isApplyingChanges}>
          {isApplyingChanges
            ? isEditMode
              ? 'Atualizando aplicação...'
              : 'Criando aplicação...'
            : isEditMode
              ? 'Atualizar aplicação'
              : 'Criar aplicação'}
        </Button>
      </div>
    </form>
  );
}

const SkeletonFormApplication = () => {
  return (
    <div className='flex flex-col gap-4 overflow-auto'>
      <div className='space-y-2'>
        <Skeleton className='h-6 w-48' />
        <Skeleton className='h-4 w-96' />
      </div>
      <div className='flex flex-col gap-4 w-full'>
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-10' />
        <Skeleton className='w-full h-20' />
      </div>
    </div>
  );
};
