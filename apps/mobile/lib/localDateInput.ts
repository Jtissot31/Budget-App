/** YYYY-MM-DD in the device local timezone (avoids UTC midnight shifts). */
export function getLocalDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse an ISO or date string to YYYY-MM-DD in local timezone. */
export function toLocalDateInputValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getLocalDateInputValue();
  return getLocalDateInputValue(parsed);
}
