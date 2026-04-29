import {
  CalendarDays,
  Droplets,
  Layers,
  MapPin,
  Plane,
  Ruler,
  SprayCan,
  Sprout,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import MapViewer from '@/components/MapViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGetApplicationsByFarmId } from '@/queries/application.query';
import { useGetFarmById } from '@/queries/farm.query';
import { Plot } from '@/types/plot.type';
import { formatApplicationDate } from '@/utils/application-date-formatter';
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from '@/utils/map-utils';
import { formatTimestamp } from '@/utils/timestamp-formatter';

import 'mapbox-gl/dist/mapbox-gl.css';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';

type DialogPlotDetailsProps = {
  farmId: string;
  plotId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type SubDivision = {
  id: number;
  geometryType: string;
  properties: Record<string, unknown>;
  coordinates: unknown;
  area?: number;
};

export default function DialogPlotDetails({
  farmId,
  plotId,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: DialogPlotDetailsProps) {
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [selectedPlotFilter, setSelectedPlotFilter] = useState<string | undefined>(plotId);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isOpen = externalOpen !== undefined ? externalOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;

  const { data, isLoading: isLoadingFarm } = useGetFarmById(
    farmId,
    {
      includePlots: 'true',
      includeGeoJson: 'true',
      includeCustomer: 'true',
    },
    {
      queryKey: ['farm', 'details', farmId],
      enabled: isOpen,
    }
  );

  const { data: applicationData, isLoading: isLoadingApplications } = useGetApplicationsByFarmId(
    data?.farm?.id || '',
    {
      enabled: isOpen,
    }
  );

  useEffect(() => {
    setSelectedPlot(data?.farm?.plots.find((plot) => plot.id === plotId) ?? null);
  }, [data?.farm?.plots, plotId]);

  const plotOptions = useMemo(() => {
    if (!data?.farm?.plots) return [];
    return data.farm.plots
      .filter((plot) => !plot.deletedAt && plot.id)
      .map((plot) => ({
        value: plot.id!,
        label: plot.name,
      }));
  }, [data?.farm?.plots]);

  const filteredPlotForDetails = useMemo(() => {
    if (!selectedPlotFilter) return selectedPlot;
    return data?.farm?.plots.find((plot) => plot.id === selectedPlotFilter) || selectedPlot;
  }, [selectedPlotFilter, selectedPlot, data?.farm?.plots]);

  const filteredApplications = useMemo(() => {
    if (!applicationData?.data) return [];
    if (!selectedPlotFilter) return applicationData.data;
    return applicationData.data.filter((app) => app.plotId === selectedPlotFilter);
  }, [applicationData?.data, selectedPlotFilter]);

  const plotStats = useMemo(() => {
    if (!filteredPlotForDetails?.geoJson) return null;

    const features = filteredPlotForDetails.geoJson.features || [];
    const totalFeatures = features.length;

    const subDivisions: SubDivision[] = features.map((feature, index) => {
      const properties = feature.properties || {};

      let area: number | undefined;
      let coordinates: unknown = null;

      if ('coordinates' in feature.geometry) {
        coordinates = feature.geometry.coordinates;

        if (feature.geometry.type === 'Polygon') {
          const polygonCoords = feature.geometry.coordinates[0];
          if (polygonCoords && polygonCoords.length > 3) {
            let sum = 0;
            for (let i = 0; i < polygonCoords.length - 1; i++) {
              sum +=
                polygonCoords[i][0] * polygonCoords[i + 1][1] -
                polygonCoords[i + 1][0] * polygonCoords[i][1];
            }
            area = Math.abs(sum / 2);
          }
        }
      }

      return {
        id: index + 1,
        geometryType: feature.geometry.type,
        properties,
        coordinates,
        area,
      };
    });

    const geometryTypes = subDivisions.reduce(
      (acc, sub) => {
        acc[sub.geometryType] = (acc[sub.geometryType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalEstimatedArea = subDivisions
      .filter((sub) => sub.area)
      .reduce((sum, sub) => sum + (sub.area || 0), 0);

    return {
      totalFeatures,
      subDivisions,
      geometryTypes,
      totalEstimatedArea,
      hasGeometry: totalFeatures > 0,
    };
  }, [filteredPlotForDetails]);

  const formatHectares = (hectare: string | undefined) => {
    if (!hectare) return 'N/A';
    const numValue = parseFloat(hectare);
    return isNaN(numValue)
      ? hectare
      : `${numValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant='outline' size='icon' className='h-8 w-8'>
              <MapPin className='h-4 w-4' />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Ver detalhes do talhão</TooltipContent>
      </Tooltip>

      <DialogContent className='sm:max-w-6xl h-[90vh] max-h-[90vh] w-11/12 max-w-[90vw] flex flex-col'>
        <DialogHeader className='flex-shrink-0'>
          <DialogTitle className='text-2xl font-semibold flex items-center gap-2'>
            <MapPin className='h-6 w-6 text-primary' />
            {selectedPlot ? `Talhão: ${selectedPlot.name}` : 'Detalhes do Talhão'}
          </DialogTitle>
          {data?.farm && (
            <CardDescription className='text-base'>
              Fazenda: {data?.farm.name} | Cliente: {data?.farm.customer.name}
            </CardDescription>
          )}
        </DialogHeader>

        <div className='flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0'>
          <div className='lg:col-span-2 flex flex-col min-h-0'>
            <Card className='flex-1 flex flex-col min-h-0'>
              <CardHeader className='flex-shrink-0'>
                <CardTitle className='text-lg'>Visualização do Mapa</CardTitle>
                <CardDescription>
                  {selectedPlot
                    ? `Visualizando: ${selectedPlot.name} (${plotStats?.totalFeatures || 0} sub-talhões)`
                    : 'Clique em um talhão para ver os detalhes'}
                </CardDescription>
              </CardHeader>
              <CardContent className='flex-1 p-0 min-h-0'>
                <div className='h-full rounded-b-lg overflow-hidden'>
                  {isLoadingFarm ? (
                    <div className='flex items-center justify-center h-full'>
                      <Skeleton className='h-full w-full text-muted-foreground dark:text-muted-foreground m-4' />
                    </div>
                  ) : (
                    <MapViewer
                      layerNameToHighlight={selectedPlot?.name}
                      geoData={
                        data?.farm?.plots
                          ? convertDatabasePlotsToMapViewerPlotsFeatureCollection(
                              data?.farm?.plots.filter((plot) => !plot.deletedAt)
                            )
                          : undefined
                      }
                      onPlotClick={(plotId) => {
                        const plot = data?.farm?.plots.find((p) => p.id === plotId);
                        setSelectedPlot(plot ?? null);
                        setSelectedPlotFilter(plot?.id);
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className='lg:col-span-1 flex flex-col min-h-0 space-y-4'>
            {data?.farm && plotOptions.length > 0 && (
              <div>
                <SearchableSelect
                  options={plotOptions}
                  value={selectedPlotFilter}
                  onValueChange={(plotId) => {
                    setSelectedPlotFilter(plotId);
                    if (plotId) {
                      const plot = data?.farm?.plots.find((p) => p.id === plotId);
                      if (plot) setSelectedPlot(plot);
                    } else {
                      setSelectedPlot(null);
                    }
                  }}
                  placeholder='Selecionar talhão...'
                  emptyText='Nenhum talhão encontrado'
                  searchPlaceholder='Buscar talhão...'
                  className='w-full'
                  clearable
                />
              </div>
            )}

            <Tabs defaultValue='applications' className='flex-1 flex flex-col min-h-0'>
              <TabsList className='flex-shrink-0 w-full justify-between'>
                <TabsTrigger value='applications' className='flex items-center gap-2 w-full'>
                  <SprayCan className='h-4 w-4' />
                  Aplicações
                </TabsTrigger>
                <TabsTrigger value='details' className='flex items-center gap-2 w-full'>
                  <MapPin className='h-4 w-4' />
                  Detalhes
                </TabsTrigger>
              </TabsList>

              <TabsContent value='applications' className='flex-1 flex flex-col min-h-0 mt-4'>
                <Card className='flex-1 flex flex-col min-h-0 overflow-y-auto'>
                  <CardHeader className='flex-shrink-0'>
                    <CardTitle className='text-lg'>Histórico de Aplicações</CardTitle>
                    <CardDescription>
                      {isLoadingApplications
                        ? 'Carregando aplicações...'
                        : selectedPlotFilter
                          ? `${filteredApplications.length} aplicações encontradas para o talhão selecionado`
                          : `${applicationData?.data?.length || 0} aplicações encontradas para esta fazenda`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='flex-1'>
                    {isLoadingApplications ? (
                      Array.from({ length: 3 }).map((_, idx) => (
                        <Skeleton key={idx} className='h-25 w-full mb-4' />
                      ))
                    ) : filteredApplications.length === 0 ? (
                      <div className='flex items-center justify-center h-full'>
                        <div className='text-center text-muted-foreground'>
                          <SprayCan className='h-12 w-12 mx-auto mb-4 opacity-50' />
                          <p className='text-lg font-medium mb-2'>Nenhuma aplicação encontrada</p>
                          <p className='text-sm'>
                            {selectedPlotFilter
                              ? 'Não há histórico de aplicações para este talhão'
                              : 'Não há histórico de aplicações para esta fazenda'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className='space-y-3'>
                        {filteredApplications.map((application) => (
                          <Card
                            key={application.id}
                            className='border-muted from-background to-muted/20'
                          >
                            <CardContent className='pt-4 pb-3'>
                              <div className='space-y-3'>
                                <div className='space-y-2'>
                                  <div className='flex items-start gap-2'>
                                    <div className='p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0'>
                                      <Droplets className='w-4 h-4 text-emerald-600 dark:text-emerald-400' />
                                    </div>
                                    <div className='flex-1'>
                                      <h4 className='font-semibold text-sm break-words'>
                                        {application.product.name}
                                      </h4>
                                      <div className='flex items-center gap-1.5 mt-1'>
                                        <MapPin className='w-3 h-3 text-muted-foreground flex-shrink-0' />
                                        <p className='text-xs text-muted-foreground break-words'>
                                          {application.plot?.name || 'Talhão não especificado'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className='flex items-center gap-1.5 text-xs text-muted-foreground pl-11'>
                                    <CalendarDays className='w-3 h-3 flex-shrink-0' />
                                    <span>
                                      {formatApplicationDate(application.date)}
                                    </span>
                                  </div>
                                </div>

                                <div className='grid grid-cols-1 gap-2'>
                                  <div className='bg-blue-50 dark:bg-blue-950/20 rounded-lg p-2.5 border border-blue-200 dark:border-blue-900'>
                                    <div className='flex items-center gap-2'>
                                      <div className='p-1 rounded bg-blue-100 dark:bg-blue-900/50 flex-shrink-0'>
                                        <Ruler className='w-3 h-3 text-blue-600 dark:text-blue-400' />
                                      </div>
                                      <div className='flex-1'>
                                        <p className='text-xs text-muted-foreground'>Área</p>
                                        <p className='text-sm font-semibold text-blue-600 dark:text-blue-400 break-words'>
                                          {application.hectares} ha
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className='bg-purple-50 dark:bg-purple-950/20 rounded-lg p-2.5 border border-purple-200 dark:border-purple-900'>
                                    <div className='flex items-center gap-2'>
                                      <div className='p-1 rounded bg-purple-100 dark:bg-purple-900/50 flex-shrink-0'>
                                        <User className='w-3 h-3 text-purple-600 dark:text-purple-400' />
                                      </div>
                                      <div className='flex-1'>
                                        <p className='text-xs text-muted-foreground'>Piloto</p>
                                        <p className='text-sm font-semibold text-purple-600 dark:text-purple-400 break-words'>
                                          {application.pilot.name.split(' ')[0]}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className='bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 border border-amber-200 dark:border-amber-900'>
                                    <div className='flex items-center gap-2'>
                                      <div className='p-1 rounded bg-amber-100 dark:bg-amber-900/50 flex-shrink-0'>
                                        <Plane className='w-3 h-3 text-amber-600 dark:text-amber-400' />
                                      </div>
                                      <div className='flex-1'>
                                        <p className='text-xs text-muted-foreground'>Drone</p>
                                        <p className='text-sm font-semibold text-amber-600 dark:text-amber-400 break-words'>
                                          {application.drone.name}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className='bg-green-50 dark:bg-green-950/20 rounded-lg p-2.5 border border-green-200 dark:border-green-900'>
                                    <div className='flex items-center gap-2'>
                                      <div className='p-1 rounded bg-green-100 dark:bg-green-900/50 flex-shrink-0'>
                                        <Sprout className='w-3 h-3 text-green-600 dark:text-green-400' />
                                      </div>
                                      <div className='flex-1'>
                                        <p className='text-xs text-muted-foreground'>Cultura</p>
                                        <p className='text-sm font-semibold text-green-600 dark:text-green-400 break-words'>
                                          {application.culture.name}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {application.observations && (
                                  <div className='flex items-start gap-2'>
                                    <span className='text-xs font-medium text-muted-foreground mt-1'>
                                      Observações:
                                    </span>
                                    <p className='text-xs text-foreground mt-1 flex-1'>
                                      {application.observations}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='details' className='flex-1 flex flex-col min-h-0 mt-4'>
                <div className='flex-1 overflow-y-auto space-y-4'>
                  {!filteredPlotForDetails && (
                    <Card>
                      <CardContent className='pt-6'>
                        <div className='text-center text-muted-foreground'>
                          <MapPin className='h-12 w-12 mx-auto mb-4 opacity-50' />
                          <p className='text-lg font-medium mb-2'>Selecione um Talhão</p>
                          <p className='text-sm'>
                            Selecione um talhão no filtro acima ou clique no mapa para ver os
                            detalhes
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {filteredPlotForDetails && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className='text-lg flex items-center gap-2'>
                            <Ruler className='h-5 w-5 text-primary' />
                            Informações Básicas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                          <div className='space-y-3'>
                            <div className='flex justify-between items-center py-2'>
                              <span className='text-sm font-medium'>Nome</span>
                              <span className='text-sm text-muted-foreground font-mono'>
                                {filteredPlotForDetails.name}
                              </span>
                            </div>

                            <div className='flex justify-between items-center py-2'>
                              <span className='text-sm font-medium'>Área</span>
                              <span className='text-sm font-semibold text-primary'>
                                {formatHectares(filteredPlotForDetails.hectare)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {data?.farm && (
                        <Card>
                          <CardHeader>
                            <CardTitle className='text-lg flex items-center gap-2'>
                              <User className='h-5 w-5 text-primary' />
                              Propriedade
                            </CardTitle>
                          </CardHeader>
                          <CardContent className='space-y-4'>
                            <div className='space-y-3'>
                              <div className='flex justify-between items-center py-2'>
                                <span className='text-sm font-medium'>Fazenda</span>
                                <span className='text-sm text-muted-foreground'>
                                  {data.farm.name}
                                </span>
                              </div>

                              <div className='flex justify-between items-center py-2'>
                                <span className='text-sm font-medium'>Cliente</span>
                                <span className='text-sm text-muted-foreground'>
                                  {data.farm.customer.name}
                                </span>
                              </div>

                              <div className='flex justify-between items-center py-2'>
                                <span className='text-sm font-medium'>Total de Talhões</span>
                                <span className='text-sm text-muted-foreground'>
                                  {data.farm.plots.length}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {plotStats && plotStats.subDivisions.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className='text-lg flex items-center gap-2'>
                              <Layers className='h-5 w-5 text-primary' />
                              Sub-talhões ({plotStats.totalFeatures})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className='space-y-4'>
                            <div className='space-y-3'>
                              <div className='flex justify-between items-center py-2'>
                                <span className='text-sm font-medium'>Total</span>
                                <span className='text-sm text-muted-foreground font-semibold'>
                                  {plotStats.totalFeatures}
                                </span>
                              </div>
                            </div>

                            <Separator />

                            <div>
                              <h4 className='text-sm font-medium text-muted-foreground mb-3'>
                                Detalhes das Sub-talhões
                              </h4>
                              <div className='space-y-3'>
                                {plotStats.subDivisions.map((subDiv) => (
                                  <Card key={subDiv.id} className='border-muted'>
                                    <CardContent className='pt-4 pb-3'>
                                      <div className='space-y-2'>
                                        <div className='flex justify-between items-center'>
                                          <span className='text-sm font-medium flex items-center gap-1'>
                                            🔶 Sub-divisão #{subDiv.id}
                                          </span>
                                        </div>

                                        {subDiv.area && (
                                          <div className='flex justify-between items-center'>
                                            <span className='text-xs text-muted-foreground'>
                                              Área
                                            </span>
                                            <span className='text-xs'>
                                              {formatHectares(subDiv.properties.hectare as string)}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle className='text-lg flex items-center gap-2'>
                            <CalendarDays className='h-5 w-5 text-primary' />
                            Informações do Sistema
                          </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                          <div className='space-y-3'>
                            {filteredPlotForDetails.createdAt && (
                              <div className='flex justify-between items-center py-2'>
                                <span className='text-sm font-medium'>Data de Criação</span>
                                <span className='text-sm text-muted-foreground'>
                                  {formatTimestamp(filteredPlotForDetails.createdAt)}
                                </span>
                              </div>
                            )}

                            {filteredPlotForDetails.updatedAt && (
                              <div className='flex justify-between items-center py-2'>
                                <span className='text-sm font-medium'>Última Atualização</span>
                                <span className='text-sm text-muted-foreground'>
                                  {formatTimestamp(filteredPlotForDetails.updatedAt)}
                                </span>
                              </div>
                            )}

                            {filteredPlotForDetails.id && (
                              <div className='flex justify-between items-center py-2'>
                                <span className='text-sm font-medium'>ID Sistema</span>
                                <span className='text-xs text-muted-foreground font-mono text-right'>
                                  {filteredPlotForDetails.id}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
