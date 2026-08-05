import { FARM_MAP_COLOR_PATTERN, deriveAutomaticFarmMapColor } from '../src/common/utils/farm-map-color';
import { db, client } from '../src/infra/database';
import { farms } from '../src/infra/database/schema';
import { asc, eq, isNull } from 'drizzle-orm';

async function backfillFarmMapColors(): Promise<void> {
  const pending = await db
    .select({ id: farms.id })
    .from(farms)
    .where(isNull(farms.mapColor))
    .orderBy(asc(farms.id));

  for (const farm of pending) {
    await db
      .update(farms)
      .set({ mapColor: deriveAutomaticFarmMapColor(farm.id) })
      .where(eq(farms.id, farm.id));
  }

  const all = await db.select({ id: farms.id, mapColor: farms.mapColor }).from(farms);
  const invalid = all.filter(
    (farm) => farm.mapColor === null || !FARM_MAP_COLOR_PATTERN.test(farm.mapColor),
  );
  if (invalid.length > 0) {
    throw new Error(`Farm map-color backfill validation failed for ${invalid.length} row(s)`);
  }

  process.stdout.write(`Farm map-color backfill complete: ${pending.length} updated, ${all.length} validated\n`);
}

backfillFarmMapColors()
  .finally(async () => client.end());
