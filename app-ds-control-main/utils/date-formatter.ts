import { formatOperationalDateBR } from '@/utils/operational-date';

export default function formatDateToDDMMYYYY(dateInput: string | number | Date) {
  return formatOperationalDateBR(dateInput);
}
