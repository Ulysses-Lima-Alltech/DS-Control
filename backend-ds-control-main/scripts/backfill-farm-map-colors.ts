import { FARM_MAP_COLOR_PATTERN, deriveAutomaticFarmMapColor } from '../src/common/utils/farm-map-color';
import { asc, eq, isNull } from 'drizzle-orm';

const BATCH_SIZE = 100;

export async function backfillFarmMapColors(): Promise<void> {
  const [{ db, client }, { farms }] = await Promise.all([
    import('../src/infra/database'),
    import('../src/infra/database/schema'),
  ]);
  let updated = 0;

  try {
    while (true) {
      const pending = await db
        .select({ id: farms.id })
        .from(farms)
        .where(isNull(farms.mapColor))
        .orderBy(asc(farms.id))
        .limit(BATCH_SIZE);

      if (pending.length === 0) break;

      for (const farm of pending) {
        await db
          .update(farms)
          .set({ mapColor: deriveAutomaticFarmMapColor(farm.id) })
          .where(eq(farms.id, farm.id));
        updated += 1;
      }
    }

    const all = await db.select({ mapColor: farms.mapColor }).from(farms);
    const invalid = all.filter(
      (farm) => farm.mapColor === null || !FARM_MAP_COLOR_PATTERN.test(farm.mapColor),
    );
    if (invalid.length > 0) {
      throw new Error(`Farm map-color backfill validation failed for ${invalid.length} row(s)`);
    }

    process.stdout.write(
      `Farm map-color backfill complete: total=${all.length}, updated=${updated}, ignored=${all.length - updated}, invalid=0\n`,
    );
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  void backfillFarmMapColors().catch(() => {
    process.stderr.write('Farm map-color backfill failed; inspect the controlled runtime logs.\n');
    process.exitCode = 1;
  });
}
