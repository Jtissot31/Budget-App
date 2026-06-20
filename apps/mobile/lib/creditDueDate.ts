function startOfToday(today: Date = new Date()) {
  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function dueDateInMonth(year: number, month: number, dueDay: number) {
  const day = Math.min(Math.max(dueDay, 1), daysInMonth(year, month));
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Prochaine date d'échéance mensuelle (ce mois si le jour n'est pas passé, sinon le mois suivant). */
export function nextCreditDueDate(dueDay: number, today: Date = new Date()) {
  const todayStart = startOfToday(today);
  const year = todayStart.getFullYear();
  const month = todayStart.getMonth();
  const thisMonth = dueDateInMonth(year, month, dueDay);
  if (thisMonth >= todayStart) return thisMonth;
  return dueDateInMonth(year, month + 1, dueDay);
}

/** Libellé français long : « le 29 février ». */
export function formatCreditDueDateLabel(dueDay: number, today: Date = new Date()) {
  const dueDate = nextCreditDueDate(dueDay, today);
  const formatted = dueDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return `le ${formatted}`;
}
