import { Entypo, Feather, Octicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { COLORS } from '@/constants/colors';
import { useGetApplicationsByPlotId } from '@/queries/application.query';
import { useGetPlotById } from '@/queries/plot.query';
import { Application } from '@/types/applications.type';
import {
  buildReportMapboxStaticUrl,
  getReportMapPlaceholderMessage,
} from '@/utils/mapboxStaticReportMap';
import { formatOperationalDateBR, toOperationalDateYMD } from '@/utils/operational-date';

const MAPBOX_FALLBACK_TOKEN =
  'pk.eyJ1IjoiYW50b25pb3Zpbmk0NyIsImEiOiJjbWJoNW9wM2swNmlyMmlvbGlmb3J6NW4xIn0.wKznYpMm2m5Z0Opjjkpa-Q';

interface ModalPlotViewerProps {
  plotId: string | null;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

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

function formatAreaValue(value: number) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

function firstStringFromKeys(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[]
): string | null {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getApplicationOperationType(application: Application): string | null {
  const fromApplication = firstStringFromKeys(application as unknown as Record<string, unknown>, [
    'operation',
    'operationType',
    'applicationType',
    'method',
    'type',
  ]);

  if (fromApplication) {
    return fromApplication;
  }

  return firstStringFromKeys(application.serviceOrder as unknown as Record<string, unknown>, [
    'operation',
    'operationType',
    'method',
    'type',
  ]);
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

  useEffect(() => {
    if (!visible || !isPlotError) {
      return;
    }

    Toast.show({
      type: 'error',
      text1: 'Erro ao carregar talhao',
    });
    setVisible(false);
  }, [isPlotError, visible, setVisible]);

  useEffect(() => {
    if (!visible || !isApplicationsError) {
      return;
    }

    Toast.show({
      type: 'error',
      text1: 'Erro ao carregar aplicacoes do talhao',
    });
  }, [isApplicationsError, visible]);

  const applications: Application[] = applicationsData?.data ?? [];

  const sortedApplications = useMemo(() => {
    return [...applications].sort((first, second) => {
      const firstDate = toOperationalDateYMD(first.date) ?? '';
      const secondDate = toOperationalDateYMD(second.date) ?? '';

      if (firstDate === secondDate) {
        const firstCreated = toOperationalDateYMD(first.createdAt) ?? '';
        const secondCreated = toOperationalDateYMD(second.createdAt) ?? '';
        return secondCreated.localeCompare(firstCreated);
      }

      return secondDate.localeCompare(firstDate);
    });
  }, [applications]);

  const summary = useMemo(() => {
    const totalAppliedArea = sortedApplications.reduce((sum, application) => {
      return sum + parseNumericValue(application.hectares);
    }, 0);

    const latestApplication = sortedApplications[0] ?? null;

    return {
      totalApplications: sortedApplications.length,
      totalAppliedArea,
      latestApplicationDate: latestApplication
        ? formatOperationalDateBR(latestApplication.date)
        : 'N/A',
      latestCulture: latestApplication?.culture?.name || 'N/A',
    };
  }, [sortedApplications]);

  const farmName = useMemo(() => {
    return sortedApplications.find((application) => application.farm?.name)?.farm?.name || 'N/A';
  }, [sortedApplications]);

  const customerName = useMemo(() => {
    return (
      sortedApplications.find((application) => application.farm?.customer?.name)?.farm?.customer
        ?.name || 'N/A'
    );
  }, [sortedApplications]);

  const mapPreview = useMemo(() => {
    if (!plotData?.plot) {
      return {
        url: null as string | null,
        placeholder: 'Mapa indisponivel',
      };
    }

    const mapResult = buildReportMapboxStaticUrl({
      plot: plotData.plot,
      mapWidth: 1200,
      mapHeight: 600,
      accessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || MAPBOX_FALLBACK_TOKEN,
    });

    return {
      url: mapResult.url,
      placeholder: getReportMapPlaceholderMessage(mapResult.unavailableReason),
    };
  }, [plotData?.plot]);

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet'>
      <View style={styles.header}>
        <View style={styles.headerTitleWrapper}>
          <Octicons name='stack' size={16} color={COLORS.blue} />
          <Text numberOfLines={1} style={styles.headerTitle}>
            {isFetchingPlot
              ? 'Carregando talhao...'
              : `Historico do Talhao - ${plotData?.plot?.name || 'Talhao'}`}
          </Text>
        </View>

        <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
          <Entypo name='cross' size={20} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {isFetchingPlot ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={COLORS.blue} />
          </View>
        ) : (
          <>
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total de Aplicacoes</Text>
                <Text style={styles.summaryValue}>{summary.totalApplications}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Area Total Aplicada</Text>
                <Text style={styles.summaryValue}>{formatAreaValue(summary.totalAppliedArea)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Ultima Aplicacao</Text>
                <Text style={styles.summaryValue}>{summary.latestApplicationDate}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Cultura Mais Recente</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>
                  {summary.latestCulture}
                </Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Feather name='map-pin' size={16} color={COLORS.orange} />
                <Text style={styles.sectionTitle}>Visualizacao do Talhao</Text>
              </View>

              <View style={styles.mapCard}>
                {mapPreview.url ? (
                  <Image
                    source={{ uri: mapPreview.url }}
                    style={styles.mapImage}
                    resizeMode='cover'
                  />
                ) : (
                  <View style={styles.mapPlaceholder}>
                    <Text style={styles.mapPlaceholderText}>{mapPreview.placeholder}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Feather name='info' size={16} color={COLORS.blue} />
                <Text style={styles.sectionTitle}>Informacoes do Talhao</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fazenda</Text>
                <Text style={styles.infoValue}>{farmName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cliente</Text>
                <Text style={styles.infoValue}>{customerName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Area do Talhao</Text>
                <Text style={styles.infoValue}>{formatPlotArea(plotData?.plot?.hectare)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Data de Cadastro</Text>
                <Text style={styles.infoValue}>{formatOperationalDateBR(plotData?.plot?.createdAt)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cultura Mais Recente</Text>
                <Text style={styles.infoValue}>{summary.latestCulture}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Identificador</Text>
                <Text style={styles.infoValue}>{plotData?.plot?.id || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nome do Talhao</Text>
                <Text style={styles.infoValue}>{plotData?.plot?.name || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Feather name='clock' size={16} color={COLORS.green} />
                <Text style={styles.sectionTitle}>Historico de Aplicacoes</Text>
              </View>

              {isFetchingApplications ? (
                <View style={styles.loadingApplications}>
                  <ActivityIndicator size='small' color={COLORS.blue} />
                </View>
              ) : sortedApplications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    Nenhuma aplicacao encontrada para este talhao.
                  </Text>
                </View>
              ) : (
                sortedApplications.map((application) => {
                  const operationType = getApplicationOperationType(application);

                  return (
                    <View key={application.id} style={styles.applicationCard}>
                      <View style={styles.applicationHeader}>
                        <View style={styles.applicationTitleGroup}>
                          <Feather name='droplet' size={14} color={COLORS.green} />
                          <Text style={styles.applicationProduct}>
                            {application.product?.name || 'N/A'}
                          </Text>
                        </View>
                        <Text style={styles.applicationDate}>
                          {formatOperationalDateBR(application.date)}
                        </Text>
                      </View>

                      <View style={styles.applicationGrid}>
                        {operationType ? (
                          <View style={styles.applicationDataItem}>
                            <Text style={styles.applicationDataLabel}>Operacao/Tipo</Text>
                            <Text style={styles.applicationDataValue}>{operationType}</Text>
                          </View>
                        ) : null}

                        <View style={styles.applicationDataItem}>
                          <Text style={styles.applicationDataLabel}>Area aplicada</Text>
                          <Text style={styles.applicationDataValue}>
                            {formatAreaValue(parseNumericValue(application.hectares))}
                          </Text>
                        </View>

                        <View style={styles.applicationDataItem}>
                          <Text style={styles.applicationDataLabel}>Piloto</Text>
                          <Text style={styles.applicationDataValue}>
                            {application.pilot?.name || 'N/A'}
                          </Text>
                        </View>

                        <View style={styles.applicationDataItem}>
                          <Text style={styles.applicationDataLabel}>Drone</Text>
                          <Text style={styles.applicationDataValue}>
                            {application.drone?.name || 'N/A'}
                          </Text>
                        </View>

                        <View style={styles.applicationDataItem}>
                          <Text style={styles.applicationDataLabel}>Cultura</Text>
                          <Text style={styles.applicationDataValue}>
                            {application.culture?.name || 'N/A'}
                          </Text>
                        </View>

                        {application.serviceOrder?.number ? (
                          <View style={styles.applicationDataItem}>
                            <Text style={styles.applicationDataLabel}>OS</Text>
                            <Text style={styles.applicationDataValue}>
                              #{application.serviceOrder?.number}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {application.observations ? (
                        <View style={styles.observationsBox}>
                          <Text style={styles.observationsLabel}>Observacoes</Text>
                          <Text style={styles.observationsValue}>{application.observations}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

function formatPlotArea(hectare: string | undefined) {
  if (!hectare) return 'N/A';
  return formatAreaValue(parseNumericValue(hectare));
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flexShrink: 1,
  },
  closeButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  summaryContainer: {
    margin: 16,
    marginBottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.gray,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
  },
  sectionCard: {
    margin: 16,
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  mapCard: {
    height: 190,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.primarySoft,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  mapPlaceholderText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    color: COLORS.gray,
    fontSize: 12,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingApplications: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  emptyStateText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 13,
    fontWeight: '600',
  },
  applicationCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  applicationTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  applicationProduct: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    flexShrink: 1,
  },
  applicationDate: {
    fontSize: 12,
    color: COLORS.gray,
  },
  applicationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  applicationDataItem: {
    width: '48%',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 8,
  },
  applicationDataLabel: {
    fontSize: 10,
    color: COLORS.gray,
  },
  applicationDataValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.black,
  },
  observationsBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
    padding: 8,
    backgroundColor: COLORS.background,
  },
  observationsLabel: {
    fontSize: 10,
    color: COLORS.gray,
    marginBottom: 4,
  },
  observationsValue: {
    fontSize: 12,
    color: COLORS.black,
    fontWeight: '600',
  },
});
