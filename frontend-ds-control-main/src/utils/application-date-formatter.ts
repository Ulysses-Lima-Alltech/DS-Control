import { formatOperationalDateBR } from '@/utils/operational-date';

export function formatApplicationDate(dateInput: string | Date | null | undefined): string {
  return formatOperationalDateBR(dateInput);
}
