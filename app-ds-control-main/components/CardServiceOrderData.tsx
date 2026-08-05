import {
  Entypo,
  Feather,
  FontAwesome6,
  Ionicons,
  Octicons,
  SimpleLineIcons,
} from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useGetServiceOrderById } from '@/queries/service-order.query';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { resolveServiceOrderMetrics } from '@/utils/service-order-metrics';

import ModalMapFarmViewer from './Modal/ModalMapFarmViewer';

const formatHectares = (value?: number) =>
  `${Number(value || 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ha`;

const formatPercent = (value?: number) =>
  `${Number(value || 0).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`;

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

  const metrics = resolveServiceOrderMetrics(serviceOrder);
  const myAppliedHectares = Number(serviceOrder.myAppliedHectares || 0);
  const myApplicationsCount = Number(serviceOrder.myApplicationsCount || 0);

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: COLORS.black,
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
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
            {formatDateToDDMMYYYY(serviceOrder.plannedDate)}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: COLORS.background,
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: COLORS.lightgray,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name='bar-chart-2' size={18} color={COLORS.green} />
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.black }}>
            Resumo da OS
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <SummaryItem
            label='Área cadastrada da OS'
            value={formatHectares(metrics.plannedAreaHa)}
          />
          <SummaryItem
            label='Área bruta aplicada'
            value={formatHectares(metrics.grossAppliedAreaHa)}
          />
          <SummaryItem
            label='Área cadastrada concluída'
            value={formatHectares(metrics.registeredCompletedAreaHa)}
          />
          <SummaryItem
            label='Área aplicada em andamento'
            value={formatHectares(metrics.inProgressAppliedAreaHa)}
          />
          <SummaryItem
            label='Área operacional consolidada'
            value={formatHectares(metrics.consolidatedOperationalAreaHa)}
          />
          <SummaryItem
            label='Progresso cadastral concluído'
            value={formatPercent(metrics.registeredProgressPercent)}
          />
          <SummaryItem
            label='Progresso bruto aplicado'
            value={formatPercent(metrics.grossAppliedProgressPercent)}
          />
          <SummaryItem
            label='Meus hectares nesta OS'
            value={formatHectares(myAppliedHectares)}
          />
          <SummaryItem
            label='Minhas aplicações nesta OS'
            value={myApplicationsCount.toLocaleString('pt-BR')}
          />
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
            borderRadius: 14,
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
                      borderRadius: 18,
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
                          borderRadius: 14,
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
                                borderRadius: 14,
                                padding: 4,
                                borderWidth: 1,
                                borderColor: COLORS.border,
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
            borderRadius: 14,
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

const SummaryItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.lightgray,
        padding: 10,
        flexGrow: 1,
        flexBasis: '47%',
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 11, color: COLORS.gray }}>{label}</Text>
      <Text style={{ fontSize: 13, color: COLORS.black, fontWeight: 'bold' }}>{value}</Text>
    </View>
  );
};

const SkeletonError = ({ error }: { error: Error | null }) => {
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        shadowColor: COLORS.shadow,
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
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
    >
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
};
