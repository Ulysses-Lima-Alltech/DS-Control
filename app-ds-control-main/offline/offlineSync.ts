import NetInfo from '@react-native-community/netinfo';

import {
  clearOfflineAuthSession,
  getOfflineAuthSession,
  saveOfflineAuthSession,
} from '@/offline/offlineAuth';
import { assertOfflineDatasetChecksum } from '@/offline/offlineManifest';
import { deleteOfflineMapPackages, downloadOfflineMapPackages } from '@/offline/offlineMaps';
import { refreshOfflineStatus } from '@/offline/offlineStatus';
import {
  activateOfflineDataset,
  clearOfflineStorage,
  countPendingOfflineOperations,
  estimateOfflinePayloadBytes,
  failOfflineDataset,
  getMapPackStatuses,
  setActiveOfflineOwner,
  stageOfflineBootstrapData,
} from '@/offline/offlineStorage';
import type {
  OfflineBootstrap,
  OfflineStatusSnapshot,
  OfflineSyncProgress,
} from '@/offline/offlineTypes';
import { api } from '@/services/api.service';
import { removeSecureAccessToken } from '@/services/auth-token-storage.service';
import { clearOfflineDataCache as clearLegacyOfflineDataCache } from '@/utils/offline-storage';

const isOnline = async () => {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
};

const emit = (
  onProgress: ((progress: OfflineSyncProgress) => void) | undefined,
  progress: OfflineSyncProgress
) => {
  onProgress?.(progress);
};

export async function fetchOfflineBootstrap(
  selectedServiceOrderIds: string[]
): Promise<OfflineBootstrap> {
  const response = await api('/mobile/offline/dataset', {
    method: 'POST',
    body: JSON.stringify({ serviceOrderIds: selectedServiceOrderIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || 'Nao foi possivel baixar os dados offline.');
  }

  return await response.json();
}

let downloadInFlight = false;

export function isOfflineDownloadInProgress(): boolean {
  return downloadInFlight;
}

export async function downloadOfflineDataAndMaps(options?: {
  onProgress?: (progress: OfflineSyncProgress) => void;
  selectedServiceOrderIds?: string[];
}): Promise<OfflineStatusSnapshot> {
  if (downloadInFlight) {
    throw new Error('Ja existe um download de dados offline em andamento.');
  }
  if (!(await isOnline())) {
    throw new Error('Conecte-se a internet para baixar os dados offline.');
  }
  const selectedServiceOrderIds = [...new Set(options?.selectedServiceOrderIds ?? [])];
  if (selectedServiceOrderIds.length === 0) {
    throw new Error('Selecione ao menos uma Ordem de Servico para uso offline.');
  }

  downloadInFlight = true;
  try {
    return await runOfflineDownload(options, selectedServiceOrderIds);
  } finally {
    downloadInFlight = false;
  }
}

async function runOfflineDownload(
  options: { onProgress?: (progress: OfflineSyncProgress) => void } | undefined,
  selectedServiceOrderIds: string[]
): Promise<OfflineStatusSnapshot> {
  emit(options?.onProgress, {
    stage: 'preparing',
    message: 'Preparando dados...',
  });

  await refreshOfflineStatus({ status: 'downloading-data' });

  emit(options?.onProgress, {
    stage: 'downloading-data',
    message: 'Baixando fazendas, talhoes, ordens de servico e aplicacoes...',
  });

  const bootstrap = await fetchOfflineBootstrap(selectedServiceOrderIds);
  await setActiveOfflineOwner({
    userId: bootstrap.user.id,
    customerId: bootstrap.user.customerId,
    role: bootstrap.user.type,
  });
  await assertOfflineDatasetChecksum(bootstrap);
  const approximateDataBytes = estimateOfflinePayloadBytes(bootstrap);
  const previousMapStatuses = await getMapPackStatuses();
  let datasetId: string | null = null;
  const previousSession = await getOfflineAuthSession();
  const pendingSession =
    previousSession?.user.id === bootstrap.user.id
      ? previousSession
      : await saveOfflineAuthSession({
          user: bootstrap.user,
          tenant: bootstrap.tenant,
          permissions: bootstrap.permissions,
          lastOnlineAuthAt: bootstrap.serverTime,
          offlineReady: false,
        });

  emit(options?.onProgress, {
    stage: 'saving-data',
    message: 'Salvando dados no dispositivo...',
  });

  const initialStatus: OfflineStatusSnapshot = {
    status: 'downloading-maps',
    isReady: false,
    lastSyncAt: bootstrap.serverTime,
    offlineExpiresAt: pendingSession.offlineExpiresAt,
    approximateSizeBytes: approximateDataBytes,
    farmsCount: bootstrap.farms.length,
    plotsCount: bootstrap.plots.length,
    serviceOrdersCount: bootstrap.serviceOrders.length,
    applicationsCount: bootstrap.applications.length,
    mapPackagesCount: bootstrap.mapPackages.length,
    availableMapPackagesCount: 0,
    warnings: [],
    errors: [],
    updatedAt: new Date().toISOString(),
    datasetVersion: bootstrap.manifest.datasetVersion,
    datasetChecksum: bootstrap.manifest.checksum,
    selectedServiceOrderIds: bootstrap.manifest.selectedServiceOrderIds,
  };

  await refreshOfflineStatus(initialStatus);
  datasetId = await stageOfflineBootstrapData(bootstrap);

  emit(options?.onProgress, {
    stage: 'downloading-maps',
    message: 'Baixando mapas offline...',
    completedMapPackages: 0,
    totalMapPackages: bootstrap.mapPackages.length,
  });

  let mapResult;
  try {
    mapResult = await downloadOfflineMapPackages(
      bootstrap.mapPackages,
      bootstrap.manifest.datasetVersion,
      (mapStatus, completed, total) => {
        emit(options?.onProgress, {
          stage: 'downloading-maps',
          message: `Baixando mapa: ${mapStatus.name}`,
          currentMapPackage: mapStatus.name,
          mapPackageProgress: mapStatus.progress,
          completedMapPackages: completed,
          totalMapPackages: total,
        });
      }
    );
    if (mapResult.warnings.length > 0) {
      throw new Error(`Mapas offline incompletos: ${mapResult.warnings.join(' | ')}`);
    }
    await activateOfflineDataset(datasetId, mapResult.statuses);
  } catch (error) {
    await failOfflineDataset(
      datasetId,
      error instanceof Error ? error.message : 'Falha ao preparar mapas offline.'
    );
    throw error;
  }

  await saveOfflineAuthSession({
    user: bootstrap.user,
    tenant: bootstrap.tenant,
    permissions: bootstrap.permissions,
    lastOnlineAuthAt: bootstrap.serverTime,
    offlineReady: true,
  });

  emit(options?.onProgress, {
    stage: 'finalizing',
    message: 'Finalizando...',
    warnings: mapResult.warnings,
  });

  let finalStatus = await refreshOfflineStatus({
    status: 'available',
    warnings: [],
    approximateSizeBytes: approximateDataBytes + mapResult.totalResourceSize,
  });

  const currentPackNames = new Set(mapResult.statuses.map((status) => status.packName));
  const obsoletePackNames = previousMapStatuses
    .map((status) => status.packName)
    .filter((packName) => !currentPackNames.has(packName));
  const cleanupWarnings = await deleteOfflineMapPackages(obsoletePackNames);
  if (cleanupWarnings.length > 0) {
    finalStatus = await refreshOfflineStatus({
      status: 'available',
      warnings: cleanupWarnings,
      approximateSizeBytes: approximateDataBytes + mapResult.totalResourceSize,
    });
  }

  emit(options?.onProgress, {
    stage: 'completed',
    message:
      cleanupWarnings.length > 0 ? 'Download concluido com avisos.' : 'Modo offline disponivel.',
    warnings: cleanupWarnings,
  });

  return finalStatus;
}

export async function removeOfflineModeData(): Promise<string[]> {
  if ((await countPendingOfflineOperations()) > 0) {
    throw new Error(
      'Sincronize ou mantenha as operacoes pendentes antes de remover o modo offline.'
    );
  }
  const mapStatuses = await getMapPackStatuses();
  const mapErrors = await deleteOfflineMapPackages(mapStatuses.map((status) => status.packName));

  await clearOfflineStorage();
  await clearLegacyOfflineDataCache();
  await clearOfflineAuthSession({ removeSecureToken: true });
  await removeSecureAccessToken();

  return mapErrors;
}
