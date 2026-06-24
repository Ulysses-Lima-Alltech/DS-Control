import { Feather, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import DatePickeriOSModal from '@/components/ui/DatePickeriOSModal';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import { COLORS } from '@/constants/colors';
import { useGetAllApplications, useGetStatsApplications } from '@/queries/application.query';
import { useGetAllAssistantsInfinite } from '@/queries/assistant.query';
import { useGetAllCropSeasonsInfinite, useGetCurrentCropSeason } from '@/queries/crop-season.query';
import { useGetAllCustomersInfinite } from '@/queries/customer.query';
import { useGetAllDronesInfinite } from '@/queries/drone.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllProductsInfinite } from '@/queries/product.query';
import { useGetAllUsersInfinite } from '@/queries/user.query';
import { GetAllApplicationsParams } from '@/services/application.service';
import {
  Application,
  ApplicationIssueFilter,
  APPLICATION_ISSUE_LABELS,
  ApplicationOrderBy,
  ApplicationOrderType,
} from '@/types/applications.type';
import { Assistant } from '@/types/assistant.type';
import { CropSeason } from '@/types/crop-season.type';
import { Customer } from '@/types/customer.type';
import { Drone } from '@/types/drone.type';
import { Farm } from '@/types/farm.type';
import { Product } from '@/types/product.type';
import { ServiceOrderStatus } from '@/types/service-order.type';
import { User } from '@/types/user.type';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { isAndroid } from '@/utils/isAndroid';

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const serviceOrderStatusOptions: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos os status' },
  { id: 'open', label: 'Aberto' },
  { id: 'completed', label: 'Concluido' },
  { id: 'cancelled', label: 'Cancelado' },
];

const invalidApplicationOptions: { id: string; label: string }[] = [
  { id: 'all', label: 'Todas (validas + inconsistentes)' },
  { id: 'true', label: 'Somente inconsistentes' },
  { id: 'false', label: 'Somente validas' },
];

const orderByOptions: { id: string; label: string }[] = [
  { id: ApplicationOrderBy.DATE, label: 'Data da aplicacao' },
  { id: ApplicationOrderBy.PILOT, label: 'Piloto' },
  { id: ApplicationOrderBy.PRODUCT, label: 'Produto' },
];

const orderTypeOptions: { id: string; label: string }[] = [
  { id: ApplicationOrderType.DESC, label: 'Descendente' },
  { id: ApplicationOrderType.ASC, label: 'Ascendente' },
];

const limitOptions: { id: string; label: string }[] = [
  { id: '5', label: '5 por pagina' },
  { id: '10', label: '10 por pagina' },
  { id: '20', label: '20 por pagina' },
];

const applicationIssueOptions: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos os tipos' },
  ...Object.entries(APPLICATION_ISSUE_LABELS).map(([id, label]) => ({ id, label })),
];

const parseNumeric = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCivilDateParam = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseCivilDate = (value?: string) => {
  if (value && DATE_PARAM_REGEX.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
};

const formatHectares = (value: number | undefined) =>
  `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;

const formatInteger = (value: number | undefined) => Number(value || 0).toLocaleString('pt-BR');

type ApplicationWithQualityFlags = Application & {
  invalidApplication?: boolean;
  applicationIssue?: ApplicationIssueFilter;
};

const getServiceOrderStatusLabel = (status?: ServiceOrderStatus) => {
  if (status === 'open') return 'Aberto';
  if (status === 'completed') return 'Concluido';
  if (status === 'cancelled') return 'Cancelado';
  return 'N/A';
};

function MetricCard({
  title,
  value,
  subtitle,
  highlight,
}: {
  title: string;
  value: string;
  subtitle?: string;
  highlight?: 'normal' | 'warning';
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={highlight === 'warning' ? styles.metricValueWarning : styles.metricValue}>
        {value}
      </Text>
      {subtitle ? <Text style={styles.metricSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataField}>
      <Text style={styles.dataFieldLabel}>{label}</Text>
      <Text style={styles.dataFieldValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function BackofficeApplications() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isTablet = width >= 900;
  const shouldUseTwoColumns = width >= 760;
  const cardColumnWidth = shouldUseTwoColumns ? '48.6%' : '100%';
  const filterColumnWidth = shouldUseTwoColumns ? '48.6%' : '100%';

  const [showFilters, setShowFilters] = useState(isTablet);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [pageSize, setPageSize] = useState('10');
  const [orderBy, setOrderBy] = useState<ApplicationOrderBy>(ApplicationOrderBy.DATE);
  const [orderType, setOrderType] = useState<ApplicationOrderType>(ApplicationOrderType.DESC);

  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [pilotId, setPilotId] = useState<string | undefined>(undefined);
  const [assistantId, setAssistantId] = useState<string | undefined>(undefined);
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [cropSeasonId, setCropSeasonId] = useState<string | undefined>(undefined);
  const [droneId, setDroneId] = useState<string | undefined>(undefined);
  const [serviceOrderStatus, setServiceOrderStatus] = useState<ServiceOrderStatus | undefined>(
    undefined
  );
  const [applicationIssue, setApplicationIssue] = useState<ApplicationIssueFilter | undefined>(
    undefined
  );
  const [invalidApplication, setInvalidApplication] = useState<'all' | 'true' | 'false'>('all');

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [farmSearchTerm, setFarmSearchTerm] = useState('');
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [assistantSearchTerm, setAssistantSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [cropSeasonSearchTerm, setCropSeasonSearchTerm] = useState('');
  const [droneSearchTerm, setDroneSearchTerm] = useState('');
  const cropSeasonDefaultAppliedRef = useRef(false);

  useEffect(() => {
    if (isTablet) {
      setShowFilters(true);
    }
  }, [isTablet]);

  const { data: currentCropSeasonData } = useGetCurrentCropSeason();

  useEffect(() => {
    if (cropSeasonDefaultAppliedRef.current) {
      return;
    }

    if (currentCropSeasonData?.cropSeason?.id) {
      setCropSeasonId(currentCropSeasonData.cropSeason.id);
      cropSeasonDefaultAppliedRef.current = true;
    }
  }, [currentCropSeasonData?.cropSeason?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    startDate,
    endDate,
    customerId,
    farmId,
    pilotId,
    assistantId,
    productId,
    cropSeasonId,
    droneId,
    serviceOrderStatus,
    applicationIssue,
    invalidApplication,
    orderBy,
    orderType,
    pageSize,
  ]);

  const {
    data: customersData,
    hasNextPage: hasNextPageCustomers,
    isFetchingNextPage: isFetchingNextPageCustomers,
    fetchNextPage: fetchNextPageCustomers,
    isFetching: isFetchingCustomers,
  } = useGetAllCustomersInfinite({
    limit: '10',
    search: customerSearchTerm || undefined,
  });
  const {
    data: farmsData,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    fetchNextPage: fetchNextPageFarms,
    isFetching: isFetchingFarms,
  } = useGetAllFarmsInfinite(customerId, {
    limit: '10',
    search: farmSearchTerm || undefined,
    includeCustomer: 'true',
  });
  const {
    data: pilotsData,
    hasNextPage: hasNextPagePilots,
    isFetchingNextPage: isFetchingNextPagePilots,
    fetchNextPage: fetchNextPagePilots,
    isFetching: isFetchingPilots,
  } = useGetAllUsersInfinite({
    type: 'pilot',
    status: 'active',
    limit: '10',
    search: pilotSearchTerm || undefined,
  });
  const {
    data: assistantsData,
    hasNextPage: hasNextPageAssistants,
    isFetchingNextPage: isFetchingNextPageAssistants,
    fetchNextPage: fetchNextPageAssistants,
    isFetching: isFetchingAssistants,
  } = useGetAllAssistantsInfinite({
    limit: '10',
    search: assistantSearchTerm || undefined,
  });
  const {
    data: productsData,
    hasNextPage: hasNextPageProducts,
    isFetchingNextPage: isFetchingNextPageProducts,
    fetchNextPage: fetchNextPageProducts,
    isFetching: isFetchingProducts,
  } = useGetAllProductsInfinite({
    limit: '10',
    search: productSearchTerm || undefined,
  });
  const {
    data: cropSeasonsData,
    hasNextPage: hasNextPageCropSeasons,
    isFetchingNextPage: isFetchingNextPageCropSeasons,
    fetchNextPage: fetchNextPageCropSeasons,
    isFetching: isFetchingCropSeasons,
  } = useGetAllCropSeasonsInfinite({
    limit: '10',
    search: cropSeasonSearchTerm || undefined,
    status: 'active',
  });
  const {
    data: dronesData,
    hasNextPage: hasNextPageDrones,
    isFetchingNextPage: isFetchingNextPageDrones,
    fetchNextPage: fetchNextPageDrones,
    isFetching: isFetchingDrones,
  } = useGetAllDronesInfinite({
    limit: '10',
    search: droneSearchTerm || undefined,
  });

  const listedCustomers: Customer[] = useMemo(
    () =>
      ((customersData as unknown as InfiniteData<{ data: Customer[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Customer[]) || [],
    [customersData]
  );
  const listedFarms: Farm[] = useMemo(
    () =>
      ((farmsData as unknown as InfiniteData<{ data: Farm[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Farm[]) || [],
    [farmsData]
  );
  const listedPilots: User[] = useMemo(
    () =>
      ((pilotsData as unknown as InfiniteData<{ data: User[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as User[]) || [],
    [pilotsData]
  );
  const listedAssistants: Assistant[] = useMemo(
    () =>
      ((
        assistantsData as unknown as InfiniteData<{ data: Assistant[] }> | undefined
      )?.pages?.flatMap((page) => page.data) as Assistant[]) || [],
    [assistantsData]
  );
  const listedProducts: Product[] = useMemo(
    () =>
      ((productsData as unknown as InfiniteData<{ data: Product[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Product[]) || [],
    [productsData]
  );
  const listedCropSeasons: CropSeason[] = useMemo(
    () =>
      ((
        cropSeasonsData as unknown as InfiniteData<{ data: CropSeason[] }> | undefined
      )?.pages?.flatMap((page) => page.data) as CropSeason[]) || [],
    [cropSeasonsData]
  );
  const listedDrones: Drone[] = useMemo(
    () =>
      ((dronesData as unknown as InfiniteData<{ data: Drone[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Drone[]) || [],
    [dronesData]
  );

  const allCustomerOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os clientes' }, ...listedCustomers],
    [listedCustomers]
  );
  const allFarmOptions = useMemo(
    () => [{ id: 'all', name: 'Todas as fazendas' }, ...listedFarms],
    [listedFarms]
  );
  const allPilotOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os pilotos' }, ...listedPilots],
    [listedPilots]
  );
  const allAssistantOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os ajudantes' }, ...listedAssistants],
    [listedAssistants]
  );
  const allProductOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os produtos' }, ...listedProducts],
    [listedProducts]
  );
  const allCropSeasonOptions = useMemo(
    () => [{ id: 'all', name: 'Todas as safras' }, ...listedCropSeasons],
    [listedCropSeasons]
  );
  const allDroneOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os drones' }, ...listedDrones],
    [listedDrones]
  );

  const applicationParams: GetAllApplicationsParams = {
    page: currentPage.toString(),
    limit: pageSize,
    search: search.trim() || undefined,
    customerId,
    farmId,
    pilotId,
    assistantId,
    productId,
    cropSeasonId,
    droneId,
    serviceOrderStatus,
    applicationIssue,
    invalidApplication: invalidApplication === 'all' ? undefined : invalidApplication,
    includeCustomer: 'true',
    includeServiceOrder: 'true',
    startDate,
    endDate,
    orderBy,
    orderType,
  };

  const {
    data: applicationsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAllApplications(applicationParams);

  const invalidApplicationAsBoolean =
    invalidApplication === 'all' ? undefined : invalidApplication === 'true';

  const { data: applicationsStatsData } = useGetStatsApplications({
    search: search.trim() || undefined,
    customerId,
    farmId,
    pilotId,
    assistantId,
    productId,
    cropSeasonId,
    droneId,
    serviceOrderStatus,
    applicationIssue,
    invalidApplication: invalidApplicationAsBoolean,
    startDate,
    endDate,
  });

  const activeFilters = useMemo(() => {
    return [
      !!search.trim() && 'Busca',
      !!startDate && 'Data inicial',
      !!endDate && 'Data final',
      !!customerId && 'Cliente',
      !!farmId && 'Fazenda',
      !!pilotId && 'Piloto',
      !!assistantId && 'Ajudante',
      !!productId && 'Produto',
      !!cropSeasonId && 'Safra',
      !!droneId && 'Drone',
      !!serviceOrderStatus && 'Status OS',
      !!applicationIssue && 'Tipo',
      invalidApplication !== 'all' && 'Inconsistencia',
      orderBy !== ApplicationOrderBy.DATE && 'Ordenacao',
      orderType !== ApplicationOrderType.DESC && 'Ordem',
      pageSize !== '10' && 'Limite',
    ].filter(Boolean) as string[];
  }, [
    search,
    startDate,
    endDate,
    customerId,
    farmId,
    pilotId,
    assistantId,
    productId,
    droneId,
    serviceOrderStatus,
    applicationIssue,
    invalidApplication,
    orderBy,
    orderType,
    pageSize,
  ]);

  const clearFilters = () => {
    setSearch('');
    setStartDate(undefined);
    setEndDate(undefined);
    setCustomerId(undefined);
    setFarmId(undefined);
    setPilotId(undefined);
    setAssistantId(undefined);
    setProductId(undefined);
    setCropSeasonId(currentCropSeasonData?.cropSeason?.id);
    setDroneId(undefined);
    setServiceOrderStatus(undefined);
    setApplicationIssue(undefined);
    setInvalidApplication('all');
    setOrderBy(ApplicationOrderBy.DATE);
    setOrderType(ApplicationOrderType.DESC);
    setPageSize('10');
    setCustomerSearchTerm('');
    setFarmSearchTerm('');
    setPilotSearchTerm('');
    setAssistantSearchTerm('');
    setProductSearchTerm('');
    setCropSeasonSearchTerm('');
    setDroneSearchTerm('');
    setCurrentPage(1);
  };

  const applications = applicationsData?.data ?? [];
  const totalCount = applicationsData?.totalCount ?? 0;
  const totalPages = applicationsData?.totalPages ?? 1;
  const totalAreaFromStats = applicationsStatsData?.stats?.totalAreaHectares;
  const totalAreaFromSummary = applicationsData?.summary?.totalFilteredHectares;
  const totalAreaFallback = applications.reduce(
    (sum, application) => sum + parseNumeric(application.hectares),
    0
  );
  const totalArea = totalAreaFromStats ?? totalAreaFromSummary ?? totalAreaFallback;
  const standaloneCount =
    applicationsData?.summary?.standaloneCount ??
    applications.filter((application) => !application.serviceOrderId).length;
  const standaloneArea =
    applicationsData?.summary?.standaloneHectares ??
    applications
      .filter((application) => !application.serviceOrderId)
      .reduce((sum, application) => sum + parseNumeric(application.hectares), 0);
  const inconsistenciesCount =
    applicationsStatsData?.stats?.invalidApplication ??
    applications.filter(
      (application) => (application as ApplicationWithQualityFlags).invalidApplication
    ).length;

  const handleFirstPage = () => setCurrentPage(1);
  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  const handleLastPage = () => setCurrentPage(totalPages);
  const navigateToServiceOrder = (serviceOrderId?: string) => {
    if (!serviceOrderId) return;
    router.push({
      pathname: '/backoffice/service-orders',
      params: { selectedServiceOrderId: serviceOrderId },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Aplicacoes - Backoffice</Text>
        <Text style={styles.headerSubtitle}>
          Visao administrativa ampla de aplicacoes operacionais
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={[styles.metricItem, { width: cardColumnWidth }]}>
          <MetricCard
            title='Total de aplicacoes'
            value={formatInteger(totalCount)}
            subtitle='Registros no recorte atual'
          />
        </View>
        <View style={[styles.metricItem, { width: cardColumnWidth }]}>
          <MetricCard
            title='Area total'
            value={formatHectares(totalArea)}
            subtitle='Hectares aplicados no recorte'
          />
        </View>
        <View style={[styles.metricItem, { width: cardColumnWidth }]}>
          <MetricCard
            title='Aplicacoes avulsas'
            value={formatInteger(standaloneCount)}
            subtitle={`Area avulsa: ${formatHectares(standaloneArea)}`}
          />
        </View>
        <View style={[styles.metricItem, { width: cardColumnWidth }]}>
          <MetricCard
            title='Inconsistencias'
            value={formatInteger(inconsistenciesCount)}
            subtitle='Pendencias estruturais/operacionais'
            highlight={inconsistenciesCount > 0 ? 'warning' : 'normal'}
          />
        </View>
      </View>

      <View style={styles.filtersCard}>
        <View style={styles.filtersHeader}>
          <Text style={styles.filtersTitle}>Filtros</Text>
          {!isTablet && (
            <TouchableOpacity
              onPress={() => setShowFilters((prev) => !prev)}
              style={styles.toggleFiltersButton}
            >
              <Text style={styles.toggleFiltersButtonText}>
                {showFilters ? 'Ocultar' : 'Mostrar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showFilters && (
          <View style={styles.filtersBody}>
            <View style={[styles.filterField, { width: '100%' }]}>
              <Text style={styles.filterLabel}>Busca</Text>
              <View style={styles.searchInputWrap}>
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder='Cliente, fazenda, piloto, produto, OS...'
                  placeholderTextColor={COLORS.gray}
                />
              </View>
            </View>

            <View style={[styles.filterField, { width: filterColumnWidth }]}>
              <Text style={styles.filterLabel}>Data inicial</Text>
              {isAndroid ? (
                <>
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(true)}
                    style={styles.dateButton}
                  >
                    <Text style={styles.dateButtonText}>
                      {startDate ? formatDateToDDMMYYYY(startDate) : 'Selecione...'}
                    </Text>
                  </TouchableOpacity>
                  {showStartPicker && (
                    <DateTimePicker
                      value={parseCivilDate(startDate)}
                      mode='date'
                      display='default'
                      onChange={(_: unknown, selectedDate?: Date) => {
                        setShowStartPicker(false);
                        if (selectedDate) {
                          const selectedCivilDate = toCivilDateParam(selectedDate);
                          setStartDate(selectedCivilDate);
                          if (endDate && selectedCivilDate > endDate) {
                            setEndDate(undefined);
                          }
                        }
                      }}
                    />
                  )}
                </>
              ) : (
                <DatePickeriOSModal
                  value={parseCivilDate(startDate)}
                  onDateChange={(date) => {
                    const selectedCivilDate = toCivilDateParam(date);
                    setStartDate(selectedCivilDate);
                    if (endDate && selectedCivilDate > endDate) {
                      setEndDate(undefined);
                    }
                  }}
                  minimumDate={undefined}
                  maximumDate={new Date()}
                  disabled={false}
                />
              )}
            </View>

            <View style={[styles.filterField, { width: filterColumnWidth }]}>
              <Text style={styles.filterLabel}>Data final</Text>
              {isAndroid ? (
                <>
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(true)}
                    style={styles.dateButton}
                  >
                    <Text style={styles.dateButtonText}>
                      {endDate ? formatDateToDDMMYYYY(endDate) : 'Selecione...'}
                    </Text>
                  </TouchableOpacity>
                  {showEndPicker && (
                    <DateTimePicker
                      value={parseCivilDate(endDate)}
                      mode='date'
                      display='default'
                      minimumDate={startDate ? parseCivilDate(startDate) : undefined}
                      onChange={(_: unknown, selectedDate?: Date) => {
                        setShowEndPicker(false);
                        if (selectedDate) {
                          setEndDate(toCivilDateParam(selectedDate));
                        }
                      }}
                    />
                  )}
                </>
              ) : (
                <DatePickeriOSModal
                  value={parseCivilDate(endDate)}
                  onDateChange={(date) => setEndDate(toCivilDateParam(date))}
                  minimumDate={startDate ? parseCivilDate(startDate) : undefined}
                  maximumDate={new Date()}
                  disabled={false}
                />
              )}
            </View>

            <View style={[styles.filterField, { width: filterColumnWidth }]}>
              <Text style={styles.filterLabel}>Safra</Text>
              <SearchableSelectQuery
                value={cropSeasonId || 'all'}
                listedData={allCropSeasonOptions}
                onSearchChange={setCropSeasonSearchTerm}
                onItemSelect={(value: string | undefined) => {
                  cropSeasonDefaultAppliedRef.current = true;
                  setCropSeasonId(!value || value === 'all' ? undefined : value);
                }}
                itemKey='name'
                hasNextPage={hasNextPageCropSeasons}
                fetchNextPage={fetchNextPageCropSeasons}
                isFetchingNextPage={isFetchingNextPageCropSeasons}
                isFetching={isFetchingCropSeasons}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: filterColumnWidth }]}>
              <Text style={styles.filterLabel}>Cliente</Text>
              <SearchableSelectQuery
                value={customerId || 'all'}
                listedData={allCustomerOptions}
                onSearchChange={setCustomerSearchTerm}
                onItemSelect={(value: string | undefined) => {
                  if (!value || value === 'all') {
                    setCustomerId(undefined);
                    return;
                  }
                  setCustomerId(value);
                }}
                itemKey='name'
                hasNextPage={hasNextPageCustomers}
                fetchNextPage={fetchNextPageCustomers}
                isFetchingNextPage={isFetchingNextPageCustomers}
                isFetching={isFetchingCustomers}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: filterColumnWidth }]}>
              <Text style={styles.filterLabel}>Fazenda</Text>
              <SearchableSelectQuery
                value={farmId || 'all'}
                listedData={allFarmOptions}
                onSearchChange={setFarmSearchTerm}
                onItemSelect={(value: string | undefined) => {
                  if (!value || value === 'all') {
                    setFarmId(undefined);
                    return;
                  }
                  setFarmId(value);
                }}
                itemKey='name'
                hasNextPage={hasNextPageFarms}
                fetchNextPage={fetchNextPageFarms}
                isFetchingNextPage={isFetchingNextPageFarms}
                isFetching={isFetchingFarms}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: filterColumnWidth }]}>
              <Text style={styles.filterLabel}>Piloto</Text>
              <SearchableSelectQuery
                value={pilotId || 'all'}
                listedData={allPilotOptions}
                onSearchChange={setPilotSearchTerm}
                onItemSelect={(value: string | undefined) => {
                  if (!value || value === 'all') {
                    setPilotId(undefined);
                    return;
                  }
                  setPilotId(value);
                }}
                itemKey='name'
                hasNextPage={hasNextPagePilots}
                fetchNextPage={fetchNextPagePilots}
                isFetchingNextPage={isFetchingNextPagePilots}
                isFetching={isFetchingPilots}
                disabled={false}
              />
            </View>

            <TouchableOpacity
              onPress={() => setShowAdvancedFilters((prev) => !prev)}
              style={[styles.advancedToggleButton, { width: '100%' }]}
            >
              <Text style={styles.advancedToggleButtonText}>
                {showAdvancedFilters ? 'Ocultar filtros avancados' : 'Mostrar filtros avancados'}
              </Text>
              <Feather
                name={showAdvancedFilters ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.gray}
              />
            </TouchableOpacity>

            {showAdvancedFilters && (
              <>
                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Ajudante</Text>
                  <SearchableSelectQuery
                    value={assistantId || 'all'}
                    listedData={allAssistantOptions}
                    onSearchChange={setAssistantSearchTerm}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setAssistantId(undefined);
                        return;
                      }
                      setAssistantId(value);
                    }}
                    itemKey='name'
                    hasNextPage={hasNextPageAssistants}
                    fetchNextPage={fetchNextPageAssistants}
                    isFetchingNextPage={isFetchingNextPageAssistants}
                    isFetching={isFetchingAssistants}
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Produto</Text>
                  <SearchableSelectQuery
                    value={productId || 'all'}
                    listedData={allProductOptions}
                    onSearchChange={setProductSearchTerm}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setProductId(undefined);
                        return;
                      }
                      setProductId(value);
                    }}
                    itemKey='name'
                    hasNextPage={hasNextPageProducts}
                    fetchNextPage={fetchNextPageProducts}
                    isFetchingNextPage={isFetchingNextPageProducts}
                    isFetching={isFetchingProducts}
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Drone</Text>
                  <SearchableSelectQuery
                    value={droneId || 'all'}
                    listedData={allDroneOptions}
                    onSearchChange={setDroneSearchTerm}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setDroneId(undefined);
                        return;
                      }
                      setDroneId(value);
                    }}
                    itemKey='name'
                    hasNextPage={hasNextPageDrones}
                    fetchNextPage={fetchNextPageDrones}
                    isFetchingNextPage={isFetchingNextPageDrones}
                    isFetching={isFetchingDrones}
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Status da OS</Text>
                  <SearchableSelectQuery
                    value={serviceOrderStatus || 'all'}
                    listedData={serviceOrderStatusOptions}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setServiceOrderStatus(undefined);
                        return;
                      }
                      setServiceOrderStatus(value as ServiceOrderStatus);
                    }}
                    itemKey='label'
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Tipo/applicationIssue</Text>
                  <SearchableSelectQuery
                    value={applicationIssue || 'all'}
                    listedData={applicationIssueOptions}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setApplicationIssue(undefined);
                        return;
                      }
                      setApplicationIssue(value as ApplicationIssueFilter);
                      setInvalidApplication('all');
                    }}
                    itemKey='label'
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Inconsistencia/invalidApplication</Text>
                  <SearchableSelectQuery
                    value={invalidApplication}
                    listedData={invalidApplicationOptions}
                    onItemSelect={(value: string | undefined) => {
                      const nextValue = (value as 'all' | 'true' | 'false' | undefined) || 'all';
                      setInvalidApplication(nextValue);
                      if (nextValue === 'true') {
                        setApplicationIssue(undefined);
                      }
                    }}
                    itemKey='label'
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Ordenacao/orderBy</Text>
                  <SearchableSelectQuery
                    value={orderBy}
                    listedData={orderByOptions}
                    onItemSelect={(value: string | undefined) =>
                      setOrderBy((value as ApplicationOrderBy) || ApplicationOrderBy.DATE)
                    }
                    itemKey='label'
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Direcao/orderType</Text>
                  <SearchableSelectQuery
                    value={orderType}
                    listedData={orderTypeOptions}
                    onItemSelect={(value: string | undefined) =>
                      setOrderType((value as ApplicationOrderType) || ApplicationOrderType.DESC)
                    }
                    itemKey='label'
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: filterColumnWidth }]}>
                  <Text style={styles.filterLabel}>Limite</Text>
                  <SearchableSelectQuery
                    value={pageSize}
                    listedData={limitOptions}
                    onItemSelect={(value: string | undefined) => setPageSize(value || '10')}
                    itemKey='label'
                    disabled={false}
                  />
                </View>
              </>
            )}

            <View style={styles.clearButtonRow}>
              <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
                <Feather name='x-circle' size={14} color={COLORS.blue} />
                <Text style={styles.clearButtonText}>Limpar filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeFilters.length > 0 && (
          <Text style={styles.activeFiltersText}>
            {activeFilters.length} filtro(s) ativo(s): {activeFilters.join(', ')}
          </Text>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Listagem de aplicacoes</Text>
        <Text style={styles.listCountText}>{formatInteger(totalCount)} aplicacoes</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size='large' color={COLORS.primary} />
        </View>
      ) : isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Erro ao carregar aplicacoes</Text>
          <Text style={styles.errorMessage}>{error?.message || 'Tente novamente.'}</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : applications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name='search' size={32} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>Nenhuma aplicacao encontrada</Text>
          <Text style={styles.emptyMessage}>
            Ajuste os filtros para encontrar registros no recorte desejado.
          </Text>
        </View>
      ) : (
        <View style={styles.cardsGrid}>
          {applications.map((application: Application) => {
            const applicationWithQuality = application as ApplicationWithQualityFlags;
            const customerName =
              application.farm?.customer?.name || application.serviceOrder?.customer?.name || 'N/A';
            const farmName = application.farm?.name || 'N/A';
            const pilotName = application.pilot?.name || 'N/A';
            const assistantName = application.assistant?.name || 'N/A';
            const productName = application.product?.name || 'N/A';
            const droneName = application.drone?.name || 'N/A';
            const serviceOrderNumber = application.serviceOrder?.number;
            const linkedServiceOrderId = application.serviceOrderId || application.serviceOrder?.id;
            const serviceOrderStatusLabel = getServiceOrderStatusLabel(
              application.serviceOrder?.status
            );
            const issueLabel = applicationWithQuality.applicationIssue
              ? APPLICATION_ISSUE_LABELS[applicationWithQuality.applicationIssue]
              : undefined;
            const isInvalid = Boolean(applicationWithQuality.invalidApplication);

            return (
              <View
                key={application.id}
                style={[styles.applicationCard, { width: cardColumnWidth }]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {productName}
                    </Text>
                    <Text style={styles.cardDate}>{formatDateToDDMMYYYY(application.date)}</Text>
                  </View>
                  {!application.serviceOrderId && (
                    <View style={styles.badgeLoose}>
                      <Text style={styles.badgeLooseText}>Avulsa</Text>
                    </View>
                  )}
                </View>

                <View style={styles.badgesRow}>
                  {serviceOrderNumber ? (
                    <View style={styles.badgeNeutral}>
                      <Text style={styles.badgeNeutralText}>{`OS #${serviceOrderNumber}`}</Text>
                    </View>
                  ) : null}
                  {serviceOrderNumber ? (
                    <View style={styles.badgeNeutral}>
                      <Text style={styles.badgeNeutralText}>{serviceOrderStatusLabel}</Text>
                    </View>
                  ) : null}
                  {isInvalid ? (
                    <View style={styles.badgeWarning}>
                      <Text style={styles.badgeWarningText}>Inconsistente</Text>
                    </View>
                  ) : null}
                  {issueLabel ? (
                    <View style={styles.badgeIssue}>
                      <Text style={styles.badgeIssueText} numberOfLines={1}>
                        {issueLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.dataGrid}>
                  <DataField label='Cliente' value={customerName} />
                  <DataField label='Fazenda' value={farmName} />
                  <DataField label='Piloto' value={pilotName} />
                  <DataField label='Ajudante' value={assistantName} />
                  <DataField label='Produto' value={productName} />
                  <DataField label='Drone' value={droneName} />
                  <DataField
                    label='Hectares'
                    value={formatHectares(parseNumeric(application.hectares))}
                  />
                  <DataField
                    label='OS/Status'
                    value={
                      serviceOrderNumber
                        ? `#${serviceOrderNumber} - ${serviceOrderStatusLabel}`
                        : 'Avulsa'
                    }
                  />
                </View>
                {linkedServiceOrderId ? (
                  <TouchableOpacity
                    onPress={() => navigateToServiceOrder(linkedServiceOrderId)}
                    style={styles.serviceOrderActionButton}
                  >
                    <Text style={styles.serviceOrderActionButtonText}>
                      Abrir OS #{serviceOrderNumber || '-'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {!isLoading && !isError && totalPages > 1 && (
        <View style={styles.paginationWrap}>
          <Text style={styles.paginationText}>
            Pagina {currentPage} de {totalPages} | {formatInteger(totalCount)} aplicacoes
          </Text>

          <View style={styles.paginationButtons}>
            <TouchableOpacity
              onPress={handleFirstPage}
              disabled={currentPage === 1}
              style={[
                styles.paginationButton,
                currentPage === 1
                  ? styles.paginationButtonDisabled
                  : styles.paginationButtonEnabled,
              ]}
            >
              <Feather
                name='chevrons-left'
                size={16}
                color={currentPage === 1 ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePreviousPage}
              disabled={currentPage === 1}
              style={[
                styles.paginationButton,
                currentPage === 1
                  ? styles.paginationButtonDisabled
                  : styles.paginationButtonEnabled,
              ]}
            >
              <Feather
                name='chevron-left'
                size={16}
                color={currentPage === 1 ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNextPage}
              disabled={currentPage === totalPages}
              style={[
                styles.paginationButton,
                currentPage === totalPages
                  ? styles.paginationButtonDisabled
                  : styles.paginationButtonEnabled,
              ]}
            >
              <Feather
                name='chevron-right'
                size={16}
                color={currentPage === totalPages ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLastPage}
              disabled={currentPage === totalPages}
              style={[
                styles.paginationButton,
                currentPage === totalPages
                  ? styles.paginationButtonDisabled
                  : styles.paginationButtonEnabled,
              ]}
            >
              <Feather
                name='chevrons-right'
                size={16}
                color={currentPage === totalPages ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    padding: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.gray,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricItem: {
    minHeight: 98,
  },
  metricCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 98,
    justifyContent: 'center',
  },
  metricTitle: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    marginTop: 6,
    color: COLORS.black,
    fontSize: 24,
    fontWeight: '700',
  },
  metricValueWarning: {
    marginTop: 6,
    color: COLORS.red,
    fontSize: 24,
    fontWeight: '700',
  },
  metricSubtitle: {
    marginTop: 6,
    color: COLORS.gray,
    fontSize: 12,
  },
  filtersCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    padding: 12,
    gap: 8,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  toggleFiltersButton: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleFiltersButtonText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  filtersBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  filterField: {
    gap: 6,
  },
  filterLabel: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  searchInputWrap: {
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 16,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  searchInput: {
    color: COLORS.black,
    fontSize: 15,
  },
  dateButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: COLORS.black,
    fontSize: 14,
  },
  advancedToggleButton: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advancedToggleButtonText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '700',
  },
  clearButtonRow: {
    width: '100%',
    marginTop: 4,
    alignItems: 'flex-end',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  activeFiltersText: {
    color: COLORS.blue,
    fontSize: 12,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '700',
  },
  listCountText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    color: '#991B1B',
    fontSize: 15,
    fontWeight: '700',
  },
  errorMessage: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyMessage: {
    color: COLORS.gray,
    fontSize: 13,
    textAlign: 'center',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  applicationCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: '700',
  },
  cardDate: {
    marginTop: 2,
    color: COLORS.gray,
    fontSize: 12,
  },
  badgeLoose: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLooseText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgeNeutral: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    backgroundColor: COLORS.background,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeNeutralText: {
    color: COLORS.black,
    fontSize: 11,
    fontWeight: '600',
  },
  badgeWarning: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeWarningText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeIssue: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  badgeIssueText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  serviceOrderActionButton: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  serviceOrderActionButtonText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dataField: {
    width: '48.6%',
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    gap: 2,
  },
  dataFieldLabel: {
    color: COLORS.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  dataFieldValue: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '700',
  },
  paginationWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  paginationText: {
    flex: 1,
    color: COLORS.gray,
    fontSize: 12,
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationButton: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationButtonEnabled: {
    backgroundColor: COLORS.blue,
  },
  paginationButtonDisabled: {
    backgroundColor: COLORS.lightgray,
  },
});
