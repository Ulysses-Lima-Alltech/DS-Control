import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { date, pgTable, serial } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { CreateServiceOrderSchema } from '../dto/create-service-order';
import { UpdateServiceOrderSchema } from '../dto/update-service-order.dto';
import {
  isServiceOrderPlannedDate,
  nextServiceOrderPlannedDate,
  normalizeServiceOrderPlannedDate,
  toServiceOrderPlannedDate,
} from '../service-order-planned-date';

const formatYmdInTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

describe('service-order plannedDate civil contract', () => {
  it('reproduces the legacy defect when YYYY-MM-DD is treated as an instant', () => {
    const selectedCivilDate = '2026-09-09';
    const legacyInstant = new Date(selectedCivilDate);

    expect(legacyInstant.toISOString()).toBe('2026-09-09T00:00:00.000Z');
    expect(formatYmdInTimeZone(legacyInstant, 'UTC')).toBe('2026-09-09');
    expect(formatYmdInTimeZone(legacyInstant, 'America/Sao_Paulo')).toBe('2026-09-08');
  });

  it('preserves creation and update payloads as YYYY-MM-DD strings', () => {
    const creation = CreateServiceOrderSchema.parse({
      customerId: '44444444-4444-4444-8444-444444444444',
      contractId: '55555555-5555-4555-8555-555555555555',
      farmsIds: ['11111111-1111-4111-8111-111111111111'],
      plotsIds: ['22222222-2222-4222-8222-222222222222'],
      pilotsIds: ['33333333-3333-4333-8333-333333333333'],
      plannedDate: '2026-09-09',
    });
    const update = UpdateServiceOrderSchema.parse({ plannedDate: '2026-09-09' });

    expect(creation.plannedDate).toBe('2026-09-09');
    expect(update.plannedDate).toBe('2026-09-09');
  });

  it('normalizes legacy Date and ISO API values to YYYY-MM-DD for transition safety', () => {
    expect(toServiceOrderPlannedDate('2026-09-09T03:00:00.000Z')).toBe('2026-09-09');
    expect(toServiceOrderPlannedDate(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('rejects invalid calendar dates instead of falling back to today', () => {
    expect(isServiceOrderPlannedDate('2026-02-29')).toBe(false);
    expect(isServiceOrderPlannedDate('2028-02-29')).toBe(true);
    expect(() => normalizeServiceOrderPlannedDate('2026-13-01')).toThrow();
    expect(() => UpdateServiceOrderSchema.parse({ plannedDate: '2026-02-29' })).toThrow();
  });

  it('calculates inclusive date filter upper bounds using civil days', () => {
    expect(nextServiceOrderPlannedDate('2026-09-09')).toBe('2026-09-10');
    expect(nextServiceOrderPlannedDate('2026-12-31')).toBe('2027-01-01');
    expect(nextServiceOrderPlannedDate('2028-02-29')).toBe('2028-03-01');
  });
});

describe('service-order plannedDate SQL DATE driver contract', () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const runIfDatabase = databaseUrl ? it : it.skip;

  runIfDatabase('round-trips through Drizzle as DATE string in an isolated database', async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'CREATE TEMP TABLE service_order_planned_date_test (id serial primary key, planned_date date NOT NULL)',
      );
      const table = pgTable('service_order_planned_date_test', {
        id: serial('id').primaryKey(),
        plannedDate: date('planned_date', { mode: 'string' }).notNull(),
      });
      const db = drizzle(client);

      await db.insert(table).values({ plannedDate: '2026-09-09' });
      const [drizzleRow] = await db.select().from(table);
      const rawResult = await client.query<{
        plannedDateText: string;
        plannedDateType: string;
        rawDateValue: Date;
      }>(`SELECT to_char(planned_date, 'YYYY-MM-DD') AS "plannedDateText",
                 pg_typeof(planned_date)::text AS "plannedDateType",
                 planned_date AS "rawDateValue"
            FROM service_order_planned_date_test`);
      await client.query('ROLLBACK');

      expect(drizzleRow).toEqual({
        id: 1,
        plannedDate: '2026-09-09',
      });
      expect(rawResult.rows[0].plannedDateText).toBe('2026-09-09');
      expect(rawResult.rows[0].plannedDateType).toBe('date');
      expect(rawResult.rows[0].rawDateValue).toBeInstanceOf(Date);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
  });
});
