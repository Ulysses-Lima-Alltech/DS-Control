import { describe, expect, it } from 'vitest';
import {
  toSafeOfflineUser,
  withoutOfflinePlotApplicationDetails,
  withoutOfflineServiceOrderJoinDetails,
} from './offline-dataset-scope';

describe('offline dataset user scope', () => {
  it('never serializes password or password-reset state', () => {
    const safe = toSafeOfflineUser({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Pilot Test',
      email: 'pilot@example.invalid',
      password: 'hash-must-not-leave-server',
      type: 'pilot',
      customerId: null,
      createdAt: new Date('2026-08-05T00:00:00.000Z'),
      updatedAt: null,
      deletedAt: null,
      mustChangePassword: true,
    });

    expect(safe).not.toHaveProperty('password');
    expect(safe).not.toHaveProperty('mustChangePassword');
    expect(safe.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('removes cross-pilot application details embedded in plot coverage', () => {
    const safe = withoutOfflinePlotApplicationDetails({
      id: 'plot-1',
      status: 'COMPLETED',
      applications: [{ id: 'other-pilot-application', appliedAreaHectares: '10' }],
    });

    expect(safe).toEqual({ id: 'plot-1', status: 'COMPLETED' });
    expect(safe).not.toHaveProperty('applications');
  });

  it('removes raw service-order joins that contain unsanitized users', () => {
    const safe = withoutOfflineServiceOrderJoinDetails({
      id: 'order-1',
      serviceOrderPilots: [{ pilot: { password: 'hash-must-not-leave-server' } }],
      serviceOrderFarms: [{ farm: { id: 'farm-1' } }],
      serviceOrderPlots: [{ plot: { id: 'plot-1' } }],
    });

    expect(safe).toEqual({ id: 'order-1' });
  });
});
