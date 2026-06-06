import type { RecurringPayment, RecurringPaymentFrequency, Transaction } from '@/types';

export const ESTIMATED_PAYCHECK_LABEL = 'Dépôt de paie estimé';
export const PAYCHECK_TRANSACTION_LOOKBACK_LIMIT = 120;

const PAY_INTERVALS = [7, 14] as const;
const MIN_PAY_DAYS_FOR_ESTIMATE = 2;

export type EstimatedPaycheck = {
  dateKey: string;
  date: Date;
  amount: number;
  source: 'actual' | 'transactions' | 'recurring';
  /** Vrai si le dépôt est déjà passé et reflété (ou devrait l’être) dans le solde actuel. */
  alreadyReceived?: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function parseIsoDay(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
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

function dateKeyFromDate(date: Date) {
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function getLocalDayKey(value: string) {
  const dayOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(value.trim());
  if (dayOnly) return dayOnly[1];

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return dateKeyFromDate(parsed);

  const isoDay = parseIsoDay(value.slice(0, 10));
  return isoDay ? dateKeyFromDate(isoDay) : null;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, dim));
  next.setHours(0, 0, 0, 0);
  return next;
}

function addYearsClamped(date: Date, years: number) {
  return addMonthsClamped(date, years * 12);
}

function addRecurringPeriod(date: Date, frequency: RecurringPaymentFrequency) {
  if (frequency === 'weekly') return addDays(date, 7);
  if (frequency === 'biweekly') return addDays(date, 14);
  if (frequency === 'yearly') return addYearsClamped(date, 1);
  return addMonthsClamped(date, 1);
}

function normalizeText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getTransactionSearchText(transaction: Transaction) {
  return normalizeText(`${transaction.label} ${transaction.categoryName ?? ''} ${transaction.note ?? ''}`);
}

function hasPayKeyword(text: string) {
  return (
    /\b(salaire|salary|paie|paye|payroll|paycheque|paycheck|pay|employeur)\b/.test(text) ||
    text.includes('depot salaire') ||
    text.includes('depot direct') ||
    text.includes('direct deposit')
  );
}

function hasExcludedIncomeKeyword(text: string) {
  return (
    /\b(remboursement|refund|vente|vendu|sale|marketplace|kijiji|retour)\b/.test(text) ||
    text.includes('facebook marketplace')
  );
}

function isLikelyPayTransaction(transaction: Transaction) {
  const text = getTransactionSearchText(transaction);
  return (
    transaction.type === 'income' &&
    transaction.amount > 0 &&
    hasPayKeyword(text) &&
    !hasExcludedIncomeKeyword(text)
  );
}

function nearestPayInterval(days: number) {
  const match = PAY_INTERVALS.map((interval) => ({ interval, delta: Math.abs(days - interval) })).sort(
    (a, b) => a.delta - b.delta,
  )[0];

  return match && match.delta <= 2 ? match.interval : null;
}

/** Infère le prochain dépôt de paie à partir des transactions de revenus (logique agenda). */
export function inferEstimatedPaycheckFromTransactions(
  transactions: Transaction[],
  today: Date = startOfToday(),
): EstimatedPaycheck | null {
  const payTransactions = transactions.filter(isLikelyPayTransaction);
  if (payTransactions.length < MIN_PAY_DAYS_FOR_ESTIMATE) return null;

  const payDays = new Map<string, number>();
  payTransactions.forEach((transaction) => {
    const key = getLocalDayKey(transaction.date);
    if (!key || !Number.isFinite(transaction.amount) || transaction.amount <= 0) return;
    payDays.set(key, (payDays.get(key) ?? 0) + transaction.amount);
  });

  const sortedPayDays = [...payDays.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (sortedPayDays.length < MIN_PAY_DAYS_FOR_ESTIMATE) return null;

  const datedPayDays = sortedPayDays
    .map(([key, amount]) => ({ key, amount, date: parseIsoDay(key) }))
    .filter((item): item is { key: string; amount: number; date: Date } => item.date !== null);
  if (datedPayDays.length < MIN_PAY_DAYS_FOR_ESTIMATE) return null;

  const intervals = datedPayDays
    .slice(1)
    .map((item, index) => Math.round((item.date.getTime() - datedPayDays[index].date.getTime()) / 86400000))
    .filter((days) => days > 0)
    .map(nearestPayInterval)
    .filter((interval): interval is 7 | 14 => interval !== null);

  if (intervals.length === 0) return null;

  const weeklyCount = intervals.filter((interval) => interval === 7).length;
  const biweeklyCount = intervals.filter((interval) => interval === 14).length;
  const inferredInterval = weeklyCount >= biweeklyCount ? 7 : 14;
  const lastPayDay = datedPayDays[datedPayDays.length - 1];
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  if (lastPayDay.date.getTime() === todayStart.getTime()) {
    return {
      dateKey: lastPayDay.key,
      date: lastPayDay.date,
      amount: lastPayDay.amount,
      source: 'transactions',
    };
  }

  let nextPayDate = addDays(lastPayDay.date, inferredInterval);
  while (nextPayDate < todayStart) {
    nextPayDate = addDays(nextPayDate, inferredInterval);
  }

  const recentAmounts = datedPayDays.slice(-4).map((item) => item.amount);
  const averageAmount = recentAmounts.reduce((sum, amount) => sum + amount, 0) / recentAmounts.length;
  if (!Number.isFinite(averageAmount) || averageAmount <= 0) return null;

  return {
    dateKey: dateKeyFromDate(nextPayDate),
    date: nextPayDate,
    amount: averageAmount,
    source: 'transactions',
  };
}

function nextMonthlyDateFromDueDay(dueDay?: number | null, today: Date = startOfToday()) {
  const day = Math.min(Math.max(dueDay ?? today.getDate(), 1), 28);
  const next = new Date(today.getFullYear(), today.getMonth(), day);
  next.setHours(0, 0, 0, 0);
  if (next < today) next.setMonth(next.getMonth() + 1);
  return next;
}

function nextRecurringIncomeOccurrence(payment: RecurringPayment, today: Date = startOfToday()) {
  const seed =
    parseIsoDay(payment.nextDate) ??
    nextMonthlyDateFromDueDay(payment.dueDay, today);
  if (!seed) return null;

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  let cursor = new Date(seed);
  let guard = 0;
  while (cursor < todayStart && guard < 240) {
    cursor = addRecurringPeriod(cursor, payment.frequency);
    guard += 1;
  }

  return {
    dateKey: dateKeyFromDate(cursor),
    date: cursor,
    amount: payment.amount,
    source: 'recurring' as const,
  };
}

function isPayLikeRecurringIncome(payment: RecurringPayment) {
  const text = normalizeText(`${payment.name} ${payment.accountLabel}`);
  return hasPayKeyword(text) || payment.kind === 'income';
}

/**
 * Prochain dépôt de paie pour un compte : revenu récurrent lié au compte, sinon estimation globale
 * (transactions), sinon tout revenu récurrent actif.
 */
export function resolveNextPaycheckForAccount(
  accountId: string | undefined,
  recurringPayments: RecurringPayment[],
  incomeTransactions: Transaction[],
  today: Date = startOfToday(),
): EstimatedPaycheck | null {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const candidates = collectEstimatedPaycheckCandidates(
    accountId,
    recurringPayments,
    incomeTransactions,
    todayStart,
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((earliest, item) => (item.date < earliest.date ? item : earliest));
}

function collectPayTransactions(transactions: Transaction[]) {
  return transactions.filter(isLikelyPayTransaction);
}

function inferLastPayCycleStart(transactions: Transaction[], today: Date): Date | null {
  const payDays = collectPayTransactions(transactions)
    .map((transaction) => {
      const key = getLocalDayKey(transaction.date);
      return key ? parseIsoDay(key) : null;
    })
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const lastBeforeToday = payDays.find((date) => date.getTime() < todayStart.getTime());
  if (lastBeforeToday) return lastBeforeToday;

  return payDays.length ? payDays[payDays.length - 1] : null;
}

function findActualPaycheckBeforeDue(
  transactions: Transaction[],
  cycleStart: Date,
  dueDate: Date,
  today: Date,
): EstimatedPaycheck | null {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const totalsByDay = new Map<string, number>();

  collectPayTransactions(transactions).forEach((transaction) => {
    const key = getLocalDayKey(transaction.date);
    const date = key ? parseIsoDay(key) : null;
    if (!key || !date || date < cycleStart || date > dueDate) return;
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) return;
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + transaction.amount);
  });

  if (totalsByDay.size === 0) return null;

  const latestKey = [...totalsByDay.keys()].sort((a, b) => a.localeCompare(b)).at(-1)!;
  const latestDate = parseIsoDay(latestKey);
  if (!latestDate) return null;

  return {
    dateKey: latestKey,
    date: latestDate,
    amount: totalsByDay.get(latestKey) ?? 0,
    source: 'actual',
    alreadyReceived: latestDate.getTime() <= todayStart.getTime(),
  };
}

function collectEstimatedPaycheckCandidates(
  accountId: string | undefined,
  recurringPayments: RecurringPayment[],
  incomeTransactions: Transaction[],
  today: Date,
): EstimatedPaycheck[] {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const accountIdTrimmed = accountId?.trim();

  const accountLinked = recurringPayments
    .filter(
      (payment) =>
        payment.active &&
        payment.kind === 'income' &&
        payment.amount > 0 &&
        (!accountIdTrimmed || payment.accountId === accountIdTrimmed),
    )
    .map((payment) => nextRecurringIncomeOccurrence(payment, todayStart))
    .filter((item): item is EstimatedPaycheck => item !== null);

  const payLikeRecurring = recurringPayments
    .filter((payment) => payment.active && payment.amount > 0 && isPayLikeRecurringIncome(payment))
    .map((payment) => nextRecurringIncomeOccurrence(payment, todayStart))
    .filter((item): item is EstimatedPaycheck => item !== null);

  const fromTransactions = inferEstimatedPaycheckFromTransactions(incomeTransactions, todayStart);

  return [
    ...accountLinked,
    ...(fromTransactions ? [fromTransactions] : []),
    ...payLikeRecurring.filter(
      (item) => !accountLinked.some((linked) => linked.dateKey === item.dateKey && linked.amount === item.amount),
    ),
  ];
}

function pickEstimatedPaycheckBeforeDue(
  accountId: string | undefined,
  recurringPayments: RecurringPayment[],
  incomeTransactions: Transaction[],
  dueDate: Date,
  today: Date,
): EstimatedPaycheck | null {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const beforeDue = collectEstimatedPaycheckCandidates(
    accountId,
    recurringPayments,
    incomeTransactions,
    todayStart,
  ).filter((item) => item.date.getTime() <= dueDate.getTime());

  if (beforeDue.length === 0) return null;

  const earliest = beforeDue.reduce((best, item) => (item.date < best.date ? item : best));

  // Date estimée dépassée sans dépôt réel enregistré → ne pas compter sur cette estimation.
  if (earliest.date.getTime() < todayStart.getTime()) return null;

  return earliest;
}

/**
 * Paie pertinente pour une échéance : dépôt réel du cycle courant (prioritaire), sinon revenu
 * récurrent, sinon estimation par historique — seulement si la date tombe avant ou le jour de l’échéance.
 */
export function resolvePaycheckForPaymentAlert(
  accountId: string | undefined,
  recurringPayments: RecurringPayment[],
  incomeTransactions: Transaction[],
  paymentDueDate: Date,
  today: Date = startOfToday(),
): EstimatedPaycheck | null {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const dueDate = new Date(paymentDueDate);
  dueDate.setHours(0, 0, 0, 0);

  const cycleStart =
    inferLastPayCycleStart(incomeTransactions, todayStart) ?? addDays(todayStart, -14);

  const actual = findActualPaycheckBeforeDue(incomeTransactions, cycleStart, dueDate, todayStart);
  if (actual) return actual;

  return pickEstimatedPaycheckBeforeDue(
    accountId,
    recurringPayments,
    incomeTransactions,
    dueDate,
    todayStart,
  );
}
