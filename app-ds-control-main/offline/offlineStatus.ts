import { getOfflineAuthSession } from '@/offline/offlineAuth';
import {
  getMapPackStatuses,
  getOfflineApplications,
  getOfflineFarms,
  getOfflineServiceOrders,
  getOfflineStatus,
  setOfflineStatus,
} from '@/offline/offlineStorage';
import type { OfflineModeStatus, OfflineStatusSnapshot } from '@/offline/offlineTypes';

export async function buildOfflineStatusSnapshot(input?: {
  status?: OfflineModeStatus;
  warnings?: string[];
  errors?: string[];
  approximateSizeBytes?: number;
}): Promise<OfflineStatusSnapshot> {
  const [session, farms, serviceOrders, applications, mapStatuses] = await Promise.all([
    getOfflineAuthSession(),
    getOfflineFarms(),
    getOfflineServiceOrders(),
    getOfflineApplications(),
    getMapPackStatuses(),
  ]);

  const plotsCount = farms.reduce((total, farm) => total + (farm.plots?.length ?? 0), 0);
  const availableMapPackagesCount = mapStatuses.filter(
    (mapStatus) => mapStatus.status === 'available'
  ).length;
  const expired = session?.offlineExpiresAt
    ? new Date(session.offlineExpiresAt).getTime() <= Date.now()
    : false;
  const hasData = farms.length > 0 || serviceOrders.length > 0 || applications.length > 0;
  const status =
    input?.status ??
    (expired
      ? 'expired'
      : hasData && session?.offlineReady
        ? availableMapPackagesCount === mapStatuses.length
          ? 'available'
          : 'partial'
        : 'not-configured');

  return {
    status,
    isReady: status === 'available' || status === 'partial',
    lastSyncAt: session?.lastOnlineAuthAt,
    offlineExpiresAt: session?.offlineExpiresAt,
    approximateSizeBytes: input?.approximateSizeBytes,
    farmsCount: farms.length,
    plotsCount,
    serviceOrdersCount: serviceOrders.length,
    applicationsCount: applications.length,
    mapPackagesCount: mapStatuses.length,
    availableMapPackagesCount,
    warnings: input?.warnings ?? [],
    errors: input?.errors ?? [],
    updatedAt: new Date().toISOString(),
  };
}

export async function refreshOfflineStatus(input?: {
  status?: OfflineModeStatus;
  warnings?: string[];
  errors?: string[];
  approximateSizeBytes?: number;
}) {
  const snapshot = await buildOfflineStatusSnapshot(input);
  await setOfflineStatus(snapshot);
  return snapshot;
}

export { getOfflineStatus };
