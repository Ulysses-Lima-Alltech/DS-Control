import { FARM_MAP_COLOR_PATTERN, deriveAutomaticFarmMapColor } from '../src/common/utils/farm-map-color';
import { Client } from 'pg';

const BATCH_SIZE = 100;

export async function backfillFarmMapColors(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  let updated = 0;

  try {
    await client.connect();

    while (true) {
      const pending = await client.query<{ id: string }>(
        'SELECT id FROM farms WHERE map_color IS NULL ORDER BY id LIMIT $1',
        [BATCH_SIZE],
      );

      if (pending.rowCount === 0) break;

      await client.query('BEGIN');
      try {
        for (const farm of pending.rows) {
          const result = await client.query(
            'UPDATE farms SET map_color = $1 WHERE id = $2 AND map_color IS NULL',
            [deriveAutomaticFarmMapColor(farm.id), farm.id],
          );
          updated += result.rowCount ?? 0;
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    const validation = await client.query<{ map_color: string | null }>(
      'SELECT map_color FROM farms',
    );
    const invalid = validation.rows.filter(
      (farm) => farm.map_color === null || !FARM_MAP_COLOR_PATTERN.test(farm.map_color),
    );
    if (invalid.length > 0) {
      throw new Error(`Farm map-color backfill validation failed for ${invalid.length} row(s)`);
    }

    process.stdout.write(
      `Farm map-color backfill complete: total=${validation.rowCount}, updated=${updated}, ignored=${(validation.rowCount ?? 0) - updated}, invalid=0\n`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (require.main === module) {
  void backfillFarmMapColors().catch(() => {
    process.stderr.write('Farm map-color backfill failed; inspect the controlled runtime logs.\n');
    process.exitCode = 1;
  });
}
