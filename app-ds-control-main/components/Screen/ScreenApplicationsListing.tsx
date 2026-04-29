import {
  AntDesign,
  Entypo,
  Feather,
  Ionicons,
  Octicons,
  SimpleLineIcons,
} from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import DatePickeriOSModal from '@/components/ui/DatePickeriOSModal';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import { useGetAllApplications } from '@/queries/application.query';
import { useGetAllAssistantsInfinite } from '@/queries/assistant.query';
import { useGetAllDronesInfinite } from '@/queries/drone.query';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllProductsInfinite } from '@/queries/product.query';
import { useGetAllServiceOrders } from '@/queries/service-order.query';
import { GetAllApplicationsParams } from '@/services/application.service';
import {
  Application,
  ApplicationIssueFilter,
  APPLICATION_ISSUE_LABELS,
  ApplicationOrderBy,
  ApplicationOrderType,
} from '@/types/applications.type';
import { Assistant } from '@/types/assistant.type';
import { Drone } from '@/types/drone.type';
import { Farm } from '@/types/farm.type';
import { Product } from '@/types/product.type';
import { ServiceOrderStatus } from '@/types/service-order.type';
import { User } from '@/types/user.type';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { isAndroid } from '@/utils/isAndroid';

const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

const serviceOrderStatusOptions: { id: string; label: string }[] = [
  { id: 'open', label: 'Aberta' },
  { id: 'completed', label: 'Concluída' },
  { id: 'cancelled', label: 'Cancelada' },
];

const invalidApplicationOptions: { id: string; label: string }[] = [
  { id: 'all', label: 'Todas (válidas + inconsistentes)' },
  { id: 'true', label: 'Somente inconsistentes' },
  { id: 'false', label: 'Somente válidas' },
];

const orderByOptions: { id: string; label: string }[] = [
  { id: ApplicationOrderBy.DATE, label: 'Data da aplicação' },
  { id: ApplicationOrderBy.PILOT, label: 'Piloto' },
  { id: ApplicationOrderBy.PRODUCT, label: 'Produto' },
];

const orderTypeOptions: { id: string; label: string }[] = [
  { id: ApplicationOrderType.DESC, label: 'Descendente' },
  { id: ApplicationOrderType.ASC, label: 'Ascendente' },
];

const limitOptions: { id: string; label: string }[] = [
  { id: '5', label: '5 por página' },
  { id: '10', label: '10 por página' },
  { id: '20', label: '20 por página' },
];

const applicationIssueOptions: { id: string; label: string }[] = [
  { id: 'all', label: 'Todas as inconsistências' },
  ...Object.entries(APPLICATION_ISSUE_LABELS).map(([id, label]) => ({ id, label })),
];

export default function ScreenApplicationsListing() {
  const router = useRouter();
  const { user } = useAuth();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [pageSize, setPageSize] = useState('5');
  const [orderBy, setOrderBy] = useState<ApplicationOrderBy>(ApplicationOrderBy.DATE);
  const [orderType, setOrderType] = useState<ApplicationOrderType>(ApplicationOrderType.DESC);

  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [farmSearchTerm, setFarmSearchTerm] = useState('');
  const [pilotId, setPilotId] = useState<string | undefined>(undefined);
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [assistantId, setAssistantId] = useState<string | undefined>(undefined);
  const [assistantSearchTerm, setAssistantSearchTerm] = useState('');
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [droneId, setDroneId] = useState<string | undefined>(undefined);
  const [droneSearchTerm, setDroneSearchTerm] = useState('');
  const [serviceOrderStatus, setServiceOrderStatus] = useState<ServiceOrderStatus | undefined>(
    undefined
  );
  const [applicationIssue, setApplicationIssue] = useState<ApplicationIssueFilter | undefined>(
    undefined
  );
  const [invalidApplication, setInvalidApplication] = useState<'all' | 'true' | 'false'>('all');

  const {
    data: farmsData,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    fetchNextPage: fetchNextPageFarms,
    isFetching: isFetchingFarms,
  } = useGetAllFarmsInfinite(user?.type === 'farmer' ? user?.customerId : undefined, {
    limit: '10',
    search: farmSearchTerm || undefined,
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
    data: dronesData,
    hasNextPage: hasNextPageDrones,
    isFetchingNextPage: isFetchingNextPageDrones,
    fetchNextPage: fetchNextPageDrones,
    isFetching: isFetchingDrones,
  } = useGetAllDronesInfinite({
    limit: '10',
    search: droneSearchTerm || undefined,
  });

  const { data: serviceOrdersData, isFetching: isFetchingPilots } = useGetAllServiceOrders(
    {
      customerId: user?.type === 'farmer' ? user?.customerId : undefined,
      includePilots: 'true',
      includeCustomers: 'false',
      includePlots: 'false',
      includeFarms: 'false',
      includeContracts: 'false',
      includeGeoJson: 'false',
      page: '1',
      limit: '100',
    },
    {
      enabled: user?.type !== 'pilot',
    }
  );

  const listedFarms: Farm[] = useMemo(() => {
    return (
      ((farmsData as unknown as InfiniteData<{ data: Farm[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Farm[]) || []
    );
  }, [farmsData]);

  const listedAssistants: Assistant[] = useMemo(() => {
    return (
      ((
        assistantsData as unknown as InfiniteData<{ data: Assistant[] }> | undefined
      )?.pages?.flatMap((page) => page.data) as Assistant[]) || []
    );
  }, [assistantsData]);

  const listedProducts: Product[] = useMemo(() => {
    return (
      ((productsData as unknown as InfiniteData<{ data: Product[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Product[]) || []
    );
  }, [productsData]);

  const listedDrones: Drone[] = useMemo(() => {
    return (
      ((dronesData as unknown as InfiniteData<{ data: Drone[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Drone[]) || []
    );
  }, [dronesData]);

  const listedPilots: User[] = useMemo(() => {
    const pilotsMap = new Map<string, User>();

    serviceOrdersData?.data?.forEach((serviceOrder) => {
      serviceOrder.pilots?.forEach((pilot) => {
        if (!pilotsMap.has(pilot.id)) {
          pilotsMap.set(pilot.id, pilot);
        }
      });
    });

    const pilots = Array.from(pilotsMap.values());
    if (!pilotSearchTerm.trim()) return pilots;

    const search = pilotSearchTerm.trim().toLowerCase();
    return pilots.filter((pilot) => pilot.name?.toLowerCase().includes(search));
  }, [serviceOrdersData, pilotSearchTerm]);

  const applicationParams: GetAllApplicationsParams = {
    pilotId: user?.type === 'pilot' ? user?.id : pilotId,
    assistantId,
    productId,
    droneId,
    customerId: user?.type === 'farmer' ? user?.customerId : undefined,
    serviceOrderStatus,
    applicationIssue,
    invalidApplication: invalidApplication === 'all' ? undefined : invalidApplication,
    includeCustomer: 'true',
    includeServiceOrder: 'true',
    page: currentPage.toString(),
    limit: pageSize,
    orderBy,
    orderType,
    startDate,
    endDate,
    farmId,
  };

  const {
    data: applicationsData,
    isLoading,
    isError,
    error,
  } = useGetAllApplications(applicationParams);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    startDate,
    endDate,
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

  const activeFilters = useMemo(() => {
    return [
      !!startDate && 'Data inicial',
      !!endDate && 'Data final',
      !!farmId && 'Fazenda',
      !!pilotId && user?.type !== 'pilot' && 'Piloto',
      !!assistantId && 'Ajudante',
      !!productId && 'Produto',
      !!droneId && 'Drone',
      !!serviceOrderStatus && 'Status OS',
      !!applicationIssue && 'Inconsistência',
      invalidApplication !== 'all' && 'Inválida',
      orderBy !== ApplicationOrderBy.DATE && 'Ordenação',
      orderType !== ApplicationOrderType.DESC && 'Ordem',
      pageSize !== '5' && 'Limite',
    ].filter(Boolean) as string[];
  }, [
    startDate,
    endDate,
    farmId,
    pilotId,
    user?.type,
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

  const handleInvalidApplicationChange = (value: string) => {
    const nextInvalidApplication = value as 'all' | 'true' | 'false';
    setInvalidApplication(nextInvalidApplication);

    if (nextInvalidApplication === 'true') {
      setApplicationIssue(undefined);
    }
  };

  const handleApplicationIssueChange = (value: string) => {
    if (value === 'all') {
      setApplicationIssue(undefined);
      return;
    }

    setApplicationIssue(value as ApplicationIssueFilter);
    setInvalidApplication('all');
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setFarmId(undefined);
    setPilotId(undefined);
    setAssistantId(undefined);
    setProductId(undefined);
    setDroneId(undefined);
    setServiceOrderStatus(undefined);
    setApplicationIssue(undefined);
    setInvalidApplication('all');
    setOrderBy(ApplicationOrderBy.DATE);
    setOrderType(ApplicationOrderType.DESC);
    setPageSize('5');
    setFarmSearchTerm('');
    setPilotSearchTerm('');
    setAssistantSearchTerm('');
    setProductSearchTerm('');
    setDroneSearchTerm('');
    setCurrentPage(1);
  };

  if (isError) {
    return <SkeletonError error={error} />;
  }

  if (isLoading || !applicationsData) {
    return <SkeletonLoading />;
  }

  const applications: Application[] = applicationsData?.data ?? [];
  const totalPages = applicationsData?.totalPages ?? 1;
  const totalCount = applicationsData?.totalCount ?? 0;

  const handleFirstPage = () => setCurrentPage(1);
  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  const handleLastPage = () => setCurrentPage(totalPages);

  return (
    <ScrollView style={{ padding: 12 }} showsVerticalScrollIndicator={false}>
      {/* Filters */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: 12,
          padding: 12,
          borderColor: COLORS.lightblue,
          borderWidth: 1,
          marginBottom: 12,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.black }}>Filtros</Text>
        {activeFilters.length > 0 && (
          <Text style={{ fontSize: 12, color: COLORS.blue }}>
            {activeFilters.length} filtro(s) ativo(s): {activeFilters.join(', ')}
          </Text>
        )}

        {/* Date Range */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Start Date */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Data inicial</Text>
            {isAndroid ? (
              <>
                <TouchableOpacity
                  onPress={() => setShowStartPicker(true)}
                  style={{
                    backgroundColor: COLORS.white,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: COLORS.gray,
                  }}
                >
                  <Text style={{ color: COLORS.black }}>
                    {startDate ? formatDateToDDMMYYYY(startDate) : 'Selecione...'}
                  </Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={parseCivilDate(startDate)}
                    mode='date'
                    display='default'
                    onChange={(_: any, selectedDate?: Date) => {
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

          {/* End Date */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Data final</Text>
            {isAndroid ? (
              <>
                <TouchableOpacity
                  onPress={() => setShowEndPicker(true)}
                  style={{
                    backgroundColor: COLORS.white,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: COLORS.gray,
                  }}
                >
                  <Text style={{ color: COLORS.black }}>
                    {endDate ? formatDateToDDMMYYYY(endDate) : 'Selecione...'}
                  </Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={parseCivilDate(endDate)}
                    mode='date'
                    display='default'
                    minimumDate={startDate ? parseCivilDate(startDate) : undefined}
                    onChange={(_: any, selectedDate?: Date) => {
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
        </View>

        {/* Farm filter */}
        <View>
          <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Fazenda</Text>
          <SearchableSelectQuery
            value={farmId}
            listedData={listedFarms}
            onSearchChange={setFarmSearchTerm}
            onItemSelect={(value: string | undefined) => setFarmId(value)}
            itemKey='name'
            hasNextPage={hasNextPageFarms}
            fetchNextPage={fetchNextPageFarms}
            isFetchingNextPage={isFetchingNextPageFarms}
            isFetching={isFetchingFarms}
            disabled={false}
          />
        </View>

        <TouchableOpacity
          onPress={() => setShowAdvancedFilters((prev) => !prev)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderColor: COLORS.lightgray,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 10,
            backgroundColor: COLORS.background,
          }}
        >
          <Text style={{ color: COLORS.black, fontWeight: 'bold' }}>Filtros avançados</Text>
          <Feather
            name={showAdvancedFilters ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.gray}
          />
        </TouchableOpacity>

        {showAdvancedFilters && (
          <View style={{ gap: 10 }}>
            {user?.type !== 'pilot' && (
              <View>
                <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Piloto</Text>
                <SearchableSelectQuery
                  value={pilotId}
                  listedData={listedPilots}
                  onSearchChange={setPilotSearchTerm}
                  onItemSelect={(value: string | undefined) => setPilotId(value)}
                  itemKey='name'
                  isFetching={isFetchingPilots}
                  disabled={false}
                />
              </View>
            )}

            <View>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Ajudante</Text>
              <SearchableSelectQuery
                value={assistantId}
                listedData={listedAssistants}
                onSearchChange={setAssistantSearchTerm}
                onItemSelect={(value: string | undefined) => setAssistantId(value)}
                itemKey='name'
                hasNextPage={hasNextPageAssistants}
                fetchNextPage={fetchNextPageAssistants}
                isFetchingNextPage={isFetchingNextPageAssistants}
                isFetching={isFetchingAssistants}
                disabled={false}
              />
            </View>

            <View>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Produto</Text>
              <SearchableSelectQuery
                value={productId}
                listedData={listedProducts}
                onSearchChange={setProductSearchTerm}
                onItemSelect={(value: string | undefined) => setProductId(value)}
                itemKey='name'
                hasNextPage={hasNextPageProducts}
                fetchNextPage={fetchNextPageProducts}
                isFetchingNextPage={isFetchingNextPageProducts}
                isFetching={isFetchingProducts}
                disabled={false}
              />
            </View>

            <View>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Drone</Text>
              <SearchableSelectQuery
                value={droneId}
                listedData={listedDrones}
                onSearchChange={setDroneSearchTerm}
                onItemSelect={(value: string | undefined) => setDroneId(value)}
                itemKey='name'
                hasNextPage={hasNextPageDrones}
                fetchNextPage={fetchNextPageDrones}
                isFetchingNextPage={isFetchingNextPageDrones}
                isFetching={isFetchingDrones}
                disabled={false}
              />
            </View>

            <View>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                Status da OS
              </Text>
              <SearchableSelectQuery
                value={serviceOrderStatus}
                listedData={serviceOrderStatusOptions}
                onItemSelect={(value: string | undefined) =>
                  setServiceOrderStatus((value as ServiceOrderStatus | undefined) || undefined)
                }
                itemKey='label'
                disabled={false}
              />
            </View>

            <View>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                Inconsistência (applicationIssue)
              </Text>
              <SearchableSelectQuery
                value={applicationIssue || 'all'}
                listedData={applicationIssueOptions}
                onItemSelect={(value: string | undefined) =>
                  handleApplicationIssueChange(value || 'all')
                }
                itemKey='label'
                disabled={false}
              />
            </View>

            <View>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                Válida/Inconsistente (invalidApplication)
              </Text>
              <SearchableSelectQuery
                value={invalidApplication}
                listedData={invalidApplicationOptions}
                onItemSelect={(value: string | undefined) =>
                  handleInvalidApplicationChange(value || 'all')
                }
                itemKey='label'
                disabled={false}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                  Ordenar por
                </Text>
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
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Ordem</Text>
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
            </View>

            <View>
              <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                Itens por página
              </Text>
              <SearchableSelectQuery
                value={pageSize}
                listedData={limitOptions}
                onItemSelect={(value: string | undefined) => setPageSize(value || '5')}
                itemKey='label'
                disabled={false}
              />
            </View>
          </View>
        )}

        {/* Clear filters */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            onPress={clearFilters}
            style={{
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              borderColor: COLORS.blue,
              borderWidth: 1,
              borderRadius: 8,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: COLORS.white,
            }}
          >
            <Feather name='x-circle' size={14} color={COLORS.blue} />
            <Text style={{ color: COLORS.blue, fontWeight: 'bold' }}>Limpar filtros</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'black' }}>Aplicações</Text>
        <View
          style={{
            backgroundColor: 'lightblue',
            borderRadius: 8,
            padding: 4,
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: 'blue' }}>
            {applicationsData.totalCount} aplicações
          </Text>
        </View>
      </View>
      {applications.map((application) => {
        return (
          <View
            key={application.id}
            style={{
              backgroundColor: COLORS.white,
              borderRadius: 12,
              padding: 12,
              borderColor: COLORS.lightblue,
              borderWidth: 1,
              marginBottom: 12,
              shadowColor: COLORS.black,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name='settings' size={16} color={COLORS.green} />
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
                  Aplicação de {application.product.name}
                </Text>
                {!application.serviceOrder && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 4,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderColor: COLORS.red,
                      borderWidth: 1,
                      backgroundColor: COLORS.lightpink,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: COLORS.red }}>Avulsa</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity>
                <Ionicons name='ellipsis-vertical' size={16} color={COLORS.green} />
              </TouchableOpacity>
            </View>

            {!application.serviceOrder && (
              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: COLORS.lightpink,
                  borderColor: COLORS.red,
                  borderWidth: 1,
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <AntDesign name='warning' size={16} color={COLORS.red} />
                  <Text style={{ fontSize: 14, color: COLORS.red }}>Aplicação Avulsa</Text>
                </View>
                <Text style={{ fontSize: 14, color: COLORS.lightred }}>
                  Esta aplicação não está vinculada a nenhuma ordem de serviço.
                </Text>
              </View>
            )}

            {(application.serviceOrder ||
              application.farm?.name ||
              application.farm?.customer?.name) && (
              <View
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  backgroundColor: COLORS.lightblue,
                  padding: 12,
                  borderRadius: 8,
                  borderColor: COLORS.lightgray,
                  borderWidth: 1,
                  shadowColor: COLORS.black,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 3.84,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='file-text' size={14} color={COLORS.blue} />
                  <Text style={{ fontSize: 14, color: COLORS.blue, fontWeight: 'bold' }}>
                    Dados da OS
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    justifyContent: 'space-between',
                  }}
                >
                  {application.serviceOrder?.number && (
                    <View
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, flex: 1 }}
                    >
                      <Text style={{ color: COLORS.blue, opacity: 0.7, fontSize: 12 }}>
                        Número da OS
                      </Text>
                      <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                        #{application.serviceOrder.number}
                      </Text>
                    </View>
                  )}
                  {application.farm?.name && (
                    <View
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, flex: 1 }}
                    >
                      <Text style={{ color: COLORS.blue, opacity: 0.7, fontSize: 12 }}>
                        Fazenda
                      </Text>
                      <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                        {application.farm?.name || 'NÃO INFORMADO'}
                      </Text>
                    </View>
                  )}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    justifyContent: 'space-between',
                  }}
                >
                  {application.farm?.customer?.name && (
                    <View
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, flex: 1 }}
                    >
                      <Text style={{ color: COLORS.blue, opacity: 0.7, fontSize: 12 }}>
                        Cliente
                      </Text>
                      <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                        {application.farm?.customer?.name || 'NÃO INFORMADO'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Dados da aplicação */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Coluna 1 */}
              <View
                style={{
                  width: '50%',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* Coluna 1 - Linha 1 - Piloto */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='user' size={16} color={COLORS.blue} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Piloto</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.pilot?.name.split(' ')[0] ?? 'NÃO INFORMADO'}
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 2 - Drone */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='settings' size={16} color={COLORS.purple} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Drone</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.drone.name}
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 3 - Talhão */}
                {application.plot && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Octicons name='stack' size={16} color={COLORS.purple} />
                    <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      <Text style={{ fontSize: 12, color: COLORS.gray }}>Talhão</Text>
                      <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                        {application.plot?.name || 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Coluna 1 - Linha 4 - Vazão */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Entypo name='water' size={16} color={COLORS.blue} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Vazão</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.flowRate} L/ha
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 5 - Espaçamento de Rota */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='navigation' size={16} color={COLORS.green} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Espaçamento de Rota</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.routeSpacing} m
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 6 - Data */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='calendar' size={16} color={COLORS.green} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Data</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {formatDateToDDMMYYYY(application.date)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Coluna 2 */}
              <View
                style={{
                  width: '50%',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* Coluna 2 - Linha 1 - Ajudante */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='user' size={16} color={COLORS.green} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Ajudante</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.assistant?.name.split(' ')[0] ?? 'NÃO INFORMADO'}
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 2 - Cultivo */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name='leaf-outline' size={16} color={COLORS.orange} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Cultivo</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.culture.name}
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 3 - Hectares */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='target' size={16} color={COLORS.red} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Hectares</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.hectares} ha
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 4 - Altitude de Voo */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SimpleLineIcons name='plane' size={16} color={COLORS.purple} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Altitude de Voo</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.altitude} m
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 5 - Tamanho de Gota */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='droplet' size={16} color={COLORS.orange} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Tamanho de Gota</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.dropletSize} µm
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Observações */}
            {application.observations && (
              <View
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginTop: 16,
                  backgroundColor: COLORS.lightblue,
                  padding: 12,
                  borderRadius: 8,
                  borderColor: COLORS.lightgray,
                  borderWidth: 1,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.gray }}>Observações</Text>
                <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                  {application.observations}
                </Text>
              </View>
            )}

            {/* Botão Editar aplicação */}
            {user?.type === 'pilot' && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 16,
                  borderColor: COLORS.blue,
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 6,
                  backgroundColor: COLORS.white,
                }}
                onPress={() => {
                  router.push(
                    `/pilot/applications/form-application?applicationId=${application.id}&formMode=${application.serviceOrder ? 'edit' : 'edit-loose'}`
                  );
                }}
              >
                <Feather name='edit' size={14} color={COLORS.blue} />
                <Text style={{ fontSize: 14, color: COLORS.blue, fontWeight: 'bold' }}>
                  Editar aplicação
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12,
            paddingHorizontal: 20,
            paddingBottom: 60,
            backgroundColor: COLORS.background,
          }}
        >
          {/* Pagination Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: 'gray' }}>
              Página {currentPage} de {totalPages} • {totalCount} aplicações
            </Text>
          </View>

          {/* Pagination Buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* First Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === 1 ? 'lightgray' : 'blue',
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
              onPress={handleFirstPage}
              disabled={currentPage === 1}
            >
              <Feather
                name='chevrons-left'
                size={16}
                color={currentPage === 1 ? 'gray' : 'white'}
              />
            </TouchableOpacity>

            {/* Previous Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === 1 ? 'lightgray' : 'blue',
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
              onPress={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <Feather name='chevron-left' size={16} color={currentPage === 1 ? 'gray' : 'white'} />
            </TouchableOpacity>

            {/* Next Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === totalPages ? 'lightgray' : 'blue',
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
              onPress={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <Feather
                name='chevron-right'
                size={16}
                color={currentPage === totalPages ? 'gray' : 'white'}
              />
            </TouchableOpacity>

            {/* Last Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === totalPages ? 'lightgray' : 'blue',
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
              onPress={handleLastPage}
              disabled={currentPage === totalPages}
            >
              <Feather
                name='chevrons-right'
                size={16}
                color={currentPage === totalPages ? 'gray' : 'white'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const SkeletonError = ({ error }: { error: Error | null }) => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.red, fontSize: 16, fontWeight: 'bold' }}>
        Erro ao carregar aplicações
      </Text>
      <Text style={{ color: COLORS.gray, fontSize: 14 }}>
        {error?.message ?? 'Erro ao carregar aplicações'}
      </Text>
    </View>
  );
};

const SkeletonLoading = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size='large' color={COLORS.primary} />
    </View>
  );
};
