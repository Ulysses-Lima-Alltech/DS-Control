import Mapbox from '@rnmapbox/maps';

import type { OfflineMapPackageDefinition, OfflineMapPackStatus } from '@/offline/offlineTypes';

type NativePackStatus = {
  name: string;
  state: number;
  percentage: number;
  completedResourceSize: number;
  completedTileCount: number;
  completedResourceCount: number;
  requiredResourceCount: number;
};

export type OfflineMapDownloadResult = {
  statuses: OfflineMapPackStatus[];
  warnings: string[];
  totalResourceSize: number;
};

const MAP_DOWNLOAD_TIMEOUT_MS = 45 * 60 * 1000;

export const getOfflinePackName = (farmId: string) => `farm-${farmId}`;

const isValidBounds = (mapPackage: OfflineMapPackageDefinition) => {
  const values = [...mapPackage.bounds.northEast, ...mapPackage.bounds.southWest];
  return values.every((value) => typeof value === 'number' && Number.isFinite(value));
};

async function deleteExistingPack(packName: string): Promise<void> {
  try {
    await Mapbox.offlineManager.deletePack(packName);
  } catch (error) {
    if (__DEV__) {
      console.warn('[OfflineMaps] Could not delete existing pack', packName, error);
    }
  }
}

async function waitForMapPackageDownload(
  mapPackage: OfflineMapPackageDefinition,
  onProgress?: (status: OfflineMapPackStatus) => void
): Promise<OfflineMapPackStatus> {
  const packName = getOfflinePackName(mapPackage.farmId);

  await deleteExistingPack(packName);

  return new Promise<OfflineMapPackStatus>((resolve, reject) => {
    let settled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeout) clearTimeout(timeout);
      Mapbox.offlineManager.unsubscribe(packName);
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const toPackStatus = (
      nativeStatus: Partial<NativePackStatus>,
      status: OfflineMapPackStatus['status']
    ): OfflineMapPackStatus => ({
      ...mapPackage,
      packName,
      status,
      progress: Math.max(0, Math.min(100, Number(nativeStatus.percentage ?? 0))),
      completedResourceSize: Number(nativeStatus.completedResourceSize ?? 0),
      completedTileCount: Number(nativeStatus.completedTileCount ?? 0),
      downloadedAt: status === 'available' ? new Date().toISOString() : undefined,
    });

    const maybeComplete = (nativeStatus: Partial<NativePackStatus>) => {
      const progress = Number(nativeStatus.percentage ?? 0);
      const requiredResourceCount = Number(nativeStatus.requiredResourceCount ?? 0);
      const completedResourceCount = Number(nativeStatus.completedResourceCount ?? 0);
      const completed =
        progress >= 100 ||
        (requiredResourceCount > 0 && completedResourceCount >= requiredResourceCount);

      const nextStatus = toPackStatus(nativeStatus, completed ? 'available' : 'downloading');
      onProgress?.(nextStatus);

      if (completed) {
        settle(() => resolve(nextStatus));
      }
    };

    timeout = setTimeout(() => {
      settle(() =>
        reject(new Error(`Tempo limite ao baixar o mapa offline de ${mapPackage.name}.`))
      );
    }, MAP_DOWNLOAD_TIMEOUT_MS);

    Mapbox.offlineManager
      .createPack(
        {
          name: packName,
          styleURL: mapPackage.styleURL,
          minZoom: mapPackage.minZoom,
          maxZoom: mapPackage.maxZoom,
          bounds: [mapPackage.bounds.northEast, mapPackage.bounds.southWest],
          metadata: {
            farmId: mapPackage.farmId,
            farmName: mapPackage.name,
            createdAt: new Date().toISOString(),
          },
        },
        (_pack, nativeStatus) => {
          maybeComplete(nativeStatus);
        },
        (_pack, error) => {
          settle(() => reject(new Error(error.message)));
        }
      )
      .then(async () => {
        const pack = await Mapbox.offlineManager.getPack(packName);
        pollInterval = setInterval(async () => {
          if (settled || !pack) return;

          try {
            const nativeStatus = await pack.status();
            maybeComplete(nativeStatus);
          } catch (error) {
            if (__DEV__) {
              console.warn('[OfflineMaps] Could not poll pack status', packName, error);
            }
          }
        }, 2000);
      })
      .catch((error) => {
        settle(() => reject(error));
      });
  });
}

export async function downloadOfflineMapPackages(
  mapPackages: OfflineMapPackageDefinition[],
  onProgress?: (status: OfflineMapPackStatus, completed: number, total: number) => void
): Promise<OfflineMapDownloadResult> {
  const statuses: OfflineMapPackStatus[] = [];
  const warnings: string[] = [];
  let totalResourceSize = 0;

  Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');
  Mapbox.offlineManager.setProgressEventThrottle(1000);

  for (const mapPackage of mapPackages) {
    const packName = getOfflinePackName(mapPackage.farmId);

    if (!isValidBounds(mapPackage)) {
      const skippedStatus: OfflineMapPackStatus = {
        ...mapPackage,
        packName,
        status: 'skipped',
        progress: 0,
        errorMessage: 'Bounds invalidos para esta fazenda.',
      };
      statuses.push(skippedStatus);
      warnings.push(`${mapPackage.name}: bounds invalidos.`);
      continue;
    }

    try {
      const completedStatus = await waitForMapPackageDownload(mapPackage, (status) => {
        onProgress?.(status, statuses.length, mapPackages.length);
      });
      totalResourceSize += completedStatus.completedResourceSize ?? 0;
      statuses.push(completedStatus);
      onProgress?.(completedStatus, statuses.length, mapPackages.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      const failedStatus: OfflineMapPackStatus = {
        ...mapPackage,
        packName,
        status: 'error',
        progress: 0,
        errorMessage,
      };
      statuses.push(failedStatus);
      warnings.push(`${mapPackage.name}: ${errorMessage}`);
      onProgress?.(failedStatus, statuses.length, mapPackages.length);
    }
  }

  return { statuses, warnings, totalResourceSize };
}

export async function deleteOfflineMapPackages(packNames: string[]): Promise<string[]> {
  const errors: string[] = [];

  for (const packName of packNames) {
    try {
      await Mapbox.offlineManager.deletePack(packName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido.';
      errors.push(`${packName}: ${message}`);
    }
  }

  return errors;
}
