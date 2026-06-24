import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FlashList } from '@shopify/flash-list';
import { InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useGetAllMyOpenServiceOrders } from '@/queries/service-order.query';
import { Farm } from '@/types/farm.type';
import { ServiceOrder, ServiceOrderBy, ServiceOrderType } from '@/types/service-order.type';
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
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [farmId, setFarmId] = useState<string | undefined>(undefined);
  const [farmSearchTerm, setFarmSearchTerm] = useState('');
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
  } = useGetAllFarmsInfinite(undefined, {
    limit: '10',
    search: farmSearchTerm || undefined,
  });

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, farmId, startDate, endDate, orderBy, orderType, pageSize]);

  const activeFilters = useMemo(() => {
    return [
      !!search && 'Busca',
      !!farmId && 'Fazenda',
      !!startDate && 'Data inicial',
      !!endDate && 'Data final',
      orderBy !== ServiceOrderBy.PLANNED_DATE && 'Ordenação',
      orderType !== ServiceOrderType.DESC && 'Ordem',
      pageSize !== '5' && 'Limite',
    ].filter(Boolean) as string[];
  }, [search, farmId, startDate, endDate, orderBy, orderType, pageSize]);

  const handleClearFilters = () => {
    setSearch('');
    setFarmId(undefined);
    setFarmSearchTerm('');
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
  } = useGetAllMyOpenServiceOrders({
    search: search || undefined,
    status: 'open',
    pilotId: user?.id,
    farmId,
    startDate,
    endDate,
    orderBy,
    orderType,
    includeFarms: 'true',
    includeCustomers: 'true',
    includePlots: 'false',
    includePilots: 'false',
    includeContracts: 'false',
    includeGeoJson: 'false',
    page: currentPage.toString(),
    limit: pageSize,
  });

  const serviceOrdersList: ServiceOrder[] = data?.data ?? [];

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
        data={serviceOrdersList}
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
                    borderRadius: 14,
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
                  borderRadius: 18,
                  padding: 12,
                  borderColor: COLORS.border,
                  borderWidth: 1,
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.black }}>
                  Filtros
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.gray }}>
                  Escopo de piloto: somente ordens abertas.
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
                      borderRadius: 16,
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
                      Data inicial
                    </Text>
                    {isAndroid ? (
                      <>
                        <TouchableOpacity
                          onPress={() => setShowStartPicker(true)}
                          style={{
                            backgroundColor: COLORS.white,
                            padding: 12,
                            borderRadius: 14,
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
                            borderRadius: 14,
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

                <View>
                  <Text style={{ fontSize: 12, color: COLORS.gray, marginBottom: 6 }}>Fazenda</Text>
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

                <TouchableOpacity
                  onPress={() => setShowAdvancedFilters((prev) => !prev)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderColor: COLORS.lightgray,
                    borderWidth: 1,
                    borderRadius: 14,
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
                      borderRadius: 14,
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
          const { id, number, customer, plannedDate, farms } = item;
          return (
            <TouchableOpacity
              key={id}
              style={{
                backgroundColor: COLORS.white,
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                shadowColor: COLORS.black,
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.08,
                shadowRadius: 16,
                elevation: 4,
              }}
              onPress={() => {
                router.push(`/pilot/service-orders/${id}`);
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
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: COLORS.white,
                    borderRadius: 14,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                  onPress={() => {
                    router.push(`/pilot/service-orders/${id}`);
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
                  color={COLORS.primaryDark}
                  style={{
                    backgroundColor: COLORS.lightblue,
                    borderRadius: 14,
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
                    borderRadius: 14,
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
                    borderRadius: 14,
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
                              borderRadius: 14,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Entypo name='location-pin' size={16} color={COLORS.gray} />
                            <Text style={{ fontSize: 12, color: COLORS.textMuted }}>{farm.name}</Text>
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
                  borderColor: COLORS.border,
                  borderWidth: 1,
                  marginTop: 12,
                  borderRadius: 14,
                  padding: 2,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                }}
                onPress={() => {
                  router.push(`/pilot/service-orders/${id}`);
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
            description='Contate o administrador para solicitar uma ordem de serviço.'
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
        borderRadius: 18,
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
