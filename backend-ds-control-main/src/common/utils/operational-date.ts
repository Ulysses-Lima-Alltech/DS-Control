import { DateTime } from "luxon";
import { sql } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";

export const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";
export const OPERATIONAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type OperationalDateInput = string | number | Date;

const OPERATIONAL_TIME_ZONE_SQL = sql.raw(`'${OPERATIONAL_TIME_ZONE}'`);

function dateTimeFromInput(input: OperationalDateInput): DateTime {
  if (input instanceof Date) {
    const parsed = DateTime.fromJSDate(input, { zone: "utc" });
    if (!parsed.isValid) {
      throw new Error("Invalid Date input");
    }
    return parsed;
  }

  if (typeof input === "number") {
    const parsed = DateTime.fromMillis(input, { zone: "utc" });
    if (!parsed.isValid) {
      throw new Error("Invalid timestamp input");
    }
    return parsed;
  }

  const trimmed = input.trim();

  if (/^\d+$/.test(trimmed)) {
    return dateTimeFromInput(Number(trimmed));
  }

  const isoParsed = DateTime.fromISO(trimmed, { setZone: true });
  if (isoParsed.isValid) {
    return isoParsed.toUTC();
  }

  const fallbackDate = new Date(trimmed);
  if (!Number.isNaN(fallbackDate.getTime())) {
    return DateTime.fromJSDate(fallbackDate, { zone: "utc" });
  }

  throw new Error(`Invalid operational date input: ${input}`);
}

export function isOperationalDateString(value: string): boolean {
  return OPERATIONAL_DATE_PATTERN.test(value);
}

export function toOperationalDateYMD(input: OperationalDateInput): string {
  if (typeof input === "string" && isOperationalDateString(input.trim())) {
    return input.trim();
  }

  return dateTimeFromInput(input).setZone(OPERATIONAL_TIME_ZONE).toFormat("yyyy-LL-dd");
}

export function toOperationalDateDisplayBR(input: OperationalDateInput): string {
  const ymd = toOperationalDateYMD(input);
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

export function toOperationalDateDatabaseTimestamp(input: OperationalDateInput): Date {
  const operationalDate = toOperationalDateYMD(input);
  const parsed = DateTime.fromISO(operationalDate, { zone: OPERATIONAL_TIME_ZONE });
  if (!parsed.isValid) {
    throw new Error(`Invalid operational date value: ${operationalDate}`);
  }

  return parsed.startOf("day").toUTC().toJSDate();
}

export function addOperationalDays(input: OperationalDateInput, days: number): string {
  const base = DateTime.fromISO(toOperationalDateYMD(input), { zone: OPERATIONAL_TIME_ZONE });
  return base.plus({ days }).toFormat("yyyy-LL-dd");
}

export function addOperationalMonths(input: OperationalDateInput, months: number): string {
  const base = DateTime.fromISO(toOperationalDateYMD(input), { zone: OPERATIONAL_TIME_ZONE });
  return base.plus({ months }).toFormat("yyyy-LL-dd");
}

export function diffOperationalDaysInclusive(
  startDateInput: OperationalDateInput,
  endDateInput: OperationalDateInput,
): number {
  const start = DateTime.fromISO(toOperationalDateYMD(startDateInput), { zone: OPERATIONAL_TIME_ZONE }).startOf("day");
  const end = DateTime.fromISO(toOperationalDateYMD(endDateInput), { zone: OPERATIONAL_TIME_ZONE }).startOf("day");
  const diff = Math.floor(end.diff(start, "days").days) + 1;
  return Math.max(1, diff);
}

/**
 * Interpreta timestamps salvos como UTC e converte para o dia civil em America/Sao_Paulo.
 */
export function operationalDateSql(column: SQLWrapper): SQL {
  return sql`(((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${OPERATIONAL_TIME_ZONE_SQL})::date)`;
}

export function operationalDateToYmdSql(column: SQLWrapper): SQL<string> {
  return sql<string>`TO_CHAR(${operationalDateSql(column)}, 'YYYY-MM-DD')`;
}

