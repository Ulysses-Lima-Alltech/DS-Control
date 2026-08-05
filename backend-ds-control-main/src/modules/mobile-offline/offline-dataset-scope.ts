import type { users } from '@infra/database/schema';

export function toSafeOfflineUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    type: user.type,
    customerId: user.customerId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}

export function withoutOfflinePlotApplicationDetails<T extends Record<string, unknown>>(
  plot: T,
): Omit<T, 'applications'> {
  const safe = { ...plot };
  delete safe.applications;
  return safe;
}
