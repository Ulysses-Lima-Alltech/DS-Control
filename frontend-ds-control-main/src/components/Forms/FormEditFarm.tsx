'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import InputFarmFile from '@/components/InputFarmFile';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useEditFarmById } from '@/mutations/farm.mutation';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetFarmById } from '@/queries/farm.query';
import type { Plot } from '@/types/plot.type';
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from '@/utils/map-utils';

type FormEditFarmProps = {
  farmId: string;
  closeDialog: () => void;
};

export default function FormEditFarm({ farmId, closeDialog }: FormEditFarmProps) {
  const queryClient = useQueryClient();
  const [farmGeojson, setFarmGeojson] = useState<Plot[] | null>(null);
  const [convertionFileErrors, setConvertionFileErrors] = useState<string[]>([]);
  const [isConvertionFileErrorsOpen, setIsConvertionFileErrorsOpen] = useState(true);
  const inputFarmNameRef = useRef<HTMLInputElement>(null);

  const { data: farmData, isLoading: isLoadingFarmData } = useGetFarmById(farmId, {
    includePlots: 'true',
    includeGeoJson: 'true',
    includeCustomer: 'true',
  });

  const EditFarmFormSchema = z.object({
    customerId: z.string().min(1, { message: 'Cliente é obrigatório' }),
    name: z.string().min(1, { message: 'Nome é obrigatório' }),
  });

  const [customerSearch, setCustomerSearch] = useState('');

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
  } = useForm<z.infer<typeof EditFarmFormSchema>>({
    resolver: zodResolver(EditFarmFormSchema),
    defaultValues: {
      customerId: farmData?.farm.customer.id,
      name: farmData?.farm.name,
    },
  });

  useEffect(() => {
    if (!farmData?.farm) return;
    setFarmGeojson(farmData.farm.plots.filter((plot) => plot.deletedAt === null));
    setValue('customerId', farmData.farm.customer.id);
    setValue('name', farmData.farm.name);
  }, [farmData]);

  const { mutate: editFarm, isPending: isEditingFarm } = useEditFarmById({
    onSuccess: () => {
      toast('Fazenda editada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast(`[FormEditFarm] ${error.message}`);
      console.error('[FormEditFarm] Error: ', error);
    },
  });

  const onSubmit = (data: z.infer<typeof EditFarmFormSchema>) => {
    if (!farmGeojson) {
      toast('Geojson inválido!');
      return;
    }

    editFarm({
      farmId: farmId,
      data: { ...data, plots: farmGeojson },
    });
  };

  useEffect(() => {
    if (inputFarmNameRef.current) {
      inputFarmNameRef.current.value = farmData?.farm.name || '';
    }
  }, [farmData?.farm.name]);

  return (
    <div className='max-w-7xl h-[600px] p-0'>
      <form onSubmit={handleSubmit(onSubmit)} className='h-full'>
        <div className='grid grid-cols-1 lg:grid-cols-2 h-full gap-6 p-6'>
          <Card className='h-full m-0 flex flex-col'>
            <CardHeader className='flex-shrink-0'>
              <CardTitle>Editar Fazenda sdadasd</CardTitle>
              <CardDescription>Atualize os dados da fazenda</CardDescription>
            </CardHeader>

            {isLoadingFarmData ? (
              <CardContent className='flex-1 flex flex-col space-y-4 overflow-hidden'>
                <div className='flex flex-col h-full space-y-2'>
                  <Skeleton className='h-6 w-40' />
                  <Skeleton className='h-8 w-full' />
                  <Skeleton className='h-6 w-40' />
                  <Skeleton className='h-8 w-full' />
                  <Skeleton className='h-40 w-full' />
                </div>
              </CardContent>
            ) : (
              <CardContent className='flex-1 flex flex-col space-y-4 overflow-hidden'>
                <div className='space-y-2'>
                  <Label>Cliente</Label>
                  <Controller
                    name='customerId'
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ''}>
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
                  <Label htmlFor='farmName'>Nome da fazenda</Label>
                  <Input
                    id='farmName'
                    type='text'
                    placeholder='Digite o nome da fazenda'
                    {...register('name')}
                    className='w-full'
                    ref={inputFarmNameRef}
                    onChange={(e) => {
                      setValue('name', e.target.value);
                    }}
                  />
                  {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
                </div>

                <div className='space-y-2'>
                  <Label>Arquivo KML (opcional)</Label>
                  <InputFarmFile
                    changePlots={setFarmGeojson}
                    setConvertErrors={(errors) => {
                      setConvertionFileErrors(errors);
                      if (errors.length > 0) {
                        if (!farmData?.farm.plots) {
                          return;
                        }
                        setFarmGeojson(farmData?.farm.plots);
                      }
                    }}
                    setFileName={(fileName) => {
                      if (inputFarmNameRef.current?.value === '') {
                        inputFarmNameRef.current!.value = fileName;
                        setValue('name', fileName);
                      }
                    }}
                  />
                  <p className='text-sm text-gray-600'>
                    Deixe em branco para manter os talhões atuais
                  </p>
                </div>

                <div className='flex-1 flex flex-col min-h-0'>
                  {convertionFileErrors.length > 0 && (
                    <Collapsible
                      open={isConvertionFileErrorsOpen}
                      onOpenChange={setIsConvertionFileErrorsOpen}
                      className='flex-1 flex flex-col min-h-0'
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          type='button'
                          variant='ghost'
                          className='w-full justify-between p-3 h-auto text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors flex-shrink-0'
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
                      <CollapsibleContent className='mt-2 flex-1 min-h-0'>
                        <div className='p-3 bg-red-50 border border-red-200 rounded-md h-full flex flex-col'>
                          <div className='text-red-600 text-sm flex flex-col h-full'>
                            <p className='font-medium mb-2 flex-shrink-0'>
                              Foram identificados esses erros:
                            </p>
                            <div className='overflow-y-auto flex-1 min-h-0'>
                              <ul className='list-disc list-inside space-y-1'>
                                {convertionFileErrors.map((error, index) => (
                                  <li key={index} className='text-red-700'>
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </CardContent>
            )}
            <div className='flex-shrink-0 p-6 pt-0'>
              <Button
                type='submit'
                className='w-full'
                disabled={
                  !farmGeojson ||
                  isLoadingFarmData ||
                  isEditingFarm ||
                  convertionFileErrors.length > 0
                }
              >
                {isEditingFarm ? 'Salvando alterações...' : 'Salvar alterações'}
              </Button>
            </div>
          </Card>

          <Card className='h-full m-0 flex flex-col'>
            <CardHeader className='flex-shrink-0'>
              <CardTitle className='flex items-center space-x-2'>
                <MapPin className='h-5 w-5' />
                <span>Localização da Fazenda</span>
              </CardTitle>
              <CardDescription>Visualização geográfica da propriedade</CardDescription>
            </CardHeader>
            <CardContent className='flex-1 flex flex-col p-4 min-h-0'>
              <div className='flex-1 overflow-hidden rounded-lg border mb-4'>
                {isLoadingFarmData ? (
                  <div className='flex items-center justify-center h-full'>
                    <Skeleton className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></Skeleton>
                  </div>
                ) : (
                  <MapViewer
                    geoData={
                      farmGeojson
                        ? convertDatabasePlotsToMapViewerPlotsFeatureCollection(farmGeojson)
                        : undefined
                    }
                  />
                )}
              </div>
              <div className='flex-shrink-0 p-3 bg-gray-50 rounded-lg'>
                <div className='text-sm text-gray-600'>
                  {farmGeojson ? (
                    <div className='space-y-1'>
                      <span className='font-medium text-green-700'>✓ Talhões carregados</span>
                      <div className='text-xs'>
                        {farmGeojson.length} {farmGeojson.length > 1 ? 'talhões ' : 'talhão '}
                        {convertionFileErrors.length === 0 ? 'configurado' : 'identificado'}
                        {farmGeojson.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  ) : (
                    <span>Nenhum talhão configurado</span>
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
