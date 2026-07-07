const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDayKey(dateKey: string): Date | null {
  const match = ISO_DAY_PATTERN.exec(dateKey.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatWeekdayLong(date: Date): string {
  return capitalizeFirst(date.toLocaleDateString('fr-FR', { weekday: 'long' }));
}

function formatDayAndMonth(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleDateString('fr-FR', { month: 'long' });
  return `${day} ${month}`;
}

/**
 * À venir section date headers — today/tomorrow special cases, full weekday otherwise.
 * Examples: « Aujourd'hui Lundi 6 juillet », « Demain le 7 juillet », « Vendredi 10 juillet ».
 */
export function formatAgendaUpcomingDateLabel(dateKey: string, todayKey: string): string {
  const date = parseIsoDayKey(dateKey);
  const today = parseIsoDayKey(todayKey);
  if (!date || !today) return dateKey;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) {
    return `Aujourd'hui ${formatWeekdayLong(date)} ${formatDayAndMonth(date)}`;
  }

  if (date.getTime() === tomorrow.getTime()) {
    return `Demain le ${formatDayAndMonth(date)}`;
  }

  return `${formatWeekdayLong(date)} ${formatDayAndMonth(date)}`;
}
