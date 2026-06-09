'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import DateRangePicker, { type DateParams } from '@/components/DateRangePicker';
import {
  resolveApplicationStatusLabel,
  resolveApplicationTypeOrIssueLabel,
} from '@/components/PDFReports/ApplicationsGeneralReportPDF';
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
import { getAllUsers } from '@/services/user.service';
import {
  APPLICATION_ISSUE_LABELS,
  type Application,
  type ApplicationIssueFilter,
} from '@/types/applications.type';
import type { Farm } from '@/types/farm.type';
import type { ServiceOrder, ServiceOrderStatus } from '@/types/service-order.type';
import type { User } from '@/types/user.type';
import { generateAndDownloadApplicationIndividualReport } from '@/utils/applicationIndividualReport';
import { OPERATIONAL_TIME_ZONE } from '@/utils/operational-date';
import {
  downloadPDF,
  generateApplicationsReportPDF,
  generateFarmsReportPDF,
  generateGeneralReportPDF,
  generatePilotApplicationsReportPDF,
  generateServiceOrderStrategicReportPDF,
  generateServiceOrdersDetailedConsolidatedPDF,
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
type FarmPreviewRow = {
  farmId: string;
  farmName: string;
  customerName: string;
  plotsCount: number;
  totalAreaHectares: number;
  applicationsCount?: number;
  serviceOrdersCount?: number;
};
type GeneralPreview = {
  applicationsCount: number;
  serviceOrdersCount: number;
  farmsCount: number;
  totalAppliedHectares: number;
};
type ApplicationPreviewRow = {
  id: string;
  date: string;
  serviceOrderNumber: string;
  customerName: string;
  farmName: string;
  plotName: string;
  pilotName: string;
  productName: string;
  typeOrIssueLabel: string;
  appliedHectares: number;
  statusLabel: string;
};
type PilotPreviewRow = {
  pilotId: string;
  pilotName: string;
  statusLabel: string;
  applicationsCount: number;
  totalHectares: number;
};

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

function hasActiveFilters(filtersState: ReportsFiltersState): boolean {
  return Object.values(filtersState).some((value) => value !== undefined && value !== '');
}

function formatDate(value?: Date | string): string {
  if (!value) return 'Nao informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nao informada';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function getStatusLabel(status?: ServiceOrderStatus): string {
  if (!status) return 'Nao informado';
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function formatOperationalDate(value?: string): string {
  if (!value) return 'Nao informada';
  const onlyDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = value.match(onlyDatePattern);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nao informada';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: OPERATIONAL_TIME_ZONE }).format(date);
}

export default function ReportsCenterPage() {
  const [selectedReportId, setSelectedReportId] = useState<ReportId>('applications');
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string | undefined>(undefined);
  const [selectedServiceOrderIds, setSelectedServiceOrderIds] = useState<string[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | undefined>(undefined);
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
  const [isGeneratingRowReport, setIsGeneratingRowReport] = useState<string | null>(null);
  const [farmsPreviewRows, setFarmsPreviewRows] = useState<FarmPreviewRow[]>([]);
  const [farmsPreviewLoading, setFarmsPreviewLoading] = useState(false);
  const [farmsPreviewError, setFarmsPreviewError] = useState<string | null>(null);
  const [generalPreview, setGeneralPreview] = useState<GeneralPreview | null>(null);
  const [generalPreviewLoading, setGeneralPreviewLoading] = useState(false);
  const [generalPreviewError, setGeneralPreviewError] = useState<string | null>(null);
  const [applicationsPreviewRows, setApplicationsPreviewRows] = useState<ApplicationPreviewRow[]>([]);
  const [applicationsPreviewData, setApplicationsPreviewData] = useState<Application[]>([]);
  const [applicationsPreviewLoading, setApplicationsPreviewLoading] = useState(false);
  const [applicationsPreviewError, setApplicationsPreviewError] = useState<string | null>(null);
  const [applicationsPreviewTotalCount, setApplicationsPreviewTotalCount] = useState(0);
  const [applicationsPreviewTotalHectares, setApplicationsPreviewTotalHectares] = useState(0);
  const [pilotPreviewRows, setPilotPreviewRows] = useState<PilotPreviewRow[]>([]);
  const [pilotPreviewLoading, setPilotPreviewLoading] = useState(false);
  const [pilotPreviewError, setPilotPreviewError] = useState<string | null>(null);

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
    limit: '400',
    type: 'pilot',
    status: 'all',
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

  const serviceOrdersFoundCount = serviceOrdersData?.totalCount || filteredServiceOrders.length;

  const serviceOrderOptions = filteredServiceOrders.map((serviceOrder) => ({
    value: serviceOrder.id,
    label: `#${serviceOrder.number} - ${serviceOrder.customer?.name || 'Cliente N/A'}`,
    aditionalInformation:
      serviceOrder.farms?.length > 0 ? serviceOrder.farms.map((farm) => farm.name).join(', ') : 'Sem fazenda',
  }));

  const toggleServiceOrderSelection = (serviceOrderId: string) => {
    setSelectedServiceOrderIds((prev) =>
      prev.includes(serviceOrderId) ? prev.filter((id) => id !== serviceOrderId) : [...prev, serviceOrderId]
    );
  };

  const updateFilter = <K extends keyof ReportsFiltersState>(key: K, value: ReportsFiltersState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSelectedApplicationId(undefined);

    if (key === 'customerId') {
      setFilters((prev) => ({
        ...prev,
        customerId: value as ReportsFiltersState['customerId'],
        farmId: undefined,
      }));
      setSelectedServiceOrderId(undefined);
      setSelectedServiceOrderIds([]);
      setSelectedApplicationId(undefined);
      return;
    }

    if (key === 'farmId' || key === 'pilotId' || key === 'serviceOrderStatus' || key === 'startDate' || key === 'endDate' || key === 'serviceOrderNumber' || key === 'observation') {
      setSelectedServiceOrderId(undefined);
      setSelectedServiceOrderIds([]);
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

  const handleGenerateApplicationReport = async (applicationId?: string) => {
    const targetApplicationId = applicationId || selectedApplicationId;
    if (!targetApplicationId) {
      throw new Error('Selecione uma aplicacao para gerar o relatorio individual.');
    }

    const applicationFromPreview = applicationsPreviewData.find(
      (application) => application.id === targetApplicationId
    );

    await generateAndDownloadApplicationIndividualReport({
      applicationId: targetApplicationId,
      application: applicationFromPreview,
    });

    setSelectedApplicationId(targetApplicationId);
  };

  const handleGenerateApplicationReportById = async (applicationId: string) => {
    try {
      setIsGeneratingRowReport(applicationId);
      setGenerationError(null);
      setGenerationSuccess(null);

      await handleGenerateApplicationReport(applicationId);
      setGenerationSuccess('Relatorio da aplicacao gerado com sucesso.');
      toast.success('Relatorio da aplicacao gerado com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar relatorio da aplicacao.';
      setGenerationError(message);
      toast.error(message);
    } finally {
      setIsGeneratingRowReport(null);
    }
  };

  const handleGenerateServiceOrderReport = async () => {
    const targets = selectedServiceOrderIds;
    if (targets.length === 0) {
      throw new Error('Selecione ao menos uma OS para gerar o relatorio da OS.');
    }

    for (const serviceOrderId of targets) {
      const { serviceOrderForReport, applications } = await fetchServiceOrderAndApplications(serviceOrderId);
      const blob = await generateServiceOrderStrategicReportPDF({
        serviceOrder: serviceOrderForReport,
        applications,
      });
      downloadPDF(blob, `relatorio-os-${serviceOrderForReport.number}-estrategico.pdf`);
    }
  };

  const handleGenerateServiceOrderReportById = async (serviceOrderId: string) => {
    try {
      setIsGeneratingRowReport(serviceOrderId);
      setGenerationError(null);
      setGenerationSuccess(null);
      const { serviceOrderForReport, applications } = await fetchServiceOrderAndApplications(serviceOrderId);
      const blob = await generateServiceOrderStrategicReportPDF({
        serviceOrder: serviceOrderForReport,
        applications,
      });

      downloadPDF(blob, `relatorio-os-${serviceOrderForReport.number}-estrategico.pdf`);
      setGenerationSuccess(`Relatorio da OS #${serviceOrderForReport.number} gerado com sucesso.`);
      toast.success('Relatorio gerado com sucesso.');
      setSelectedServiceOrderId(serviceOrderId);
      setSelectedServiceOrderIds([serviceOrderId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar relatorio.';
      setGenerationError(message);
      toast.error(message);
    } finally {
      setIsGeneratingRowReport(null);
    }
  };

  const handleGenerateServiceOrderApplicationsReportById = async (serviceOrderId: string) => {
    try {
      setIsGeneratingRowReport(`apps-${serviceOrderId}`);
      setGenerationError(null);
      setGenerationSuccess(null);

      const { serviceOrderForReport, applications } = await fetchServiceOrderAndApplications(serviceOrderId);
      if (applications.length === 0) {
        throw new Error('Nao ha aplicacoes para gerar o relatorio detalhado desta OS.');
      }

      const blob = await generateApplicationsReportPDF({
        serviceOrder: serviceOrderForReport,
        applications,
      });

      downloadPDF(blob, `relatorio-aplicacoes-os-${serviceOrderForReport.number}.pdf`);
      setGenerationSuccess(`Relatorio detalhado da OS #${serviceOrderForReport.number} gerado com sucesso.`);
      toast.success('Relatorio detalhado gerado com sucesso.');
      setSelectedServiceOrderId(serviceOrderId);
      setSelectedServiceOrderIds([serviceOrderId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar relatorio detalhado.';
      setGenerationError(message);
      toast.error(message);
    } finally {
      setIsGeneratingRowReport(null);
    }
  };

  const handleGenerateSelectedServiceOrdersDetailedReport = async () => {
    const targets = selectedServiceOrderIds;
    if (targets.length === 0) {
      throw new Error('Selecione ao menos uma OS para gerar o relatorio detalhado.');
    }

    const sections: Array<{ serviceOrder: ServiceOrder; applications: Application[] }> = [];
    for (const serviceOrderId of targets) {
      const { serviceOrderForReport, applications } = await fetchServiceOrderAndApplications(serviceOrderId);
      sections.push({
        serviceOrder: serviceOrderForReport,
        applications,
      });
    }

    const totalApps = sections.reduce((sum, section) => sum + section.applications.length, 0);
    if (totalApps === 0) {
      throw new Error('Nao ha aplicacoes nas OS selecionadas para gerar o relatorio detalhado.');
    }

    const blob = await generateServiceOrdersDetailedConsolidatedPDF({
      generatedAt: formatGeneratedAt(),
      filtersSummary: resolveFiltersSummary(),
      sections,
    });
    downloadPDF(blob, `relatorio-detalhado-os-${targets.length}-selecionadas.pdf`);
  };

  const handleGeneratePilotReport = async () => {
    const response = await getAllApplications({
      ...buildApplicationFilters(),
      page: '1',
      limit: '1000',
    });
    const apps = response.data || [];
    if (apps.length === 0) {
      throw new Error('Nenhuma aplicacao encontrada para os filtros selecionados.');
    }

    const grouped = new Map<string, Application[]>();
    apps.forEach((app) => {
      const pilotName = app.pilot?.name || 'Piloto nao informado';
      const current = grouped.get(pilotName) || [];
      current.push(app);
      grouped.set(pilotName, current);
    });

    const groups = Array.from(grouped.entries())
      .map(([pilotName, applications]) => ({ pilotName, applications }))
      .sort((a, b) => a.pilotName.localeCompare(b.pilotName, 'pt-BR'));

    const blob = await generatePilotApplicationsReportPDF({
      generatedAt: formatGeneratedAt(),
      filtersSummary: resolveFiltersSummary(),
      groups,
    });
    downloadPDF(blob, 'relatorio-por-piloto.pdf');
  };

  const handleGeneratePilotReportById = async (pilotId: string, pilotName: string) => {
    const response = await getAllApplications({
      ...buildApplicationFilters(),
      pilotId,
      page: '1',
      limit: '1000',
    });
    const apps = response.data || [];
    if (apps.length === 0) {
      throw new Error(`Nenhuma aplicacao encontrada para o piloto ${pilotName}.`);
    }

    const blob = await generatePilotApplicationsReportPDF({
      generatedAt: formatGeneratedAt(),
      filtersSummary: [
        ...resolveFiltersSummary().filter((item) => item.label !== 'Piloto'),
        { label: 'Piloto', value: pilotName },
      ],
      groups: [{ pilotName, applications: apps }],
    });
    downloadPDF(blob, `relatorio-piloto-${pilotName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
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
        parseNumber(
          serviceOrder.plannedHectares ??
            (serviceOrder.plots || []).reduce(
              (plotSum, plot) => plotSum + parseNumber(plot.hectare),
              0
            )
        ),
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
        await handleGenerateApplicationReport();
      } else if (selectedReport.id === 'service-orders') {
        await handleGenerateServiceOrderReport();
      } else if (selectedReport.id === 'pilot') {
        await handleGeneratePilotReport();
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
    setSelectedServiceOrderIds([]);
    setSelectedApplicationId(undefined);
    setServiceOrderSearch('');
    setGenerationError(null);
    setGenerationSuccess(null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadApplicationsPreview = async () => {
      if (selectedReport.id !== 'applications') return;
      setApplicationsPreviewLoading(true);
      setApplicationsPreviewError(null);
      try {
        const response = await getAllApplications({
          ...buildApplicationFilters(),
          page: '1',
          limit: '50',
        });

        if (!isMounted) return;

        const rows = (response.data || []).map((application) => ({
          id: application.id,
          date: formatOperationalDate(application.date),
          serviceOrderNumber: application.serviceOrder?.number
            ? `#${application.serviceOrder.number}`
            : application.serviceOrderId
              ? `#${application.serviceOrderId}`
              : '-',
          customerName: application.serviceOrder?.customer?.name || '-',
          farmName: application.farm?.name || '-',
          plotName: application.plot?.name || '-',
          pilotName: application.pilot?.name || '-',
          productName: application.product?.name || '-',
          typeOrIssueLabel: resolveApplicationTypeOrIssueLabel(application.observations),
          appliedHectares: parseNumber(application.hectares),
          statusLabel: resolveApplicationStatusLabel(application.serviceOrder?.status),
        }));

        setApplicationsPreviewData(response.data || []);
        setApplicationsPreviewRows(rows);
        setApplicationsPreviewTotalCount(response.totalCount || rows.length);
        setApplicationsPreviewTotalHectares(parseNumber(response.summary?.totalFilteredHectares));
        setSelectedApplicationId((previous) => {
          if (previous && rows.some((row) => row.id === previous)) {
            return previous;
          }
          return rows[0]?.id;
        });
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Erro ao carregar aplicacoes.';
        setApplicationsPreviewData([]);
        setApplicationsPreviewError(message);
      } finally {
        if (isMounted) setApplicationsPreviewLoading(false);
      }
    };

    loadApplicationsPreview();
    return () => {
      isMounted = false;
    };
  }, [selectedReport.id, filters]);

  useEffect(() => {
    let isMounted = true;

    const loadPilotPreview = async () => {
      if (selectedReport.id !== 'pilot') return;
      setPilotPreviewLoading(true);
      setPilotPreviewError(null);
      try {
        const [usersResponse, applicationsResponse] = await Promise.all([
          getAllUsers({
            page: '1',
            limit: '500',
            type: 'pilot',
            status: 'all',
            search: pilotSearch || undefined,
          }),
          getAllApplications({
            ...buildApplicationFilters(),
            page: '1',
            limit: '1000',
          }),
        ]);

        if (!isMounted) return;
        const applications = applicationsResponse.data || [];
        const map = new Map<string, PilotPreviewRow>();

        (usersResponse.data || []).forEach((pilot) => {
          map.set(pilot.id, {
            pilotId: pilot.id,
            pilotName: pilot.name,
            statusLabel: pilot.deletedAt ? 'Inativo' : 'Ativo',
            applicationsCount: 0,
            totalHectares: 0,
          });
        });

        applications.forEach((app) => {
          const pilotId = app.pilotId || app.pilot?.id;
          const pilotName = app.pilot?.name || 'Piloto nao informado';
          const current = pilotId
            ? map.get(pilotId) || {
                pilotId,
                pilotName,
                statusLabel: 'Ativo',
                applicationsCount: 0,
                totalHectares: 0,
              }
            : {
                pilotId: `unknown-${pilotName}`,
                pilotName,
                statusLabel: 'Nao informado',
                applicationsCount: 0,
                totalHectares: 0,
              };
          current.applicationsCount += 1;
          current.totalHectares += parseNumber(app.hectares);
          map.set(current.pilotId, current);
        });

        const rows = Array.from(map.values()).sort((a, b) => a.pilotName.localeCompare(b.pilotName, 'pt-BR'));
        setPilotPreviewRows(rows);
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Erro ao carregar pilotos.';
        setPilotPreviewRows([]);
        setPilotPreviewError(message);
      } finally {
        if (isMounted) setPilotPreviewLoading(false);
      }
    };

    loadPilotPreview();
    return () => {
      isMounted = false;
    };
  }, [selectedReport.id, filters, pilotSearch]);

  useEffect(() => {
    let isMounted = true;

    const loadFarmsPreview = async () => {
      if (selectedReport.id !== 'farms') return;
      setFarmsPreviewLoading(true);
      setFarmsPreviewError(null);
      try {
        const [farmsResponse, applicationsResponse, serviceOrdersResponse] = await Promise.all([
          getAllFarms(filters.customerId, {
            page: '1',
            limit: '200',
            includeCustomer: 'true',
            includePlots: 'true',
            includeGeoJson: 'false',
            search: undefined,
          }),
          getAllApplications({
            ...buildApplicationFilters(),
            page: '1',
            limit: '1000',
          }),
          getAllServiceOrders(buildServiceOrderFilters()),
        ]);

        if (!isMounted) return;
        const rows = (farmsResponse.data || [])
          .filter((farm) => (filters.farmId ? farm.id === filters.farmId : true))
          .map((farm) => ({
            farmId: farm.id,
            farmName: farm.name,
            customerName: farm.customer?.name || 'Cliente N/A',
            plotsCount: farm.plots?.length || 0,
            totalAreaHectares: (farm.plots || []).reduce((sum, plot) => sum + parseNumber(plot.hectare), 0),
            applicationsCount: (applicationsResponse.data || []).filter((app) => app.farmId === farm.id).length,
            serviceOrdersCount: (serviceOrdersResponse.data || []).filter((serviceOrder) =>
              (serviceOrder.farms || []).some((serviceOrderFarm) => serviceOrderFarm.id === farm.id)
            ).length,
          }));
        setFarmsPreviewRows(rows);
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Erro ao carregar fazendas.';
        setFarmsPreviewError(message);
      } finally {
        if (isMounted) setFarmsPreviewLoading(false);
      }
    };

    loadFarmsPreview();
    return () => {
      isMounted = false;
    };
  }, [selectedReport.id, filters]);

  useEffect(() => {
    let isMounted = true;

    const loadGeneralPreview = async () => {
      if (selectedReport.id !== 'general') return;
      setGeneralPreviewLoading(true);
      setGeneralPreviewError(null);
      try {
        const [applicationsResponse, serviceOrdersResponse, farmsResponse] = await Promise.all([
          getAllApplications({
            ...buildApplicationFilters(),
            page: '1',
            limit: '1000',
          }),
          getAllServiceOrders(buildServiceOrderFilters()),
          getAllFarms(filters.customerId, {
            page: '1',
            limit: '200',
            includeCustomer: 'true',
            includePlots: 'true',
            includeGeoJson: 'false',
          }),
        ]);

        if (!isMounted) return;
        setGeneralPreview({
          applicationsCount: applicationsResponse.totalCount || applicationsResponse.data.length,
          serviceOrdersCount: serviceOrdersResponse.totalCount || serviceOrdersResponse.data.length,
          farmsCount: farmsResponse.totalCount || farmsResponse.data.length,
          totalAppliedHectares:
            parseNumber(applicationsResponse.summary?.totalFilteredHectares) ||
            (applicationsResponse.data || []).reduce((sum, app) => sum + parseNumber(app.hectares), 0),
        });
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : 'Erro ao carregar resumo geral.';
        setGeneralPreviewError(message);
      } finally {
        if (isMounted) setGeneralPreviewLoading(false);
      }
    };

    loadGeneralPreview();
    return () => {
      isMounted = false;
    };
  }, [selectedReport.id, filters]);

  return (
    <div className='p-6 flex flex-col gap-6 min-h-full max-w-screen'>
      <div>
        <h1 className='text-2xl font-bold'>Relatorios</h1>
        <p className='text-muted-foreground'>
          Gere relatorios conforme os filtros e o tipo selecionado.
        </p>
      </div>

      <Card className='max-w-full order-1'>
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
                  setSelectedServiceOrderIds([]);
                  setSelectedApplicationId(undefined);
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

      <Card className='max-w-full order-2'>
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

            {supports('serviceOrder') && selectedReport.id !== 'service-orders' && (
              <div className='space-y-1 md:col-span-2 xl:col-span-2'>
                <p className='text-sm font-medium'>
                  {selectedReport.serviceOrderSelectionLabel || 'Selecionar OS'}
                </p>
                <SearchableSelectQuery
                  options={serviceOrderOptions}
                  value={selectedServiceOrderId}
                  onValueChange={(value) => {
                    const nextValue = value as string | undefined;
                    setSelectedServiceOrderId(nextValue);
                    setSelectedServiceOrderIds(nextValue ? [nextValue] : []);
                  }}
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
            <Button
              onClick={handleGenerateReport}
              disabled={
                isGeneratingReport ||
                (selectedReport.id === 'applications' &&
                  (applicationsPreviewLoading ||
                    applicationsPreviewRows.length === 0 ||
                    !selectedApplicationId)) ||
                (selectedReport.id === 'service-orders' &&
                  selectedServiceOrderIds.length === 0)
              }
            >
              {isGeneratingReport ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Gerando relatorio...
                </>
              ) : (
                selectedReport.id === 'applications'
                  ? 'Gerar relatorio da aplicacao'
                  : selectedReport.id === 'service-orders'
                    ? 'Gerar relatorio da OS'
                    : selectedReport.id === 'pilot'
                      ? 'Gerar relatorio por piloto'
                      : 'Gerar relatorio'
              )}
            </Button>
            <Button variant='outline' onClick={clearFilters} disabled={isGeneratingReport}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className='max-w-full order-3'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-lg'>Relatorios disponiveis</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {selectedReport.id === 'service-orders' && (
            <div className='space-y-3'>
              <div>
                <p className='text-sm font-semibold'>Ordens de Servico encontradas</p>
                <p className='text-xs text-muted-foreground'>
                  Cada OS possui dois fluxos: mapa estrategico e relatorio detalhado de aplicacao.
                </p>
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline'>Selecionadas: {selectedServiceOrderIds.length}</Badge>
                <Button
                  size='sm'
                  onClick={handleGenerateServiceOrderReport}
                  disabled={isGeneratingReport || selectedServiceOrderIds.length === 0}
                >
                  Mapa estrategico (selecionadas)
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={handleGenerateSelectedServiceOrdersDetailedReport}
                  disabled={isGeneratingReport || selectedServiceOrderIds.length === 0}
                >
                  Relatorio detalhado (selecionadas)
                </Button>
              </div>

              <div className='text-xs text-muted-foreground'>
                {serviceOrdersFoundCount} OS encontradas
                {!hasActiveFilters(filters) ? ' (lista inicial limitada)' : ''}
              </div>

              {filteredServiceOrders.length === 0 && (
                <p className='text-sm text-muted-foreground'>Nenhuma OS encontrada para os filtros atuais.</p>
              )}

              <div className='space-y-2'>
                {filteredServiceOrders.map((serviceOrder) => {
                  const plannedTotal = (serviceOrder.plots || []).reduce(
                    (sum, plot) => sum + parseNumber(plot.hectare),
                    0
                  );
                  const pilotsLabel =
                    serviceOrder.pilots?.length > 0
                      ? serviceOrder.pilots.map((pilot) => pilot.name).join(', ')
                      : 'Nao informado';
                  return (
                    <div key={serviceOrder.id} className='rounded-lg border p-3'>
                      <div className='flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between'>
                        <div className='space-y-1'>
                          <label className='flex items-center gap-2 text-xs text-muted-foreground'>
                            <input
                              type='checkbox'
                              checked={selectedServiceOrderIds.includes(serviceOrder.id)}
                              onChange={() => toggleServiceOrderSelection(serviceOrder.id)}
                            />
                            Selecionar OS
                          </label>
                          <p className='text-sm font-semibold'>
                            OS #{serviceOrder.number} | {serviceOrder.customer?.name || 'Cliente N/A'}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Fazendas:{' '}
                            {serviceOrder.farms?.length > 0
                              ? serviceOrder.farms.map((farm) => farm.name).join(', ')
                              : 'Sem fazenda'}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Contrato/Safra: {serviceOrder.contract?.name || 'Nao informado'}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Planejada: {formatDate(serviceOrder.plannedDate)} | Status:{' '}
                            {getStatusLabel(serviceOrder.status)}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Observacao/Tipo: {serviceOrder.observation || 'Nao informado'}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Total planejado: {plannedTotal.toFixed(2)} ha | Pilotos: {pilotsLabel}
                          </p>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                          <Button
                            size='sm'
                            onClick={() => handleGenerateServiceOrderReportById(serviceOrder.id)}
                            disabled={isGeneratingReport || isGeneratingRowReport === serviceOrder.id}
                          >
                            {isGeneratingRowReport === serviceOrder.id ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Gerando...
                              </>
                            ) : (
                              'Mapa estrategico'
                            )}
                          </Button>
                          <Button
                            size='sm'
                            variant='secondary'
                            onClick={() => handleGenerateServiceOrderApplicationsReportById(serviceOrder.id)}
                            disabled={
                              isGeneratingReport || isGeneratingRowReport === `apps-${serviceOrder.id}`
                            }
                          >
                            {isGeneratingRowReport === `apps-${serviceOrder.id}` ? (
                              <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Gerando...
                              </>
                            ) : (
                              'Relatorio detalhado'
                            )}
                          </Button>
                          <Button size='sm' variant='outline' asChild>
                            <Link href={`/dashboard/service-orders/${serviceOrder.id}`}>Abrir OS</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedReport.id === 'applications' && (
            <div className='space-y-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                  <p className='text-sm font-semibold'>Aplicacoes encontradas</p>
                  <p className='text-xs text-muted-foreground'>
                    Selecione uma aplicacao para gerar o relatorio individual do voo/aplicacao.
                  </p>
                </div>
                <Button
                  size='sm'
                  onClick={handleGenerateReport}
                  disabled={
                    isGeneratingReport ||
                    applicationsPreviewLoading ||
                    applicationsPreviewRows.length === 0 ||
                    !selectedApplicationId ||
                    !!isGeneratingRowReport
                  }
                >
                  {isGeneratingReport ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Gerando...
                    </>
                  ) : (
                    'Gerar relatorio da aplicacao'
                  )}
                </Button>
              </div>
              {selectedApplicationId && (
                <p className='text-xs text-muted-foreground'>
                  Aplicacao selecionada: <span className='font-medium'>{selectedApplicationId}</span>
                </p>
              )}
              {applicationsPreviewLoading && (
                <p className='text-sm text-muted-foreground'>Carregando aplicacoes...</p>
              )}
              {applicationsPreviewError && <p className='text-sm text-red-500'>{applicationsPreviewError}</p>}
              {!applicationsPreviewLoading &&
                !applicationsPreviewError &&
                applicationsPreviewRows.length === 0 && (
                  <p className='text-sm text-muted-foreground'>
                    Nenhuma aplicacao encontrada para os filtros selecionados.
                  </p>
                )}
              {!applicationsPreviewLoading &&
                !applicationsPreviewError &&
                applicationsPreviewRows.length > 0 && (
                  <div className='space-y-2'>
                    <div className='overflow-x-auto rounded-lg border'>
                      <table className='w-full text-xs'>
                        <thead className='bg-muted/40'>
                          <tr className='text-left'>
                            <th className='px-3 py-2 font-medium'>Data</th>
                            <th className='px-3 py-2 font-medium'>OS</th>
                            <th className='px-3 py-2 font-medium'>Cliente</th>
                            <th className='px-3 py-2 font-medium'>Fazenda</th>
                            <th className='px-3 py-2 font-medium'>Talhao/Mapa</th>
                            <th className='px-3 py-2 font-medium'>Piloto</th>
                            <th className='px-3 py-2 font-medium'>Produto</th>
                            <th className='px-3 py-2 font-medium'>Tipo/Issue</th>
                            <th className='px-3 py-2 font-medium'>Area aplicada</th>
                            <th className='px-3 py-2 font-medium'>Status</th>
                            <th className='px-3 py-2 font-medium text-right'>Acoes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {applicationsPreviewRows.map((row) => {
                            const isSelected = selectedApplicationId === row.id;
                            return (
                            <tr key={row.id} className={`border-t ${isSelected ? 'bg-primary/5' : ''}`}>
                              <td className='px-3 py-2'>{row.date}</td>
                              <td className='px-3 py-2'>{row.serviceOrderNumber}</td>
                              <td className='px-3 py-2'>{row.customerName}</td>
                              <td className='px-3 py-2'>{row.farmName}</td>
                              <td className='px-3 py-2'>{row.plotName}</td>
                              <td className='px-3 py-2'>{row.pilotName}</td>
                              <td className='px-3 py-2'>{row.productName}</td>
                              <td className='px-3 py-2'>{row.typeOrIssueLabel}</td>
                              <td className='px-3 py-2'>{row.appliedHectares.toFixed(2)} ha</td>
                              <td className='px-3 py-2'>{row.statusLabel}</td>
                              <td className='px-3 py-2'>
                                <div className='flex justify-end gap-2'>
                                  <Button
                                    size='sm'
                                    variant={isSelected ? 'default' : 'outline'}
                                    onClick={() => setSelectedApplicationId(row.id)}
                                  >
                                    {isSelected ? 'Selecionada' : 'Selecionar'}
                                  </Button>
                                  <Button
                                    size='sm'
                                    onClick={() => handleGenerateApplicationReportById(row.id)}
                                    disabled={isGeneratingReport || isGeneratingRowReport === row.id}
                                  >
                                    {isGeneratingRowReport === row.id ? (
                                      <>
                                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                        Gerando...
                                      </>
                                    ) : (
                                      'Gerar relatorio'
                                    )}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                      <p>Previa: {applicationsPreviewRows.length} aplicacoes exibidas.</p>
                      <p>Total filtrado: {applicationsPreviewTotalCount} aplicacoes.</p>
                      <p>Area total filtrada: {applicationsPreviewTotalHectares.toFixed(2)} ha.</p>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Exibindo ate 50 aplicacoes na previa. O PDF e gerado apenas para a aplicacao selecionada.
                    </p>
                  </div>
                )}
            </div>
          )}

          {selectedReport.id === 'farms' && (
            <div className='space-y-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-sm font-semibold'>Fazendas encontradas</p>
                <Button
                  size='sm'
                  onClick={handleGenerateReport}
                  disabled={isGeneratingReport || farmsPreviewLoading || farmsPreviewRows.length === 0}
                >
                  {isGeneratingReport ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Gerando relatorio de fazendas...
                    </>
                  ) : (
                    'Gerar relatorio de fazendas'
                  )}
                </Button>
              </div>
              {farmsPreviewLoading && <p className='text-sm text-muted-foreground'>Carregando fazendas...</p>}
              {farmsPreviewError && <p className='text-sm text-red-500'>{farmsPreviewError}</p>}
              {!farmsPreviewLoading && !farmsPreviewError && farmsPreviewRows.length === 0 && (
                <p className='text-sm text-muted-foreground'>Nenhuma fazenda encontrada para os filtros atuais.</p>
              )}
              <div className='space-y-2'>
                {farmsPreviewRows.map((farmRow) => (
                  <div key={farmRow.farmId} className='rounded-lg border p-3'>
                    <p className='text-sm font-semibold'>{farmRow.farmName}</p>
                    <p className='text-xs text-muted-foreground'>Cliente: {farmRow.customerName}</p>
                    <p className='text-xs text-muted-foreground'>
                      Area total: {farmRow.totalAreaHectares.toFixed(2)} ha | Talhoes/Mapas: {farmRow.plotsCount}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Aplicacoes vinculadas: {farmRow.applicationsCount || 0} | OS vinculadas:{' '}
                      {farmRow.serviceOrdersCount || 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedReport.id === 'pilot' && (
            <div className='space-y-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                  <p className='text-sm font-semibold'>Relatorio por piloto</p>
                  <p className='text-xs text-muted-foreground'>
                    Gera uma lista compacta agrupada por piloto, sem mapa, conforme os filtros.
                  </p>
                </div>
                <Button size='sm' onClick={handleGenerateReport} disabled={isGeneratingReport}>
                  {isGeneratingReport ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Gerando...
                    </>
                  ) : (
                    'Gerar relatorio por piloto'
                  )}
                </Button>
              </div>
              {pilotPreviewLoading && <p className='text-sm text-muted-foreground'>Carregando pilotos...</p>}
              {pilotPreviewError && <p className='text-sm text-red-500'>{pilotPreviewError}</p>}
              {!pilotPreviewLoading && !pilotPreviewError && (
                <div className='space-y-2'>
                  {pilotPreviewRows.map((pilotRow) => (
                    <div key={pilotRow.pilotId} className='rounded-lg border p-3'>
                      <div className='flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between'>
                        <div className='space-y-1'>
                          <p className='text-sm font-semibold'>{pilotRow.pilotName}</p>
                          <p className='text-xs text-muted-foreground'>Status: {pilotRow.statusLabel}</p>
                          <p className='text-xs text-muted-foreground'>
                            Aplicacoes: {pilotRow.applicationsCount} | Hectares: {pilotRow.totalHectares.toFixed(2)} ha
                          </p>
                        </div>
                        <Button
                          size='sm'
                          onClick={async () => {
                            try {
                              setIsGeneratingRowReport(`pilot-${pilotRow.pilotId}`);
                              setGenerationError(null);
                              setGenerationSuccess(null);
                              await handleGeneratePilotReportById(pilotRow.pilotId, pilotRow.pilotName);
                              setGenerationSuccess(`Relatorio do piloto ${pilotRow.pilotName} gerado com sucesso.`);
                              toast.success('Relatorio do piloto gerado com sucesso.');
                            } catch (error) {
                              const message = error instanceof Error ? error.message : 'Erro ao gerar relatorio do piloto.';
                              setGenerationError(message);
                              toast.error(message);
                            } finally {
                              setIsGeneratingRowReport(null);
                            }
                          }}
                          disabled={isGeneratingReport || isGeneratingRowReport === `pilot-${pilotRow.pilotId}`}
                        >
                          {isGeneratingRowReport === `pilot-${pilotRow.pilotId}` ? (
                            <>
                              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                              Gerando...
                            </>
                          ) : (
                            'Gerar relatorio'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className='text-xs text-muted-foreground'>
                Se um piloto estiver filtrado, o PDF trara apenas esse piloto. Sem filtro de piloto, o PDF agrupa todos os pilotos retornados.
              </p>
            </div>
          )}

          {selectedReport.id === 'general' && (
            <div className='space-y-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-sm font-semibold'>Resumo do recorte filtrado</p>
                <Button size='sm' onClick={handleGenerateReport} disabled={isGeneratingReport || generalPreviewLoading}>
                  {isGeneratingReport ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Gerando...
                    </>
                  ) : (
                    'Gerar relatorio geral'
                  )}
                </Button>
              </div>
              {generalPreviewLoading && <p className='text-sm text-muted-foreground'>Carregando resumo...</p>}
              {generalPreviewError && <p className='text-sm text-red-500'>{generalPreviewError}</p>}
              {generalPreview && (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2'>
                  <div className='rounded-lg border p-3'>
                    <p className='text-xs text-muted-foreground'>Total aplicado</p>
                    <p className='text-sm font-semibold'>{generalPreview.totalAppliedHectares.toFixed(2)} ha</p>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <p className='text-xs text-muted-foreground'>Aplicacoes</p>
                    <p className='text-sm font-semibold'>{generalPreview.applicationsCount}</p>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <p className='text-xs text-muted-foreground'>Ordens de Servico</p>
                    <p className='text-sm font-semibold'>{generalPreview.serviceOrdersCount}</p>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <p className='text-xs text-muted-foreground'>Fazendas</p>
                    <p className='text-sm font-semibold'>{generalPreview.farmsCount}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className='max-w-full order-4'>
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
