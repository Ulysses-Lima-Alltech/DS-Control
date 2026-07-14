'use client';

import type { GeoJSON } from 'geojson';
import { CheckCircle, Eye, FileText, Pencil, XCircle } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditServiceOrder from '@/components/Forms/FormEditServiceOrder';
import MapViewer from '@/components/MapViewer';
import { TableApplications } from '@/components/Tables/TableApplications';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useCancelServiceOrderById,
  useCompleteServiceOrderById,
} from '@/mutations/service-order.mutation';
import { useGetApplicationsByServiceOrderId } from '@/queries/application.query';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import { Application } from '@/types/applications.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';
import { convertDatabasePlotsToMapViewerPlotsFeatureCollection } from '@/utils/map-utils';
import { formatOperationalDateBR } from '@/utils/operational-date';
import {
  downloadPDF,
  generateApplicationsReportPDF,
  generateCompletedPlotsPlannedAreaReportPDF,
  generatePendingPlotsReportPDF,
} from '@/utils/pdfGenerator';
import { formatTimestamp } from '@/utils/timestamp-formatter';

type MapFilter = 'all' | 'completed' | 'pending';
type ReportMode = 'all' | 'completed';

export default function ServiceOrderPage({
  params,
}: {
  params: Promise<{ idServiceOrder: string }>;
}) {
  const { idServiceOrder } = use(params);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isMapsModalOpen, setIsMapsModalOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const { data: applicationsData, isPending: isApplicationsLoading } =
    useGetApplicationsByServiceOrderId(idServiceOrder);

  const {
    data: serviceOrderData,
    isPending: isServiceOrderLoading,
    isError: isServiceOrderError,
  } = useGetServiceOrderById(idServiceOrder, {
    includePlots: 'true',
    includeGeoJson: 'true',
    includePilots: 'true',
    includeFarms: 'true',
    includeContracts: 'true',
    includeCustomers: 'true',
  });

  const applications = applicationsData?.data || [];

  const applicationWithPlotData = useMemo(() => {
    if (!serviceOrderData?.plots?.length || applications.length === 0) {
      return applications;
    }

    const plotMap = new Map<string, Plot>();
    serviceOrderData.plots.forEach((plot) => {
      if (plot.id) {
        plotMap.set(plot.id, plot);
      }
    });

    return applications.map((application) => {
      if (!application.plotId) {
        return application;
      }

      const mappedPlot = plotMap.get(application.plotId);
      if (!mappedPlot) {
        return application;
      }

      return {
        ...application,
        plot: mappedPlot,
      };
    });
  }, [applications, serviceOrderData?.plots]);

  const currentServiceOrderApplications = useMemo(() => {
    const applicationsById = new Map<string, Application>();

    applicationWithPlotData.forEach((application) => {
      if (
        application.id &&
        application.serviceOrderId === idServiceOrder &&
        !application.deletedAt
      ) {
        applicationsById.set(application.id, application);
      }
    });

    return Array.from(applicationsById.values());
  }, [applicationWithPlotData, idServiceOrder]);

  const completedPlotIds = useMemo(() => {
    return (serviceOrderData?.plots || [])
      .filter((plot) => plot.status === 'COMPLETED')
      .map((plot) => plot.id)
      .filter(Boolean) as string[];
  }, [serviceOrderData?.plots]);

  const pendingPlotIds = useMemo(
    () =>
      (serviceOrderData?.plots || [])
        .filter((plot) => plot.status === 'PENDING')
        .map((plot) => plot.id)
        .filter(Boolean) as string[],
    [serviceOrderData?.plots]
  );

  const progressData = useMemo(() => {
    const mapasTotal = Number(serviceOrderData?.totalPlots ?? serviceOrderData?.plots?.length ?? 0);
    const mapasConcluidos = Number(serviceOrderData?.completedPlots ?? completedPlotIds.length);
    const areaTotal = Number(serviceOrderData?.plannedHectares || 0);
    const areaConcluida = Number(serviceOrderData?.completedHectares || 0);
    const percentual = Number(serviceOrderData?.progressPercent || 0);

    return {
      mapasTotal,
      mapasConcluidos,
      areaTotal,
      areaConcluida,
      percentual,
    };
  }, [
    completedPlotIds.length,
    serviceOrderData?.completedHectares,
    serviceOrderData?.completedPlots,
    serviceOrderData?.plannedHectares,
    serviceOrderData?.plots,
    serviceOrderData?.progressPercent,
    serviceOrderData?.totalPlots,
  ]);

  const mapsGeoData = useMemo<GeoJSON.FeatureCollection | undefined>(() => {
    if (!serviceOrderData?.plots?.length) {
      return undefined;
    }

    const plotsWithGeo = serviceOrderData.plots.filter((plot) => {
      return Boolean(plot?.geoJson && typeof plot.geoJson === 'object');
    });

    if (plotsWithGeo.length === 0) {
      return undefined;
    }

    try {
      return convertDatabasePlotsToMapViewerPlotsFeatureCollection(
        plotsWithGeo,
        serviceOrderData.farms || []
      );
    } catch {
      return undefined;
    }
  }, [serviceOrderData?.farms, serviceOrderData?.plots]);

  const filteredMapGeoData = useMemo<GeoJSON.FeatureCollection | undefined>(() => {
    if (!mapsGeoData) {
      return undefined;
    }

    if (mapFilter === 'all') {
      return mapsGeoData;
    }

    const allowedIds = new Set(mapFilter === 'completed' ? completedPlotIds : pendingPlotIds);

    return {
      ...mapsGeoData,
      features: mapsGeoData.features.filter((feature) => {
        const featurePlotId = (feature.properties as { plot_id?: string } | null | undefined)
          ?.plot_id;
        if (!featurePlotId) {
          return false;
        }
        return allowedIds.has(String(featurePlotId));
      }),
    };
  }, [completedPlotIds, mapFilter, mapsGeoData, pendingPlotIds]);

  const legendData = useMemo(() => {
    if (mapFilter === 'completed') {
      const byFarm = new Map<string, { id: string; name: string; hectares: number }>();

      (serviceOrderData?.plots || []).forEach((plot) => {
        if (!plot.id || !completedPlotIds.includes(plot.id)) return;
        const farmId = plot.farmId || 'farm-unknown';
        const applicationFarm = serviceOrderData?.farms?.find((farm) => farm.id === farmId);
        const farmName = applicationFarm?.name || 'Fazenda sem nome';
        const current = byFarm.get(farmId) || { id: farmId, name: farmName, hectares: 0 };
        current.hectares += Number.parseFloat(plot.hectare || '0') || 0;
        byFarm.set(farmId, current);
      });

      const farms = Array.from(byFarm.values()).sort((a, b) => b.hectares - a.hectares);
      const total = farms.reduce((sum, item) => sum + item.hectares, 0);

      return { farms, total };
    }

    const allowedIds = mapFilter === 'all' ? null : new Set(pendingPlotIds);

    const byFarm = new Map<string, { id: string; name: string; hectares: number }>();

    (serviceOrderData?.plots || []).forEach((plot) => {
      if (mapFilter === 'pending' && (!plot.id || !allowedIds?.has(plot.id))) {
        return;
      }

      const farmId = plot.farmId || 'farm-unknown';
      const farmName =
        serviceOrderData?.farms?.find((farm) => farm.id === farmId)?.name || 'Fazenda sem nome';

      const current = byFarm.get(farmId) || {
        id: farmId,
        name: farmName,
        hectares: 0,
      };
      current.hectares += Number.parseFloat(plot.hectare || '0') || 0;
      byFarm.set(farmId, current);
    });

    const farms = Array.from(byFarm.values()).sort((a, b) => b.hectares - a.hectares);
    const total = farms.reduce((sum, item) => sum + item.hectares, 0);

    return { farms, total };
  }, [
    completedPlotIds,
    mapFilter,
    pendingPlotIds,
    serviceOrderData?.farms,
    serviceOrderData?.plots,
  ]);

  const completedRegisteredArea = useMemo(() => {
    const completedIds = new Set(completedPlotIds);

    return (serviceOrderData?.plots || []).reduce((total, plot) => {
      if (!plot.id || !completedIds.has(plot.id)) {
        return total;
      }

      return total + (Number.parseFloat(plot.hectare || '0') || 0);
    }, 0);
  }, [completedPlotIds, serviceOrderData?.plots]);

  const legendLabels = useMemo(() => {
    if (mapFilter === 'completed') {
      return {
        title: 'Área concluída por fazenda',
        total: 'Área total concluída',
      };
    }

    if (mapFilter === 'pending') {
      return {
        title: 'Área pendente por fazenda',
        total: 'Área pendente total',
      };
    }

    return {
      title: 'Área cadastrada por fazenda',
      total: 'Área cadastrada total',
    };
  }, [mapFilter]);

  const hasApplicationsWithNullPlot = useMemo(() => {
    return applicationWithPlotData.some((application) => !application.plotId);
  }, [applicationWithPlotData]);

  const completeServiceOrderMutation = useCompleteServiceOrderById({
    onSuccess: () => {
      setIsCompleteDialogOpen(false);
      toast.success('Ordem de serviço concluída com sucesso');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao concluir a ordem de serviço');
    },
  });

  const cancelServiceOrderMutation = useCancelServiceOrderById({
    onSuccess: () => {
      setIsCancelDialogOpen(false);
      toast.success('Ordem de serviço cancelada com sucesso');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao cancelar a ordem de serviço');
    },
  });

  const statusMap: Record<
    ServiceOrder['status'],
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    open: { label: 'Aberta', variant: 'secondary' },
    completed: { label: 'Concluída', variant: 'default' },
    cancelled: { label: 'Cancelada', variant: 'destructive' },
  };

  const isActionDisabled = serviceOrderData?.status !== 'open';

  const handleCompleteServiceOrder = () => {
    if (!serviceOrderData) {
      return;
    }
    completeServiceOrderMutation.mutate(serviceOrderData.id);
  };

  const handleCancelServiceOrder = () => {
    if (!serviceOrderData) {
      return;
    }
    cancelServiceOrderMutation.mutate(serviceOrderData.id);
  };

  const buildApplicationsForReport = (mode: ReportMode): Application[] => {
    if (mode === 'all') {
      return currentServiceOrderApplications;
    }

    if (mode === 'completed') {
      return currentServiceOrderApplications.filter((application) =>
        Boolean(application.plotId && completedPlotIds.includes(application.plotId))
      );
    }

    return currentServiceOrderApplications;
  };

  const handleGenerateApplicationsReport = async (mode: ReportMode = 'all') => {
    if (!serviceOrderData) {
      return;
    }

    const reportApplications = buildApplicationsForReport(mode);
    if (reportApplications.length === 0) {
      toast.info('Nao ha aplicacoes para o recorte selecionado');
      return;
    }

    try {
      setIsGeneratingReport(true);

      const blob = await generateApplicationsReportPDF({
        serviceOrder: serviceOrderData,
        applications: reportApplications,
      });

      const suffix = mode === 'all' ? 'geral' : 'concluidos';
      downloadPDF(blob, `relatorio-aplicacoes-os-${serviceOrderData.number}-${suffix}.pdf`);
      toast.success('Relatorio de aplicacao gerado com sucesso');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao gerar relatorio');
      }
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGenerateCompletedPlotsPlannedAreaReport = async () => {
    if (!serviceOrderData) {
      return;
    }

    if (completedPlotIds.length === 0) {
      toast.info('Não há talhões concluídos para gerar o relatório');
      return;
    }

    try {
      setIsGeneratingReport(true);
      const blob = await generateCompletedPlotsPlannedAreaReportPDF({
        serviceOrder: serviceOrderData,
        applications: currentServiceOrderApplications,
        completedPlotIds,
      });

      downloadPDF(blob, `relatorio-area-total-concluida-os-${serviceOrderData.number}.pdf`);
      toast.success('Relatório de Área Total Concluída gerado com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar relatório');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleGeneratePendingPlotsReport = async () => {
    if (!serviceOrderData || pendingPlotIds.length === 0) {
      toast.info('Não há talhões pendentes para gerar o relatório');
      return;
    }
    try {
      setIsGeneratingReport(true);
      const blob = await generatePendingPlotsReportPDF({
        serviceOrder: serviceOrderData,
        pendingPlotIds,
      });
      downloadPDF(blob, `relatorio-talhoes-pendentes-os-${serviceOrderData.number}.pdf`);
      toast.success('Relatório de talhões pendentes gerado com sucesso');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar relatório');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (isServiceOrderLoading) {
    return <ServiceOrderDetailsSkeleton />;
  }

  if (isServiceOrderError || !serviceOrderData) {
    return (
      <div className='p-6'>
        <Card className='border-destructive/40'>
          <CardHeader>
            <CardTitle className='text-destructive'>Erro ao carregar OS</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground'>
              Não foi possível carregar os dados da ordem de serviço.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6 p-6'>
      <div className='space-y-2'>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href='/dashboard/service-orders'>Ordens de Serviço</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>OS #{serviceOrderData.number}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div>
          <h1 className='text-2xl font-bold'>Detalhes da Ordem de Serviço</h1>
          <p className='text-muted-foreground'>Acompanhe progresso, dados e aplicações da OS.</p>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Progressos da Ordem de Serviço</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-3'>
              <MetricItem label='Mapas' value={String(progressData.mapasTotal)} />
              <MetricItem
                label='Total em hectares'
                value={`${progressData.areaTotal.toFixed(2).replace('.', ',')} ha`}
              />
              <MetricItem
                label='Concluído'
                value={`${progressData.mapasConcluidos}/${progressData.mapasTotal || 0}`}
              />
              <MetricItem
                label='Total concluído'
                value={`${progressData.areaConcluida.toFixed(2).replace('.', ',')} ha`}
              />
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Progresso</span>
                <span className='font-semibold'>
                  {progressData.percentual.toFixed(1).replace('.', ',')}%
                </span>
              </div>
              <Progress value={Math.min(progressData.percentual, 100)} className='h-2.5' />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Detalhes da OS</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              <InfoRow label='Número' value={`#${serviceOrderData.number}`} />
              <InfoRow
                label='Status'
                value={
                  <Badge variant={statusMap[serviceOrderData.status].variant}>
                    {statusMap[serviceOrderData.status].label}
                  </Badge>
                }
              />
              <InfoRow label='Cliente' value={serviceOrderData.customer?.name || 'N/A'} />
              <InfoRow label='Contrato' value={serviceOrderData.contract?.name || 'N/A'} />
              <InfoRow
                label='Data Planejada'
                value={formatOperationalDateBR(serviceOrderData.plannedDate)}
              />
              <InfoRow label='Criado em' value={formatTimestamp(serviceOrderData.createdAt)} />
            </div>
            <InfoRow
              label='Fazendas'
              value={
                serviceOrderData.farms?.length ? (
                  <div className='flex flex-wrap gap-1'>
                    {serviceOrderData.farms.map((farm) => (
                      <Badge key={farm.id} variant='outline'>
                        {farm.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow
              label='Pilotos'
              value={
                serviceOrderData.pilots?.length ? (
                  <div className='flex flex-wrap gap-1'>
                    {serviceOrderData.pilots.map((pilot) => (
                      <Badge key={pilot.id} variant='outline'>
                        {pilot.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow label='Observação' value={serviceOrderData.observation || 'N/A'} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className='flex flex-wrap items-center gap-2 p-4'>
          <Button variant='outline' onClick={() => setIsMapsModalOpen(true)}>
            <Eye className='mr-2 h-4 w-4' />
            Visualizar Mapas
          </Button>

          <DialogForm
            form={
              <FormEditServiceOrder
                serviceOrderId={serviceOrderData.id}
                onSuccess={() => setIsEditDialogOpen(false)}
              />
            }
            trigger={
              <Button variant='outline' disabled={isActionDisabled}>
                <Pencil className='mr-2 h-4 w-4' />
                Editar OS
              </Button>
            }
            className='sm:max-w-6xl h-[700px] max-h-[90vh] flex flex-col'
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
          />

          {hasApplicationsWithNullPlot ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button variant='outline' className='border-green-600 text-green-600' disabled>
                    <CheckCircle className='mr-2 h-4 w-4' />
                    Concluir OS
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>Ainda há aplicações sem talhão vinculado</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant='outline'
              className='border-green-600 text-green-600 hover:bg-green-50'
              disabled={isActionDisabled}
              onClick={() => setIsCompleteDialogOpen(true)}
            >
              <CheckCircle className='mr-2 h-4 w-4' />
              Concluir OS
            </Button>
          )}

          <Button
            variant='outline'
            className='border-red-600 text-red-600 hover:bg-red-50'
            disabled={isActionDisabled}
            onClick={() => setIsCancelDialogOpen(true)}
          >
            <XCircle className='mr-2 h-4 w-4' />
            Cancelar OS
          </Button>

          <Button
            variant='outline'
            disabled={isGeneratingReport || serviceOrderData.status === 'cancelled'}
            onClick={() =>
              window.open(
                `/dashboard/service-orders/${serviceOrderData.id}/strategic-map-print`,
                '_blank',
                'noopener,noreferrer'
              )
            }
          >
            <FileText className='mr-2 h-4 w-4' />
            Mapa estrategico da OS
          </Button>
          <Button
            variant='outline'
            disabled={isGeneratingReport || serviceOrderData.status === 'cancelled'}
            onClick={() => handleGenerateApplicationsReport('all')}
          >
            <FileText className='mr-2 h-4 w-4' />
            Relatorio de aplicacao da OS
          </Button>
        </CardContent>
      </Card>

      <Card className='p-4 sm:p-5'>
        <TableApplications
          serviceOrderId={idServiceOrder}
          customerId={serviceOrderData.customerId}
          customerName={serviceOrderData.customer?.name}
          defaultStatus={serviceOrderData.status}
          statusLabel={statusMap[serviceOrderData.status].label}
          disableStatusFilter={true}
          disableCustomerFilter={true}
        />
      </Card>

      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar conclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja marcar esta OS como concluída? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsCompleteDialogOpen(false)}
              disabled={completeServiceOrderMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteServiceOrder}
              disabled={completeServiceOrderMutation.isPending}
              className='bg-green-600 hover:bg-green-700'
            >
              {completeServiceOrderMutation.isPending ? 'Concluindo...' : 'Confirmar conclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cancelamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar esta OS? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsCancelDialogOpen(false)}
              disabled={cancelServiceOrderMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={handleCancelServiceOrder}
              disabled={cancelServiceOrderMutation.isPending}
            >
              {cancelServiceOrderMutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMapsModalOpen} onOpenChange={setIsMapsModalOpen}>
        <DialogContent className='flex h-[94vh] w-[96vw] max-w-6xl flex-col overflow-hidden p-0 xl:max-w-7xl'>
          <DialogHeader className='space-y-2 border-b px-6 py-4'>
            <DialogTitle>Visualização do Mapa - OS #{serviceOrderData.number}</DialogTitle>
            <DialogDescription>
              Explore os talhões planejados, concluídos e pendentes para esta ordem de serviço.
            </DialogDescription>
          </DialogHeader>

          <div className='flex flex-wrap items-center gap-2 border-b px-6 py-3'>
            <Button
              variant={mapFilter === 'all' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setMapFilter('all')}
            >
              Todos os Talhões
            </Button>
            <Button
              variant={mapFilter === 'completed' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setMapFilter('completed')}
            >
              Concluídos
            </Button>
            <Button
              variant={mapFilter === 'pending' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setMapFilter('pending')}
            >
              Pendentes
            </Button>
            <div className='ml-auto flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={isGeneratingReport}
                onClick={() => handleGenerateApplicationsReport('all')}
              >
                PDF Aplicacoes (Geral)
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={isGeneratingReport}
                onClick={() => handleGenerateApplicationsReport('completed')}
              >
                PDF Concluídos
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={isGeneratingReport}
                onClick={handleGenerateCompletedPlotsPlannedAreaReport}
              >
                PDF Área Total Concluída
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={isGeneratingReport}
                onClick={handleGeneratePendingPlotsReport}
              >
                PDF Pendentes
              </Button>
            </div>
          </div>

          <div className='grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]'>
            <div className='relative h-[55vh] min-h-[500px] lg:h-[600px] lg:min-h-[600px] lg:border-r'>
              {filteredMapGeoData && filteredMapGeoData.features.length > 0 ? (
                <div className='h-full w-full'>
                  <MapViewer geoData={filteredMapGeoData} />
                </div>
              ) : (
                <div className='flex h-full items-center justify-center p-8'>
                  <div className='rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center'>
                    <p className='text-sm font-medium'>Mapa da OS ainda não disponível</p>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      O mapa será exibido quando os geojson dos talhões estiverem disponíveis.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className='space-y-4 overflow-y-auto border-t p-4 lg:border-t-0'>
              <h3 className='text-sm font-semibold text-foreground'>{legendLabels.title}</h3>
              <div className='space-y-2'>
                {legendData.farms.length > 0 ? (
                  legendData.farms.map((farm) => (
                    <div
                      key={farm.id}
                      className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
                    >
                      <span className='truncate pr-2'>{farm.name}</span>
                      <span className='font-medium'>
                        {farm.hectares.toFixed(2).replace('.', ',')} ha
                      </span>
                    </div>
                  ))
                ) : (
                  <p className='text-xs text-muted-foreground'>
                    Sem dados de área para o filtro atual.
                  </p>
                )}
              </div>
              <div className='rounded-md border border-border bg-muted/20 px-3 py-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='font-medium'>{legendLabels.total}</span>
                  <span className='font-semibold'>
                    {legendData.total.toFixed(2).replace('.', ',')} ha
                  </span>
                </div>
              </div>
              <div className='rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground'>
                <p>Mapas totais: {progressData.mapasTotal}</p>
                {mapFilter === 'completed' ? (
                  <>
                    <p>Mapas concluídos: {completedPlotIds.length}</p>
                    <p>Aplicações realizadas: {currentServiceOrderApplications.length}</p>
                    <p className='font-medium text-foreground'>
                      Área total concluída: {legendData.total.toFixed(2).replace('.', ',')} ha
                    </p>
                    <p className='mt-2 text-[11px] text-muted-foreground/80'>
                      Área cadastrada dos mapas concluídos:{' '}
                      {completedRegisteredArea.toFixed(2).replace('.', ',')} ha
                    </p>
                  </>
                ) : mapFilter === 'pending' ? (
                  <>
                    <p>Mapas pendentes: {pendingPlotIds.length}</p>
                    <p>Área pendente: {legendData.total.toFixed(2).replace('.', ',')} ha</p>
                  </>
                ) : (
                  <>
                    <p>Mapas concluídos: {completedPlotIds.length}</p>
                    <p>Aplicações realizadas: {currentServiceOrderApplications.length}</p>
                    <p>Área cadastrada: {legendData.total.toFixed(2).replace('.', ',')} ha</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isApplicationsLoading && (
        <p className='text-xs text-muted-foreground'>Carregando aplicações vinculadas...</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-1 rounded-md border border-border/60 p-2.5'>
      <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {label}
      </span>
      <div className='text-sm text-foreground'>{value}</div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border border-border/60 p-3'>
      <p className='text-xs uppercase tracking-wide text-muted-foreground'>{label}</p>
      <p className='mt-1 text-lg font-semibold text-foreground'>{value}</p>
    </div>
  );
}

function ServiceOrderDetailsSkeleton() {
  return (
    <div className='space-y-4 p-6'>
      <Skeleton className='h-5 w-64' />
      <Skeleton className='h-8 w-80' />
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Skeleton className='h-72 w-full' />
        <Skeleton className='h-72 w-full' />
      </div>
      <Skeleton className='h-14 w-full' />
      <Skeleton className='h-[480px] w-full' />
    </div>
  );
}
