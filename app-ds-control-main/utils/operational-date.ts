export const OPERATIONAL_TIME_ZONE = 'America/Sao_Paulo';
export const OPERATIONAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const OPERATIONAL_DATE_PREFIX_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;

export type OperationalDateInput = string | number | Date | null | undefined;

function parseYmdToDate(ymd: string): Date | null {
  if (!OPERATIONAL_DATE_REGEX.test(ymd)) {
    return null;
  }

  const [year, month, day] = ymd.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function extractCivilYmdFromString(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(OPERATIONAL_DATE_PREFIX_REGEX);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const ymd = `${year}-${month}-${day}`;

  return parseYmdToDate(ymd) ? ymd : null;
}

function toYmdInOperationalZone(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  if (!year || !month || !day) {
    const fallbackYear = date.getFullYear();
    const fallbackMonth = String(date.getMonth() + 1).padStart(2, '0');
    const fallbackDay = String(date.getDate()).padStart(2, '0');
    return `${fallbackYear}-${fallbackMonth}-${fallbackDay}`;
  }

  return `${year}-${month}-${day}`;
}

export function toOperationalDateYMD(input: OperationalDateInput): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();

    if (!trimmed) {
      return null;
    }

    // Regra principal:
    // qualquer string que COMEÇA com YYYY-MM-DD representa uma data civil operacional.
    // Não converter com new Date(), porque isso pode mudar o dia por timezone.
    const civilYmd = extractCivilYmdFromString(trimmed);

    if (civilYmd) {
      return civilYmd;
    }

    // Mantém suporte para timestamps numéricos em string.
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);

      if (!Number.isFinite(numeric)) {
        return null;
      }

      return toYmdInOperationalZone(new Date(numeric));
    }

    // Fallback para entradas realmente livres/externas.
    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return toYmdInOperationalZone(parsed);
  }

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      return null;
    }

    return toYmdInOperationalZone(new Date(input));
  }

  if (Number.isNaN(input.getTime())) {
    return null;
  }

  return toYmdInOperationalZone(input);
}

export function toOperationalDateYMDOrToday(input?: OperationalDateInput): string {
  return toOperationalDateYMD(input) ?? toYmdInOperationalZone(new Date());
}

export function formatOperationalDateBR(input: OperationalDateInput): string {
  const ymd = toOperationalDateYMD(input);

  if (!ymd) {
    return '-';
  }

  const [year, month, day] = ymd.split('-');
  return `${day}/${month}/${year}`;
}

export function parseOperationalDateToPickerDate(input: OperationalDateInput): Date | undefined {
  if (input === null || input === undefined) {
    return undefined;
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return undefined;
    }

    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }

  if (typeof input === 'string') {
    const civilYmd = extractCivilYmdFromString(input);

    if (civilYmd) {
      const parsed = parseYmdToDate(civilYmd);
      return parsed ?? undefined;
    }
  }

  const normalized = toOperationalDateYMD(input);

  if (!normalized) {
    return undefined;
  }

  const parsed = parseYmdToDate(normalized);
  return parsed ?? undefined;
}
