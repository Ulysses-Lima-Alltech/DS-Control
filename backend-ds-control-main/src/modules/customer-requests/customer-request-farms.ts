import { db } from '@infra/database';
import { farms } from '@infra/database/schema';
import { inArray } from 'drizzle-orm';

export async function findFarmsByIds(farmIds: string[]) {
  if (farmIds.length === 0) return [];
  return db.query.farms.findMany({
    where: inArray(farms.id, farmIds),
    columns: { id: true, name: true },
  });
}
