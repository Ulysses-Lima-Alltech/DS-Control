'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MapMinus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import MapViewer from '@/components/MapViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useRegisterNewServiceOrder } from '@/mutations/service-order.mutation';
import { useGetAllContractsInfinite } from '@/queries/contract.query';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllFarmsInfinite, useGetFarmById } from '@/queries/farm.query';
import { useGetAllUsersInfinite } from '@/queries/user.query';
import { RegisterNewServiceOrderSchema } from '@/schemas/service-order.schema';
import { RegisterNewServiceOrderParams } from '@/services/service-order.service';
import { Contract } from '@/types/contracts.type';
import { Customer } from '@/types/customer.type';
import { Farm } from '@/types/farm.type';
import { ServiceOrder } from '@/types/service-order.type';
import { User } from '@/types/user.type';
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from '@/utils/map-utils';

import 'mapbox-gl/dist/mapbox-gl.css';

export default function FormRegisterNewServiceOrder({
  closeDialog,
  initialValues,
  onSubmitOverride,
  isUpdatingServiceOrder,
  isEditingServiceOrder,
}: {
  closeDialog?: () => void;
  initialValues?: Partial<ServiceOrder>;
  onSubmitOverride?: (data: RegisterNewServiceOrderParams) => void;
  isUpdatingServiceOrder?: boolean;
  isEditingServiceOrder?: boolean;
}) {
  const debugRunId = 'os-debug-pre';
  const emitDebugLog = (hypothesisId: string, location: string, message: string, data: Record<string, unknown>) => {
    // #region agent log
    fetch('http://127.0.0.1:7864/ingest/41c173a2-8dc0-4d04-b818-e538de3cf1c3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'17c8b7'},body:JSON.stringify({sessionId:'17c8b7',runId:debugRunId,hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  };

  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');
  const [farmSearch, setFarmSearch] = useState('');
  const [pilotSearch, setPilotSearch] = useState('');
  const [plotSearch, setPlotSearch] = useState('');
  const [lastClickedFarmId, setLastClickedFarmId] = useState<string | null>(null);

  // TABS
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsListRef.current) {
      tabsListRef.current.scrollBy({
        left: direction === 'left' ? -100 : 100,
        behavior: 'smooth',
      });
    }
  };

  const checkScrollPosition = () => {
    if (tabsListRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    const tabsList = tabsListRef.current;
    if (tabsList) {
      checkScrollPosition();
      tabsList.addEventListener('scroll', checkScrollPosition);
      return () => tabsList.removeEventListener('scroll', checkScrollPosition);
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setValue,
    getValues,
  } = useForm<RegisterNewServiceOrderParams>({
    resolver: zodResolver(RegisterNewServiceOrderSchema),
    defaultValues: {
      customerId: initialValues?.customer?.id ?? '',
      contractId: initialValues?.contract?.id ?? '',
      farmsIds:
        initialValues?.farms
          ?.map((farm) => farm.id)
          .filter((id): id is string => id !== undefined) ?? [],
      pilotsIds:
        initialValues?.pilots
          ?.map((pilot) => pilot.id)
          .filter((id): id is string => id !== undefined) ?? [],
      plotsIds:
        initialValues?.plots
          ?.map((plot) => plot.id)
          .filter((id): id is string => id !== undefined) ?? [],
      plannedDate: initialValues?.plannedDate
        ? new Date(initialValues?.plannedDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      observation: initialValues?.observation ?? '',
    },
  });

  // CUSTOMERS
  const {
    data: customersFromInfiniteQuery,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingCustomers,
  } = useGetAllCustomersInfinite(
    {
      limit: '10',
      search: customerSearch || undefined,
    },
    {
      queryKey: [
        'customers',
        'FormRegisterNewServiceOrder',
        'infinite',
        '10',
        customerSearch || '',
      ],
    }
  );

  const allListedCustomers: Partial<Customer>[] = [
    ...(initialValues?.customer ? [initialValues.customer] : []),
    ...((
      customersFromInfiniteQuery as unknown as InfiniteData<{ data: Customer[] }>
    )?.pages?.flatMap((page) => page.data) || []),
  ].filter((customer, index, self) => index === self.findIndex((c) => c?.id === customer?.id));

  const selectedCustomerId = watch('customerId');

  // CONTRACTS
  const {
    data: contractsFromInfiniteQuery,
    fetchNextPage: fetchNextPageContracts,
    hasNextPage: hasNextPageContracts,
    isFetchingNextPage: isFetchingNextPageContracts,
    isLoading: isLoadingContracts,
  } = useGetAllContractsInfinite(
    {
      customerId: selectedCustomerId,
      limit: '10',
      search: contractSearch || undefined,
    },
    {
      enabled: !!selectedCustomerId,
      queryKey: [
        'contracts',
        'FormRegisterNewServiceOrder',
        'infinite',
        selectedCustomerId,
        '10',
        contractSearch || '',
      ],
    }
  );

  const allListedContracts: Partial<Contract>[] = [
    ...(initialValues?.contract ? [initialValues.contract] : []),
    ...((
      contractsFromInfiniteQuery as unknown as InfiniteData<{ data: Contract[] }>
    )?.pages?.flatMap((page) => page.data) || []),
  ].filter((contract, index, self) => index === self.findIndex((c) => c?.id === contract?.id));

  // PILOTS
  const {
    data: pilotsFromInfiniteQuery,
    fetchNextPage: fetchNextPagePilots,
    hasNextPage: hasNextPagePilots,
    isFetchingNextPage: isFetchingNextPagePilots,
    isLoading: isLoadingPilots,
  } = useGetAllUsersInfinite(
    {
      type: 'pilot',
      limit: '10',
      search: pilotSearch || undefined,
    },
    {
      queryKey: [
        'users',
        'FormRegisterNewServiceOrder',
        'infinite',
        'pilot',
        '10',
        pilotSearch || '',
      ],
    }
  );

  const allListedPilots = (initialValues?.pilots || [])
    .concat(
      ...((pilotsFromInfiniteQuery as unknown as InfiniteData<{ data: User[] }>)?.pages?.flatMap(
        (page) => page.data
      ) || [])
    )
    .filter((pilot, index, self) => index === self.findIndex((p) => p?.id === pilot?.id));

  // FARMS
  const {
    data: farmsFromInfiniteQuery,
    fetchNextPage: fetchNextPageFarms,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    isLoading: isLoadingFarms,
  } = useGetAllFarmsInfinite(
    selectedCustomerId,
    {
      includePlots: 'true',
      includeGeoJson: 'false',
      includeCustomer: 'true',
      limit: '10',
      search: farmSearch || undefined,
    },
    {
      enabled: !!selectedCustomerId,
      queryKey: [
        'farms',
        'FormRegisterNewServiceOrder',
        'infinite',
        selectedCustomerId,
        '10',
        farmSearch || '',
      ],
    }
  );

  const { data: lastClickedFarmData, isLoading: isLoadingLastClickedFarm } = useGetFarmById(
    lastClickedFarmId,
    {
      includePlots: 'true',
      includeGeoJson: 'true',
    },
    {
      queryKey: ['lastClickedFarm', 'FormRegisterNewServiceOrder', lastClickedFarmId],
    }
  );

  const allListedFarms = (initialValues?.farms || [])
    .concat(
      ...((farmsFromInfiniteQuery as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap(
        (page) => page.data
      ) || [])
    )
    .filter((farm, index, self) => index === self.findIndex((f) => f?.id === farm?.id));

  const { mutate: registerNewServiceOrder, isPending: isCreatingServiceOrder } =
    useRegisterNewServiceOrder({
      onSuccess: () => {
        toast('Ordem de serviço criada com sucesso');
        queryClient.invalidateQueries({ queryKey: ['service-orders'] });
        closeDialog?.();
      },
      onError: (error) => {
        toast(error.message);
      },
    });

  // PLOTS
  const currentSelectedPlots = watch('plotsIds');
  const currentSelectedFarms = watch('farmsIds');
  const selectedFarms = allListedFarms.filter( farm => currentSelectedFarms.includes(farm.id!))

  const hasDeletedPlots = (farmId: string): boolean => {
    const farm = allListedFarms.find((f) => f.id === farmId);
    return farm?.plots?.some((plot) => plot.deletedAt) || false;
  };

  useEffect(() => {
    checkScrollPosition();
  }, [currentSelectedPlots, allListedFarms]);

  const getCurrentSelectedFarmsIdsByPlotsIds = (plotsIds: string[]): string[] => {
    return allListedFarms
      .filter((farm) => farm.plots?.some((plot) => plotsIds.includes(plot.id!)))
      .map((farm) => farm.id!);
  };

  const handleOnPlotClick: (plotId: string) => void = (plotId: string) => {
    const currentPlotIds = currentSelectedPlots;

    if (currentPlotIds.includes(plotId)) {
      setValue(
        'plotsIds',
        currentPlotIds.filter((id) => id !== plotId)
      );
    } else {
      setValue('plotsIds', [...currentPlotIds, plotId]);
    }
  };

  const getPlotIdByNameForTheLastClickedFarm: (plotName: string) => string = (plotName: string) => {
    return lastClickedFarmData?.farm.plots.find((plot) => plot.name === plotName)?.id ?? '';
  };

  useEffect(() => {
    emitDebugLog('H1', 'FormRegisterNewServiceOrder.tsx:component', 'OS component rendered', {
      component: 'FormRegisterNewServiceOrder',
      hasInitialValues: !!initialValues,
      isEditingServiceOrder: !!isEditingServiceOrder,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const plots = lastClickedFarmData?.farm.plots ?? [];
    const activePlots = plots.filter((plot) => !plot.deletedAt);
    const inactivePlots = plots.filter((plot) => !!plot.deletedAt);
    const f76Related = lastClickedFarmData?.farm?.name?.includes('F76') ?? false;

    emitDebugLog('H2', 'FormRegisterNewServiceOrder.tsx:lastClickedFarmData', 'Farm plots payload stats', {
      farmId: lastClickedFarmId,
      farmName: lastClickedFarmData?.farm?.name ?? null,
      isF76: f76Related,
      totalPlots: plots.length,
      activePlots: activePlots.length,
      inactivePlots: inactivePlots.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastClickedFarmData, lastClickedFarmId]);

  const toggleFarmSelection = (farmId: string) => {
    const selectedFarm = allListedFarms.find((farm) => farm.id === farmId);

    const currentFarmIds = watch('farmsIds');
    const isFarmSelected = currentFarmIds.includes(farmId);

    // Toggle farmsIds directly
    const nextFarmIds = isFarmSelected
      ? currentFarmIds.filter((id) => id !== farmId)
      : [...currentFarmIds, farmId];
    setValue('farmsIds', nextFarmIds);

    // Keep plotsIds in sync with farm toggle
    if (selectedFarm?.plots) {
      const farmPlotIds = selectedFarm.plots
        .filter((plot) => !plot.deletedAt)
        .map((plot) => plot.id!)
        .filter((id) => id);
      const currentPlotIds = watch('plotsIds');

      if (isFarmSelected) {
        // Deselect: remove all plots of this farm
        const newPlotIds = currentPlotIds.filter((plotId) => !farmPlotIds.includes(plotId));
        setValue('plotsIds', newPlotIds);
        setLastClickedFarmId(null)
      } else {
        // Select: add all plots of this farm
        const newPlotIds = [...new Set([...currentPlotIds, ...farmPlotIds])];
        setValue('plotsIds', newPlotIds);
        setLastClickedFarmId(farmId)
      }
    }
  };

  /* const generateFarmAditionalInformation = (
    farm: Partial<Farm>,
    currentSelectedPlots: string[]
  ) => {
    if (!farm.plots || !Array.isArray(farm.plots)) {
      return '';
    }

    const selectedPlotsCount = farm.plots.filter((plot) =>
      currentSelectedPlots.includes(plot.id!)
    ).length;

    if (selectedPlotsCount === 0) {
      return '';
    }

    const totalHectaresSelectedForThisFarm = farm.plots
      .filter((plot) => currentSelectedPlots.includes(plot.id!))
      .reduce((sum, plot) => sum + (parseFloat(plot.hectare) || 0), 0);

    const totalHectares = totalHectaresSelectedForThisFarm.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const isPlural = selectedPlotsCount > 1;
    const text = `${selectedPlotsCount} talh${isPlural ? 'ões' : 'ão'} selecionado${
      isPlural ? 's' : ''
    } - ${totalHectares} ha`;
    return text;
  }; */

  // Keep farmsIds in sync with plotsIds without removing existing farms
  useEffect(() => {
    const selectedPlotIds: string[] = currentSelectedPlots;

    const currentFarmIds = getValues('farmsIds') || [];

    if (selectedPlotIds.length === 0) {
      if (!isEditingServiceOrder && currentFarmIds.length > 0) {
        setValue('farmsIds', []);
      }
      return;
    }

    const farmsWithSelectedPlots = allListedFarms.filter((farm) =>
      farm.plots?.some((plot) => selectedPlotIds.includes(plot.id!))
    );

    const farmIdsToSelect = farmsWithSelectedPlots.map((farm) => farm.id!).filter((id) => id);
    const mergedFarmIds = [...new Set([...currentFarmIds, ...farmIdsToSelect])];

    const sameLength = mergedFarmIds.length === currentFarmIds.length;
    const sameContent = sameLength && mergedFarmIds.every((id) => currentFarmIds.includes(id));
    if (!sameContent) {
      setValue('farmsIds', mergedFarmIds);
    }
  }, [currentSelectedPlots, allListedFarms, setValue, isEditingServiceOrder, getValues]);

  const onSubmit = (data: RegisterNewServiceOrderParams) => {
    if (isEditingServiceOrder) {
      onSubmitOverride?.(data);
    } else {
      registerNewServiceOrder(data);
    }
  };

  const isSavingData = isCreatingServiceOrder || isUpdatingServiceOrder;

  return (
    <div className='flex flex-col h-full'>
      <DialogHeader className='flex-shrink-0'>
        <DialogTitle>
          {isEditingServiceOrder ? 'Editar ordem de serviço' : 'Criar nova ordem de serviço'}
        </DialogTitle>
        <DialogDescription>
          {isEditingServiceOrder
            ? 'Edite as informações da ordem de serviço.'
            : 'Crie uma nova ordem de serviço para o sistema.'}
        </DialogDescription>
      </DialogHeader>

      <div className='flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 mt-4'>
        <div className='flex flex-col min-h-0'>
          <Card className='flex-1 flex flex-col min-h-0'>
            <CardHeader className='flex-shrink-0'>
              <CardTitle className='text-lg'>Informações da Ordem de Serviço</CardTitle>
            </CardHeader>
            <CardContent className='flex-1 overflow-y-auto scrollbar-hide'>
              <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
                <Controller
                  name='customerId'
                  control={control}
                  render={({ field }) => (
                    <SearchableSelectQuery
                      options={allListedCustomers.map((customer: Partial<Customer>) => ({
                        value: customer.id ?? 'N/A',
                        label: customer.name ?? 'N/A',
                      }))}
                      value={field.value}
                      onValueChange={(value) => {
                        setLastClickedFarmId(null);
                        setValue('customerId', value as string);
                        setValue('contractId', '');
                        setValue('farmsIds', []);
                        setValue('plotsIds', []);
                        field.onChange(value);
                      }}
                      placeholder='Selecione um cliente'
                      searchPlaceholder='Buscar cliente por nome...'
                      onSearchChange={setCustomerSearch}
                      onScrollEnd={fetchNextPage}
                      hasNextPage={hasNextPage}
                      isFetchingNextPage={isFetchingNextPage}
                      isLoading={isLoadingCustomers}
                      className='w-full'
                      disabled={isSavingData || isLoadingCustomers}
                    />
                  )}
                />
                {errors.customerId && (
                  <p className='text-red-500 text-sm'>{errors.customerId.message}</p>
                )}

                <Controller
                  name='contractId'
                  control={control}
                  render={({ field }) => (
                    <SearchableSelectQuery
                      options={allListedContracts.map((contract: Partial<Contract>) => ({
                        value: contract.id ?? 'N/A',
                        label: contract.name ?? 'N/A',
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={
                        !selectedCustomerId
                          ? 'Selecione um cliente primeiro'
                          : 'Selecione um contrato'
                      }
                      searchPlaceholder='Buscar contrato por nome...'
                      disabled={!selectedCustomerId || isSavingData || isLoadingContracts}
                      onSearchChange={setContractSearch}
                      onScrollEnd={fetchNextPageContracts}
                      hasNextPage={hasNextPageContracts}
                      isFetchingNextPage={isFetchingNextPageContracts}
                      isLoading={isLoadingContracts}
                      className='w-full'
                    />
                  )}
                />
                {errors.contractId && (
                  <p className='text-red-500 text-sm'>{errors.contractId.message}</p>
                )}

                <div>
                  <Controller
                    name='farmsIds'
                    control={control}
                    render={() => (
                      <div className='flex flex-col gap-2 mt-1'>
                        <Controller
                          name='farmsIds'
                          control={control}
                          render={() => (
                          <>
                            <SearchableSelectQuery
                              options={allListedFarms.map((farm: Partial<Farm>) => ({
                                value: farm.id ?? 'N/A',
                                label: farm.name ? `${farm.name}` : 'N/A'
                              }))}
                              value={watch('farmsIds')}
                              onValueChange={(newValue) => {
                                if (Array.isArray(newValue)) {
                                  // Determine toggled farm by diffing
                                  const current = watch('farmsIds');
                                  const added = newValue.find((id) => !current.includes(id));
                                  const removed = current.find((id) => !newValue.includes(id));
                                  const toggled = added || removed;
                                  if (toggled) {
                                    toggleFarmSelection(toggled);
                                  }
                                }
                              }}
                              placeholder={
                                !selectedCustomerId
                                  ? 'Selecione um cliente primeiro'
                                  : 'Selecione fazendas'
                              }
                              searchPlaceholder='Buscar fazenda por nome...'
                              disabled={
                                (!selectedCustomerId && !isEditingServiceOrder) ||
                                isSavingData ||
                                isLoadingFarms ||
                                isLoadingLastClickedFarm
                              }
                              isMultipleSelections={true}
                              onSearchChange={setFarmSearch}
                              onScrollEnd={fetchNextPageFarms}
                              hasNextPage={hasNextPageFarms}
                              isFetchingNextPage={isFetchingNextPageFarms}
                              isLoading={isLoadingFarms}
                              onItemClick={(farmId: string) => toggleFarmSelection(farmId)}
                              className='w-full'
                            />
                            {(selectedFarms.length > 0) && <>
                              <div className='flex flex-col min-h-0'>
                                <Card className='gap-1 px-2 py-4 flex-1 flex flex-col min-h-0'>
                                  <CardHeader className='!pb-0 flex-shrink-0 text-center'>
                                    <CardTitle className='text-sm'>Fazendas selecionadas para esta ordem de serviço</CardTitle>
                                  </CardHeader>
                                  <CardContent className='px-3 gap-2 flex-1 overflow-y-auto scrollbar-hide'>
                                    <div className="flex flex-col gap-2">
                                      {selectedFarms.map((farm) => (
                                        <div
                                            key={farm.id}
                                            className='flex flex-row gap-2 items-center'>
                                          <div
                                            className="p-2 flex flex-1 justify-between border rounded cursor-pointer hover:opacity-[80%]"
                                            onClick={() => setLastClickedFarmId(farm.id!)} // se quiser permitir selecionar também
                                          >
                                            <p className="text-sm font-medium">{farm.name}</p>
                                            {farm.plots?.length ? (
                                              <p className="text-xs text-muted-foreground">{farm.plots.length} talhões</p>
                                            ) : null}
                                          </div>
                                          <div
                                            className='p-1 w-8 h-8 flex items-center justify-center rounded bg-red-700 cursor-pointer'
                                            onClick={() => toggleFarmSelection(farm.id!)}>
                                            <X className='w-4 h-4'/>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>

                                </Card>
                              </div>
                            </>}
                          </>
                          )}
                        />
                      </div>
                    )}
                  />
                  {errors.farmsIds && (
                    <p className='text-red-500 text-sm'>{errors.farmsIds.message}</p>
                  )}
                </div>

                <Controller
                  name='pilotsIds'
                  control={control}
                  render={({ field }) => (
                    <SearchableSelectQuery
                      options={allListedPilots.map((pilot: Partial<User>) => ({
                        value: pilot.id ?? 'N/A',
                        label: pilot.name ?? 'N/A',
                      }))}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder='Selecione pilotos'
                      searchPlaceholder='Buscar piloto por nome...'
                      isMultipleSelections={true}
                      onSearchChange={setPilotSearch}
                      onScrollEnd={fetchNextPagePilots}
                      hasNextPage={hasNextPagePilots}
                      isFetchingNextPage={isFetchingNextPagePilots}
                      isLoading={isLoadingPilots}
                      disabled={isSavingData || isLoadingPilots}
                      className='w-full'
                    />
                  )}
                />
                {errors.pilotsIds && (
                  <p className='text-red-500 text-sm'>{errors.pilotsIds.message}</p>
                )}

                <Controller
                  name='plannedDate'
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder='Data planejada'
                      className='w-full'
                    />
                  )}
                />
                {errors.plannedDate && (
                  <p className='text-red-500 text-sm'>{errors.plannedDate.message}</p>
                )}

                <div className='flex flex-col flex-1'>
                  <Textarea
                    placeholder='Digite uma observação...'
                    {...register('observation')}
                    className='flex-1 min-h-[100px]'
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSubmit(onSubmit as (data: RegisterNewServiceOrderParams) => void)}
                disabled={isSavingData}
                className='w-full'
              >
                {isSavingData ? 'Salvando...' : 'Salvar'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className='flex flex-col min-h-0 my-0'>
          <div className='flex-1 overflow-hidden flex justify-center items-center rounded-t-xl'>
            {isLoadingLastClickedFarm ? (
              <div className='flex flex-col items-center justify-center space-y-2'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
                <p className='text-sm text-muted-foreground'>Carregando dados do mapa...</p>
              </div>
            ) : (
              (() => {
                const mapPlots =
                  lastClickedFarmData?.farm.plots?.filter(
                    (plot) =>
                      plot.name.toLowerCase().includes(plotSearch.toLowerCase()) && !plot.deletedAt
                  ) ?? [];
                const hasInactiveInMap = mapPlots.some((plot) => !!plot.deletedAt);
                emitDebugLog(
                  'H3',
                  'FormRegisterNewServiceOrder.tsx:mapGeoData',
                  'Map plots before conversion',
                  {
                    farmId: lastClickedFarmId,
                    farmName: lastClickedFarmData?.farm?.name ?? null,
                    isF76: lastClickedFarmData?.farm?.name?.includes('F76') ?? false,
                    plotSearch,
                    mapPlotsCount: mapPlots.length,
                    hasInactiveInMap,
                    mapPlotNames: mapPlots.slice(0, 20).map((plot) => plot.name),
                  }
                );
                return (
              <MapViewer
                geoData={
                  lastClickedFarmData?.farm.plots
                    ? convertDatabasePlotsToMapViewerPlotsFeatureCollection(
                        lastClickedFarmData?.farm.plots.filter((plot) =>
                          plot.name.toLowerCase().includes(plotSearch.toLowerCase()) && !plot.deletedAt
                        )
                      )
                    : undefined
                }
                layerNameToHighlight={
                  lastClickedFarmData?.farm.plots.map((plot) => {
                    if (currentSelectedPlots.includes(plot.id!)) {
                      return plot.name;
                    }
                    return '';
                  }) || []
                }
                onPlotClick={(plotName: string) => {
                  emitDebugLog('H4', 'FormRegisterNewServiceOrder.tsx:onPlotClick', 'Map click payload key', {
                    farmId: lastClickedFarmId,
                    farmName: lastClickedFarmData?.farm?.name ?? null,
                    isF76: lastClickedFarmData?.farm?.name?.includes('F76') ?? false,
                    clickedPlotName: plotName,
                    resolvedPlotId: getPlotIdByNameForTheLastClickedFarm(plotName),
                  });
                  handleOnPlotClick(getPlotIdByNameForTheLastClickedFarm(plotName));
                }}
              />
                );
              })()
            )}
          </div>

          {(() => {
            const selectedFarmIds = getCurrentSelectedFarmsIdsByPlotsIds(currentSelectedPlots);
            const selectedFarms =
              allListedFarms.filter((farm) => selectedFarmIds.includes(farm.id)) || [];

            if (selectedFarms.length === 0) {
              return null;
            }

            // Avoid setting state during render; handled by useEffect sync

            return (
              <Tabs
                value={lastClickedFarmId || selectedFarms[0]?.id}
                onValueChange={setLastClickedFarmId}
                className='w-full'
              >
                <div className='relative'>
                  {selectedFarms.length >= 4 && canScrollLeft && (
                    <button
                      onClick={() => scrollTabs('left')}
                      className='absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm border border-border rounded-full p-1 shadow-sm hover:bg-accent transition-all duration-200 opacity-70 hover:opacity-100'
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}

                  {selectedFarms.length >= 4 && canScrollRight && (
                    <button
                      onClick={() => scrollTabs('right')}
                      className='absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm border border-border rounded-full p-1 shadow-sm hover:bg-accent transition-all duration-200 opacity-70 hover:opacity-100'
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}

                  <TabsList
                    ref={tabsListRef}
                    className={`w-full justify-start ${
                      selectedFarms.length >= 4 ? 'overflow-x-auto scrollbar-hide' : ''
                    }`}
                    style={
                      selectedFarms.length >= 4
                        ? {
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                          }
                        : {}
                    }
                  >
                    {selectedFarms.map((farm) => {
                      return (
                        <TabsTrigger
                          key={farm.id}
                          value={farm.id}
                          className={
                            selectedFarms.length >= 4
                              ? 'flex-shrink-0 min-w-fit whitespace-nowrap'
                              : 'flex-1'
                          }
                        >
                          <div className='flex items-center gap-1'>
                            {farm.name}
                            {hasDeletedPlots(farm.id) && (
                              <MapMinus className='h-4 w-4 text-red-500' />
                            )}
                          </div>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
                {selectedFarms.map((farm) => (
                  <TabsContent key={farm.id} value={farm.id} className='mt-0'></TabsContent>
                ))}
              </Tabs>
            );
          })()}
          <Card className='flex-shrink-0 rounded-t-none p-2'>
            <CardContent className='p-2'>
              <div>
                <Input
                  type='search'
                  placeholder='Buscar talhão por nome...'
                  value={plotSearch}
                  onChange={(e) => setPlotSearch(e.target.value)}
                  className='mb-2'
                />
                <Controller
                  name='plotsIds'
                  control={control}
                  render={({ field }) => {
                    const allListedPlots = lastClickedFarmData?.farm.plots;

                    return (
                      <div className='flex flex-col gap-2'>
                        <div className='h-40 overflow-y-auto border rounded-md p-2'>
                          {!isLoadingLastClickedFarm &&
                          allListedPlots &&
                          allListedPlots.length > 0 ? (
                            <>
                              {allListedPlots
                                .filter((plot) =>
                                  plot.name.toLowerCase().includes(plotSearch.toLowerCase()) && !plot.deletedAt
                                )
                                .map((plot) => (
                                  <div
                                    key={plot.id}
                                    ref={(element) => {
                                      field.ref(element);
                                    }}
                                    onClick={() => {
                                      handleOnPlotClick(plot.id!);
                                    }}
                                    className='flex items-center space-x-2 cursor-pointer py-1'
                                  >
                                    <input
                                      type='checkbox'
                                      checked={watch('plotsIds').includes(plot.id!) || false}
                                      onChange={() => {}}
                                      className='pointer-events-none'
                                    />
                                    <span className='text-sm'>
                                      {plot.name}
                                      {plot.deletedAt && (
                                        <span className='text-red-500 ml-1'>
                                          - DELETADO (Versão antiga do mapa)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                            </>
                          ) : (
                            <p className='text-sm text-muted-foreground'>
                              {lastClickedFarmId
                                ? 'Nenhum talhão encontrado para a fazenda selecionada'
                                : 'Selecione uma fazenda primeiro'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                {errors.plotsIds && (
                  <p className='text-red-500 text-sm'>{errors.plotsIds.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
