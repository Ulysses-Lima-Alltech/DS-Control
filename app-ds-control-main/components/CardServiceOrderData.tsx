import {
  Entypo,
  Feather,
  FontAwesome6,
  Ionicons,
  Octicons,
  SimpleLineIcons,
} from '@expo/vector-icons';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import Skeleton from '@/components/ui/Skeleton';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { COLORS } from '../constants/colors';
import ModalMapFarmViewer from './Modal/ModalMapFarmViewer';
import { useState } from 'react';

export default function CardServiceOrderData({ serviceOrderId }: { serviceOrderId: string }) {
  const [isVisibleModalMapFarmViewer, setIsVisibleModalMapFarmViewer] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

  const {
    data: serviceOrder,
    isLoading,
    isError,
    error,
  } = useGetServiceOrderById({
    serviceOrderId: serviceOrderId,
    includeFarms: 'true',
    includeCustomers: 'true',
    includePlots: 'true',
    includePilots: 'false',
    includeContracts: 'false',
    includeGeoJson: 'false',
  });

  if (isError) {
    return <SkeletonError error={error} />;
  }

  if (isLoading || !serviceOrder) {
    return <SkeletonLoading />;
  }

  return (
    <View
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
            #{serviceOrder.number} - Ordem de serviço
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <Feather
          name='user'
          size={20}
          color={COLORS.blue}
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
            {serviceOrder?.customer?.name}
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
            {formatDateToDDMMYYYY(serviceOrder.plannedDate)}
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
        <FontAwesome6
          name='map'
          size={20}
          color={COLORS.orange}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: COLORS.lightorange,
            borderRadius: 8,
            padding: 4,
          }}
        />
        <View style={{ flexDirection: 'column', gap: 4, flex: 1 }}>
          <Text style={{ fontSize: 12, color: COLORS.gray }}>Fazendas e talhões</Text>
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
              {serviceOrder.farms.map((farm) => {
                return (
                  <View
                    key={farm.id}
                    style={{
                      backgroundColor: COLORS.lightblue,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      width: '100%',
                    }}
                  >
                    {/* Farm name */}
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 4,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'nowrap',
                        width: '100%',
                        marginBottom: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 4,
                          alignItems: 'center',
                          flexShrink: 1,
                        }}
                      >
                        <SimpleLineIcons name='location-pin' size={12} color={COLORS.orange} />
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 12,
                            color: COLORS.black,
                            fontWeight: '600',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flexWrap: 'nowrap',
                          }}
                        >
                          {farm.name}
                        </Text>
                      </View>

                      {/* View map button */}
                      <TouchableOpacity
                        style={{
                          alignSelf: 'flex-end',
                          flexDirection: 'row',
                          gap: 4,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: COLORS.lightblue,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 2,
                          borderWidth: 1,
                          borderColor: COLORS.blue,
                        }}
                        onPress={() => {
                          setSelectedFarmId(farm.id);
                          setIsVisibleModalMapFarmViewer(true);
                        }}
                      >
                        <Entypo name='map' size={10} color={COLORS.blue} />
                        <Text style={{ fontSize: 10, color: COLORS.blue }}>Ver mapa</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                      {serviceOrder.plots
                        ?.filter((plot) => plot.farmId === farm.id)
                        .map((plot) => {
                          return (
                            <View
                              key={plot.id}
                              style={{
                                flexDirection: 'row',
                                gap: 4,
                                alignItems: 'center',
                                backgroundColor: 'white',
                                borderRadius: 8,
                                padding: 4,
                                borderWidth: 1,
                                borderColor: 'lightgray',
                                flexWrap: 'wrap',
                                flexGrow: 1,
                              }}
                            >
                              <Octicons name='stack' size={12} color={COLORS.gray} />
                              <Text style={{ fontSize: 10, color: COLORS.gray }}>{plot.name}</Text>
                            </View>
                          );
                        })}
                    </View>
                  </View>
                );
              })}
            </View>
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
        <Ionicons
          name='chatbox-outline'
          size={20}
          color={COLORS.purple}
          style={{
            backgroundColor: COLORS.lightpurple,
            borderRadius: 8,
            padding: 4,
            alignSelf: 'flex-start',
          }}
        />
        <View style={{ flexDirection: 'column', gap: 4, flex: 1 }}>
          <Text style={{ fontSize: 12, color: COLORS.gray }}>Observações</Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: COLORS.black,
              marginTop: 2,
            }}
          >
            {serviceOrder.observation ? serviceOrder.observation : 'Nenhuma observação'}
          </Text>
        </View>
      </View>

      <ModalMapFarmViewer
        farmId={selectedFarmId ?? ''}
        visible={isVisibleModalMapFarmViewer}
        setVisible={setIsVisibleModalMapFarmViewer}
      />
    </View>
  );
}

const SkeletonError = ({ error }: { error: Error | null }) => {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text>Erro ao carregar ordem de serviço: </Text>
      <Text style={{ color: COLORS.red }}>
        {error?.message ?? 'Erro ao carregar ordem de serviço'}
      </Text>
    </View>
  );
};

const SkeletonLoading = () => {
  return (
    <View
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
    >
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
};
