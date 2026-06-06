export function daysUntilPayment(isoDate: string, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.max(0, Math.ceil((target.getTime() - start.getTime()) / 86_400_000));
}

/** Meta line under payment title — « demain », « dans 3 jours » */
export function formatDaysUntilMeta(days: number) {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

/** Compact uppercase badge — « DEMAIN », « DANS 3 J » */
export function formatUpcomingStatusBadge(days: number) {
  if (days <= 0) return "AUJOURD'HUI";
  if (days === 1) return 'DEMAIN';
  return `DANS ${days} J`;
}

export function resolvePaymentStatusBadge(
  eventDateKey: string,
  todayKey: string,
  options: { isIncome?: boolean; isPay?: boolean } = {},
) {
  if (eventDateKey > todayKey) {
    return formatUpcomingStatusBadge(daysUntilPayment(eventDateKey, new Date(`${todayKey}T12:00:00`)));
  }
  if (options.isIncome || options.isPay) return 'REÇU';
  return 'PAYÉ';
}
