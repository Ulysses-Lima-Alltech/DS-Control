'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getAllContracts } from '@/services/contract.service';
import {
  approveCustomerRequest,
  getAdminCustomerRequest,
  getAdminCustomerRequests,
  rejectCustomerRequest,
  requestCustomerRequestChanges,
} from '@/services/customer-request.service';
import { getFarmById } from '@/services/farm.service';
import { getAllUsers } from '@/services/user.service';
import {
  CUSTOMER_REQUEST_STATUSES,
  type CustomerRequestListItem,
  type CustomerRequestPathType,
  type CustomerRequestStatus,
  type CustomerRequestType,
} from '@/types/customer-request.type';

const STATUS_LABELS: Record<CustomerRequestStatus, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviada',
  PARSING: 'Processando',
  UNDER_REVIEW: 'Em análise',
  CHANGES_REQUESTED: 'Ajustes solicitados',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
};

const formatDate = (value?: string | Date | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value)
      )
    : '—';

const pathType = (request: CustomerRequestListItem): CustomerRequestPathType =>
  request.requestType === 'SERVICE_ORDER' ? 'service-orders' : 'areas';

export default function CustomerRequestsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [type, setType] = useState<CustomerRequestType | ''>('');
  const [status, setStatus] = useState<CustomerRequestStatus | ''>('UNDER_REVIEW');
  const [selected, setSelected] = useState<CustomerRequestListItem | null>(null);
  const [reason, setReason] = useState('');
  const [contractId, setContractId] = useState('');
  const [pilotIds, setPilotIds] = useState<string[]>([]);
  const [plotIds, setPlotIds] = useState<string[]>([]);
  const [plannedDate, setPlannedDate] = useState('');
  const [observation, setObservation] = useState('');
  const [farmName, setFarmName] = useState('');
  const [mapColor, setMapColor] = useState('#0AAA50');

  const listQuery = useQuery({
    queryKey: ['admin-customer-requests', page, type, status],
    queryFn: () =>
      getAdminCustomerRequests({
        page,
        limit: 20,
        type: type || undefined,
        status: status || undefined,
      }),
  });
  const detailQuery = useQuery({
    queryKey: ['admin-customer-request', selected?.requestType, selected?.id],
    queryFn: () => getAdminCustomerRequest(pathType(selected!), selected!.id),
    enabled: Boolean(selected),
  });
  const detail = detailQuery.data;
  const contractsQuery = useQuery({
    queryKey: ['request-contracts', detail?.customerId],
    queryFn: () => getAllContracts({ customerId: detail!.customerId, page: '1', limit: '100' }),
    enabled: detail?.requestType === 'SERVICE_ORDER',
  });
  const pilotsQuery = useQuery({
    queryKey: ['request-pilots'],
    queryFn: () => getAllUsers({ type: 'pilot', status: 'active', page: '1', limit: '100' }),
    enabled: detail?.requestType === 'SERVICE_ORDER',
  });
  const requestedFarmIds = detail?.requestedFarmIds ?? [];
  const farmsQuery = useQuery({
    queryKey: ['request-farms', requestedFarmIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        requestedFarmIds.map((farmId) => getFarmById(farmId, { includePlots: 'true' }))
      );
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      if (failedCount > 0) {
        toast.error(
          `Não foi possível carregar ${failedCount} de ${requestedFarmIds.length} fazenda(s) da solicitação.`
        );
      }
      return results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
    },
    enabled: detail?.requestType === 'SERVICE_ORDER' && requestedFarmIds.length > 0,
  });
  const requestedFarms = farmsQuery.data?.map((response) => response.farm) ?? [];

  useEffect(() => {
    setReason('');
    setContractId('');
    setPilotIds([]);
    setPlotIds([]);
    setPlannedDate(detail?.requestedDate || '');
    setObservation(detail?.observation || '');
    setFarmName(detail?.suggestedFarmName || '');
    setMapColor('#0AAA50');
  }, [detail?.id, detail?.observation, detail?.requestedDate, detail?.suggestedFarmName]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-customer-requests'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-customer-request'] });
  };
  const mutation = useMutation({
    mutationFn: async (action: 'changes' | 'reject' | 'approve') => {
      if (!detail) throw new Error('Selecione uma solicitação');
      const requestType = pathType(detail);
      if (action === 'changes')
        return requestCustomerRequestChanges(requestType, detail.id, reason.trim());
      if (action === 'reject') return rejectCustomerRequest(requestType, detail.id, reason.trim());
      if (detail.requestType === 'SERVICE_ORDER') {
        return approveCustomerRequest(requestType, detail.id, {
          approvalType: 'SERVICE_ORDER',
          contractId,
          pilotIds,
          plotIds,
          plannedDate: plannedDate || undefined,
          observation: observation || undefined,
        });
      }
      return approveCustomerRequest(requestType, detail.id, {
        approvalType: 'AREA_SUBMISSION',
        farmName: detail.existingFarmId ? undefined : farmName.trim() || undefined,
        mapColor: detail.existingFarmId ? undefined : mapColor,
      });
    },
    onSuccess: async () => {
      toast.success('Solicitação atualizada com sucesso');
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Falha ao revisar solicitação'),
  });

  const canReview = detail?.status === 'UNDER_REVIEW';
  const canApproveService = Boolean(contractId && pilotIds.length && plotIds.length);
  const canApproveArea = Boolean(detail?.existingFarmId || farmName.trim());
  const selectedPlotArea = useMemo(
    () =>
      detail?.submittedPlots
        ?.filter((plot) => plot.validationStatus === 'VALID')
        .reduce((sum, plot) => sum + Number(plot.calculatedAreaHa), 0) ?? 0,
    [detail?.submittedPlots]
  );

  return (
    <div className='min-h-full space-y-6 p-5 lg:p-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='flex items-center gap-2 text-3xl font-semibold text-primary'>
            <ClipboardCheck /> Solicitações
          </h1>
          <p className='text-muted-foreground'>
            Analise pedidos de OS e áreas KML antes de criar registros definitivos.
          </p>
        </div>
        <Button variant='outline' onClick={() => refresh()} disabled={listQuery.isFetching}>
          <RefreshCw className='mr-2 size-4' />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className='grid gap-3 p-4 md:grid-cols-3'>
          <select
            aria-label='Tipo'
            className='h-10 rounded-md border bg-background px-3'
            value={type}
            onChange={(event) => {
              setType(event.target.value as CustomerRequestType | '');
              setPage(1);
            }}
          >
            <option value=''>Todos os tipos</option>
            <option value='SERVICE_ORDER'>Ordem de serviço</option>
            <option value='AREA_SUBMISSION'>Área / KML</option>
          </select>
          <select
            aria-label='Status'
            className='h-10 rounded-md border bg-background px-3'
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CustomerRequestStatus | '');
              setPage(1);
            }}
          >
            <option value=''>Todos os status</option>
            {CUSTOMER_REQUEST_STATUSES.map((item) => (
              <option key={item} value={item}>
                {STATUS_LABELS[item]}
              </option>
            ))}
          </select>
          <div className='flex items-center justify-end text-sm text-muted-foreground'>
            {listQuery.data?.totalCount ?? 0} solicitações
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]'>
        <Card>
          <CardContent className='p-0'>
            {listQuery.isLoading ? (
              <p className='p-6'>Carregando...</p>
            ) : listQuery.isError ? (
              <p className='p-6 text-destructive'>{listQuery.error.message}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Criada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.data?.data.map((item) => (
                    <TableRow
                      key={`${item.requestType}-${item.id}`}
                      className='cursor-pointer'
                      data-state={selected?.id === item.id ? 'selected' : undefined}
                      onClick={() => setSelected(item)}
                    >
                      <TableCell>{item.requestType === 'SERVICE_ORDER' ? 'OS' : 'Área'}</TableCell>
                      <TableCell className='font-mono text-xs'>
                        {item.customerId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'REJECTED' ? 'destructive' : 'outline'}>
                          {STATUS_LABELS[item.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.serviceType || item.suggestedFarmName || 'Fazenda existente'}
                      </TableCell>
                      <TableCell>{formatDate(item.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {!listQuery.data?.data.length && (
                    <TableRow>
                      <TableCell colSpan={5} className='h-28 text-center text-muted-foreground'>
                        Nenhuma solicitação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <div className='flex items-center justify-between border-t p-3'>
              <Button
                variant='outline'
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <span className='text-sm'>
                Página {page} de {Math.max(1, listQuery.data?.totalPages || 1)}
              </span>
              <Button
                variant='outline'
                disabled={page >= (listQuery.data?.totalPages || 1)}
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhes e revisão</CardTitle>
          </CardHeader>
          <CardContent className='space-y-5'>
            {!selected ? (
              <p className='text-sm text-muted-foreground'>Selecione uma solicitação.</p>
            ) : detailQuery.isLoading ? (
              <p>Carregando detalhes...</p>
            ) : detailQuery.isError ? (
              <p className='text-destructive'>{detailQuery.error.message}</p>
            ) : (
              detail && (
                <>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <p className='text-muted-foreground'>Cliente</p>
                      <p className='font-medium'>{detail.customer?.name || detail.customerId}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>Solicitante</p>
                      <p className='font-medium'>{detail.requestedBy?.name || '—'}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>Tipo</p>
                      <p>
                        {detail.requestType === 'SERVICE_ORDER' ? 'Ordem de serviço' : 'Área / KML'}
                      </p>
                    </div>
                    <div>
                      <p className='text-muted-foreground'>Status</p>
                      <Badge variant='outline'>{STATUS_LABELS[detail.status]}</Badge>
                    </div>
                  </div>
                  {detail.requestType === 'AREA_SUBMISSION' && (
                    <div className='rounded-lg border p-3 text-sm'>
                      <p className='font-medium'>
                        {detail.existingFarm?.name || detail.suggestedFarmName}
                      </p>
                      <p>
                        {detail.submittedPlots?.filter((plot) => plot.validationStatus === 'VALID')
                          .length || 0}{' '}
                        talhões válidos ·{' '}
                        {selectedPlotArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha
                      </p>
                      {detail.files?.map((file) => (
                        <p key={file.id} className='text-muted-foreground'>
                          {file.originalFileName} · {file.parseStatus}
                        </p>
                      ))}
                    </div>
                  )}
                  {detail.requestType === 'SERVICE_ORDER' && (
                    <div className='rounded-lg border p-3 text-sm'>
                      <p className='font-medium'>{detail.serviceType}</p>
                      <p>
                        {requestedFarms.map((farm) => farm.name).join(', ')} · data solicitada{' '}
                        {detail.requestedDate}
                      </p>
                      <p className='text-muted-foreground'>
                        {detail.observation || 'Sem observação'}
                      </p>
                    </div>
                  )}
                  {canReview && (
                    <div className='space-y-3 border-t pt-4'>
                      <Textarea
                        placeholder='Motivo obrigatório para solicitar ajustes ou rejeitar'
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                      <div className='grid grid-cols-2 gap-2'>
                        <Button
                          variant='outline'
                          disabled={!reason.trim() || mutation.isPending}
                          onClick={() => mutation.mutate('changes')}
                        >
                          Solicitar ajustes
                        </Button>
                        <Button
                          variant='destructive'
                          disabled={!reason.trim() || mutation.isPending}
                          onClick={() => mutation.mutate('reject')}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  )}
                  {canReview && detail.requestType === 'SERVICE_ORDER' && (
                    <div className='space-y-3 border-t pt-4'>
                      <p className='font-semibold'>Criar ordem de serviço</p>
                      <select
                        className='h-10 w-full rounded-md border bg-background px-3'
                        value={contractId}
                        onChange={(event) => setContractId(event.target.value)}
                      >
                        <option value=''>Selecione o contrato</option>
                        {contractsQuery.data?.data.map((contract) => (
                          <option key={contract.id} value={contract.id}>
                            {contract.name}
                          </option>
                        ))}
                      </select>
                      <label className='block text-sm'>
                        Pilotos
                        <select
                          multiple
                          className='mt-1 min-h-24 w-full rounded-md border bg-background p-2'
                          value={pilotIds}
                          onChange={(event) =>
                            setPilotIds(
                              Array.from(event.target.selectedOptions, (option) => option.value)
                            )
                          }
                        >
                          {pilotsQuery.data?.data.map((pilot) => (
                            <option key={pilot.id} value={pilot.id}>
                              {pilot.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className='block text-sm'>
                        Talhões
                        <select
                          multiple
                          className='mt-1 min-h-28 w-full rounded-md border bg-background p-2'
                          value={plotIds}
                          onChange={(event) =>
                            setPlotIds(
                              Array.from(event.target.selectedOptions, (option) => option.value)
                            )
                          }
                        >
                          {requestedFarms.map((farm) => (
                            <optgroup key={farm.id} label={farm.name}>
                              {farm.plots?.map((plot) => (
                                <option key={plot.id} value={plot.id}>
                                  {plot.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <Input
                        type='date'
                        value={plannedDate}
                        onChange={(event) => setPlannedDate(event.target.value)}
                      />
                      <Textarea
                        placeholder='Observação da OS'
                        value={observation}
                        onChange={(event) => setObservation(event.target.value)}
                      />
                      <Button
                        className='w-full'
                        disabled={!canApproveService || mutation.isPending}
                        onClick={() => mutation.mutate('approve')}
                      >
                        Aprovar e criar OS
                      </Button>
                    </div>
                  )}
                  {canReview && detail.requestType === 'AREA_SUBMISSION' && (
                    <div className='space-y-3 border-t pt-4'>
                      <p className='font-semibold'>Criar fazenda e talhões</p>
                      {!detail.existingFarmId && (
                        <>
                          <Input
                            placeholder='Nome da fazenda'
                            value={farmName}
                            onChange={(event) => setFarmName(event.target.value)}
                          />
                          <label className='flex items-center gap-3 text-sm'>
                            Cor no mapa
                            <Input
                              type='color'
                              className='h-10 w-20 p-1'
                              value={mapColor}
                              onChange={(event) => setMapColor(event.target.value.toUpperCase())}
                            />
                            <span>{mapColor}</span>
                          </label>
                        </>
                      )}
                      <Button
                        className='w-full'
                        disabled={!canApproveArea || mutation.isPending}
                        onClick={() => mutation.mutate('approve')}
                      >
                        Aprovar e criar áreas
                      </Button>
                    </div>
                  )}
                  {detail.events?.length > 0 && (
                    <div className='border-t pt-4'>
                      <p className='mb-2 font-semibold'>Histórico</p>
                      <div className='max-h-40 space-y-2 overflow-auto'>
                        {detail.events.map((event) => (
                          <div key={event.id} className='text-xs'>
                            <span className='font-medium'>{event.eventType}</span> ·{' '}
                            {formatDate(event.createdAt)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
