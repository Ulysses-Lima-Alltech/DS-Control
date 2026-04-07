export function formatApplicationDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';

  const rawValue = dateInput instanceof Date ? dateInput.toISOString() : String(dateInput);
  const datePart = rawValue.includes('T') ? rawValue.split('T')[0] : rawValue;
  const [year, month, day] = datePart.split('-');

  if (!year || !month || !day) return 'N/A';

  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}
