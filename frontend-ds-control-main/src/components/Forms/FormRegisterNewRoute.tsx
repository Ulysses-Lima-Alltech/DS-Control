'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight, Route as RouteIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import type { ConvertedRouteData } from '@/app/api/file-converter-route/route';
import InputRouteFile from '@/components/InputRouteFile';
import MapViewer from '@/components/MapViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateRoutesBatch } from '@/mutations/route.mutation';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetAllFarms } from '@/queries/farm.query';
import type { Customer } from '@/types/customer.type';
import type { Farm } from '@/types/farm.type';

type FormRegisterNewRouteProps = {
  customer?: Customer;
  farm?: Farm;
  closeDialog: () => void;
};

const NewRouteFormSchema = z.object({
  customerId: z.string().min(1, { message: 'Cliente é obrigatório' }),
  farmId: z.string().min(1, { message: 'Fazenda é obrigatória' }),
  name: z.string().optional(),
});

type NewRouteFormData = z.infer<typeof NewRouteFormSchema>;

function enrichRouteGeoJson(route: ConvertedRouteData): GeoJSON.FeatureCollection {
  const metadata = {
    source_file_name: route.sourceFileName,
    source_file: route.sourceFileName,
    external_id: route.externalId,
    externalId: route.externalId,
    point_count: route.pointCount,
    distance_meters: route.distanceMeters,
    start: route.start,
    end: route.end,
  };

  return {
    type: 'FeatureCollection',
    features: (route.geoJson?.features ?? []).map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        route_name: route.name,
        ...metadata,
      },
    })),
  };
}

function buildPreviewFeatureCollection(
  routes: ConvertedRouteData[]
): GeoJSON.FeatureCollection | null {
  const features = routes.flatMap((route) => enrichRouteGeoJson(route).features);

  if (features.length === 0) return null;

  return {
    type: 'FeatureCollection',
    features,
  };
}

function formatDistanceMeters(distanceMeters?: number) {
  if (!distanceMeters || distanceMeters <= 0) return 'Distância não calculada';

  if (distanceMeters < 1000) {
    return `${distanceMeters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m`;
  }

  return `${(distanceMeters / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} km`;
}

function isValidConvertedRoute(route: ConvertedRouteData) {
  return Boolean(route.name.trim() && route.geoJson?.features?.length);
}

export default function FormRegisterNewRoute({
  customer,
  farm,
  closeDialog,
}: FormRegisterNewRouteProps) {
  const queryClient = useQueryClient();
  const [convertedRoutes, setConvertedRoutes] = useState<ConvertedRouteData[]>([]);
  const [convertionFileErrors, setConvertionFileErrors] = useState<string[]>([]);
  const [isConvertionFileErrorsOpen, setIsConvertionFileErrorsOpen] = useState(true);

  const [customerSearch, setCustomerSearch] = useState('');
  const [farmSearch, setFarmSearch] = useState('');

  const { data: customers } = useGetAllCustomers();

  const filteredCustomers = useMemo(() => {
    if (!customers?.data) return [];

    if (!customerSearch.trim()) return customers.data;

    return customers.data.filter((cust) =>
      cust.name.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers?.data, customerSearch]);

  const {
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    getValues,
    watch,
  } = useForm<NewRouteFormData>({
    resolver: zodResolver(NewRouteFormSchema),
    defaultValues: {
      customerId: customer?.id ?? '',
      farmId: farm?.id ?? '',
      name: '',
    },
  });

  const selectedCustomerId = watch('customerId');
  const singleRouteName = convertedRoutes.length === 1 ? convertedRoutes[0].name : watch('name');

  const { data: farms } = useGetAllFarms(selectedCustomerId, {
    limit: '100',
  });

  const filteredFarms = useMemo(() => {
    if (!farms?.data) return [];

    if (!farmSearch.trim()) return farms.data;

    return farms.data.filter((f) => f.name.toLowerCase().includes(farmSearch.toLowerCase()));
  }, [farms?.data, farmSearch]);

  const validConvertedRoutes = useMemo(
    () => convertedRoutes.filter(isValidConvertedRoute),
    [convertedRoutes]
  );

  const previewGeoJson = useMemo(
    () => buildPreviewFeatureCollection(validConvertedRoutes),
    [validConvertedRoutes]
  );

  const { mutate: createRoutesBatch, isPending: isCreatingRoutesBatch } = useCreateRoutesBatch({
    onSuccess: (response) => {
      toast(`${response.createdCount} rotas criadas com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast(`[FormRegisterNewRoute] ${error.message}`);
      console.error('[FormRegisterNewRoute] Error: ', error);
    },
  });

  const updateConvertedRouteName = (routeIndex: number, name: string) => {
    setConvertedRoutes((currentRoutes) =>
      currentRoutes.map((route, index) => (index === routeIndex ? { ...route, name } : route))
    );
  };

  const onSubmit = (data: NewRouteFormData) => {
    if (validConvertedRoutes.length === 0) {
      toast('Nenhuma rota KML válida para salvar');
      return;
    }

    createRoutesBatch({
      customerId: data.customerId,
      farmId: data.farmId,
      duplicateStrategy: 'rename',
      routes: validConvertedRoutes.map((route) => ({
        name: route.name.trim(),
        geoJson: enrichRouteGeoJson(route) as unknown as Record<string, unknown>,
        externalId: route.externalId,
        sourceFileName: route.sourceFileName,
      })),
    });
  };

  const buttonText =
    validConvertedRoutes.length > 1
      ? `Criar ${validConvertedRoutes.length} rotas para esta fazenda`
      : 'Criar rota para esta fazenda';

  return (
    <div className='max-w-7xl h-[600px] p-0'>
      <form onSubmit={handleSubmit(onSubmit)} className='h-full'>
        <div className='grid grid-cols-1 lg:grid-cols-2 h-full gap-6 p-6'>
          <Card className='h-full m-0 flex flex-col'>
            <CardHeader className='flex-shrink-0'>
              <CardTitle>Informações da Rota</CardTitle>
              <CardDescription>
                Selecione a fazenda e um ou mais arquivos KML. As rotas serao agrupadas
                automaticamente pela fazenda selecionada.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex-1 flex flex-col overflow-y-auto overflow-x-hidden'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label>Cliente</Label>
                  <Controller
                    name='customerId'
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setValue('farmId', '');
                        }}
                        value={field.value || ''}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='Selecione um cliente' />
                        </SelectTrigger>
                        <SelectContent>
                          <Input
                            type='text'
                            placeholder='Buscar cliente por nome...'
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className='mb-2'
                          />
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map((cust) => (
                              <SelectItem key={cust.id} value={cust.id}>
                                {cust.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value='404' disabled>
                              Nenhum cliente encontrado
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.customerId && (
                    <p className='text-red-500 text-sm'>{errors.customerId.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label>Fazenda</Label>
                  <Controller
                    name='farmId'
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={!selectedCustomerId}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='Selecione uma fazenda' />
                        </SelectTrigger>
                        <SelectContent>
                          <Input
                            type='text'
                            placeholder='Buscar fazenda por nome...'
                            value={farmSearch}
                            onChange={(e) => setFarmSearch(e.target.value)}
                            className='mb-2'
                          />
                          {filteredFarms.length > 0 ? (
                            filteredFarms.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value='404' disabled>
                              {selectedCustomerId
                                ? 'Nenhuma fazenda encontrada'
                                : 'Selecione um cliente primeiro'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.farmId && <p className='text-red-500 text-sm'>{errors.farmId.message}</p>}
                </div>

                {convertedRoutes.length <= 1 && (
                  <div className='space-y-2'>
                    <Label htmlFor='routeName'>Nome da rota</Label>
                    <Input
                      id='routeName'
                      type='text'
                      placeholder='O nome será sugerido pelo KML ou arquivo'
                      value={singleRouteName || ''}
                      onChange={(e) => {
                        setValue('name', e.target.value);
                        if (convertedRoutes.length === 1) {
                          updateConvertedRouteName(0, e.target.value);
                        }
                      }}
                      className='w-full'
                    />
                  </div>
                )}

                <div className='space-y-2'>
                  <Label>Selecione um ou mais arquivos KML</Label>
                  <InputRouteFile
                    multiple
                    onConvertedRoutes={(routes) => {
                      setConvertedRoutes(routes);
                      if (routes.length === 1) {
                        setValue('name', routes[0].name);
                      } else if (routes.length > 1) {
                        setValue('name', '');
                      }
                    }}
                    changeGeoJson={() => undefined}
                    setConvertErrors={(errors) => {
                      setConvertionFileErrors(errors);
                      if (errors.length > 0) {
                        setIsConvertionFileErrorsOpen(true);
                      }
                    }}
                    setFileName={(fileName) => {
                      if (!getValues('name')) {
                        setValue('name', fileName);
                      }
                    }}
                  />
                </div>

                {convertedRoutes.length > 1 && (
                  <div className='space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3'>
                    <div className='flex items-center justify-between gap-3'>
                      <div>
                        <p className='text-sm font-semibold text-gray-900'>Rotas processadas</p>
                        <p className='text-xs text-gray-500'>
                          {validConvertedRoutes.length} de {convertedRoutes.length} rota(s) válidas
                        </p>
                      </div>
                      <span className='rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700'>
                        Total: {convertedRoutes.length}
                      </span>
                    </div>

                    <div className='max-h-56 space-y-2 overflow-y-auto pr-1'>
                      {convertedRoutes.map((route, index) => (
                        <div
                          key={`${route.externalId}-${index}`}
                          className='rounded-md bg-white p-3'
                        >
                          <div className='mb-2 flex items-center justify-between gap-3'>
                            <span className='text-xs font-medium text-gray-500'>
                              {route.sourceFileName}
                            </span>
                            <span className='text-xs text-gray-500'>
                              {route.pointCount.toLocaleString('pt-BR')} pontos
                            </span>
                          </div>
                          <Input
                            value={route.name}
                            onChange={(event) =>
                              updateConvertedRouteName(index, event.target.value)
                            }
                            className='h-9'
                          />
                          <div className='mt-2 text-xs text-gray-500'>
                            {formatDistanceMeters(route.distanceMeters)}
                          </div>
                          {!route.name.trim() && (
                            <p className='mt-1 text-xs text-red-600'>
                              Informe um nome para salvar.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {convertionFileErrors.length > 0 && (
                  <div className='space-y-2'>
                    <Collapsible
                      open={isConvertionFileErrorsOpen}
                      onOpenChange={setIsConvertionFileErrorsOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          type='button'
                          variant='ghost'
                          className='w-full justify-between p-3 h-auto text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors'
                        >
                          <div className='flex items-center space-x-2'>
                            <AlertCircle className='h-4 w-4 text-red-500' />
                            <span className='font-medium'>
                              Erros encontrados ({convertionFileErrors.length})
                            </span>
                          </div>
                          {isConvertionFileErrorsOpen ? (
                            <ChevronDown className='h-4 w-4 transition-transform duration-200' />
                          ) : (
                            <ChevronRight className='h-4 w-4 transition-transform duration-200' />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className='mt-2'>
                        <div className='p-3 bg-red-50 border border-red-200 rounded-md max-h-48 overflow-y-auto'>
                          <div className='text-red-600 text-sm'>
                            <p className='font-medium mb-2'>Foram identificados esses erros:</p>
                            <ul className='list-disc list-inside space-y-1'>
                              {convertionFileErrors.map((error, index) => (
                                <li key={`${error}-${index}`} className='text-red-700'>
                                  {error}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </div>
            </CardContent>
            <div className='flex-shrink-0 p-6 pt-0'>
              <Button
                type='submit'
                className='w-full'
                disabled={validConvertedRoutes.length === 0 || isCreatingRoutesBatch}
              >
                {isCreatingRoutesBatch ? 'Criando rota(s)...' : buttonText}
              </Button>
            </div>
          </Card>

          <Card className='h-full m-0 flex flex-col'>
            <CardHeader className='flex-shrink-0'>
              <CardTitle className='flex items-center space-x-2'>
                <RouteIcon className='h-5 w-5' />
                <span>Visualização da Rota</span>
              </CardTitle>
              <CardDescription>Visualização geográfica da rota</CardDescription>
            </CardHeader>
            <CardContent className='flex-1 flex flex-col p-4 min-h-0'>
              <div className='flex-1 overflow-hidden rounded-lg border mb-4'>
                {/* eslint-disable-next-line */}
                <MapViewer geoData={previewGeoJson ? (previewGeoJson as any) : undefined} />
              </div>
              <div className='flex-shrink-0 p-3 bg-gray-50 rounded-lg'>
                <div className='text-sm text-gray-600'>
                  {validConvertedRoutes.length > 0 ? (
                    <div className='space-y-1'>
                      <span className='font-medium text-green-700'>
                        {validConvertedRoutes.length === 1
                          ? 'Arquivo processado com sucesso'
                          : `${validConvertedRoutes.length} rotas válidas processadas`}
                      </span>
                      <div className='text-xs'>
                        {validConvertedRoutes.length === 1
                          ? 'Rota carregada e pronta para ser salva'
                          : 'Todas as rotas validas serao desenhadas, salvas separadamente e agrupadas pela fazenda'}
                      </div>
                    </div>
                  ) : (
                    <span>Aguardando upload de arquivos KML</span>
                  )}
                  {convertionFileErrors.length > 0 && (
                    <div className='mt-2'>
                      <span className='text-red-600 font-medium'>
                        {convertionFileErrors.length}{' '}
                        {convertionFileErrors.length > 1 ? 'erros ' : 'erro '}
                        encontrado{convertionFileErrors.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
