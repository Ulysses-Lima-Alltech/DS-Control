import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import ServiceOrdersEmptyState from '@/components/ServiceOrdersEmptyState';
import { useGetAllMyOpenServiceOrders } from '@/queries/service-order.query';
import { ServiceOrder } from '@/types/service-order.type';
import Entypo from '@expo/vector-icons/Entypo';
import Skeleton from '@/components/ui/Skeleton';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import formatDateToDDMMYYYY from '../../../utils/date-formatter';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { COLORS } from '@/constants/colors';
import Separator from '@/components/ui/Separator';

export default function ServiceOrders() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data,
    isFetching: isFetchingServiceOrders,
    error,
    refetch,
  } = useGetAllMyOpenServiceOrders({
    includeFarms: 'true',
    includeCustomers: 'true',
    includePlots: 'false',
    includePilots: 'false',
    includeContracts: 'false',
    includeGeoJson: 'false',
    page: currentPage.toString(),
    limit: '5',
  });

  const serviceOrderOrderedByPlannedDate: ServiceOrder[] =
    data?.data.sort((a, b) => {
      return new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime();
    }) ?? [];

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
        data={serviceOrderOrderedByPlannedDate}
        ListHeaderComponent={() => {
          return (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
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
                <Text style={{ fontSize: 12, color: COLORS.blue }}>{data?.totalCount} ordens</Text>
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
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
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
                    borderRadius: 8,
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
