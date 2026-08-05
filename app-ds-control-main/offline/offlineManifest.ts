import * as Crypto from 'expo-crypto';

import type { OfflineBootstrap } from '@/offline/offlineTypes';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function canonicalOfflineJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function getOfflineDatasetChecksumPayload(bootstrap: OfflineBootstrap) {
  return {
    user: bootstrap.user,
    tenant: bootstrap.tenant,
    permissions: bootstrap.permissions,
    farms: bootstrap.farms,
    plots: bootstrap.plots,
    serviceOrders: bootstrap.serviceOrders,
    applications: bootstrap.applications,
    routes: bootstrap.routes,
    assistants: bootstrap.assistants ?? [],
    drones: bootstrap.drones ?? [],
    cultureTypes: bootstrap.cultureTypes ?? [],
    products: bootstrap.products ?? [],
    mapPackages: bootstrap.mapPackages,
  };
}

export async function calculateOfflineDatasetChecksum(
  bootstrap: OfflineBootstrap
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    canonicalOfflineJson(getOfflineDatasetChecksumPayload(bootstrap))
  );
}

export async function assertOfflineDatasetChecksum(bootstrap: OfflineBootstrap): Promise<void> {
  const actual = await calculateOfflineDatasetChecksum(bootstrap);
  if (actual !== bootstrap.manifest.checksum || actual !== bootstrap.manifest.datasetVersion) {
    throw new Error('Checksum do dataset offline nao confere com o manifesto.');
  }
}
