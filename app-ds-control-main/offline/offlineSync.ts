import NetInfo from '@react-native-community/netinfo';

import { clearOfflineAuthSession, saveOfflineAuthSession } from '@/offline/offlineAuth';
import { deleteOfflineMapPackages, downloadOfflineMapPackages } from '@/offline/offlineMaps';
import { refreshOfflineStatus } from '@/offline/offlineStatus';
import {
  clearOfflineStorage,
  estimateOfflinePayloadBytes,
  getMapPackStatuses,
  saveMapPackStatuses,
  saveOfflineBootstrapData,
} from '@/offline/offlineStorage';
import type {
  OfflineBootstrap,
  OfflineStatusSnapshot,
  OfflineSyncProgress,
} from '@/offline/offlineTypes';
import { api } from '@/services/api.service';
import { removeSecureAccessToken } from '@/services/auth-token-storage.service';
import {
  clearOfflineDataCache as clearLegacyOfflineDataCache,
  saveOfflineDataCache as saveLegacyOfflineDataCache,
} from '@/utils/offline-storage';

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

export async function fetchOfflineBootstrap(): Promise<OfflineBootstrap> {
  const response = await api('/mobile/offline/bootstrap', {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || 'Nao foi possivel baixar os dados offline.');
  }

  return await response.json();
}

export async function downloadOfflineDataAndMaps(options?: {
  onProgress?: (progress: OfflineSyncProgress) => void;
}): Promise<OfflineStatusSnapshot> {
  if (!(await isOnline())) {
    throw new Error('Conecte-se a internet para baixar os dados offline.');
  }

  emit(options?.onProgress, {
    stage: 'preparing',
    message: 'Preparando dados...',
  });

  await refreshOfflineStatus({ status: 'downloading-data' });

  emit(options?.onProgress, {
    stage: 'downloading-data',
    message: 'Baixando fazendas, talhoes, ordens de servico e aplicacoes...',
  });

  const bootstrap = await fetchOfflineBootstrap();
  const approximateDataBytes = estimateOfflinePayloadBytes(bootstrap);
  const session = await saveOfflineAuthSession({
    user: bootstrap.user,
    tenant: bootstrap.tenant,
    permissions: bootstrap.permissions,
    lastOnlineAuthAt: bootstrap.serverTime,
    offlineReady: true,
  });

  emit(options?.onProgress, {
    stage: 'saving-data',
    message: 'Salvando dados no dispositivo...',
  });

  const initialStatus: OfflineStatusSnapshot = {
    status: 'downloading-maps',
    isReady: false,
    lastSyncAt: session.lastOnlineAuthAt,
    offlineExpiresAt: session.offlineExpiresAt,
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
  };

  await saveOfflineBootstrapData(bootstrap, initialStatus);
  await saveLegacyOfflineDataCache({
    pilot:
      bootstrap.user.type === 'pilot'
        ? {
            id: bootstrap.user.id,
            name: bootstrap.user.name,
          }
        : null,
    assistants:
      bootstrap.assistants?.map((assistant) => ({
        id: String(assistant.id ?? ''),
        name: String(assistant.name ?? ''),
      })) ?? [],
    drones:
      bootstrap.drones?.map((drone) => ({
        id: String(drone.id ?? ''),
        name: String(drone.name ?? ''),
      })) ?? [],
    cultureTypes:
      bootstrap.cultureTypes?.map((cultureType) => ({
        id: String(cultureType.id ?? ''),
        name: String(cultureType.name ?? ''),
      })) ?? [],
    products:
      bootstrap.products?.map((product) => ({
        id: String(product.id ?? ''),
        name: String(product.name ?? ''),
      })) ?? [],
    lastUpdated: bootstrap.serverTime,
  });

  emit(options?.onProgress, {
    stage: 'downloading-maps',
    message: 'Baixando mapas offline...',
    completedMapPackages: 0,
    totalMapPackages: bootstrap.mapPackages.length,
  });

  const mapResult = await downloadOfflineMapPackages(
    bootstrap.mapPackages,
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

  await saveMapPackStatuses(mapResult.statuses);

  emit(options?.onProgress, {
    stage: 'finalizing',
    message: 'Finalizando...',
    warnings: mapResult.warnings,
  });

  const finalStatus = await refreshOfflineStatus({
    status: mapResult.warnings.length > 0 ? 'partial' : 'available',
    warnings: mapResult.warnings,
    approximateSizeBytes: approximateDataBytes + mapResult.totalResourceSize,
  });

  emit(options?.onProgress, {
    stage: 'completed',
    message:
      mapResult.warnings.length > 0 ? 'Download concluido com avisos.' : 'Modo offline disponivel.',
    warnings: mapResult.warnings,
  });

  return finalStatus;
}

export async function removeOfflineModeData(): Promise<string[]> {
  const mapStatuses = await getMapPackStatuses();
  const mapErrors = await deleteOfflineMapPackages(mapStatuses.map((status) => status.packName));

  await clearOfflineStorage();
  await clearLegacyOfflineDataCache();
  await clearOfflineAuthSession({ removeSecureToken: true });
  await removeSecureAccessToken();

  return mapErrors;
}
