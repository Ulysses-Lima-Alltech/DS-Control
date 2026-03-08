export function formatTimestamp(timestamp: Date | null | undefined) {
  if (!timestamp) return 'N/A';

  const date = new Date(timestamp);

  if (date.toISOString().split('T')[1].includes('T')) {
    const onlyDate = timestamp.toString().split('T')[0];
    const [year, month, day] = onlyDate.split('-');
    return `${day}/${month}/${year}`;
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
