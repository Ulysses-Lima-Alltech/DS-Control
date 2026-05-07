import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FlashList } from '@shopify/flash-list';
import { InfiniteData } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import ServiceOrdersEmptyState from '@/components/ServiceOrdersEmptyState';
import DatePickeriOSModal from '@/components/ui/DatePickeriOSModal';
import SearchableSelectQuery from '@/components/ui/SearchableSelectQuery';
import Separator from '@/components/ui/Separator';
import Skeleton from '@/components/ui/Skeleton';
import TextInputSearch from '@/components/ui/TextInputSearch';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';
import { useGetAllFarmsInfinite } from '@/queries/farm.query';
import { useGetAllServiceOrders, useGetServiceOrderById } from '@/queries/service-order.query';
import { Farm } from '@/types/farm.type';
import {
  ServiceOrder,
  ServiceOrderBy,
  ServiceOrderStatus,
  ServiceOrderType,
} from '@/types/service-order.type';
import { User } from '@/types/user.type';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { isAndroid } from '@/utils/isAndroid';
import { isAdministrativeRole, isFarmerRole } from '@/utils/user-role';

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

const statusOptions: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos os status' },
  { id: 'open', label: 'Aberta' },
  { id: 'completed', label: 'Concluída' },
  { id: 'cancelled', label: 'Cancelada' },
];

const orderByOptions: { id: string; label: string }[] = [
  { id: ServiceOrderBy.PLANNED_DATE, label: 'Data planejada' },
  { id: ServiceOrderBy.CUSTOMER, label: 'Cliente' },
  { id: ServiceOrderBy.NAME, label: 'Nome' },
];

const orderTypeOptions: { id: string; label: string }[] = [
  { id: ServiceOrderType.DESC, label: 'Descendente' },
  { id: ServiceOrderType.ASC, label: 'Ascendente' },
];

const limitOptions: { id: string; label: string }[] = [
  { id: '5', label: '5 por página' },
  { id: '10', label: '10 por página' },
  { id: '20', label: '20 por página' },
];

export default function ServiceOrders() {
  const router = useRouter();
  const { selectedServiceOrderId: selectedServiceOrderIdParam } = useLocalSearchParams<{
    selectedServiceOrderId?: string | string[];
  }>();
  const { user } = useAuth();
  const routeGroup = isAdministrativeRole(user?.type) ? 'backoffice' : 'farmer';
  const customerIdFilter = isFarmerRole(user?.type) ? user?.customerId : undefined;
  const selectedServiceOrderId = useMemo(() => {
    const normalized = Array.isArray(selectedServiceOrderIdParam)
      ? selectedServiceOrderIdParam[0]
      : selectedServiceOrderIdParam;
    if (!normalized) return undefined;
    const trimmed = normalized.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [selectedServiceOrderIdParam]);
  const serviceOrdersListRef = useRef<FlashList<ServiceOrder>>(null);
  const lastAutoScrollServiceOrderIdRef = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | undefined>(undefined);
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [farmSearchTerm, setFarmSearchTerm] = useState('');
  const [pilotId, setPilotId] = useState<string | undefined>(undefined);
  const [pilotSearchTerm, setPilotSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [orderBy, setOrderBy] = useState<ServiceOrderBy>(ServiceOrderBy.PLANNED_DATE);
  const [orderType, setOrderType] = useState<ServiceOrderType>(ServiceOrderType.DESC);
  const [pageSize, setPageSize] = useState('5');

  const {
    data: farmsData,
    hasNextPage: hasNextPageFarms,
    isFetchingNextPage: isFetchingNextPageFarms,
    fetchNextPage: fetchNextPageFarms,
    isFetching: isFetchingFarms,
  } = useGetAllFarmsInfinite(customerIdFilter, {
    limit: '10',
    search: farmSearchTerm || undefined,
  });

  const { data: pilotSourceData, isFetching: isFetchingPilots } = useGetAllServiceOrders(
    {
      customerId: customerIdFilter,
      includePilots: 'true',
      includeCustomers: 'false',
      includePlots: 'false',
      includeFarms: 'false',
      includeContracts: 'false',
      includeGeoJson: 'false',
      page: '1',
      limit: '100',
    },
    { enabled: user?.type !== 'pilot' }
  );

  const listedFarms: Farm[] = useMemo(() => {
    return (
      ((farmsData as unknown as InfiniteData<{ data: Farm[] }> | undefined)?.pages?.flatMap(
        (page) => page.data
      ) as Farm[]) || []
    );
  }, [farmsData]);

  const farmsOptions = useMemo(() => {
    return [{ id: 'all', name: 'Todas as fazendas' }, ...listedFarms];
  }, [listedFarms]);

  const listedPilots: User[] = useMemo(() => {
    const pilotsMap = new Map<string, User>();
    pilotSourceData?.data?.forEach((serviceOrder) => {
      serviceOrder.pilots?.forEach((pilot) => {
        if (!pilotsMap.has(pilot.id)) {
          pilotsMap.set(pilot.id, pilot);
        }
      });
    });

    const pilots = Array.from(pilotsMap.values());
    if (!pilotSearchTerm.trim()) return pilots;

    const searchTerm = pilotSearchTerm.trim().toLowerCase();
    return pilots.filter((pilot) => pilot.name?.toLowerCase().includes(searchTerm));
  }, [pilotSourceData, pilotSearchTerm]);

  const pilotOptions = useMemo(() => {
    return [{ id: 'all', name: 'Todos os pilotos' }, ...listedPilots];
  }, [listedPilots]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, farmId, pilotId, startDate, endDate, orderBy, orderType, pageSize]);

  const activeFilters = useMemo(() => {
    return [
      !!search && 'Busca',
      !!statusFilter && 'Status',
      !!farmId && 'Fazenda',
      !!pilotId && 'Piloto',
      !!startDate && 'Data inicial',
      !!endDate && 'Data final',
      orderBy !== ServiceOrderBy.PLANNED_DATE && 'Ordenação',
      orderType !== ServiceOrderType.DESC && 'Ordem',
      pageSize !== '5' && 'Limite',
    ].filter(Boolean) as string[];
  }, [search, statusFilter, farmId, pilotId, startDate, endDate, orderBy, orderType, pageSize]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter(undefined);
    setFarmId(undefined);
    setPilotId(undefined);
    setFarmSearchTerm('');
    setPilotSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);
    setOrderBy(ServiceOrderBy.PLANNED_DATE);
    setOrderType(ServiceOrderType.DESC);
    setPageSize('5');
    setCurrentPage(1);
  };

  const {
    data,
    isFetching: isFetchingServiceOrders,
    error,
    refetch,
  } = useGetAllServiceOrders({
    search: search || undefined,
    status: statusFilter,
    farmId,
    pilotId,
    customerId: customerIdFilter,
    startDate,
    endDate,
    includeFarms: 'true',
    includeCustomers: 'true',
    includePlots: 'false',
    includePilots: 'true',
    includeContracts: 'false',
    includeGeoJson: 'false',
    page: currentPage.toString(),
    limit: pageSize,
    orderBy,
    orderType,
  });

  const serviceOrdersList: ServiceOrder[] = data?.data ?? [];
  const selectedServiceOrderInCurrentPage = useMemo(
    () => serviceOrdersList.find((serviceOrder) => serviceOrder.id === selectedServiceOrderId),
    [selectedServiceOrderId, serviceOrdersList]
  );

  const { data: selectedServiceOrderFromApi } = useGetServiceOrderById(
    {
      serviceOrderId: selectedServiceOrderId || '',
      includeFarms: 'true',
      includeCustomers: 'true',
      includePilots: 'true',
      includePlots: 'false',
      includeContracts: 'false',
      includeGeoJson: 'false',
    },
    {
      enabled: Boolean(selectedServiceOrderId && !selectedServiceOrderInCurrentPage),
      retry: 1,
    }
  );

  const serviceOrdersListToRender = useMemo(() => {
    if (!selectedServiceOrderId) return serviceOrdersList;

    if (selectedServiceOrderInCurrentPage) {
      return serviceOrdersList;
    }

    if (!selectedServiceOrderFromApi) {
      return serviceOrdersList;
    }

    return [selectedServiceOrderFromApi, ...serviceOrdersList];
  }, [
    selectedServiceOrderId,
    selectedServiceOrderFromApi,
    selectedServiceOrderInCurrentPage,
    serviceOrdersList,
  ]);

  const selectedServiceOrderIndex = useMemo(
    () =>
      selectedServiceOrderId
        ? serviceOrdersListToRender.findIndex((serviceOrder) => serviceOrder.id === selectedServiceOrderId)
        : -1,
    [selectedServiceOrderId, serviceOrdersListToRender]
  );

  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const handleFirstPage = () => setCurrentPage(1);
  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  const handleLastPage = () => setCurrentPage(totalPages);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!selectedServiceOrderId) {
      lastAutoScrollServiceOrderIdRef.current = null;
      return;
    }

    if (selectedServiceOrderIndex < 0) return;
    if (lastAutoScrollServiceOrderIdRef.current === selectedServiceOrderId) return;

    const timer = setTimeout(() => {
      try {
        serviceOrdersListRef.current?.scrollToIndex({
          index: selectedServiceOrderIndex,
          animated: true,
          viewPosition: 0.3,
        });
      } catch {
        serviceOrdersListRef.current?.scrollToOffset({
          offset: 0,
          animated: true,
        });
      }
      lastAutoScrollServiceOrderIdRef.current = selectedServiceOrderId;
    }, 180);

    return () => clearTimeout(timer);
  }, [selectedServiceOrderId, selectedServiceOrderIndex]);

  if (error) {
    return <SkeletonError error={error ?? new Error('Erro ao carregar ordens de serviço')} />;
  }

  if (isFetchingServiceOrders) {
    return (
      <View style={{ padding: 20 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonLoadingCard key={index} />
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        paddingVertical: 0,
        flex: 1,
        backgroundColor: COLORS.background,
      }}
    >
      <FlashList
        ref={serviceOrdersListRef}
        data={serviceOrdersListToRender}
        extraData={selectedServiceOrderId}
        ListHeaderComponent={() => {
          return (
            <View style={{ gap: 12, marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.black }}>
                  Ordens de serviço
                </Text>
                <View
                  style={{
                    backgroundColor: COLORS.lightblue,
                    borderRadius: 8,
                    padding: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, color: COLORS.blue }}>
                    {data?.totalCount} ordens
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: COLORS.white,
                  borderRadius: 12,
                  padding: 12,
                  borderColor: COLORS.lightblue,
                  borderWidth: 1,
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.black }}>
                  Filtros
                </Text>
                {activeFilters.length > 0 && (
                  <Text style={{ fontSize: 12, color: COLORS.blue }}>
                    {activeFilters.length} filtro(s) ativo(s): {activeFilters.join(', ')}
                  </Text>
                )}

                <View>
                  <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Busca</Text>
                  <TextInputSearch
                    placeholder='Buscar número, cliente ou fazenda...'
                    style={{
                      backgroundColor: COLORS.white,
                      height: 50,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: COLORS.gray,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 15,
                    }}
                    onChangeText={setSearch}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                      Status
                    </Text>
                    <SearchableSelectQuery
                      value={statusFilter || 'all'}
                      listedData={statusOptions}
                      onItemSelect={(value: string | undefined) => {
                        if (!value || value === 'all') {
                          setStatusFilter(undefined);
                          return;
                        }
                        setStatusFilter(value as ServiceOrderStatus);
                      }}
                      itemKey='label'
                      disabled={false}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                      Fazenda
                    </Text>
                    <SearchableSelectQuery
                      value={farmId || 'all'}
                      listedData={farmsOptions}
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
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Piloto</Text>
                  <SearchableSelectQuery
                    value={pilotId || 'all'}
                    listedData={pilotOptions}
                    onSearchChange={setPilotSearchTerm}
                    onItemSelect={(value: string | undefined) => {
                      if (!value || value === 'all') {
                        setPilotId(undefined);
                        return;
                      }
                      setPilotId(value);
                    }}
                    itemKey='name'
                    isFetching={isFetchingPilots}
                    disabled={false}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                      Data inicial
                    </Text>
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

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                      Data final
                    </Text>
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
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                          Ordenar por
                        </Text>
                        <SearchableSelectQuery
                          value={orderBy}
                          listedData={orderByOptions}
                          onItemSelect={(value: string | undefined) =>
                            setOrderBy((value as ServiceOrderBy) || ServiceOrderBy.PLANNED_DATE)
                          }
                          itemKey='label'
                          disabled={false}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>
                          Ordem
                        </Text>
                        <SearchableSelectQuery
                          value={orderType}
                          listedData={orderTypeOptions}
                          onItemSelect={(value: string | undefined) =>
                            setOrderType((value as ServiceOrderType) || ServiceOrderType.DESC)
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

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity
                    onPress={handleClearFilters}
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
            </View>
          );
        }}
        renderItem={({ item }: { item: ServiceOrder }) => {
          const { id, number, customer, plannedDate, farms, status } = item;
          const isSelectedServiceOrder = selectedServiceOrderId === id;
          return (
            <TouchableOpacity
              key={id}
              style={{
                backgroundColor: COLORS.white,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: isSelectedServiceOrder ? 2 : 0,
                borderColor: isSelectedServiceOrder ? COLORS.blue : 'transparent',
                shadowColor: COLORS.black,
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.1,
                shadowRadius: 3.84,
                elevation: 5,
              }}
              onPress={() => {
                router.push({
                  pathname: `/${routeGroup}/service-orders/[serviceOrderId]` as any,
                  params: { serviceOrderId: id },
                });
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 24,
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                  <Feather name='file-text' size={20} color={COLORS.blue} />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: 'bold',
                      color: COLORS.black,
                      flex: 1,
                      marginRight: 10,
                    }}
                  >
                    #{number} - Ordem de serviço
                  </Text>
                  {isSelectedServiceOrder && (
                    <View
                      style={{
                        backgroundColor: COLORS.lightblue,
                        borderRadius: 8,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: COLORS.blue,
                        }}
                      >
                        Selecionada
                      </Text>
                    </View>
                  )}
                  <StatusBadge status={status} />
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: COLORS.white,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                  onPress={() => {
                    router.push({
                      pathname: `/${routeGroup}/service-orders/[serviceOrderId]` as any,
                      params: { serviceOrderId: id },
                    });
                  }}
                >
                  <MaterialCommunityIcons name='dots-vertical' size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              <View
                style={{ flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' }}
              >
                <Feather
                  name='user'
                  size={20}
                  color='blue'
                  style={{
                    backgroundColor: COLORS.lightblue,
                    borderRadius: 8,
                    padding: 4,
                    alignSelf: 'flex-start',
                  }}
                />
                <View style={{ flexDirection: 'column', gap: 4, flex: 1 }}>
                  <Text style={{ fontSize: 12, color: COLORS.gray }}>Cliente</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: COLORS.black,
                      marginTop: 2,
                    }}
                  >
                    {customer.name}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  marginBottom: 12,
                  alignItems: 'center',
                }}
              >
                <Feather
                  name='calendar'
                  size={20}
                  color={COLORS.green}
                  style={{
                    backgroundColor: COLORS.lightgreen,
                    borderRadius: 8,
                    padding: 4,
                    alignSelf: 'flex-start',
                  }}
                />
                <View style={{ flexDirection: 'column', gap: 4, flex: 1 }}>
                  <Text style={{ fontSize: 12, color: COLORS.gray }}>Data planejada</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: COLORS.black,
                      marginTop: 2,
                    }}
                  >
                    {formatDateToDDMMYYYY(plannedDate)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <FontAwesome5
                  name='map'
                  size={20}
                  color={COLORS.yellow}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: COLORS.lightyellow,
                    borderRadius: 8,
                    padding: 4,
                  }}
                />
                <View style={{ flexDirection: 'column', gap: 4, flex: 1 }}>
                  <Text style={{ fontSize: 12, color: COLORS.gray }}>Fazendas</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: COLORS.black,
                      marginTop: 2,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      {farms.map((farm) => {
                        return (
                          <View
                            key={farm.id}
                            style={{
                              backgroundColor: COLORS.white,
                              borderWidth: 1,
                              borderColor: COLORS.lightgray,
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Entypo name='location-pin' size={16} color={COLORS.gray} />
                            <Text style={{ fontSize: 12, color: 'gray' }}>{farm.name}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </Text>
                </View>
              </View>
              <Separator color={COLORS.lightgray} lineWidth={1} />
              <TouchableOpacity
                style={{
                  width: '100%',
                  backgroundColor: COLORS.white,
                  borderColor: COLORS.lightblue,
                  borderWidth: 1,
                  marginTop: 12,
                  borderRadius: 8,
                  padding: 2,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPress={() => {
                  router.push({
                    pathname: `/${routeGroup}/service-orders/[serviceOrderId]` as any,
                    params: { serviceOrderId: id },
                  });
                }}
              >
                <MaterialCommunityIcons name='eye' size={20} color={COLORS.blue} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: COLORS.blue,
                  }}
                >
                  Visualizar
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => `${item.id}-${item.id}`}
        contentContainerStyle={{
          padding: 20,
        }}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={10}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <ServiceOrdersEmptyState
            title='Nenhuma ordem de serviço encontrada'
            description='Contate o administrador para acompanhar as ordens de serviço.'
            iconName='clipboard-list-outline'
            primaryActionLabel='Atualizar'
            onPrimaryAction={handleRefresh}
          />
        }
        ListFooterComponent={() => {
          if (totalPages <= 1) return null;

          return (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 16,
                paddingHorizontal: 20,
                paddingBottom: 16,
                backgroundColor: COLORS.background,
              }}
            >
              {/* Pagination Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>
                  Página {currentPage} de {totalPages} • {totalCount} ordens
                </Text>
              </View>

              {/* Pagination Buttons */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* First Page Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: currentPage === 1 ? COLORS.lightgray : COLORS.blue,
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
                    color={currentPage === 1 ? COLORS.gray : COLORS.white}
                  />
                </TouchableOpacity>

                {/* Previous Page Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: currentPage === 1 ? COLORS.lightgray : COLORS.blue,
                    borderRadius: 6,
                    padding: 8,
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                  onPress={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <Feather
                    name='chevron-left'
                    size={16}
                    color={currentPage === 1 ? COLORS.gray : COLORS.white}
                  />
                </TouchableOpacity>

                {/* Next Page Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: currentPage === totalPages ? COLORS.lightgray : COLORS.blue,
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
                    color={currentPage === totalPages ? COLORS.gray : COLORS.white}
                  />
                </TouchableOpacity>

                {/* Last Page Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: currentPage === totalPages ? COLORS.lightgray : COLORS.blue,
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
                    color={currentPage === totalPages ? COLORS.gray : COLORS.white}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const SkeletonError = ({ error }: { error: Error }) => {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ color: COLORS.black }}>Erro ao carregar ordens de serviço</Text>
      <Text style={{ color: COLORS.red }}>{error.message}</Text>
    </View>
  );
};

const SkeletonLoadingCard = () => {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        height: 150,
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 12,
          height: 24,
          width: '100%',
        }}
      >
        <Skeleton height={24} width={200} />
        <Skeleton height={24} width={32} />
      </View>
      <Skeleton height={24} width={100} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton height={24} width={'30%'} />
        <Skeleton height={24} width={'30%'} />
        <Skeleton height={24} width={'30%'} />
      </View>
    </View>
  );
};

const StatusBadge = ({ status }: { status: ServiceOrder['status'] }) => {
  const getStatusConfig = (status: ServiceOrder['status']) => {
    switch (status) {
      case 'open':
        return {
          label: 'Aberta',
          backgroundColor: COLORS.lightgreen,
          textColor: COLORS.green,
        };
      case 'completed':
        return {
          label: 'Concluída',
          backgroundColor: COLORS.lightblue,
          textColor: COLORS.blue,
        };
      case 'cancelled':
        return {
          label: 'Cancelada',
          backgroundColor: COLORS.lightgray,
          textColor: COLORS.gray,
        };
      default:
        return {
          label: 'Desconhecido',
          backgroundColor: COLORS.lightgray,
          textColor: COLORS.gray,
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <View
      style={{
        backgroundColor: config.backgroundColor,
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: config.textColor,
        }}
      >
        {config.label}
      </Text>
    </View>
  );
};
