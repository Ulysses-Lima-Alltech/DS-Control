import { describe, expect, it } from 'vitest';
import { toSafeOfflineUser } from './offline-dataset-scope';

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
});
