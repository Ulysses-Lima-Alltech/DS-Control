import { createHash } from 'node:crypto';

type OfflineDatasetPayload = {
  user: unknown;
  tenant: unknown;
  permissions: unknown[];
  farms: unknown[];
  plots: unknown[];
  serviceOrders: unknown[];
  applications: unknown[];
  routes: unknown[];
  assistants: unknown[];
  drones: unknown[];
  cultureTypes: unknown[];
  products: unknown[];
  mapPackages: unknown[];
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalOfflineDatasetJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function buildOfflineDatasetManifest(
  payload: OfflineDatasetPayload,
  selectedServiceOrderIds: string[],
  generatedAt: string,
) {
  const checksum = createHash('sha256').update(canonicalOfflineDatasetJson(payload)).digest('hex');

  return {
    schemaVersion: 2,
    datasetVersion: checksum,
    checksum,
    selectedServiceOrderIds: [...selectedServiceOrderIds].sort(),
    generatedAt,
    counts: {
      farms: payload.farms.length,
      plots: payload.plots.length,
      serviceOrders: payload.serviceOrders.length,
      applications: payload.applications.length,
      routes: payload.routes.length,
      mapPackages: payload.mapPackages.length,
    },
  };
}
