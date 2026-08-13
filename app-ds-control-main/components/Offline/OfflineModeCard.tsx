import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { refreshOfflineStatus } from '@/offline/offlineStatus';
import { downloadOfflineDataAndMaps, removeOfflineModeData } from '@/offline/offlineSync';
import type { OfflineStatusSnapshot, OfflineSyncProgress } from '@/offline/offlineTypes';
import { useAuth } from '@/providers/auth.provider';
import { getAllMyOpenServiceOrders } from '@/services/service-order.service';
import type { ServiceOrder } from '@/types/service-order.type';

const formatDateTime = (value?: string) => {
  if (!value) return 'ainda nao realizada';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return 'Calculado apos o download';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getStatusLabel = (status?: OfflineStatusSnapshot | null) => {
  if (!status || status.status === 'not-configured') return 'Offline nao configurado';
  if (status.status === 'downloading-data') return 'Baixando dados';
  if (status.status === 'downloading-maps') return 'Baixando mapas';
  if (status.status === 'partial') return 'Modo offline disponivel com avisos';
  if (status.status === 'expired') return 'Sessao offline expirada';
  if (status.status === 'error') return 'Erro no modo offline';
  return 'Modo offline disponivel';
};

export default function OfflineModeCard() {
  const { isConnected } = useNetworkConnectivity();
  const { user } = useAuth();
  const [status, setStatus] = useState<OfflineStatusSnapshot | null>(null);
  const [progress, setProgress] = useState<OfflineSyncProgress | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatus(await refreshOfflineStatus());
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  useEffect(() => {
    if (user?.type !== 'pilot' || isConnected === false) return;
    let active = true;
    setIsLoadingOrders(true);
    getAllMyOpenServiceOrders({
      page: '1',
      limit: '1000',
      includePlots: 'true',
      includeFarms: 'true',
    })
      .then((response) => {
        if (!active) return;
        setAvailableOrders(response.data);
        setSelectedOrderIds((current) => {
          const availableIds = new Set(response.data.map((order) => order.id));
          if (current.size > 0) {
            return new Set([...current].filter((id) => availableIds.has(id)));
          }
          const prior = new Set(status?.selectedServiceOrderIds ?? []);
          return new Set(
            response.data.filter((order) => prior.has(order.id)).map((order) => order.id)
          );
        });
      })
      .catch(() => {
        if (active) setAvailableOrders([]);
      })
      .finally(() => {
        if (active) setIsLoadingOrders(false);
      });
    return () => {
      active = false;
    };
  }, [isConnected, status?.selectedServiceOrderIds, user?.type]);

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleDownload = async () => {
    if (isConnected === false) {
      Alert.alert('Sem internet', 'Conecte-se a internet para baixar ou atualizar o modo offline.');
      return;
    }

    setIsBusy(true);
    setProgress({ stage: 'preparing', message: 'Preparando dados...' });

    try {
      const nextStatus = await downloadOfflineDataAndMaps({
        onProgress: setProgress,
        selectedServiceOrderIds: [...selectedOrderIds],
      });
      setStatus(nextStatus);
      Alert.alert(
        nextStatus.status === 'partial' ? 'Download concluido com avisos' : 'Modo offline pronto',
        nextStatus.status === 'partial'
          ? 'Alguns mapas nao puderam ser baixados. Veja os avisos no status.'
          : 'Dados e mapas foram salvos no dispositivo.'
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nao foi possivel baixar dados offline.';
      await refreshOfflineStatus({ status: 'error', errors: [message] }).then(setStatus);
      Alert.alert('Erro no download offline', message);
    } finally {
      setIsBusy(false);
      setProgress(null);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remover dados offline',
      'Isso remove dados locais, indice offline e pacotes de mapa baixados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setIsBusy(true);
            try {
              const mapErrors = await removeOfflineModeData();
              await loadStatus();
              Alert.alert(
                mapErrors.length > 0 ? 'Dados removidos com avisos' : 'Dados offline removidos',
                mapErrors.length > 0
                  ? mapErrors.join('\n')
                  : 'O modo offline foi removido deste dispositivo.'
              );
            } catch (error) {
              Alert.alert(
                'Erro ao remover dados offline',
                error instanceof Error ? error.message : 'Tente novamente.'
              );
            } finally {
              setIsBusy(false);
            }
          },
        },
      ]
    );
  };

  const isReady = status?.isReady;
  const hasWarnings = (status?.warnings?.length ?? 0) > 0;
  const hasErrors = (status?.errors?.length ?? 0) > 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <Ionicons name='cloud-download-outline' size={20} color={COLORS.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Modo Offline</Text>
          <Text style={styles.subtitle}>
            Novas OS atribuídas a você são baixadas automaticamente quando o app está online.
          </Text>
        </View>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusTitle}>{getStatusLabel(status)}</Text>
        <Text style={styles.statusText}>
          Ultima sincronizacao: {formatDateTime(status?.lastSyncAt)}
        </Text>
        <Text style={styles.statusText}>
          Sessao offline valida ate: {formatDate(status?.offlineExpiresAt)}
        </Text>
        <Text style={styles.statusText}>
          Tamanho aproximado: {formatBytes(status?.approximateSizeBytes)}
        </Text>
      </View>

      <View style={styles.includeBox}>
        <Text style={styles.includeText}>
          Inclui acesso offline ao app, fazendas, talhoes, ordens de servico, aplicacoes, geometrias
          e mapas.
        </Text>
        {status?.farmsCount ? (
          <Text style={styles.countText}>
            {status.farmsCount} fazenda(s), {status.plotsCount} talhao(oes),{' '}
            {status.serviceOrdersCount} OS, {status.availableMapPackagesCount}/
            {status.mapPackagesCount} mapa(s).
          </Text>
        ) : null}
      </View>

      {user?.type === 'pilot' ? (
        <View style={styles.selectionBox}>
          <Text style={styles.selectionTitle}>Ordens de Servico para uso offline</Text>
          <Text style={styles.selectionHint}>
            Selecione somente as OS que serao usadas sem sinal.
          </Text>
          {isLoadingOrders ? (
            <ActivityIndicator size='small' color={COLORS.primaryDark} />
          ) : availableOrders.length === 0 ? (
            <Text style={styles.selectionHint}>Nenhuma OS aberta atribuida a este piloto.</Text>
          ) : (
            availableOrders.map((order) => {
              const selected = selectedOrderIds.has(order.id);
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderRow, selected && styles.orderRowSelected]}
                  onPress={() => toggleOrder(order.id)}
                  disabled={isBusy}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={selected ? COLORS.primary : COLORS.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderTitle}>OS {order.number}</Text>
                    <Text style={styles.orderDetail}>
                      {order.farms?.map((farm) => farm.name).join(', ') || 'Sem fazenda'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : (
        <Text style={styles.selectionHint}>
          O dataset operacional offline seletivo esta disponivel somente para pilotos.
        </Text>
      )}

      {progress && (
        <View style={styles.progressBox}>
          <ActivityIndicator size='small' color={COLORS.primaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.progressText}>{progress.message}</Text>
            {typeof progress.mapPackageProgress === 'number' && (
              <Text style={styles.progressSubText}>
                {Math.round(progress.mapPackageProgress)}% - {progress.completedMapPackages ?? 0}/
                {progress.totalMapPackages ?? 0}
              </Text>
            )}
          </View>
        </View>
      )}

      {hasWarnings && (
        <View style={styles.warningBox}>
          <Ionicons name='warning-outline' size={16} color={COLORS.orange} />
          <Text style={styles.warningText}>{status?.warnings.join('\n')}</Text>
        </View>
      )}

      {hasErrors && (
        <View style={styles.errorBox}>
          <Ionicons name='alert-circle-outline' size={16} color={COLORS.error} />
          <Text style={styles.errorText}>{status?.errors.join('\n')}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          (isBusy || user?.type !== 'pilot' || selectedOrderIds.size === 0) && styles.disabled,
        ]}
        onPress={handleDownload}
        disabled={isBusy || user?.type !== 'pilot' || selectedOrderIds.size === 0}
      >
        {isBusy ? (
          <ActivityIndicator size='small' color={COLORS.white} />
        ) : (
          <Ionicons name='download-outline' size={17} color={COLORS.white} />
        )}
        <Text style={styles.primaryButtonText}>
          {isReady ? 'Forçar atualização agora' : 'Baixar dados e mapas para uso offline'}
        </Text>
      </TouchableOpacity>

      {isReady && (
        <TouchableOpacity
          style={[styles.secondaryButton, isBusy && styles.disabled]}
          onPress={handleRemove}
          disabled={isBusy}
        >
          <Ionicons name='trash-outline' size={17} color={COLORS.error} />
          <Text style={styles.secondaryButtonText}>Remover dados offline</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusBox: {
    borderRadius: 14,
    backgroundColor: COLORS.background,
    padding: 12,
    gap: 4,
  },
  statusTitle: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  includeBox: {
    gap: 4,
  },
  includeText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  selectionBox: {
    gap: 7,
  },
  selectionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  selectionHint: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 10,
  },
  orderRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  orderTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  orderDetail: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  countText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    padding: 12,
  },
  progressText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  progressSubText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#FFF7E6',
    padding: 10,
  },
  warningText: {
    flex: 1,
    color: COLORS.orange,
    fontSize: 12,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    backgroundColor: COLORS.errorSoft,
    padding: 10,
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 12,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.errorSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.68,
  },
});
