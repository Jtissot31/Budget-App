const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseToLocalDate(date: string | Date): Date | null {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    const local = new Date(date);
    local.setHours(0, 0, 0, 0);
    return local;
  }

  const trimmed = date.trim();
  if (!trimmed) return null;

  const match = ISO_DAY_PATTERN.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const local = new Date(parsed);
  local.setHours(0, 0, 0, 0);
  return local;
}

/** Friendly French date label for picker triggers and inline date display. */
export function formatFriendlyDateLabel(date: string | Date, locale = 'fr-CA'): string {
  const parsed = parseToLocalDate(date);
  if (!parsed) {
    return typeof date === 'string' ? date : '';
  }

  const today = startOfToday();
  if (isSameCalendarDay(parsed, today)) return "Aujourd'hui";

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameCalendarDay(parsed, yesterday)) return 'Hier';

  return parsed.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
