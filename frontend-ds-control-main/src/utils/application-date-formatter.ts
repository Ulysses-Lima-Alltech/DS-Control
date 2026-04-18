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

  if (dateInput instanceof Date) {
    const datePart = toLocalYMD(dateInput);
    const [year, month, day] = datePart.split('-');
    if (!year || !month || !day) return String(dateInput);
    return `${day}/${month}/${year}`;
  }

  const rawValue = String(dateInput);
  const operationalDatePattern = /^\d{4}-\d{2}-\d{2}/;

  // Operational dates are civil dates and must not be shifted by timezone.
  if (operationalDatePattern.test(rawValue)) {
    const [year, month, day] = normalizeOperationalDatePart(rawValue).split('-');
    if (!year || !month || !day) return rawValue;
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    // Datetime payloads are normalized to Brazil civil day for display consistency.
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsed);
  }

  const datePart = normalizeOperationalDatePart(rawValue);
  const [year, month, day] = datePart.split('-');

  if (!year || !month || !day) return String(dateInput);

  return `${day}/${month}/${year}`;
}
