import { Entypo, Octicons, Ionicons, Feather } from '@expo/vector-icons';
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useMemo } from 'react';
import { COLORS } from '@/constants/colors';
import { useGetPlotById } from '@/queries/plot.query';
import { useGetApplicationsByPlotId } from '@/queries/application.query';
import Toast from 'react-native-toast-message';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { Application } from '@/types/applications.type';

function parseNumericValue(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

interface ModalPlotViewerProps {
  plotId: string | null;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export default function ModalPlotViewer({ plotId, visible, setVisible }: ModalPlotViewerProps) {
  const effectivePlotId = visible ? plotId : null;

  const {
    data: plotData,
    isFetching: isFetchingPlot,
    isError: isPlotError,
  } = useGetPlotById(effectivePlotId ?? '', {
    enabled: !!effectivePlotId && visible,
  });

  const {
    data: applicationsData,
    isFetching: isFetchingApplications,
    isError: isApplicationsError,
  } = useGetApplicationsByPlotId(effectivePlotId ?? '');

  if (isPlotError) {
    Toast.show({
      type: 'error',
      text1: 'Erro ao carregar talhão',
    });
    setVisible(false);
  }

  const applications: Application[] = applicationsData?.data ?? [];

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [applications]);

  const totalAppliedArea = useMemo(() => {
    return sortedApplications.reduce((sum, application) => {
      return sum + parseNumericValue(application.hectares);
    }, 0);
  }, [sortedApplications]);

  const latestApplication = sortedApplications[0] ?? null;

  const formatAreaValue = (value: number) => {
    return `${value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ha`;
  };

  const renderApplication = (item: Application) => (
    <View
      key={item.id}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderColor: COLORS.lightblue,
        borderWidth: 1,
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
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name='settings' size={16} color={COLORS.green} />
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1C1C1E' }}>
            {item.product.name}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: '#8E8E93' }}>{formatDateToDDMMYYYY(item.date)}</Text>
      </View>

      {/* Dados da aplicação */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {/* Coluna 1 */}
        <View style={{ width: '50%', flexDirection: 'column', gap: 8 }}>
          {/* Piloto */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name='user' size={16} color={COLORS.blue} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Piloto</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.pilot?.name.split(' ')[0] ?? 'N/A'}
              </Text>
            </View>
          </View>

          {/* Drone */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name='settings' size={16} color={COLORS.purple} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Drone</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.drone.name}
              </Text>
            </View>
          </View>

          {/* Vazão */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Entypo name='water' size={16} color={COLORS.blue} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Vazão</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.flowRate} L/ha
              </Text>
            </View>
          </View>

          {/* Altitude */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name='airplane' size={16} color={COLORS.purple} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Altitude</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.altitude} m
              </Text>
            </View>
          </View>
        </View>

        {/* Coluna 2 */}
        <View style={{ width: '50%', flexDirection: 'column', gap: 8 }}>
          {/* Ajudante */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name='user' size={16} color={COLORS.green} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Ajudante</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.assistant?.name.split(' ')[0] ?? 'N/A'}
              </Text>
            </View>
          </View>

          {/* Cultivo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name='leaf-outline' size={16} color={COLORS.orange} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Cultivo</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.culture.name}
              </Text>
            </View>
          </View>

          {/* Hectares */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name='target' size={16} color={COLORS.red} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Hectares</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.hectares} ha
              </Text>
            </View>
          </View>

          {/* Tamanho de Gota */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name='droplet' size={16} color={COLORS.orange} />
            <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <Text style={{ fontSize: 12, color: COLORS.gray }}>Tamanho de Gota</Text>
              <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                {item.dropletSize} µm
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Observações */}
      {item.observations && (
        <View
          style={{
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: 12,
            backgroundColor: COLORS.lightblue,
            padding: 12,
            borderRadius: 8,
            borderColor: COLORS.lightgray,
            borderWidth: 1,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.gray }}>Observações</Text>
          <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
            {item.observations}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet'>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 12,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E5EA',
          justifyContent: 'space-between',
        }}
      >
        {/* Title */}
        <View
          style={{
            flexShrink: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'nowrap',
          }}
        >
          <Octicons name='stack' size={14} color={COLORS.blue} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#1C1C1E',
              flexWrap: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isFetchingPlot ? 'Carregando talhão...' : `HISTÓRICO - TALHÃO ${plotData?.plot?.name}`}
          </Text>
        </View>
        {/* Close button */}
        <TouchableOpacity
          style={{ alignSelf: 'flex-end', alignItems: 'flex-end' }}
          onPress={() => setVisible(false)}
        >
          <Entypo name='cross' size={18} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F5F5F5' }}
        showsVerticalScrollIndicator={false}
      >
        {isFetchingPlot ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <ActivityIndicator size='large' color={COLORS.blue} />
          </View>
        ) : (
          <>
            {/* Plot Details Section */}
            <View
              style={{
                backgroundColor: COLORS.white,
                margin: 16,
                padding: 16,
                borderRadius: 12,
                shadowColor: COLORS.black,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
              >
                <Octicons name='stack' size={16} color={COLORS.blue} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1C1C1E' }}>
                  Detalhes do Talhão
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='tag' size={14} color={COLORS.gray} />
                  <View>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Nome</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                      {plotData?.plot?.name}
                    </Text>
                  </View>
                </View>

                {plotData?.plot?.hectare && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name='target' size={14} color={COLORS.gray} />
                    <View>
                      <Text style={{ fontSize: 12, color: COLORS.gray }}>Hectares</Text>
                      <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                        {plotData?.plot?.hectare} ha
                      </Text>
                    </View>
                  </View>
                )}

                {plotData?.plot?.createdAt && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name='calendar' size={14} color={COLORS.gray} />
                    <View>
                      <Text style={{ fontSize: 12, color: COLORS.gray }}>Data de cadastro</Text>
                      <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: '600' }}>
                        {formatDateToDDMMYYYY(plotData.plot.createdAt)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Applications Section */}
            <View
              style={{
                backgroundColor: COLORS.white,
                marginHorizontal: 16,
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
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
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name='settings' size={16} color={COLORS.green} />
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1C1C1E' }}>
                    Histórico de Aplicações
                  </Text>
                </View>
                {!isFetchingApplications && (
                  <View
                    style={{
                      backgroundColor: COLORS.lightblue,
                      borderRadius: 8,
                      padding: 4,
                      paddingHorizontal: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: COLORS.blue }}>
                      {sortedApplications.length} aplicações
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={{
                  marginBottom: 12,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 96,
                    backgroundColor: '#F2F7FF',
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: '#D6E8FF',
                  }}
                >
                  <Text style={{ fontSize: 11, color: COLORS.gray }}>Total de ha aplicados</Text>
                  <Text style={{ fontSize: 13, color: COLORS.blue, fontWeight: '700' }}>
                    {formatAreaValue(totalAppliedArea)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 96,
                    backgroundColor: '#F4FBF6',
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: '#D8F0DE',
                  }}
                >
                  <Text style={{ fontSize: 11, color: COLORS.gray }}>Aplicações totais</Text>
                  <Text style={{ fontSize: 13, color: COLORS.green, fontWeight: '700' }}>
                    {sortedApplications.length}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 96,
                    backgroundColor: '#FFF8F1',
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: '#F6E4CC',
                  }}
                >
                  <Text style={{ fontSize: 11, color: COLORS.gray }}>Última aplicação</Text>
                  <Text style={{ fontSize: 13, color: COLORS.orange, fontWeight: '700' }}>
                    {latestApplication ? formatDateToDDMMYYYY(latestApplication.date) : 'N/A'}
                  </Text>
                </View>
              </View>

              {isFetchingApplications ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size='small' color={COLORS.blue} />
                </View>
              ) : isApplicationsError ? (
                <Text style={{ fontSize: 14, color: COLORS.red, textAlign: 'center' }}>
                  Erro ao carregar aplicações
                </Text>
              ) : sortedApplications.length === 0 ? (
                <Text
                  style={{ fontSize: 14, color: COLORS.gray, textAlign: 'center', padding: 20 }}
                >
                  Nenhuma aplicação encontrada para esse talhão
                </Text>
              ) : (
                sortedApplications.map(renderApplication)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}
