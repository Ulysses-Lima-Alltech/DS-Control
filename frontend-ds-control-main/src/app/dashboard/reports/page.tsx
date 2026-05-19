'use client';

import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import DateRangePicker, { type DateParams } from '@/components/DateRangePicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelectQuery } from '@/components/ui/searchable-select-query';
import { useGetAllAssistants } from '@/queries/assistant.query';
import { useGetAllCropSeasons } from '@/queries/crop-season.query';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetAllDrones } from '@/queries/drone.query';
import { useGetAllFarms } from '@/queries/farm.query';
import { useGetAllProducts } from '@/queries/product.query';
import { useGetAllServiceOrders } from '@/queries/service-order.query';
import { useGetAllUsers } from '@/queries/user.query';
import { getAllApplications, getApplicationsByServiceOrderId } from '@/services/application.service';
import { getAllFarms } from '@/services/farm.service';
import { getAllServiceOrders, getServiceOrderById } from '@/services/service-order.service';
import {
  APPLICATION_ISSUE_LABELS,
  type Application,
  type ApplicationIssueFilter,
} from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { ServiceOrderStatus } from '@/types/service-order.type';
import type { User } from '@/types/user.type';
import { OPERATIONAL_TIME_ZONE } from '@/utils/operational-date';
import {
  downloadPDF,
  generateApplicationsReportPDF,
  generateFarmsReportPDF,
  generateGeneralReportPDF,
  generateServiceOrderStrategicReportPDF,
} from '@/utils/pdfGenerator';

import { reportsCatalog, type ReportFilterKey, type ReportId } from './reportsCatalog';

type ReportsFiltersState = {
  startDate?: string;
  endDate?: string;
  cropSeasonId?: string;
  customerId?: string;
  farmId?: string;
  pilotId?: string;
  productId?: string;
  assistantId?: string;
  droneId?: string;
  serviceOrderStatus?: ServiceOrderStatus;
  applicationIssue?: ApplicationIssueFilter;
  observation?: string;
  serviceOrderNumber?: string;
};

type SummaryItem = { label: string; value: string };
type NamedValue = { name: string; value: number };

const STATUS_OPTIONS: Array<{ value: ServiceOrderStatus; label: string }> = [
  { value: 'open', label: 'Aberta' },
  { value: 'completed', label: 'Concluida' },
  { value: 'cancelled', label: 'Cancelada' },
];

function parseNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

function formatGeneratedAt(): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: OPERATIONAL_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date());
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function aggregateByName(list: Array<{ name: string; value: number }>): NamedValue[] {
  const map = new Map<string, number>();

  list.forEach((item) => {
    const key = item.name.trim() || 'Nao informado';
    map.set(key, (map.get(key) || 0) + item.value);
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export default function ReportsCenterPage() {
  const [selectedReportId, setSelectedReportId] = useState<ReportId>('applications');
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string | undefined>(undefined);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [farmSearch, setFarmSearch] = useState('');
  const [pilotSearch, setPilotSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [assistantSearch, setAssistantSearch] = useState('');
  const [droneSearch, setDroneSearch] = useState('');
  const [cropSeasonSearch, setCropSeasonSearch] = useState('');
  const [serviceOrderSearch, setServiceOrderSearch] = useState('');

  const [filters, setFilters] = useState<ReportsFiltersState>({});

  const selectedReport = useMemo(
    () => reportsCatalog.find((item) => item.id === selectedReportId) || reportsCatalog[0],
    [selectedReportId]
  );

  const supports = (filterKey: ReportFilterKey) => selectedReport.supportedFilters.includes(filterKey);

  const { data: customersData } = useGetAllCustomers({
    page: '1',
    limit: '200',
    search: customerSearch || undefined,
  });
  const customers = customersData?.data || [];

  const { data: farmsData } = useGetAllFarms(filters.customerId, {
    page: '1',
    limit: '400',
    search: farmSearch || undefined,
    includePlots: 'true',
    includeCustomer: 'true',
    includeGeoJson: 'false',
  });
  const farms = farmsData?.data || [];

  const { data: pilotsData } = useGetAllUsers({
    page: '1',
    limit: '200',
    type: 'pilot',
    status: 'active',
    search: pilotSearch || undefined,
  });
  const pilots = pilotsData?.data || [];

  const { data: productsData } = useGetAllProducts({
    page: '1',
    limit: '200',
    status: 'active',
    search: productSearch || undefined,
  });
  const products = productsData?.data || [];

  const { data: assistantsData } = useGetAllAssistants({
    page: '1',
    limit: '200',
    status: 'active',
    search: assistantSearch || undefined,
  });
  const assistants = assistantsData?.data || [];

  const { data: dronesData } = useGetAllDrones({
    page: '1',
    limit: '200',
    status: 'active',
    search: droneSearch || undefined,
  });
  const drones = dronesData?.data || [];

  const { data: cropSeasonsData } = useGetAllCropSeasons({
    page: '1',
    limit: '200',
    status: 'active',
    search: cropSeasonSearch || undefined,
  });
  const cropSeasons = cropSeasonsData?.data || [];

  const serviceOrderSearchTerm = (serviceOrderSearch || filters.serviceOrderNumber || '').trim();

  const { data: serviceOrdersData, isLoading: isLoadingServiceOrders } = useGetAllServiceOrders(
    {
      page: '1',
      limit: '200',
      search: serviceOrderSearchTerm || undefined,
      status: filters.serviceOrderStatus,
      farmId: filters.farmId,
      pilotId: filters.pilotId,
      customerId: filters.customerId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      includePlots: 'true',
      includeGeoJson: 'false',
      includeCustomers: 'true',
      includePilots: 'true',
      includeFarms: 'true',
      includeContracts: 'true',
    },
    {
      enabled: supports('serviceOrder'),
    }
  );

  const filteredServiceOrders = useMemo(() => {
    const base = serviceOrdersData?.data || [];
    const byObservation = (filters.observation || '').trim();

    if (!byObservation) {
      return base;
    }

    const normalizedObservationFilter = normalizeLabel(byObservation);
    return base.filter((serviceOrder) =>
      normalizeLabel(serviceOrder.observation || '').includes(normalizedObservationFilter)
    );
  }, [serviceOrdersData?.data, filters.observation]);

  const serviceOrderOptions = filteredServiceOrders.map((serviceOrder) => ({
    value: serviceOrder.id,
    label: `#${serviceOrder.number} - ${serviceOrder.customer?.name || 'Cliente N/A'}`,
    aditionalInformation:
      serviceOrder.farms?.length > 0 ? serviceOrder.farms.map((farm) => farm.name).join(', ') : 'Sem fazenda',
  }));

  const updateFilter = <K extends keyof ReportsFiltersState>(key: K, value: ReportsFiltersState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (key === 'customerId') {
      setFilters((prev) => ({
        ...prev,
        customerId: value as ReportsFiltersState['customerId'],
        farmId: undefined,
      }));
      setSelectedServiceOrderId(undefined);
      return;
    }

    if (key === 'farmId' || key === 'pilotId' || key === 'serviceOrderStatus' || key === 'startDate' || key === 'endDate' || key === 'serviceOrderNumber' || key === 'observation') {
      setSelectedServiceOrderId(undefined);
    }
  };

  const resolveFiltersSummary = (): SummaryItem[] => {
    const summary: SummaryItem[] = [];

    if (filters.startDate && filters.endDate) {
      summary.push({ label: 'Periodo', value: `${filters.startDate} ate ${filters.endDate}` });
    }

    if (filters.cropSeasonId) {
      const cropSeasonName = cropSeasons.find((item) => item.id === filters.cropSeasonId)?.name || filters.cropSeasonId;
      summary.push({ label: 'Safra', value: cropSeasonName });
    }

    if (filters.customerId) {
      const customerName = customers.find((item) => item.id === filters.customerId)?.name || filters.customerId;
      summary.push({ label: 'Cliente', value: customerName });
    }

    if (filters.farmId) {
      const farmName = farms.find((item) => item.id === filters.farmId)?.name || filters.farmId;
      summary.push({ label: 'Fazenda', value: farmName });
    }

    if (filters.pilotId) {
      const pilotName = pilots.find((item) => item.id === filters.pilotId)?.name || filters.pilotId;
      summary.push({ label: 'Piloto', value: pilotName });
    }

    if (filters.productId) {
      const productName = products.find((item) => item.id === filters.productId)?.name || filters.productId;
      summary.push({ label: 'Produto', value: productName });
    }

    if (filters.assistantId) {
      const assistantName = assistants.find((item) => item.id === filters.assistantId)?.name || filters.assistantId;
      summary.push({ label: 'Ajudante', value: assistantName });
    }

    if (filters.droneId) {
      const droneName = drones.find((item) => item.id === filters.droneId)?.name || filters.droneId;
      summary.push({ label: 'Drone', value: droneName });
    }

    if (filters.serviceOrderStatus) {
      const statusLabel = STATUS_OPTIONS.find((item) => item.value === filters.serviceOrderStatus)?.label || filters.serviceOrderStatus;
      summary.push({ label: 'Status OS', value: statusLabel });
    }

    if (filters.applicationIssue) {
      summary.push({
        label: 'Tipo de aplicacao / issue',
        value: APPLICATION_ISSUE_LABELS[filters.applicationIssue],
      });
    }

    if (filters.observation) {
      summary.push({ label: 'Observacao', value: filters.observation });
    }

    if (filters.serviceOrderNumber) {
      summary.push({ label: 'Busca OS', value: filters.serviceOrderNumber });
    }

    return summary;
  };

  const buildApplicationFilters = () => ({
    page: '1',
    limit: '1000',
    startDate: filters.startDate,
    endDate: filters.endDate,
    cropSeasonId: filters.cropSeasonId,
    customerId: filters.customerId,
    farmId: filters.farmId,
    pilotId: filters.pilotId,
    productId: filters.productId,
    assistantId: filters.assistantId,
    droneId: filters.droneId,
    serviceOrderStatus: filters.serviceOrderStatus,
    applicationIssue: filters.applicationIssue,
    observations: filters.observation,
    serviceOrderNumber: filters.serviceOrderNumber,
  });

  const buildServiceOrderFilters = () => ({
    page: '1',
    limit: '1000',
    search: filters.serviceOrderNumber || undefined,
    status: filters.serviceOrderStatus,
    customerId: filters.customerId,
    farmId: filters.farmId,
    pilotId: filters.pilotId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    includePlots: 'true',
    includeGeoJson: 'false',
    includeCustomers: 'true',
    includePilots: 'true',
    includeFarms: 'true',
    includeContracts: 'true',
  });

  const fetchServiceOrderAndApplications = async (serviceOrderId: string) => {
    const serviceOrderForReport = await getServiceOrderById(serviceOrderId, {
      includePlots: 'true',
      includeGeoJson: 'true',
      includePilots: 'true',
      includeFarms: 'true',
      includeContracts: 'true',
      includeCustomers: 'true',
    });

    const applicationsResponse = await getApplicationsByServiceOrderId(serviceOrderId);
    const applications = [...(applicationsResponse.data || [])];

    if (serviceOrderForReport.plots && Array.isArray(serviceOrderForReport.plots)) {
      const plotMap = new Map<string, Farm['plots'][number]>();
      serviceOrderForReport.plots.forEach((plot) => {
        if (plot.id) {
          plotMap.set(plot.id, plot);
        }
      });

      applications.forEach((application: Application) => {
        if (application.plotId && plotMap.has(application.plotId)) {
          const mappedPlot = plotMap.get(application.plotId);
          if (mappedPlot) {
            application.plot = mappedPlot;
          }
        }
      });
    }

    return { serviceOrderForReport, applications };
  };

  const handleGenerateApplicationsReport = async () => {
    if (!selectedServiceOrderId) {
      throw new Error('Selecione uma OS para gerar o relatorio de aplicacoes.');
    }

    const serviceOrderForReport = await getServiceOrderById(selectedServiceOrderId, {
      includePlots: 'true',
      includeGeoJson: 'true',
      includePilots: 'true',
      includeFarms: 'true',
      includeContracts: 'true',
      includeCustomers: 'true',
    });

    const filteredApplicationsResponse = await getAllApplications({
      ...buildApplicationFilters(),
      serviceOrderId: selectedServiceOrderId,
      page: '1',
      limit: '1000',
    });

    const applications = [...(filteredApplicationsResponse.data || [])];

    if (serviceOrderForReport.plots && Array.isArray(serviceOrderForReport.plots)) {
      const plotMap = new Map<string, Farm['plots'][number]>();
      serviceOrderForReport.plots.forEach((plot) => {
        if (plot.id) {
          plotMap.set(plot.id, plot);
        }
      });

      applications.forEach((application: Application) => {
        if (application.plotId && plotMap.has(application.plotId)) {
          const mappedPlot = plotMap.get(application.plotId);
          if (mappedPlot) {
            application.plot = mappedPlot;
          }
        }
      });
    }

    if (applications.length === 0) {
      throw new Error(
        'Nenhuma aplicacao encontrada para os filtros selecionados nesta OS.'
      );
    }

    const blob = await generateApplicationsReportPDF({
      serviceOrder: serviceOrderForReport,
      applications,
    });

    downloadPDF(
      blob,
      `relatorio-aplicacoes-os-${serviceOrderForReport.number}-central.pdf`
    );
  };

  const handleGenerateServiceOrderReport = async () => {
    if (!selectedServiceOrderId) {
      throw new Error('Selecione uma OS para gerar o relatorio da OS.');
    }

    const { serviceOrderForReport, applications } = await fetchServiceOrderAndApplications(
      selectedServiceOrderId
    );
    const blob = await generateServiceOrderStrategicReportPDF({
      serviceOrder: serviceOrderForReport,
      applications,
    });

    downloadPDF(blob, `relatorio-os-${serviceOrderForReport.number}-estrategico.pdf`);
  };

  const handleGenerateFarmsReport = async () => {
    const [farmsResponse, applicationsResponse, serviceOrdersResponse] = await Promise.all([
      getAllFarms(filters.customerId, {
        page: '1',
        limit: '1000',
        includeCustomer: 'true',
        includePlots: 'true',
        includeGeoJson: 'false',
        search: undefined,
      }),
      getAllApplications(buildApplicationFilters()),
      getAllServiceOrders(buildServiceOrderFilters()),
    ]);

    const allFarmsFromApi = farmsResponse.data || [];
    const applications = applicationsResponse.data || [];
    const serviceOrders = serviceOrdersResponse.data || [];

    const filteredFarms = allFarmsFromApi.filter((farm) => {
      if (filters.farmId && farm.id !== filters.farmId) {
        return false;
      }
      return true;
    });

    const farmRows = filteredFarms.map((farm) => {
      const applicationsCount = applications.filter((app) => app.farmId === farm.id).length;
      const serviceOrdersCount = serviceOrders.filter((serviceOrder) =>
        (serviceOrder.farms || []).some((serviceOrderFarm) => serviceOrderFarm.id === farm.id)
      ).length;
      const totalAreaHectares = (farm.plots || []).reduce(
        (sum, plot) => sum + parseNumber(plot.hectare),
        0
      );

      return {
        farmId: farm.id,
        farmName: farm.name,
        customerName: farm.customer?.name || 'Cliente N/A',
        plotsCount: farm.plots?.length || 0,
        totalAreaHectares,
        applicationsCount,
        serviceOrdersCount,
      };
    });

    const blob = await generateFarmsReportPDF({
      rows: farmRows,
      generatedAt: formatGeneratedAt(),
      filtersSummary: resolveFiltersSummary(),
    });

    downloadPDF(blob, 'relatorio-fazendas.pdf');
  };

  const handleGenerateGeneralReport = async () => {
    const [applicationsResponse, serviceOrdersResponse] = await Promise.all([
      getAllApplications(buildApplicationFilters()),
      getAllServiceOrders(buildServiceOrderFilters()),
    ]);

    const applications = applicationsResponse.data || [];
    const serviceOrders = serviceOrdersResponse.data || [];

    const totalAppliedHectares = applications.reduce(
      (sum, application) => sum + parseNumber(application.hectares),
      0
    );
    const totalPlannedHectares = serviceOrders.reduce(
      (sum, serviceOrder) =>
        sum +
        (serviceOrder.plots || []).reduce((plotSum, plot) => plotSum + parseNumber(plot.hectare), 0),
      0
    );

    const byFarm = aggregateByName(
      applications.map((application) => ({
        name:
          application.farm?.name ||
          serviceOrders
            .find((serviceOrder) => serviceOrder.id === application.serviceOrderId)
            ?.farms?.find((farm) => farm.id === application.farmId)?.name ||
          'Fazenda N/A',
        value: parseNumber(application.hectares),
      }))
    );

    const byPilot = aggregateByName(
      applications.map((application) => ({
        name: application.pilot?.name || 'Piloto N/A',
        value: parseNumber(application.hectares),
      }))
    );

    const byProduct = aggregateByName(
      applications.map((application) => ({
        name: application.product?.name || 'Produto N/A',
        value: parseNumber(application.hectares),
      }))
    );

    const byAssistant = aggregateByName(
      applications.map((application) => ({
        name: application.assistant?.name || 'Ajudante N/A',
        value: parseNumber(application.hectares),
      }))
    );

    const statusSummary = {
      openCount: serviceOrders.filter((serviceOrder) => serviceOrder.status === 'open').length,
      completedCount: serviceOrders.filter((serviceOrder) => serviceOrder.status === 'completed').length,
      cancelledCount: serviceOrders.filter((serviceOrder) => serviceOrder.status === 'cancelled').length,
    };

    const blob = await generateGeneralReportPDF({
      generatedAt: formatGeneratedAt(),
      filtersSummary: resolveFiltersSummary(),
      totals: {
        applicationsCount: applications.length,
        serviceOrdersCount: serviceOrders.length,
        totalAppliedHectares,
        totalPlannedHectares,
      },
      statusSummary,
      byFarm,
      byPilot,
      byProduct,
      byAssistant,
    });

    downloadPDF(blob, 'relatorio-geral.pdf');
  };

  const handleGenerateReport = async () => {
    try {
      setIsGeneratingReport(true);
      setGenerationError(null);
      setGenerationSuccess(null);

      if (selectedReport.id === 'applications') {
        await handleGenerateApplicationsReport();
      } else if (selectedReport.id === 'service-orders') {
        await handleGenerateServiceOrderReport();
      } else if (selectedReport.id === 'farms') {
        await handleGenerateFarmsReport();
      } else {
        await handleGenerateGeneralReport();
      }

      setGenerationSuccess('Relatorio gerado com sucesso.');
      toast.success('Relatorio gerado com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar relatorio.';
      setGenerationError(message);
      toast.error(message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSelectedServiceOrderId(undefined);
    setServiceOrderSearch('');
    setGenerationError(null);
    setGenerationSuccess(null);
  };

  return (
    <div className='p-6 space-y-6 min-h-full max-w-screen'>
      <div>
        <h1 className='text-2xl font-bold'>Relatorios</h1>
        <p className='text-muted-foreground'>
          Gere relatorios consolidados com base nos filtros selecionados.
        </p>
      </div>

      <Card className='max-w-full'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-lg'>Tipo de relatorio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3'>
            {reportsCatalog.map((report) => (
              <button
                key={report.id}
                type='button'
                onClick={() => {
                  setSelectedReportId(report.id);
                  setSelectedServiceOrderId(undefined);
                  setGenerationError(null);
                  setGenerationSuccess(null);
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selectedReportId === report.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <p className='text-sm font-semibold'>{report.label}</p>
                <p className='text-xs text-muted-foreground mt-1'>{report.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className='max-w-full'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-lg'>Filtros</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end'>
            {supports('period') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Periodo</p>
                <DateRangePicker
                  key={`${filters.startDate || 'none'}-${filters.endDate || 'none'}`}
                  className='w-full'
                  initialValue={
                    filters.startDate && filters.endDate
                      ? ({ startDate: filters.startDate, endDate: filters.endDate } as DateParams)
                      : undefined
                  }
                  onChange={(value) => {
                    updateFilter('startDate', value?.startDate);
                    updateFilter('endDate', value?.endDate);
                  }}
                  placeholder='Selecionar periodo'
                />
              </div>
            )}

            {supports('cropSeason') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Safra</p>
                <SearchableSelectQuery
                  options={cropSeasons.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={filters.cropSeasonId}
                  onValueChange={(value) => updateFilter('cropSeasonId', value as string | undefined)}
                  placeholder='Selecionar safra'
                  searchPlaceholder='Buscar safra...'
                  onSearchChange={setCropSeasonSearch}
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('customer') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Cliente</p>
                <SearchableSelectQuery
                  options={customers.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={filters.customerId}
                  onValueChange={(value) => updateFilter('customerId', value as string | undefined)}
                  placeholder='Selecionar cliente'
                  searchPlaceholder='Buscar cliente...'
                  onSearchChange={setCustomerSearch}
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('farm') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Fazenda</p>
                <SearchableSelectQuery
                  options={farms.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={filters.farmId}
                  onValueChange={(value) => updateFilter('farmId', value as string | undefined)}
                  placeholder='Selecionar fazenda'
                  searchPlaceholder='Buscar fazenda...'
                  onSearchChange={setFarmSearch}
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('pilot') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Piloto</p>
                <SearchableSelectQuery
                  options={pilots.map((item: User) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={filters.pilotId}
                  onValueChange={(value) => updateFilter('pilotId', value as string | undefined)}
                  placeholder='Selecionar piloto'
                  searchPlaceholder='Buscar piloto...'
                  onSearchChange={setPilotSearch}
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('assistant') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Ajudante</p>
                <SearchableSelectQuery
                  options={assistants.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={filters.assistantId}
                  onValueChange={(value) => updateFilter('assistantId', value as string | undefined)}
                  placeholder='Selecionar ajudante'
                  searchPlaceholder='Buscar ajudante...'
                  onSearchChange={setAssistantSearch}
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('drone') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Drone</p>
                <SearchableSelectQuery
                  options={drones.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={filters.droneId}
                  onValueChange={(value) => updateFilter('droneId', value as string | undefined)}
                  placeholder='Selecionar drone'
                  searchPlaceholder='Buscar drone...'
                  onSearchChange={setDroneSearch}
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('product') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Produto</p>
                <SearchableSelectQuery
                  options={products.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  value={filters.productId}
                  onValueChange={(value) => updateFilter('productId', value as string | undefined)}
                  placeholder='Selecionar produto'
                  searchPlaceholder='Buscar produto...'
                  onSearchChange={setProductSearch}
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('serviceOrderStatus') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Status da OS</p>
                <SearchableSelectQuery
                  options={STATUS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                  value={filters.serviceOrderStatus}
                  onValueChange={(value) => updateFilter('serviceOrderStatus', value as ServiceOrderStatus | undefined)}
                  placeholder='Selecionar status'
                  searchPlaceholder='Buscar status...'
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('applicationIssue') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Tipo de aplicacao / issue</p>
                <SearchableSelectQuery
                  options={Object.entries(APPLICATION_ISSUE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  value={filters.applicationIssue}
                  onValueChange={(value) => updateFilter('applicationIssue', value as ApplicationIssueFilter | undefined)}
                  placeholder='Selecionar issue'
                  searchPlaceholder='Buscar issue...'
                  clearable
                  className='w-full'
                />
              </div>
            )}

            {supports('observation') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Observacao / tipo</p>
                <Input
                  value={filters.observation || ''}
                  onChange={(event) => updateFilter('observation', event.target.value || undefined)}
                  placeholder='Ex.: Herbicida'
                />
              </div>
            )}

            {supports('serviceOrderNumber') && (
              <div className='space-y-1'>
                <p className='text-sm font-medium'>Busca por numero da OS</p>
                <Input
                  value={filters.serviceOrderNumber || ''}
                  onChange={(event) => updateFilter('serviceOrderNumber', event.target.value || undefined)}
                  placeholder='Ex.: 135'
                />
              </div>
            )}

            {supports('serviceOrder') && (
              <div className='space-y-1 md:col-span-2 xl:col-span-2'>
                <p className='text-sm font-medium'>
                  {selectedReport.serviceOrderSelectionLabel || 'Selecionar OS'}
                </p>
                <SearchableSelectQuery
                  options={serviceOrderOptions}
                  value={selectedServiceOrderId}
                  onValueChange={(value) => setSelectedServiceOrderId(value as string | undefined)}
                  placeholder='Selecionar OS'
                  searchPlaceholder='Buscar OS...'
                  onSearchChange={setServiceOrderSearch}
                  clearable
                  isLoading={isLoadingServiceOrders}
                  className='w-full'
                />
              </div>
            )}
          </div>

          <div className='flex flex-wrap gap-2'>
            {resolveFiltersSummary().map((item) => (
              <Badge key={`${item.label}-${item.value}`} variant='outline'>
                {item.label}: {item.value}
              </Badge>
            ))}
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Button onClick={handleGenerateReport} disabled={isGeneratingReport}>
              {isGeneratingReport ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Gerando relatorio...
                </>
              ) : (
                'Gerar relatorio'
              )}
            </Button>
            <Button variant='outline' onClick={clearFilters} disabled={isGeneratingReport}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className='max-w-full'>
        <CardContent className='pt-6'>
          {!generationError && !generationSuccess && (
            <p className='text-sm text-muted-foreground'>
              Selecione o tipo de relatorio, aplique os filtros e clique em Gerar relatorio.
            </p>
          )}
          {generationError && <p className='text-sm text-red-500'>{generationError}</p>}
          {generationSuccess && <p className='text-sm text-emerald-600'>{generationSuccess}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
