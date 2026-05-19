import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FileText, Pencil, XCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import DialogForm from '@/components/DialogForm';
import FormEditServiceOrder from '@/components/Forms/FormEditServiceOrder';
import { Badge } from '@/components/ui/badge';
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
import { getServiceOrderById } from '@/services/service-order.service';
import { Application } from '@/types/applications.type';
import { Plot } from '@/types/plot.type';
import { ServiceOrder } from '@/types/service-order.type';
import { formatOperationalDateBR } from '@/utils/operational-date';
import { downloadPDF, generateServiceOrderStrategicReportPDF } from '@/utils/pdfGenerator';
import { formatTimestamp } from '@/utils/timestamp-formatter';

interface CardServiceOrderDetailsProps {
  serviceOrder?: ServiceOrder;
  isLoading: boolean;
  isError: boolean;
  hasApplicationsWithNullPlot: boolean;
}

export default function CardServiceOrderDetails({
  serviceOrder,
  isLoading,
  isError,
  hasApplicationsWithNullPlot,
}: CardServiceOrderDetailsProps) {
  if (isLoading) {
    return <CardServiceOrderDetailsLoading />;
  }

  if (isError || !serviceOrder) {
    return <CardServiceOrderDetailsError />;
  }

  return (
    <LoadedCardServiceOrderDetails
      serviceOrder={serviceOrder}
      hasApplicationsWithNullPlot={hasApplicationsWithNullPlot}
    />
  );
}

function LoadedCardServiceOrderDetails({
  serviceOrder,
  hasApplicationsWithNullPlot,
}: {
  serviceOrder: ServiceOrder;
  hasApplicationsWithNullPlot: boolean;
}) {
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [applicationCount, setApplicationCount] = useState<number | null>(null);

  const completeServiceOrderMutation = useCompleteServiceOrderById({
    onSuccess: () => {
      setIsCompleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao concluir a ordem de serviço');
    },
  });

  const cancelServiceOrderMutation = useCancelServiceOrderById({
    onSuccess: () => {
      setIsCancelDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Ordem de serviço cancelada com sucesso');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao cancelar a ordem de serviço');
    },
  });

  const handleCompleteServiceOrder = () => {
    completeServiceOrderMutation.mutate(serviceOrder.id);
  };

  const handleCancelServiceOrder = () => {
    cancelServiceOrderMutation.mutate(serviceOrder.id);
  };

  const { data: applicationsData } = useGetApplicationsByServiceOrderId(serviceOrder.id);

  useEffect(() => {
    if (applicationsData?.data) {
      setApplicationCount(applicationsData.data.length);
    }
  }, [applicationsData]);

  const handleGeneratePDFReport = async () => {
    try {
      setIsGeneratingPDF(true);
      setPdfProgress(0);

      const progressInterval = setInterval(() => {
        setPdfProgress((prev) => {
          if (prev >= 85) return prev;
          return prev + 15;
        });
      }, 400);

      setPdfProgress(10);

      const serviceOrderForReport = await getServiceOrderById(serviceOrder.id, {
        includePlots: 'true',
        includeGeoJson: 'true',
        includePilots: 'true',
        includeFarms: 'true',
        includeContracts: 'true',
        includeCustomers: 'true',
      });

      if (!serviceOrderForReport) {
        throw new Error('Erro ao carregar dados da ordem de serviço');
      }

      setPdfProgress(40);

      if (!applicationsData?.data) {
        throw new Error('Erro ao carregar aplicações');
      }

      setPdfProgress(60);

      const applications = [...applicationsData.data];

      if (serviceOrderForReport.plots && Array.isArray(serviceOrderForReport.plots)) {
        const plotMap = new Map<string, Plot>();
        serviceOrderForReport.plots.forEach((plot: Plot) => {
          if (plot.id) {
            plotMap.set(plot.id, plot);
          }
        });

        applications.forEach((application: Application) => {
          if (application.plotId && plotMap.has(application.plotId)) {
            const plot = plotMap.get(application.plotId);
            if (plot) {
              application.plot = plot;
            }
          }
        });
      }

      console.log('[REPORT_PDF_PLOT_DEBUG]', {
        source: 'CardServiceOrderDetails',
        serviceOrderPlotsLength: serviceOrderForReport.plots?.length ?? 0,
        applications: applications.map((a) => ({
          plotId: a.plotId,
          hasPlotGeoJson: Boolean(a.plot?.geoJson),
        })),
      });

      setPdfProgress(75);

      clearInterval(progressInterval);

      const blob = await generateServiceOrderStrategicReportPDF({
        serviceOrder: serviceOrderForReport,
        applications,
      });

      setPdfProgress(95);

      downloadPDF(blob, `relatorio-aplicacoes-os-${serviceOrder.number}.pdf`);

      setPdfProgress(100);
      toast.success('Relatório gerado com sucesso');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao gerar relatório');
      }
    } finally {
      setIsGeneratingPDF(false);
      setPdfProgress(0);
    }
  };

  const statusMap: Record<
    ServiceOrder['status'],
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    open: { label: 'Aberta', variant: 'secondary' },
    completed: { label: 'Concluída', variant: 'default' },
    cancelled: { label: 'Cancelada', variant: 'destructive' },
  };

  type InfoPair = { label: string; value: ReactNode };

  const infoPairs: InfoPair[] = [
    { label: 'Número', value: `#${serviceOrder.number}` },
    {
      label: 'Status',
      value: (
        <Badge variant={statusMap[serviceOrder.status].variant}>
          {statusMap[serviceOrder.status].label}
        </Badge>
      ),
    },
    { label: 'Cliente', value: serviceOrder.customer?.name || 'N/A' },
    { label: 'Contrato', value: serviceOrder.contract?.name || 'N/A' },
    {
      label: 'Fazendas',
      value: serviceOrder.farms?.length ? (
        <div className='flex flex-wrap gap-1'>
          {serviceOrder.farms.map((farm) => (
            <Badge key={farm.id} variant='outline'>
              {farm.name}
            </Badge>
          ))}
        </div>
      ) : (
        'N/A'
      ),
    },
    {
      label: 'Pilotos',
      value: serviceOrder.pilots?.length ? (
        <div className='flex flex-wrap gap-1'>
          {serviceOrder.pilots.map((pilot) => (
            <Badge key={pilot.id} variant='outline'>
              {pilot.name.split(' ')[0]}
            </Badge>
          ))}
        </div>
      ) : (
        'N/A'
      ),
    },
    {
      label: 'Observação',
      value: serviceOrder.observation || 'N/A',
    },
    {
      label: 'Data Planejada',
      value: formatOperationalDateBR(serviceOrder.plannedDate),
    },
    { label: 'Criado em', value: formatTimestamp(serviceOrder.createdAt) },
  ];

  const isActionDisabled = serviceOrder.status !== 'open';

  return (
    <Card className='h-full rounded-none border-l border-border border-t-0 border-r-0 border-b-0 flex flex-col gap-0'>
      <CardHeader className='pb-4 flex-shrink-0'>
        <CardTitle className='text-xl font-semibold text-foreground truncate'>
          Detalhes da OS
        </CardTitle>
      </CardHeader>

      <CardContent className='flex-1 space-y-4 p-6 overflow-y-auto overflow-x-hidden'>
        <div className='space-y-4'>
          <div>
            <h3 className='text-sm font-medium text-muted-foreground mb-3'>Informações da OS</h3>
            <div className='space-y-4'>
              {infoPairs.map((pair) => (
                <div key={pair.label} className='flex flex-col gap-1 py-2'>
                  <span className='text-sm font-medium'>{pair.label}</span>
                  <div className='text-sm text-muted-foreground flex flex-wrap gap-1 break-words'>
                    {pair.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {serviceOrder.status === 'open' && (
            <div className='pt-4 border-t'>
              <h3 className='text-sm font-medium text-muted-foreground mb-3'>Editar</h3>
              <DialogForm
                form={
                  <FormEditServiceOrder
                    serviceOrderId={serviceOrder.id}
                    onSuccess={() => setIsEditDialogOpen(false)}
                  />
                }
                trigger={
                  <Button variant='outline' size='sm' className='flex items-center gap-2 w-full'>
                    <Pencil className='h-4 w-4' />
                    Editar OS
                  </Button>
                }
                className='sm:max-w-6xl h-[700px] max-h-[90vh] flex flex-col'
                isOpen={isEditDialogOpen}
                setIsOpen={setIsEditDialogOpen}
              />
            </div>
          )}

          {serviceOrder.status === 'open' && (
            <div className='pt-4 border-t'>
              <h3 className='text-sm font-medium text-muted-foreground mb-3'>Ações</h3>
              <div className='flex flex-col gap-2'>
                <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirmar Conclusão</DialogTitle>
                      <DialogDescription>
                        Tem certeza que deseja marcar esta OS como concluída? Esta ação não pode ser
                        desfeita.
                      </DialogDescription>
                    </DialogHeader>
                    <p className='text-sm text-muted-foreground'>
                      A OS #{serviceOrder.number} será marcada como concluída e NÃO PODERÁ MAIS SER
                      EDITADA.
                    </p>
                    <DialogFooter>
                      <Button
                        variant='outline'
                        onClick={() => setIsCompleteDialogOpen(false)}
                        disabled={completeServiceOrderMutation.isPending}
                      >
                        <span className='text-nowrap overflow-hidden text-ellipsis'>Cancelar</span>
                      </Button>
                      <Button
                        onClick={handleCompleteServiceOrder}
                        disabled={completeServiceOrderMutation.isPending}
                        className='bg-green-600 hover:bg-green-700'
                      >
                        {completeServiceOrderMutation.isPending
                          ? 'Concluindo...'
                          : 'Confirmar Conclusão'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {hasApplicationsWithNullPlot ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className='flex w-full cursor-not-allowed'>
                        <Button
                          variant='outline'
                          size='sm'
                          className='flex w-full items-center gap-2 text-green-600 border-green-600 hover:bg-green-50'
                          disabled={isActionDisabled || hasApplicationsWithNullPlot}
                        >
                          <CheckCircle className='h-4 w-4' />
                          <span className='text-nowrap overflow-hidden text-ellipsis'>
                            Concluir OS
                          </span>
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Ainda há aplicações sem talhão vinculado</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50'
                    disabled={isActionDisabled}
                    onClick={() => setIsCompleteDialogOpen(true)}
                  >
                    <CheckCircle className='h-4 w-4' />
                    <span className='text-nowrap overflow-hidden text-ellipsis'>Concluir OS</span>
                  </Button>
                )}

                <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirmar Cancelamento</DialogTitle>
                      <DialogDescription>
                        Tem certeza que deseja cancelar esta OS? Esta ação não pode ser desfeita.
                      </DialogDescription>
                    </DialogHeader>
                    <p className='text-sm text-muted-foreground'>
                      A OS #{serviceOrder.number} será cancelada e NÃO PODERÁ MAIS SER EDITADA.
                    </p>
                    <DialogFooter>
                      <Button
                        variant='outline'
                        onClick={() => setIsCancelDialogOpen(false)}
                        disabled={cancelServiceOrderMutation.isPending}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCancelServiceOrder}
                        disabled={cancelServiceOrderMutation.isPending}
                        variant='destructive'
                      >
                        {cancelServiceOrderMutation.isPending
                          ? 'Cancelando...'
                          : 'Confirmar Cancelamento'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant='outline'
                  size='sm'
                  className='flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50'
                  disabled={isActionDisabled}
                  onClick={() => setIsCancelDialogOpen(true)}
                >
                  <XCircle className='h-4 w-4' />
                  <span className='text-nowrap overflow-hidden text-ellipsis'>Cancelar OS</span>
                </Button>
              </div>
            </div>
          )}

          {(serviceOrder.status === 'open' || serviceOrder.status === 'completed') && (
            <div className='pt-4 border-t'>
              <h3 className='text-sm font-medium text-muted-foreground mb-3'>Relatórios</h3>
              <div className='flex flex-col gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  className='flex items-center justify-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50 w-full'
                  disabled={isGeneratingPDF}
                  onClick={handleGeneratePDFReport}
                >
                  <FileText className='h-4 w-4 flex-shrink-0' />
                  <span className='text-nowrap overflow-hidden text-ellipsis'>
                    {isGeneratingPDF
                      ? `Gerando relatório${applicationCount ? ` (${applicationCount})` : ''}...`
                      : 'Gerar relatório de aplicações'}
                  </span>
                </Button>
                {isGeneratingPDF && (
                  <div className='space-y-2'>
                    <Progress value={pdfProgress} className='h-2' />
                    <p className='text-xs text-muted-foreground text-center'>
                      {pdfProgress < 95
                        ? 'Processando dados e gerando PDF...'
                        : 'Finalizando download...'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CardServiceOrderDetailsLoading() {
  return (
    <Card className='h-full rounded-none border-l border-border border-t-0 border-r-0 border-b-0 flex flex-col gap-0'>
      <CardHeader className='pb-4 flex-shrink-0'>
        <Skeleton className='h-6 w-48' />
      </CardHeader>

      <CardContent className='flex-1 space-y-4 p-6 overflow-y-auto overflow-x-hidden'>
        <div className='space-y-4'>
          <div>
            <Skeleton className='h-4 w-40 mb-3' />
            <div className='space-y-4'>
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className='flex flex-col gap-1 py-2'>
                  <Skeleton className='h-4 w-24' />
                  <Skeleton className='h-4 w-32' />
                </div>
              ))}
            </div>
          </div>
          <div className='pt-4 border-t'>
            <Skeleton className='h-4 w-20 mb-3' />
            <Skeleton className='h-9 w-full' />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardServiceOrderDetailsError() {
  return (
    <Card className='h-full rounded-none border-l border-t-0 border-r-0 border-b-0 flex flex-col gap-0 border-destructive'>
      <CardHeader className='pb-4 flex-shrink-0'>
        <CardTitle className='text-xl font-semibold text-destructive truncate'>
          Erro ao carregar
        </CardTitle>
      </CardHeader>

      <CardContent className='flex-1 p-6 overflow-x-hidden space-y-4'>
        <div className='flex items-center justify-center flex-1'>
          <span className='text-sm text-destructive text-center'>
            Não foi possível carregar os detalhes da OS
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
