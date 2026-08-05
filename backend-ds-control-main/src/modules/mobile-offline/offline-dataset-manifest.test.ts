import { describe, expect, it } from 'vitest';
import { DownloadOfflineDatasetSchema } from './dto/download-offline-dataset.dto';
import {
  buildOfflineDatasetManifest,
  canonicalOfflineDatasetJson,
} from './offline-dataset-manifest';

const emptyPayload = {
  user: { type: 'pilot', id: 'pilot-1' },
  tenant: null,
  permissions: [],
  farms: [],
  plots: [],
  serviceOrders: [],
  applications: [],
  routes: [],
  assistants: [],
  drones: [],
  cultureTypes: [],
  products: [],
  mapPackages: [],
};

describe('selective offline dataset contract', () => {
  it('requires an explicit, unique and bounded service-order selection', () => {
    expect(() => DownloadOfflineDatasetSchema.parse({ serviceOrderIds: [] })).toThrow();
    expect(() =>
      DownloadOfflineDatasetSchema.parse({
        serviceOrderIds: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000001',
        ],
      }),
    ).toThrow();
  });

  it('canonicalizes object keys while preserving array order', () => {
    expect(canonicalOfflineDatasetJson({ z: 1, a: { c: 3, b: 2 }, skip: undefined })).toBe(
      '{"a":{"b":2,"c":3},"z":1}',
    );
    expect(canonicalOfflineDatasetJson([2, 1])).toBe('[2,1]');
    expect(canonicalOfflineDatasetJson({ at: new Date('2026-08-05T12:00:00.000Z') })).toBe(
      '{"at":"2026-08-05T12:00:00.000Z"}',
    );
  });

  it('uses the checksum as immutable dataset version and sorts selected IDs', () => {
    const manifest = buildOfflineDatasetManifest(
      emptyPayload,
      ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001'],
      '2026-08-05T00:00:00.000Z',
    );
    expect(manifest.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.datasetVersion).toBe(manifest.checksum);
    expect(manifest.selectedServiceOrderIds).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ]);
  });
});
