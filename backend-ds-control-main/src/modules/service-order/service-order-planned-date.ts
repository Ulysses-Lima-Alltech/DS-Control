import { addOperationalDays } from '@common/utils/operational-date';

export const SERVICE_ORDER_PLANNED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isServiceOrderPlannedDate(value: string): boolean {
  if (!SERVICE_ORDER_PLANNED_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function normalizeServiceOrderPlannedDate(value: string): string {
  const trimmed = value.trim();
  if (!isServiceOrderPlannedDate(trimmed)) {
    throw new Error(`Invalid service order planned date: ${value}`);
  }

  return trimmed;
}

export function toServiceOrderPlannedDate(value: string | Date): string {
  if (typeof value === 'string') {
    const prefix = value.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
    return normalizeServiceOrderPlannedDate(prefix ?? value);
  }

  if (Number.isNaN(value.getTime())) {
    throw new Error('Invalid service order planned Date');
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return normalizeServiceOrderPlannedDate(`${year}-${month}-${day}`);
}

export function nextServiceOrderPlannedDate(value: string): string {
  return addOperationalDays(normalizeServiceOrderPlannedDate(value), 1);
}
