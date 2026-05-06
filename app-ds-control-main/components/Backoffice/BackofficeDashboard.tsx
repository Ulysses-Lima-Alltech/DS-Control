import DateTimePicker from '@react-native-community/datetimepicker';
import { InfiniteData, useQueries, UseQueryResult } from '@tanstack/react-query';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import DashboardKpiCard from '@/components/Backoffice/DashboardKpiCard';
import DatePickeriOSModal from '@/components/ui/DatePickeriOSModal';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import {
  useGetAllApplications,
  useGetApplicationsByPilotStats,
  useGetDashboardMetrics,
  useGetStatsApplications,
} from '@/queries/application.query';
import { useGetAllAssistantsInfinite } from '@/queries/assistant.query';
import { useGetAllCropSeasonsInfinite, useGetCurrentCropSeason } from '@/queries/crop-season.query';
import { useGetAllCustomers } from '@/queries/customer.query';
import { useGetAllDronesInfinite } from '@/queries/drone.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllProductsInfinite } from '@/queries/product.query';
import { useGetAllServiceOrders } from '@/queries/service-order.query';
import { useGetAllUsers } from '@/queries/user.query';
import * as ApplicationService from '@/services/application.service';
import {
  ApplicationIssueFilter,
  APPLICATION_ISSUE_LABELS,
  ApplicationOrderBy,
  ApplicationOrderType,
} from '@/types/applications.type';
import { Assistant } from '@/types/assistant.type';
import { CropSeason } from '@/types/crop-season.type';
import { Drone } from '@/types/drone.type';
import { Farm } from '@/types/farm.type';
import { Product } from '@/types/product.type';
import { ServiceOrderStatus } from '@/types/service-order.type';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { isAndroid } from '@/utils/isAndroid';

type RangeMode = 'month' | 'day';
type PilotEntityMode = 'pilots' | 'assistants';
type PilotLaunchStatus = 'launched' | 'pending';
type DashboardDateRange = { startDate: string; endDate: string };

type PilotLaunchRow = {
  id: string;
  date?: string;
  pilotName: string;
  customerName: string;
  farmName: string;
  hectares: number;
  launchStatus: PilotLaunchStatus;
  serviceOrderNumber: number;
};

type ChartRow = {
  name: string;
  hectares: number;
};

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const serviceOrderStatusOptions: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos os status' },
  { id: 'open', label: 'Aberto' },
  { id: 'completed', label: 'Concluido' },
  { id: 'cancelled', label: 'Cancelado' },
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

const parseStrictCivilDate = (value?: string) => {
  if (!value || !DATE_PARAM_REGEX.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
};

const getCivilDateRangeDays = (range?: DashboardDateRange) => {
  if (!range) return 0;

  const start = parseStrictCivilDate(range.startDate);
  const end = parseStrictCivilDate(range.endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
};

const getCropSeasonElapsedDays = (
  cropSeason: { startDate: string; endDate: string } | undefined,
  todayYmd: string
) => {
  if (!cropSeason) return 0;

  const today = parseStrictCivilDate(todayYmd);
  const start = parseStrictCivilDate(cropSeason.startDate);
  const end = parseStrictCivilDate(cropSeason.endDate);

  if (!today || !start || !end || today < start) {
    return 0;
  }

  const effectiveEnd = today <= end ? today : end;
  return getCivilDateRangeDays({
    startDate: cropSeason.startDate,
    endDate: toCivilDateParam(effectiveEnd),
  });
};

const getTodayCivilDate = () => toCivilDateParam(new Date());

const getYesterdayCivilDate = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toCivilDateParam(yesterday);
};

const getMonthStartCivilDate = (base: string) => {
  const [year, month] = base.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-01`;
};

const formatHectares = (value: number | undefined) =>
  `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;

const formatInteger = (value: number | undefined) => Number(value || 0).toLocaleString('pt-BR');

const mapLaunchStatusLabel = (status: PilotLaunchStatus) =>
  status === 'launched' ? 'Lancado' : 'Pendente';

const getRangeByMode = (mode: RangeMode, filteredStartDate: string, filteredEndDate: string) => {
  if (mode === 'month') {
    const [year, month] = filteredEndDate.split('-').map(Number);
    return {
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: filteredEndDate,
    };
  }

  if (filteredStartDate === filteredEndDate) {
    return {
      startDate: filteredEndDate,
      endDate: filteredEndDate,
    };
  }

  return {
    startDate: filteredEndDate,
    endDate: filteredEndDate,
  };
};

type HorizontalBarsCardProps = {
  title: string;
  subtitle?: string;
  data: ChartRow[];
  isLoading: boolean;
  emptyText: string;
  color: string;
  isTablet: boolean;
  rightHeader?: ReactNode;
};

function HorizontalBarsCard({
  title,
  subtitle,
  data,
  isLoading,
  emptyText,
  color,
  isTablet,
  rightHeader,
}: HorizontalBarsCardProps) {
  const maxValue = useMemo(
    () => Math.max(1, ...data.map((item) => Number(item.hectares || 0))),
    [data]
  );

  return (
    <View style={styles.blockCard}>
      <View style={styles.blockHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.blockTitle}>{title}</Text>
          {subtitle ? <Text style={styles.blockSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightHeader ? <View style={styles.rightHeaderWrap}>{rightHeader}</View> : null}
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size='small' color={COLORS.blue} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : data.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {data.map((item) => {
            const hectares = Number(item.hectares || 0);
            const percent = Math.max(4, Math.min(100, (hectares / maxValue) * 100));

            return (
              <View key={`${item.name}-${hectares}`} style={styles.barRow}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.barValue}>{formatHectares(hectares)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { width: `${percent}%`, backgroundColor: color }]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {isTablet ? null : <View style={{ height: 2 }} />}
    </View>
  );
}

type ModeToggleProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function ModeToggle({ label, active, onPress }: ModeToggleProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.modeToggle, active ? styles.modeToggleActive : styles.modeToggleInactive]}
    >
      <Text style={active ? styles.modeToggleTextActive : styles.modeToggleTextInactive}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function BackofficeDashboard() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const isTablet = width >= 900;
  const shouldUseTwoColumns = width >= 760;
  const itemColumnWidth = shouldUseTwoColumns ? '48.6%' : '100%';

  const [showFilters, setShowFilters] = useState(isTablet);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [selectedFarmId, setSelectedFarmId] = useState<string | undefined>(undefined);
  const [selectedPilotId, setSelectedPilotId] = useState<string | undefined>(undefined);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [selectedCropSeasonId, setSelectedCropSeasonId] = useState<string | undefined>(undefined);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>(undefined);
  const [selectedServiceOrderStatus, setSelectedServiceOrderStatus] = useState<
    ServiceOrderStatus | undefined
  >(undefined);
  const [selectedApplicationIssue, setSelectedApplicationIssue] = useState<
    ApplicationIssueFilter | undefined
  >(undefined);
  const [selectedDroneId, setSelectedDroneId] = useState<string | undefined>(undefined);

  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [farmSearchTerm, setFarmSearchTerm] = useState('');
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [cropSeasonSearchTerm, setCropSeasonSearchTerm] = useState('');
  const [assistantSearchTerm, setAssistantSearchTerm] = useState('');
  const [droneSearchTerm, setDroneSearchTerm] = useState('');
  const cropSeasonDefaultAppliedRef = useRef(false);

  const [pilotEntityMode, setPilotEntityMode] = useState<PilotEntityMode>('pilots');
  const [pilotPeriodMode, setPilotPeriodMode] = useState<RangeMode>('month');
  const [customerPeriodMode, setCustomerPeriodMode] = useState<RangeMode>('month');

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
      setSelectedCropSeasonId(currentCropSeasonData.cropSeason.id);
      cropSeasonDefaultAppliedRef.current = true;
    }
  }, [currentCropSeasonData?.cropSeason?.id]);

  const todayDate = getTodayCivilDate();
  const yesterdayDate = getYesterdayCivilDate();
  const currentMonthStartDate = getMonthStartCivilDate(todayDate);

  const hasDateFilter = Boolean(startDate && endDate);
  const manualDateRange = useMemo(
    () =>
      startDate && endDate
        ? {
            startDate,
            endDate,
          }
        : undefined,
    [endDate, startDate]
  );
  const hasAnyPanelFilter = Boolean(
    search.trim() ||
    hasDateFilter ||
    selectedCustomerId ||
    selectedFarmId ||
    selectedPilotId ||
    selectedProductId ||
    selectedCropSeasonId ||
    selectedAssistantId ||
    selectedDroneId ||
    selectedServiceOrderStatus ||
    selectedApplicationIssue
  );

  const shouldApplyChartDateFilter = hasAnyPanelFilter && hasDateFilter;
  const pilotChartRange =
    shouldApplyChartDateFilter && startDate && endDate
      ? getRangeByMode(pilotPeriodMode, startDate, endDate)
      : undefined;
  const customerChartRange =
    shouldApplyChartDateFilter && startDate && endDate
      ? getRangeByMode(customerPeriodMode, startDate, endDate)
      : undefined;

  const { data: customersData, isPending: isLoadingCustomers } = useGetAllCustomers({
    limit: '100',
    search: customerSearchTerm || undefined,
  });
  const {
    data: farmsData,
    hasNextPage: hasNextPageFarms,
    fetchNextPage: fetchNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    isFetching: isFetchingFarms,
  } = useGetAllFarmsInfinite(selectedCustomerId, {
    limit: '100',
    search: farmSearchTerm || undefined,
    includeCustomer: 'true',
  });
  const { data: pilotsData, isPending: isLoadingPilots } = useGetAllUsers({
    type: 'pilot',
    status: 'active',
    limit: '100',
    search: pilotSearchTerm || undefined,
  });
  const {
    data: productsData,
    hasNextPage: hasNextPageProducts,
    fetchNextPage: fetchNextPageProducts,
    isFetchingNextPage: isFetchingNextPageProducts,
    isFetching: isFetchingProducts,
  } = useGetAllProductsInfinite({
    limit: '100',
    search: productSearchTerm || undefined,
  });
  const {
    data: cropSeasonsData,
    hasNextPage: hasNextPageCropSeasons,
    fetchNextPage: fetchNextPageCropSeasons,
    isFetchingNextPage: isFetchingNextPageCropSeasons,
    isFetching: isFetchingCropSeasons,
  } = useGetAllCropSeasonsInfinite({
    limit: '100',
    search: cropSeasonSearchTerm || undefined,
    status: 'active',
  });
  const {
    data: assistantsData,
    hasNextPage: hasNextPageAssistants,
    fetchNextPage: fetchNextPageAssistants,
    isFetchingNextPage: isFetchingNextPageAssistants,
    isFetching: isFetchingAssistants,
  } = useGetAllAssistantsInfinite({
    limit: '100',
    search: assistantSearchTerm || undefined,
  });
  const {
    data: dronesData,
    hasNextPage: hasNextPageDrones,
    fetchNextPage: fetchNextPageDrones,
    isFetchingNextPage: isFetchingNextPageDrones,
    isFetching: isFetchingDrones,
  } = useGetAllDronesInfinite({
    limit: '100',
    search: droneSearchTerm || undefined,
  });

  const panelBaseFilters = useMemo<ApplicationService.GetStatsApplicationsParams>(
    () => ({
      search: search || undefined,
      customerId: selectedCustomerId,
      farmId: selectedFarmId,
      pilotId: selectedPilotId,
      productId: selectedProductId,
      assistantId: selectedAssistantId,
      droneId: selectedDroneId,
      serviceOrderStatus: selectedServiceOrderStatus,
      applicationIssue: selectedApplicationIssue,
      cropSeasonId: selectedCropSeasonId,
      currentSeason: selectedCropSeasonId || manualDateRange ? undefined : true,
      ...(manualDateRange
        ? {
            startDate: manualDateRange.startDate,
            endDate: manualDateRange.endDate,
          }
        : {}),
    }),
    [
      manualDateRange,
      search,
      selectedApplicationIssue,
      selectedAssistantId,
      selectedCropSeasonId,
      selectedCustomerId,
      selectedDroneId,
      selectedFarmId,
      selectedPilotId,
      selectedProductId,
      selectedServiceOrderStatus,
    ]
  );

  const buildPanelStatsFilters = useCallback(
    (rangeOverride?: DashboardDateRange): ApplicationService.GetStatsApplicationsParams => ({
      ...panelBaseFilters,
      ...(rangeOverride
        ? {
            currentSeason: undefined,
            startDate: rangeOverride.startDate,
            endDate: rangeOverride.endDate,
          }
        : {}),
    }),
    [panelBaseFilters]
  );

  const cardRangeFilters = buildPanelStatsFilters();
  const currentMonthCardRange = manualDateRange ?? {
    startDate: currentMonthStartDate,
    endDate: todayDate,
  };
  const yesterdayCardRange = manualDateRange ?? {
    startDate: yesterdayDate,
    endDate: yesterdayDate,
  };

  useEffect(() => {
    if (__DEV__) {
      console.warn('[BackofficeDashboard][DEV] dashboard filters applied', {
        startDate: cardRangeFilters.startDate,
        endDate: cardRangeFilters.endDate,
        cropSeasonId: cardRangeFilters.cropSeasonId,
        currentSeason: cardRangeFilters.currentSeason,
        customerId: cardRangeFilters.customerId,
        farmId: cardRangeFilters.farmId,
        pilotId: cardRangeFilters.pilotId,
        productId: cardRangeFilters.productId,
        assistantId: cardRangeFilters.assistantId,
        droneId: cardRangeFilters.droneId,
        serviceOrderStatus: cardRangeFilters.serviceOrderStatus,
        applicationIssue: cardRangeFilters.applicationIssue,
      });
    }
  }, [cardRangeFilters]);

  const { data: totalSeasonStats, isPending: isLoadingTotalSeasonStats } =
    useGetStatsApplications(cardRangeFilters);
  const { data: currentMonthStats, isPending: isLoadingCurrentMonthStats } =
    useGetStatsApplications(buildPanelStatsFilters(currentMonthCardRange));
  const { data: yesterdayAreaStats, isPending: isLoadingYesterdayAreaStats } =
    useGetStatsApplications(buildPanelStatsFilters(yesterdayCardRange));
  const { data: dashboardMetrics, isPending: isLoadingDashboardMetrics } = useGetDashboardMetrics(
    {
      startDate: startDate || todayDate,
      customerIds: selectedCustomerId ? [selectedCustomerId] : undefined,
      farmIds: selectedFarmId ? [selectedFarmId] : undefined,
      pilotId: selectedPilotId,
      search: search || undefined,
      cropSeasonId: selectedCropSeasonId,
      currentSeason: selectedCropSeasonId || manualDateRange ? undefined : true,
    },
    {
      enabled: !manualDateRange && !selectedCropSeasonId,
    }
  );
  const { data: byPilotStats, isPending: isLoadingByPilotStats } = useGetApplicationsByPilotStats({
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    productId: selectedProductId,
    assistantId: selectedAssistantId,
    droneId: selectedDroneId,
    applicationIssue: selectedApplicationIssue,
    serviceOrderStatus: selectedServiceOrderStatus,
    cropSeasonId: selectedCropSeasonId,
    currentSeason: selectedCropSeasonId || pilotChartRange ? undefined : true,
    startDate: pilotChartRange?.startDate,
    endDate: pilotChartRange?.endDate,
    limit: 10,
  });
  const { data: pilotLaunchesData, isPending: isLoadingPilotLaunches } = useGetAllApplications({
    page: '1',
    limit: '1000',
    search: search || undefined,
    customerId: selectedCustomerId,
    farmId: selectedFarmId,
    pilotId: selectedPilotId,
    productId: selectedProductId,
    serviceOrderStatus: selectedServiceOrderStatus,
    assistantId: selectedAssistantId,
    droneId: selectedDroneId,
    applicationIssue: selectedApplicationIssue,
    cropSeasonId: selectedCropSeasonId,
    currentSeason: selectedCropSeasonId || manualDateRange ? undefined : true,
    ...(manualDateRange
      ? {
          startDate: manualDateRange.startDate,
          endDate: manualDateRange.endDate,
        }
      : {}),
    orderBy: ApplicationOrderBy.DATE,
    orderType: ApplicationOrderType.DESC,
  });

  const { data: assistantChartApplicationsData, isPending: isLoadingAssistantChartApplications } =
    useGetAllApplications(
      {
        page: '1',
        limit: '5000',
        search: search || undefined,
        customerId: selectedCustomerId,
        farmId: selectedFarmId,
        pilotId: selectedPilotId,
        productId: selectedProductId,
        serviceOrderStatus: selectedServiceOrderStatus,
        assistantId: selectedAssistantId,
        droneId: selectedDroneId,
        applicationIssue: selectedApplicationIssue,
        cropSeasonId: selectedCropSeasonId,
        currentSeason: selectedCropSeasonId || pilotChartRange ? undefined : true,
        ...(pilotChartRange?.startDate && pilotChartRange?.endDate
          ? {
              startDate: pilotChartRange.startDate,
              endDate: pilotChartRange.endDate,
            }
          : {}),
      },
      {
        enabled: pilotEntityMode === 'assistants',
      }
    );

  const { data: openServiceOrdersData, isPending: isLoadingOpenServiceOrders } =
    useGetAllServiceOrders({
      page: '1',
      limit: '1000',
      search: search || undefined,
      status: 'open',
      customerId: selectedCustomerId,
      farmId: selectedFarmId,
      pilotId: selectedPilotId,
      ...(manualDateRange
        ? {
            startDate: manualDateRange.startDate,
            endDate: manualDateRange.endDate,
          }
        : {}),
      includePlots: 'true',
      includeFarms: 'true',
      includePilots: 'true',
      includeCustomers: 'true',
    });

  const customers = customersData?.data || [];
  const farms =
    (farmsData as unknown as InfiniteData<{ data: Farm[] }>)?.pages?.flatMap((page) => page.data) ||
    [];
  const pilots = pilotsData?.data || [];
  const products =
    (productsData as unknown as InfiniteData<{ data: Product[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];
  const cropSeasons =
    (cropSeasonsData as unknown as InfiniteData<{ data: CropSeason[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];
  const cropSeasonsWithCurrent = useMemo(() => {
    const seasonsById = new Map(cropSeasons.map((cropSeason) => [cropSeason.id, cropSeason]));
    const currentSeason = currentCropSeasonData?.cropSeason;

    if (currentSeason) {
      seasonsById.set(currentSeason.id, currentSeason);
    }

    return Array.from(seasonsById.values());
  }, [cropSeasons, currentCropSeasonData?.cropSeason]);
  const selectedCropSeason = useMemo(() => {
    if (!selectedCropSeasonId) {
      return undefined;
    }

    return cropSeasonsWithCurrent.find((cropSeason) => cropSeason.id === selectedCropSeasonId);
  }, [cropSeasonsWithCurrent, selectedCropSeasonId]);
  const assistants =
    (assistantsData as unknown as InfiniteData<{ data: Assistant[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];
  const drones =
    (dronesData as unknown as InfiniteData<{ data: Drone[] }>)?.pages?.flatMap(
      (page) => page.data
    ) || [];

  const openServiceOrders =
    selectedServiceOrderStatus && selectedServiceOrderStatus !== 'open'
      ? []
      : openServiceOrdersData?.data || [];

  const customerAreaQueries = useQueries({
    queries: customers.map((customer) => ({
      queryKey: [
        'panel',
        'customer-hectares',
        customer.id,
        customerPeriodMode,
        customerChartRange?.startDate,
        customerChartRange?.endDate,
        selectedFarmId,
        selectedPilotId,
        selectedProductId,
        selectedServiceOrderStatus,
        search,
        selectedCropSeasonId,
      ],
      queryFn: () => {
        const statsParams: ApplicationService.GetStatsApplicationsParams = {
          search: search || undefined,
          customerId: customer.id,
          farmId: selectedFarmId,
          pilotId: selectedPilotId,
          productId: selectedProductId,
          serviceOrderStatus: selectedServiceOrderStatus,
          assistantId: selectedAssistantId,
          droneId: selectedDroneId,
          applicationIssue: selectedApplicationIssue,
          cropSeasonId: selectedCropSeasonId,
          currentSeason: selectedCropSeasonId ? undefined : true,
          ...(customerChartRange?.startDate && customerChartRange?.endDate
            ? {
                startDate: customerChartRange.startDate,
                endDate: customerChartRange.endDate,
              }
            : {}),
        };

        return ApplicationService.getStatsApplications(statsParams);
      },
      staleTime: 1000 * 60 * 5,
    })),
  }) as UseQueryResult<ApplicationService.GetStatsApplicationsResponse, Error>[];

  const orderYesterdayStatsQueries = useQueries({
    queries: openServiceOrders.map((serviceOrder) => ({
      queryKey: [
        'panel',
        'order-yesterday',
        serviceOrder.id,
        yesterdayDate,
        search,
        selectedProductId,
        selectedPilotId,
        selectedAssistantId,
        selectedDroneId,
        selectedServiceOrderStatus,
        selectedApplicationIssue,
        selectedCropSeasonId,
      ],
      queryFn: () =>
        ApplicationService.getStatsApplications({
          search: search || undefined,
          serviceOrderId: serviceOrder.id,
          pilotId: selectedPilotId,
          productId: selectedProductId,
          serviceOrderStatus: selectedServiceOrderStatus,
          assistantId: selectedAssistantId,
          droneId: selectedDroneId,
          applicationIssue: selectedApplicationIssue,
          cropSeasonId: selectedCropSeasonId,
          currentSeason: selectedCropSeasonId ? undefined : true,
          startDate: yesterdayDate,
          endDate: yesterdayDate,
        }),
      staleTime: 1000 * 60 * 3,
    })),
  }) as UseQueryResult<ApplicationService.GetStatsApplicationsResponse, Error>[];

  const orderApplicationsQueries = useQueries({
    queries: openServiceOrders.map((serviceOrder) => ({
      queryKey: [
        'panel',
        'order-applications',
        serviceOrder.id,
        search,
        selectedProductId,
        selectedPilotId,
        selectedAssistantId,
        selectedDroneId,
        selectedServiceOrderStatus,
        selectedApplicationIssue,
        selectedCropSeasonId,
      ],
      queryFn: () =>
        ApplicationService.getAllApplications({
          page: '1',
          limit: '1000',
          search: search || undefined,
          serviceOrderId: serviceOrder.id,
          pilotId: selectedPilotId,
          productId: selectedProductId,
          assistantId: selectedAssistantId,
          droneId: selectedDroneId,
          serviceOrderStatus: selectedServiceOrderStatus,
          applicationIssue: selectedApplicationIssue,
          cropSeasonId: selectedCropSeasonId,
          currentSeason: selectedCropSeasonId ? undefined : true,
        }),
      staleTime: 1000 * 60 * 3,
    })),
  }) as UseQueryResult<ApplicationService.GetAllApplicationsResponse, Error>[];

  const hectaresByCustomerData = useMemo<ChartRow[]>(() => {
    const mapped = customers.map((customer, index) => ({
      name: customer.name,
      hectares: Number(customerAreaQueries[index]?.data?.stats?.totalAreaHectares || 0),
    }));
    const withData = mapped
      .filter((item) => item.hectares > 0)
      .sort((a, b) => b.hectares - a.hectares);

    if (withData.length > 0) return withData.slice(0, 8);
    if (customerPeriodMode === 'day') {
      return mapped.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 8);
    }

    return [];
  }, [customerAreaQueries, customerPeriodMode, customers]);

  const assistantNameById = useMemo(
    () =>
      new Map(
        assistants
          .filter((assistant) => Boolean(assistant.id))
          .map((assistant) => [assistant.id, assistant.name || 'Ajudante nao informado'])
      ),
    [assistants]
  );

  const assistantChartData = useMemo<ChartRow[]>(() => {
    const applications = assistantChartApplicationsData?.data || [];
    const groupedByAssistant = new Map<string, ChartRow>();

    for (const application of applications) {
      const assistantId = application.assistantId || '';
      const assistantName =
        application.assistant?.name ||
        (assistantId ? assistantNameById.get(assistantId) : undefined) ||
        'Ajudante nao informado';
      const groupKey = assistantId || `missing:${assistantName}`;
      const current = groupedByAssistant.get(groupKey);
      const hectares = parseNumeric(application.hectares);

      if (current) {
        current.hectares += hectares;
      } else {
        groupedByAssistant.set(groupKey, {
          name: assistantName,
          hectares,
        });
      }
    }

    const sorted = Array.from(groupedByAssistant.values())
      .sort((a, b) => b.hectares - a.hectares)
      .slice(0, 10);
    if (sorted.length > 0) return sorted;

    if (pilotPeriodMode === 'day') {
      return assistants
        .filter((assistant) => !selectedAssistantId || assistant.id === selectedAssistantId)
        .map((assistant) => ({
          name: assistant.name || 'Ajudante nao informado',
          hectares: 0,
        }))
        .slice(0, 10);
    }

    return [];
  }, [
    assistantChartApplicationsData?.data,
    assistantNameById,
    assistants,
    pilotPeriodMode,
    selectedAssistantId,
  ]);

  const pilotChartData = useMemo<ChartRow[]>(() => {
    if (pilotEntityMode === 'assistants') {
      return assistantChartData;
    }

    const base = (byPilotStats?.byPilot || []).map((item) => ({
      name: item.pilotName,
      hectares: item.totalAreaHectares,
    }));

    if (base.length === 0 && pilotPeriodMode === 'day') {
      return pilots
        .filter((pilot) => !selectedPilotId || pilot.id === selectedPilotId)
        .map((pilot) => ({
          name: pilot.name,
          hectares: 0,
        }))
        .slice(0, 10);
    }

    return base;
  }, [
    assistantChartData,
    byPilotStats?.byPilot,
    pilotEntityMode,
    pilotPeriodMode,
    pilots,
    selectedPilotId,
  ]);

  const launches = pilotLaunchesData?.data || [];
  const pilotLaunchRows = useMemo<PilotLaunchRow[]>(() => {
    const applicationsByOrderPilot = new Map<string, typeof launches>();

    for (const application of launches) {
      if (!application.serviceOrderId || !application.pilotId) continue;
      const key = `${application.serviceOrderId}:${application.pilotId}`;
      const current = applicationsByOrderPilot.get(key) || [];
      current.push(application);
      applicationsByOrderPilot.set(key, current);
    }

    const rows: PilotLaunchRow[] = [];
    for (const serviceOrder of openServiceOrders) {
      const pilotsFromOrder = serviceOrder.pilots || [];
      const farmsFromOrder = (serviceOrder.farms || [])
        .map((farm) => farm.name)
        .filter((name): name is string => Boolean(name));
      const uniqueFarmNames = Array.from(new Set(farmsFromOrder));
      const farmName = uniqueFarmNames.length > 0 ? uniqueFarmNames.join(', ') : 'Nao informado';
      const customerName = serviceOrder.customer?.name || 'Cliente nao informado';

      for (const pilot of pilotsFromOrder) {
        if (selectedPilotId && pilot.id !== selectedPilotId) continue;
        const key = `${serviceOrder.id}:${pilot.id}`;
        const pilotApplications = applicationsByOrderPilot.get(key) || [];
        const hectares = pilotApplications.reduce(
          (sum, application) => sum + parseNumeric(application.hectares),
          0
        );
        const latestDate = pilotApplications
          .map((application) => application.date)
          .filter((date): date is string => Boolean(date))
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

        rows.push({
          id: `${serviceOrder.id}:${pilot.id}`,
          date: latestDate,
          pilotName: pilot.name || 'Nao informado',
          customerName,
          farmName,
          hectares,
          launchStatus: pilotApplications.length > 0 ? 'launched' : 'pending',
          serviceOrderNumber: serviceOrder.number,
        });
      }
    }

    const normalizedSearch = search.trim().toLowerCase();
    const filteredRows = normalizedSearch
      ? rows.filter((row) => {
          return (
            row.pilotName.toLowerCase().includes(normalizedSearch) ||
            row.customerName.toLowerCase().includes(normalizedSearch) ||
            row.farmName.toLowerCase().includes(normalizedSearch) ||
            String(row.serviceOrderNumber).includes(normalizedSearch)
          );
        })
      : rows;

    return filteredRows.sort((a, b) => {
      if (a.serviceOrderNumber !== b.serviceOrderNumber) {
        return a.serviceOrderNumber - b.serviceOrderNumber;
      }
      return a.pilotName.localeCompare(b.pilotName, 'pt-BR');
    });
  }, [launches, openServiceOrders, search, selectedPilotId]);

  const hasApplicationLevelOsFilters = Boolean(
    selectedProductId || selectedAssistantId || selectedDroneId || selectedApplicationIssue
  );
  const visibleOpenServiceOrders = useMemo(
    () =>
      openServiceOrders
        .map((serviceOrder, index) => ({
          serviceOrder,
          queryIndex: index,
        }))
        .filter(({ queryIndex }) => {
          if (!hasApplicationLevelOsFilters) return true;
          const applications = orderApplicationsQueries[queryIndex]?.data?.data || [];
          return applications.length > 0;
        }),
    [hasApplicationLevelOsFilters, openServiceOrders, orderApplicationsQueries]
  );

  const launchedPilotsCount = pilotLaunchRows.filter(
    (row) => row.launchStatus === 'launched'
  ).length;
  const pendingPilotsCount = pilotLaunchRows.filter((row) => row.launchStatus === 'pending').length;

  const isLoadingAnyCustomerArea =
    isLoadingCustomers || customerAreaQueries.some((query) => query.isPending);
  const isLoadingPilotLaunchRows = isLoadingPilotLaunches || isLoadingOpenServiceOrders;
  const isLoadingPilotChart =
    pilotEntityMode === 'assistants' ? isLoadingAssistantChartApplications : isLoadingByPilotStats;
  const isLoadingAnyOrderStats =
    isLoadingOpenServiceOrders ||
    orderYesterdayStatsQueries.some((query) => query.isPending) ||
    orderApplicationsQueries.some((query) => query.isPending);

  const manualRangeDays = getCivilDateRangeDays(manualDateRange);
  const cropSeasonElapsedDays = getCropSeasonElapsedDays(selectedCropSeason, todayDate);
  const elapsedDaysForCards = manualDateRange
    ? manualRangeDays
    : selectedCropSeasonId
      ? cropSeasonElapsedDays
      : dashboardMetrics?.metrics?.daysSinceStart;
  const averageDailyAreaForCards =
    Number(elapsedDaysForCards || 0) > 0
      ? Number(totalSeasonStats?.stats?.totalAreaHectares || 0) / Number(elapsedDaysForCards || 0)
      : 0;

  const kpiCards = [
    {
      title: 'Area total aplicada',
      value: formatHectares(totalSeasonStats?.stats?.totalAreaHectares),
      icon: 'leaf-outline' as const,
      accentColor: '#16A34A',
      isLoading: isLoadingTotalSeasonStats,
    },
    {
      title: 'Este mes',
      value: formatHectares(currentMonthStats?.stats?.totalAreaHectares),
      icon: 'calendar-outline' as const,
      accentColor: '#CA8A04',
      isLoading: isLoadingCurrentMonthStats,
    },
    {
      title: 'Aplicacao de ontem',
      value: formatHectares(yesterdayAreaStats?.stats?.totalAreaHectares),
      icon: 'time-outline' as const,
      accentColor: '#EA580C',
      isLoading: isLoadingYesterdayAreaStats,
    },
    {
      title: 'Media diaria safra',
      value: formatHectares(
        manualDateRange || selectedCropSeasonId
          ? averageDailyAreaForCards
          : dashboardMetrics?.metrics?.averageDailyArea
      ),
      icon: 'bar-chart-outline' as const,
      accentColor: '#0EA5E9',
      isLoading:
        manualDateRange || selectedCropSeasonId
          ? isLoadingTotalSeasonStats
          : isLoadingDashboardMetrics,
    },
    {
      title: 'Dias corridos',
      value: formatInteger(
        manualDateRange || selectedCropSeasonId
          ? elapsedDaysForCards
          : dashboardMetrics?.metrics?.daysSinceStart
      ),
      icon: 'trending-up-outline' as const,
      accentColor: '#9333EA',
      isLoading:
        manualDateRange || selectedCropSeasonId ? isFetchingCropSeasons : isLoadingDashboardMetrics,
    },
    {
      title: 'OS em aberto',
      value: formatInteger(openServiceOrdersData?.totalCount ?? openServiceOrders.length),
      icon: 'document-text-outline' as const,
      accentColor: '#2563EB',
      isLoading: isLoadingOpenServiceOrders,
    },
  ];

  const clearFilters = () => {
    setSearch('');
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedCustomerId(undefined);
    setSelectedFarmId(undefined);
    setSelectedPilotId(undefined);
    setSelectedProductId(undefined);
    setSelectedCropSeasonId(currentCropSeasonData?.cropSeason?.id);
    setSelectedAssistantId(undefined);
    setSelectedServiceOrderStatus(undefined);
    setSelectedApplicationIssue(undefined);
    setSelectedDroneId(undefined);

    setCustomerSearchTerm('');
    setFarmSearchTerm('');
    setPilotSearchTerm('');
    setProductSearchTerm('');
    setCropSeasonSearchTerm('');
    setAssistantSearchTerm('');
    setDroneSearchTerm('');
  };

  const allCustomerOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os clientes' }, ...customers],
    [customers]
  );
  const allFarmOptions = useMemo(
    () => [{ id: 'all', name: 'Todas as fazendas' }, ...farms],
    [farms]
  );
  const allPilotOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os pilotos' }, ...pilots],
    [pilots]
  );
  const allProductOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os produtos' }, ...products],
    [products]
  );
  const allCropSeasonOptions = useMemo(
    () => [{ id: 'all', name: 'Todas as safras' }, ...cropSeasons],
    [cropSeasons]
  );
  const allAssistantOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os ajudantes' }, ...assistants],
    [assistants]
  );
  const allDroneOptions = useMemo(
    () => [{ id: 'all', name: 'Todos os drones' }, ...drones],
    [drones]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Painel Administrativo</Text>
        <Text style={styles.subtitle}>Ola, {user?.name || 'Administrador'}</Text>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Filtros</Text>
          {!isTablet && (
            <TouchableOpacity
              onPress={() => setShowFilters((prev) => !prev)}
              style={styles.toggleFiltersBtn}
            >
              <Text style={styles.toggleFiltersBtnText}>
                {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showFilters && (
          <View style={styles.filtersContent}>
            <View style={[styles.filterField, { width: '100%' }]}>
              <Text style={styles.filterLabel}>Busca</Text>
              <View style={styles.searchInputWrap}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder='Cliente, fazenda, piloto ou OS...'
                  placeholderTextColor={COLORS.gray}
                  style={styles.searchInput}
                />
              </View>
            </View>

            <View style={[styles.filterField, { width: itemColumnWidth }]}>
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
                        if (!selectedDate) return;

                        const selectedCivilDate = toCivilDateParam(selectedDate);
                        setStartDate(selectedCivilDate);
                        if (endDate && selectedCivilDate > endDate) {
                          setEndDate(undefined);
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

            <View style={[styles.filterField, { width: itemColumnWidth }]}>
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
                        if (!selectedDate) return;
                        setEndDate(toCivilDateParam(selectedDate));
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

            <View style={[styles.filterField, { width: itemColumnWidth }]}>
              <Text style={styles.filterLabel}>Safra</Text>
              <SearchableSelectQuery
                value={selectedCropSeasonId || 'all'}
                listedData={allCropSeasonOptions}
                onSearchChange={setCropSeasonSearchTerm}
                onItemSelect={(value: string | undefined) => {
                  cropSeasonDefaultAppliedRef.current = true;
                  setSelectedCropSeasonId(!value || value === 'all' ? undefined : value);
                }}
                itemKey='name'
                hasNextPage={hasNextPageCropSeasons}
                fetchNextPage={fetchNextPageCropSeasons}
                isFetchingNextPage={isFetchingNextPageCropSeasons}
                isFetching={isFetchingCropSeasons}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: itemColumnWidth }]}>
              <Text style={styles.filterLabel}>Cliente</Text>
              <SearchableSelectQuery
                value={selectedCustomerId || 'all'}
                listedData={allCustomerOptions}
                onSearchChange={setCustomerSearchTerm}
                onItemSelect={(value: string | undefined) =>
                  setSelectedCustomerId(!value || value === 'all' ? undefined : value)
                }
                itemKey='name'
                isFetching={isLoadingCustomers}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: itemColumnWidth }]}>
              <Text style={styles.filterLabel}>Fazenda</Text>
              <SearchableSelectQuery
                value={selectedFarmId || 'all'}
                listedData={allFarmOptions}
                onSearchChange={setFarmSearchTerm}
                onItemSelect={(value: string | undefined) =>
                  setSelectedFarmId(!value || value === 'all' ? undefined : value)
                }
                itemKey='name'
                hasNextPage={hasNextPageFarms}
                fetchNextPage={fetchNextPageFarms}
                isFetchingNextPage={isFetchingNextPageFarms}
                isFetching={isFetchingFarms}
                disabled={false}
              />
            </View>

            <View style={[styles.filterField, { width: itemColumnWidth }]}>
              <Text style={styles.filterLabel}>Piloto</Text>
              <SearchableSelectQuery
                value={selectedPilotId || 'all'}
                listedData={allPilotOptions}
                onSearchChange={setPilotSearchTerm}
                onItemSelect={(value: string | undefined) =>
                  setSelectedPilotId(!value || value === 'all' ? undefined : value)
                }
                itemKey='name'
                isFetching={isLoadingPilots}
                disabled={false}
              />
            </View>

            <TouchableOpacity
              onPress={() => setShowAdvancedFilters((prev) => !prev)}
              style={[styles.advancedToggle, { width: '100%' }]}
            >
              <Text style={styles.advancedToggleText}>
                {showAdvancedFilters ? 'Ocultar filtros avancados' : 'Mostrar filtros avancados'}
              </Text>
            </TouchableOpacity>

            {showAdvancedFilters && (
              <>
                <View style={[styles.filterField, { width: itemColumnWidth }]}>
                  <Text style={styles.filterLabel}>Produto</Text>
                  <SearchableSelectQuery
                    value={selectedProductId || 'all'}
                    listedData={allProductOptions}
                    onSearchChange={setProductSearchTerm}
                    onItemSelect={(value: string | undefined) =>
                      setSelectedProductId(!value || value === 'all' ? undefined : value)
                    }
                    itemKey='name'
                    hasNextPage={hasNextPageProducts}
                    fetchNextPage={fetchNextPageProducts}
                    isFetchingNextPage={isFetchingNextPageProducts}
                    isFetching={isFetchingProducts}
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: itemColumnWidth }]}>
                  <Text style={styles.filterLabel}>Ajudante</Text>
                  <SearchableSelectQuery
                    value={selectedAssistantId || 'all'}
                    listedData={allAssistantOptions}
                    onSearchChange={setAssistantSearchTerm}
                    onItemSelect={(value: string | undefined) =>
                      setSelectedAssistantId(!value || value === 'all' ? undefined : value)
                    }
                    itemKey='name'
                    hasNextPage={hasNextPageAssistants}
                    fetchNextPage={fetchNextPageAssistants}
                    isFetchingNextPage={isFetchingNextPageAssistants}
                    isFetching={isFetchingAssistants}
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: itemColumnWidth }]}>
                  <Text style={styles.filterLabel}>Status da OS</Text>
                  <SearchableSelectQuery
                    value={selectedServiceOrderStatus || 'all'}
                    listedData={serviceOrderStatusOptions}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setSelectedServiceOrderStatus(undefined);
                        return;
                      }
                      setSelectedServiceOrderStatus(value as ServiceOrderStatus);
                    }}
                    itemKey='label'
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: itemColumnWidth }]}>
                  <Text style={styles.filterLabel}>Tipo/applicationIssue</Text>
                  <SearchableSelectQuery
                    value={selectedApplicationIssue || 'all'}
                    listedData={applicationIssueOptions}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setSelectedApplicationIssue(undefined);
                        return;
                      }
                      setSelectedApplicationIssue(value as ApplicationIssueFilter);
                    }}
                    itemKey='label'
                    disabled={false}
                  />
                </View>

                <View style={[styles.filterField, { width: itemColumnWidth }]}>
                  <Text style={styles.filterLabel}>Drone</Text>
                  <SearchableSelectQuery
                    value={selectedDroneId || 'all'}
                    listedData={allDroneOptions}
                    onSearchChange={setDroneSearchTerm}
                    onItemSelect={(value: string | undefined) =>
                      setSelectedDroneId(!value || value === 'all' ? undefined : value)
                    }
                    itemKey='name'
                    hasNextPage={hasNextPageDrones}
                    fetchNextPage={fetchNextPageDrones}
                    isFetchingNextPage={isFetchingNextPageDrones}
                    isFetching={isFetchingDrones}
                    disabled={false}
                  />
                </View>
              </>
            )}

            <View style={styles.clearFiltersRow}>
              <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
                <Text style={styles.clearFiltersBtnText}>Limpar filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.kpiGrid}>
        {kpiCards.map((card) => (
          <View key={card.title} style={[styles.kpiItem, { width: itemColumnWidth }]}>
            <DashboardKpiCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              accentColor={card.accentColor}
              isLoading={card.isLoading}
            />
          </View>
        ))}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.blockTitle}>Lancamentos dos pilotos</Text>
        {isLoadingPilotLaunchRows ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size='small' color={COLORS.blue} />
            <Text style={styles.loadingText}>Carregando lancamentos...</Text>
          </View>
        ) : pilotLaunchRows.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum lancamento encontrado para o periodo.</Text>
        ) : (
          <>
            <Text style={styles.blockSubtitle}>
              Lancado: {formatInteger(launchedPilotsCount)} | Pendente:{' '}
              {formatInteger(pendingPilotsCount)}
            </Text>
            <View style={{ marginTop: 10, gap: 8 }}>
              {pilotLaunchRows.map((row) => (
                <View key={row.id} style={styles.launchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.launchCustomer} numberOfLines={1}>
                      {row.customerName}
                    </Text>
                    <Text style={styles.launchPilot} numberOfLines={1}>
                      {row.pilotName}
                    </Text>
                    <Text style={styles.launchFarm} numberOfLines={1}>
                      {row.farmName}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.launchOrder}>OS #{row.serviceOrderNumber}</Text>
                    <View
                      style={[
                        styles.launchBadge,
                        row.launchStatus === 'launched'
                          ? styles.launchBadgeLaunched
                          : styles.launchBadgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.launchBadgeText,
                          row.launchStatus === 'launched'
                            ? styles.launchBadgeTextLaunched
                            : styles.launchBadgeTextPending,
                        ]}
                      >
                        {mapLaunchStatusLabel(row.launchStatus)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <HorizontalBarsCard
        title='Hectares por piloto/ajudante'
        subtitle={
          pilotEntityMode === 'assistants'
            ? 'Agrupamento por ajudante com filtros operacionais.'
            : undefined
        }
        data={pilotChartData}
        isLoading={isLoadingPilotChart}
        emptyText='Sem dados para exibir.'
        color='#2563EB'
        isTablet={isTablet}
        rightHeader={
          <View style={{ gap: 8 }}>
            <View style={styles.modeRow}>
              <ModeToggle
                label='Pilotos'
                active={pilotEntityMode === 'pilots'}
                onPress={() => setPilotEntityMode('pilots')}
              />
              <ModeToggle
                label='Ajudantes'
                active={pilotEntityMode === 'assistants'}
                onPress={() => setPilotEntityMode('assistants')}
              />
            </View>
            <View style={styles.modeRow}>
              <ModeToggle
                label='Mes'
                active={pilotPeriodMode === 'month'}
                onPress={() => setPilotPeriodMode('month')}
              />
              <ModeToggle
                label='Dia'
                active={pilotPeriodMode === 'day'}
                onPress={() => setPilotPeriodMode('day')}
              />
            </View>
          </View>
        }
      />

      <HorizontalBarsCard
        title='Hectares por cliente'
        data={hectaresByCustomerData}
        isLoading={isLoadingAnyCustomerArea}
        emptyText='Sem dados para exibir.'
        color='#0D9488'
        isTablet={isTablet}
        rightHeader={
          <View style={styles.modeRow}>
            <ModeToggle
              label='Mes'
              active={customerPeriodMode === 'month'}
              onPress={() => setCustomerPeriodMode('month')}
            />
            <ModeToggle
              label='Dia'
              active={customerPeriodMode === 'day'}
              onPress={() => setCustomerPeriodMode('day')}
            />
          </View>
        }
      />

      <View style={styles.blockCard}>
        <Text style={styles.blockTitle}>Ordens de servico em aberto</Text>
        {isLoadingAnyOrderStats ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size='small' color={COLORS.blue} />
            <Text style={styles.loadingText}>Carregando ordens de servico...</Text>
          </View>
        ) : visibleOpenServiceOrders.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma OS em aberto encontrada para o recorte.</Text>
        ) : (
          <View style={styles.serviceOrderGrid}>
            {visibleOpenServiceOrders.map(({ serviceOrder, queryIndex }) => {
              const yesterdayStats = orderYesterdayStatsQueries[queryIndex]?.data?.stats;
              const serviceOrderApplications =
                orderApplicationsQueries[queryIndex]?.data?.data || [];

              const totalPlots = serviceOrder.plots?.length || 0;
              const totalHectaresAllPlots = (serviceOrder.plots || []).reduce(
                (sum, plot) => sum + parseNumeric(plot.hectare),
                0
              );
              const totalHectaresApplied = serviceOrderApplications.reduce(
                (sum, application) => sum + parseNumeric(application.hectares),
                0
              );
              const uniquePlotIdsWithApplications = new Set(
                serviceOrderApplications
                  .map((application) => application.plotId)
                  .filter((plotId): plotId is string => Boolean(plotId))
              );
              const plotsWithApplications = uniquePlotIdsWithApplications.size;
              const rawProgress =
                totalHectaresAllPlots > 0
                  ? (totalHectaresApplied / totalHectaresAllPlots) * 100
                  : 0;
              const progressValue = Math.min(rawProgress, 100);
              const customerName = serviceOrder.customer?.name || 'Cliente nao informado';
              const farmDetails = (serviceOrder.farms || [])
                .map((farm) => farm.name)
                .filter((name): name is string => Boolean(name))
                .join(', ');
              const serviceOrderObservation = serviceOrder.observation?.trim();

              return (
                <View
                  key={serviceOrder.id}
                  style={[
                    styles.serviceOrderCard,
                    { width: shouldUseTwoColumns ? '48.6%' : '100%' },
                  ]}
                >
                  <View style={styles.serviceOrderHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceOrderCustomer} numberOfLines={1}>
                        {customerName}
                      </Text>
                      <Text style={styles.serviceOrderFarm} numberOfLines={1}>
                        {farmDetails || 'Fazenda nao informada'}
                      </Text>
                      {serviceOrderObservation ? (
                        <Text style={styles.serviceOrderObservation} numberOfLines={1}>
                          {serviceOrderObservation}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.serviceOrderNumberChip}>
                      <Text style={styles.serviceOrderNumberChipText}>
                        OS #{serviceOrder.number}
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressTitle}>Progresso da OS</Text>
                      <Text style={styles.progressValue}>
                        {formatHectares(totalHectaresApplied)} /{' '}
                        {formatHectares(totalHectaresAllPlots)}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressValue}%` }]} />
                    </View>
                    <Text style={styles.progressCaption}>{rawProgress.toFixed(1)}% concluido</Text>
                  </View>

                  <View style={styles.serviceOrderFooterStats}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.footerStatLabel}>Aplicacao ontem</Text>
                      <Text style={styles.footerStatValueGreen}>
                        {formatHectares(yesterdayStats?.totalAreaHectares)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.footerStatLabel}>Mapas/talhoes</Text>
                      <Text style={styles.footerStatValueBlue}>
                        {formatInteger(plotsWithApplications)} concluidos /{' '}
                        {formatInteger(totalPlots)} total
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  header: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.gray,
    fontSize: 14,
  },
  filterCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    padding: 12,
    gap: 10,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  toggleFiltersBtn: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleFiltersBtnText: {
    color: COLORS.blue,
    fontWeight: '600',
    fontSize: 12,
  },
  filtersContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
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
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray,
    height: 50,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 15,
    color: COLORS.black,
  },
  dateButton: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 50,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: COLORS.black,
    fontSize: 14,
  },
  advancedToggle: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  advancedToggleText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 13,
  },
  clearFiltersRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  clearFiltersBtn: {
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
  },
  clearFiltersBtnText: {
    color: COLORS.blue,
    fontWeight: '700',
    fontSize: 13,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiItem: {
    minHeight: 96,
  },
  blockCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    padding: 12,
    gap: 8,
  },
  blockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  blockSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  rightHeaderWrap: {
    maxWidth: 190,
    alignItems: 'flex-end',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  emptyText: {
    color: COLORS.gray,
    fontSize: 13,
    paddingVertical: 6,
  },
  launchRow: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  launchCustomer: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '700',
  },
  launchPilot: {
    color: COLORS.gray,
    fontSize: 13,
    marginTop: 2,
  },
  launchFarm: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 2,
  },
  launchOrder: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  launchBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  launchBadgeLaunched: {
    backgroundColor: '#ECFDF3',
    borderColor: '#BBF7D0',
  },
  launchBadgePending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  launchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  launchBadgeTextLaunched: {
    color: '#166534',
  },
  launchBadgeTextPending: {
    color: '#92400E',
  },
  barRow: {
    gap: 6,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.black,
    fontWeight: '600',
  },
  barValue: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
  },
  barTrack: {
    width: '100%',
    height: 9,
    borderRadius: 999,
    backgroundColor: COLORS.lightgray,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
  },
  modeToggle: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  modeToggleActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  modeToggleInactive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.lightgray,
  },
  modeToggleTextActive: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  modeToggleTextInactive: {
    color: COLORS.black,
    fontWeight: '600',
    fontSize: 12,
  },
  serviceOrderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  serviceOrderCard: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: COLORS.white,
  },
  serviceOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  serviceOrderCustomer: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '700',
  },
  serviceOrderFarm: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 2,
  },
  serviceOrderObservation: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 2,
  },
  serviceOrderNumberChip: {
    backgroundColor: '#ECFDF3',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serviceOrderNumberChipText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressTitle: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '600',
  },
  progressValue: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.lightgray,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#16A34A',
    height: '100%',
    borderRadius: 999,
  },
  progressCaption: {
    color: COLORS.gray,
    fontSize: 12,
  },
  serviceOrderFooterStats: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightgray,
  },
  footerStatLabel: {
    color: COLORS.gray,
    fontSize: 12,
  },
  footerStatValueGreen: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 2,
  },
  footerStatValueBlue: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 2,
  },
});
