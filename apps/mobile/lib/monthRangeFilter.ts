/**
 * Month / month-range filtering (Documents library, list screens).
 * Months are locale-independent `YYYY-MM` keys so they sort lexicographically.
 */

export type MonthRangeFilter = {
  /** Inclusive first month, `YYYY-MM`. */
  start: string;
  /** Inclusive last month, `YYYY-MM` — equals `start` for a single month. */
  end: string;
};

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isMonthKey(value: string): boolean {
  const match = MONTH_KEY_PATTERN.exec(value.trim());
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function monthKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}

/**
 * Month key for a stored ISO date.
 * Date-only strings are read as written (no UTC shift); full timestamps use local time
 * so the key matches the date rendered by `toLocaleDateString`.
 */
export function getLocalMonthKey(isoDate: string): string {
  const trimmed = isoDate.trim();
  const dateOnly = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed.slice(0, 7);
  return monthKeyFromDate(parsed);
}

export function parseMonthKey(monthKey: string): Date | null {
  const match = MONTH_KEY_PATTERN.exec(monthKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

export function addMonthsToKey(monthKey: string, amount: number): string {
  const start = parseMonthKey(monthKey);
  if (!start) return monthKey;
  return monthKeyFromDate(new Date(start.getFullYear(), start.getMonth() + amount, 1));
}

/** Order two endpoints so the earlier month is always `start`. */
export function normalizeMonthRange(first: string, second: string): MonthRangeFilter {
  return first <= second ? { start: first, end: second } : { start: second, end: first };
}

export function isSingleMonthRange(filter: MonthRangeFilter | null): boolean {
  return Boolean(filter && filter.start === filter.end);
}

export function monthKeyWithinRange(
  monthKey: string,
  filter: MonthRangeFilter | null,
): boolean {
  if (!filter) return true;
  return monthKey >= filter.start && monthKey <= filter.end;
}

export function dateWithinMonthRange(
  isoDate: string,
  filter: MonthRangeFilter | null,
): boolean {
  if (!filter) return true;
  return monthKeyWithinRange(getLocalMonthKey(isoDate), filter);
}

/** Keep only the dated items whose month falls inside the filter. */
export function filterByMonthRange<T extends { date: string }>(
  items: readonly T[],
  filter: MonthRangeFilter | null,
): T[] {
  if (!filter) return items.slice();
  return items.filter((item) => dateWithinMonthRange(item.date, filter));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** « Août 2026 » (long) or « Août » / « Déc. 2026 » depending on options. */
export function formatMonthKeyLabel(
  monthKey: string,
  options?: { style?: 'long' | 'short'; withYear?: boolean },
): string {
  const date = parseMonthKey(monthKey);
  if (!date) return monthKey;
  const format: Intl.DateTimeFormatOptions = {
    month: options?.style === 'short' ? 'short' : 'long',
  };
  if (options?.withYear !== false) format.year = 'numeric';
  return capitalize(date.toLocaleDateString('fr-FR', format));
}

/** Chip / button label: « Tous les mois », « Août 2026 », « Août – Décembre 2026 ». */
export function formatMonthRangeLabel(filter: MonthRangeFilter | null): string {
  if (!filter) return 'Tous les mois';
  if (filter.start === filter.end) return formatMonthKeyLabel(filter.start);
  const sameYear = filter.start.slice(0, 4) === filter.end.slice(0, 4);
  if (sameYear) {
    return `${formatMonthKeyLabel(filter.start, { withYear: false })} – ${formatMonthKeyLabel(filter.end)}`;
  }
  return `${formatMonthKeyLabel(filter.start, { style: 'short' })} – ${formatMonthKeyLabel(filter.end, { style: 'short' })}`;
}
