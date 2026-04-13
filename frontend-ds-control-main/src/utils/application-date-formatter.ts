function normalizeOperationalDatePart(value: string): string {
  return value.slice(0, 10);
}

function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatApplicationDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';

  const rawValue = dateInput instanceof Date ? toLocalYMD(dateInput) : String(dateInput);
  const datePart = normalizeOperationalDatePart(rawValue);
  const [year, month, day] = datePart.split('-');

  if (!year || !month || !day) return String(dateInput);

  return `${day}/${month}/${year}`;
}
