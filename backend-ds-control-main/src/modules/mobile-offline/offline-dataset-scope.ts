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
