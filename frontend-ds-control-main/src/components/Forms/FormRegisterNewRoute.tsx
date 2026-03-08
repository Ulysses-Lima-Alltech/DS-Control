'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight, Route as RouteIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { useCreateRoute } from '@/mutations/route.mutation';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetAllFarms } from '@/queries/farm.query';
import type { Customer } from '@/types/customer.type';
import type { Farm } from '@/types/farm.type';

type FormRegisterNewRouteProps = {
  customer?: Customer;
  farm?: Farm;
  closeDialog: () => void;
};

export default function FormRegisterNewRoute({
  customer,
  farm,
  closeDialog,
}: FormRegisterNewRouteProps) {
  const queryClient = useQueryClient();
  const [routeGeoJson, setRouteGeoJson] = useState<Record<string, unknown> | null>(null);
  const [convertionFileErrors, setConvertionFileErrors] = useState<string[]>([]);
  const [isConvertionFileErrorsOpen, setIsConvertionFileErrorsOpen] = useState(true);
  const inputRouteNameRef = useRef<HTMLInputElement>(null);

  const NewRouteFormSchema = z.object({
    customerId: z.string().min(1, { message: 'Cliente é obrigatório' }),
    farmId: z.string().min(1, { message: 'Fazenda é obrigatória' }),
    name: z.string().min(1, { message: 'Nome é obrigatório' }),
  });

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
    register,
    handleSubmit,
    formState: { errors },
    control,
    setValue,
    watch,
  } = useForm<z.infer<typeof NewRouteFormSchema>>({
    resolver: zodResolver(NewRouteFormSchema),
    defaultValues: {
      customerId: customer?.id ?? '',
      farmId: farm?.id ?? '',
    },
  });

  const selectedCustomerId = watch('customerId');

  const { data: farms } = useGetAllFarms(selectedCustomerId, {
    limit: '100',
  });

  const filteredFarms = useMemo(() => {
    if (!farms?.data) return [];

    if (!farmSearch.trim()) return farms.data;

    return farms.data.filter((f) => f.name.toLowerCase().includes(farmSearch.toLowerCase()));
  }, [farms?.data, farmSearch]);

  const { mutate: createRoute, isPending: isCreatingRoute } = useCreateRoute({
    onSuccess: () => {
      toast('Rota criada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast(`[FormRegisterNewRoute] ${error.message}`);
      console.error('[FormRegisterNewRoute] Error: ', error);
    },
  });

  const onSubmit = (data: z.infer<typeof NewRouteFormSchema>) => {
    if (!routeGeoJson) {
      toast('Arquivo de rota inválido!');
      return;
    }

    createRoute({ ...data, geoJson: routeGeoJson });
  };

  return (
    <div className='max-w-7xl h-[600px] p-0'>
      <form onSubmit={handleSubmit(onSubmit)} className='h-full'>
        <div className='grid grid-cols-1 lg:grid-cols-2 h-full gap-6 p-6'>
          <Card className='h-full m-0 flex flex-col'>
            <CardHeader className='flex-shrink-0'>
              <CardTitle>Informações da Rota</CardTitle>
              <CardDescription>Preencha os dados da nova rota</CardDescription>
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

                <div className='space-y-2'>
                  <Label htmlFor='routeName'>Nome da rota</Label>
                  <Input
                    id='routeName'
                    type='text'
                    placeholder='Digite o nome da rota'
                    {...register('name')}
                    className='w-full'
                    ref={inputRouteNameRef}
                    onChange={(e) => {
                      setValue('name', e.target.value);
                    }}
                  />
                  {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
                </div>

                <div className='space-y-2'>
                  <Label>Arquivo KML</Label>
                  <InputRouteFile
                    changeGeoJson={setRouteGeoJson}
                    setConvertErrors={(errors) => {
                      setConvertionFileErrors(errors);
                      setRouteGeoJson(null);
                    }}
                    setFileName={(fileName) => {
                      if (inputRouteNameRef.current?.value === '') {
                        inputRouteNameRef.current!.value = fileName;
                        setValue('name', fileName);
                      }
                    }}
                  />
                </div>

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
                                <li key={index} className='text-red-700'>
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
                disabled={!routeGeoJson || isCreatingRoute || convertionFileErrors.length > 0}
              >
                {isCreatingRoute ? 'Criando rota...' : 'Criar rota'}
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
                <MapViewer geoData={routeGeoJson ? (routeGeoJson as any) : undefined} />
              </div>
              <div className='flex-shrink-0 p-3 bg-gray-50 rounded-lg'>
                <div className='text-sm text-gray-600'>
                  {routeGeoJson ? (
                    <div className='space-y-1'>
                      <span className='font-medium text-green-700'>
                        ✓ Arquivo processado com sucesso
                      </span>
                      <div className='text-xs'>Rota carregada e pronta para ser salva</div>
                    </div>
                  ) : (
                    <span>Aguardando upload do arquivo KML</span>
                  )}
                  {convertionFileErrors.length > 0 && (
                    <div className='mt-2'>
                      <span className='text-red-600 font-medium'>
                        ⚠ {convertionFileErrors.length}{' '}
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
