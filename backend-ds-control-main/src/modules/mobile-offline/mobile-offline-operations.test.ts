import { describe, expect, it } from 'vitest';
import { SyncOfflineOperationSchema } from './dto/sync-offline-operations.dto';
import { hashOfflineOperation } from './offline-operation-idempotency';

const operation = SyncOfflineOperationSchema.parse({
  idempotencyKey: 'offline_1785943000000_abc',
  operationType: 'CREATE_APPLICATION',
  payload: {
    serviceOrderId: '00000000-0000-4000-8000-000000000001',
    farmId: '00000000-0000-4000-8000-000000000002',
    pilotId: '00000000-0000-4000-8000-000000000003',
    assistantId: null,
    droneId: '00000000-0000-4000-8000-000000000004',
    cultureId: '00000000-0000-4000-8000-000000000005',
    hectares: '12.5',
    flowRate: '10',
    altitude: '4',
    routeSpacing: '6',
    dropletSize: '150',
    date: '2026-08-05',
    productId: '00000000-0000-4000-8000-000000000006',
    plotId: '00000000-0000-4000-8000-000000000007',
    observations: null,
    plotCompleted: false,
  },
});

describe('offline operation idempotency contract', () => {
  it('accepts UUID and legacy local identifiers without accepting unsafe characters', () => {
    expect(operation.idempotencyKey).toBe('offline_1785943000000_abc');
    expect(() =>
      SyncOfflineOperationSchema.parse({ ...operation, idempotencyKey: 'key with spaces' }),
    ).toThrow();
  });

  it('keeps the request hash stable for retries and changes it with the payload', () => {
    const first = hashOfflineOperation(operation);
    const retry = hashOfflineOperation({ ...operation });
    const changed = hashOfflineOperation({
      ...operation,
      payload: { ...operation.payload, hectares: '13' },
    });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(retry).toBe(first);
    expect(changed).not.toBe(first);
  });
});
