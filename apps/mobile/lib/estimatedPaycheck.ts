import type { PayEstimationFrequency, PayEstimationSettings } from '@/lib/payEstimationSettings';
import { isPayEstimationComplete } from '@/lib/payEstimationSettings';
import type { RecurringPayment, RecurringPaymentFrequency, Transaction } from '@/types';

export const ESTIMATED_PAYCHECK_LABEL = 'Dépôt de paie estimé';
export const PAYCHECK_TRANSACTION_LOOKBACK_LIMIT = 120;

const PAY_INTERVALS = [7, 14] as const;
const MIN_PAY_DAYS_FOR_ESTIMATE = 2;

export type EstimatedPaycheck = {
  dateKey: string;
  date: Date;
  amount: number;
  source: 'actual' | 'transactions' | 'recurring' | 'settings';
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

export function dateKeyFromDate(date: Date) {
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

function subtractRecurringPeriod(date: Date, frequency: RecurringPaymentFrequency) {
  if (frequency === 'weekly') return addDays(date, -7);
  if (frequency === 'biweekly') return addDays(date, -14);
  if (frequency === 'yearly') return addMonthsClamped(date, -12);
  return addMonthsClamped(date, -1);
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
 * Génère toutes les dates de paie estimées dans la plage [rangeStart, rangeEnd].
 * Combine les revenus récurrents de type paie et l'inférence par historique de transactions.
 * Déduplique par dateKey (la source récurrente a priorité sur l'inférence).
 */
export function inferAllEstimatedPaychecksForRange(
  transactions: Transaction[],
  recurringPayments: RecurringPayment[],
  rangeStart: Date,
  rangeEnd: Date,
  today: Date = startOfToday(),
  paySettings?: PayEstimationSettings | null,
): EstimatedPaycheck[] {
  const rs = new Date(rangeStart);
  rs.setHours(0, 0, 0, 0);
  const re = new Date(rangeEnd);
  re.setHours(0, 0, 0, 0);
  const todayMid = new Date(today);
  todayMid.setHours(0, 0, 0, 0);

  const seen = new Map<string, EstimatedPaycheck>();
  const settingsComplete = paySettings ? isPayEstimationComplete(paySettings) : false;

  function tryAdd(item: EstimatedPaycheck) {
    const d = new Date(item.date);
    d.setHours(0, 0, 0, 0);
    if (d < rs || d > re) return;
    if (!seen.has(item.dateKey)) seen.set(item.dateKey, item);
  }

  // Source 0: User-configured pay estimation (highest priority for agenda projection)
  if (paySettings && settingsComplete) {
    inferPaychecksFromSettings(paySettings, rs, re).forEach(tryAdd);
  }

  // Source 1: Recurring income payments (pay-like)
  recurringPayments
    .filter((p) => p.active && p.amount > 0 && isPayLikeRecurringIncome(p))
    .forEach((payment) => {
      const seed =
        parseIsoDay(payment.nextDate) ??
        nextMonthlyDateFromDueDay(payment.dueDay, todayMid);
      if (!seed) return;

      // Walk backward from seed to cover occurrences before seed within range
      let cursor = new Date(seed);
      cursor.setHours(0, 0, 0, 0);
      let backGuard = 0;
      while (cursor > rs && backGuard < 200) {
        const prev = subtractRecurringPeriod(cursor, payment.frequency);
        if (prev.getTime() >= cursor.getTime()) break;
        cursor = prev;
        backGuard += 1;
      }

      // Forward pass through range
      let guard = 0;
      while (cursor <= re && guard < 200) {
        if (cursor >= rs) {
          const k = dateKeyFromDate(cursor);
          tryAdd({ dateKey: k, date: new Date(cursor), amount: payment.amount, source: 'recurring' });
        }
        const next = addRecurringPeriod(cursor, payment.frequency);
        if (next.getTime() <= cursor.getTime()) break;
        cursor = next;
        guard += 1;
      }
    });

  // Source 2: Transaction-inferred interval (weekly / biweekly only) — skipped when settings are complete
  const payTransactions = transactions.filter(isLikelyPayTransaction);
  if (!settingsComplete && payTransactions.length >= MIN_PAY_DAYS_FOR_ESTIMATE) {
    const payDays = new Map<string, number>();
    payTransactions.forEach((tx) => {
      const k = getLocalDayKey(tx.date);
      if (!k || !Number.isFinite(tx.amount) || tx.amount <= 0) return;
      payDays.set(k, (payDays.get(k) ?? 0) + tx.amount);
    });

    const sortedPayDays = [...payDays.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (sortedPayDays.length >= MIN_PAY_DAYS_FOR_ESTIMATE) {
      const datedPayDays = sortedPayDays
        .map(([key, amount]) => ({ key, amount, date: parseIsoDay(key) }))
        .filter((item): item is { key: string; amount: number; date: Date } => item.date !== null);

      if (datedPayDays.length >= MIN_PAY_DAYS_FOR_ESTIMATE) {
        const intervals = datedPayDays
          .slice(1)
          .map((item, idx) =>
            Math.round((item.date.getTime() - datedPayDays[idx].date.getTime()) / 86400000),
          )
          .filter((d) => d > 0)
          .map(nearestPayInterval)
          .filter((i): i is 7 | 14 => i !== null);

        if (intervals.length > 0) {
          const weeklyCount = intervals.filter((i) => i === 7).length;
          const biweeklyCount = intervals.filter((i) => i === 14).length;
          const inferredInterval = weeklyCount >= biweeklyCount ? 7 : 14;

          const lastPayDay = datedPayDays[datedPayDays.length - 1];
          const recentAmounts = datedPayDays.slice(-4).map((i) => i.amount);
          const avgAmount = recentAmounts.reduce((s, a) => s + a, 0) / recentAmounts.length;

          if (Number.isFinite(avgAmount) && avgAmount > 0) {
            // Walk backward from lastPayDay to find earliest occurrence >= rangeStart
            let cursor = new Date(lastPayDay.date);
            cursor.setHours(0, 0, 0, 0);
            let backGuard = 0;
            while (cursor > rs && backGuard < 200) {
              cursor = addDays(cursor, -inferredInterval);
              backGuard += 1;
            }

            // Forward pass; recurring source has priority on shared dates
            let guard = 0;
            while (cursor <= re && guard < 200) {
              if (cursor >= rs) {
                const k = dateKeyFromDate(cursor);
                if (!seen.has(k)) {
                  tryAdd({ dateKey: k, date: new Date(cursor), amount: avgAmount, source: 'transactions' });
                }
              }
              cursor = addDays(cursor, inferredInterval);
              guard += 1;
            }
          }
        }
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
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

type SemiMonthlyAnchors = { early: number; late: number };

function clampDayInMonth(year: number, month: number, day: number): Date {
  const dim = new Date(year, month + 1, 0).getDate();
  const next = new Date(year, month, Math.min(day, dim));
  next.setHours(0, 0, 0, 0);
  return next;
}

function deriveSemiMonthlyAnchors(secondLast: Date, last: Date): SemiMonthlyAnchors {
  const first = secondLast.getDate();
  const second = last.getDate();
  return first <= second ? { early: first, late: second } : { early: second, late: first };
}

function addPayPeriod(
  date: Date,
  frequency: PayEstimationFrequency,
  semiAnchors: SemiMonthlyAnchors | null,
): Date {
  if (frequency === 'weekly') return addDays(date, 7);
  if (frequency === 'biweekly') return addDays(date, 14);
  if (frequency === 'monthly') return addMonthsClamped(date, 1);
  if (!semiAnchors) return addMonthsClamped(date, 1);

  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const earlyThisMonth = clampDayInMonth(y, m, semiAnchors.early);
  const lateThisMonth = clampDayInMonth(y, m, semiAnchors.late);

  if (d < earlyThisMonth.getDate()) return earlyThisMonth;
  if (d < lateThisMonth.getDate()) return lateThisMonth;
  return clampDayInMonth(y, m + 1, semiAnchors.early);
}

function subtractPayPeriod(
  date: Date,
  frequency: PayEstimationFrequency,
  semiAnchors: SemiMonthlyAnchors | null,
): Date {
  if (frequency === 'weekly') return addDays(date, -7);
  if (frequency === 'biweekly') return addDays(date, -14);
  if (frequency === 'monthly') return addMonthsClamped(date, -1);
  if (!semiAnchors) return addMonthsClamped(date, -1);

  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const earlyThisMonth = clampDayInMonth(y, m, semiAnchors.early);
  const lateThisMonth = clampDayInMonth(y, m, semiAnchors.late);

  if (d > lateThisMonth.getDate()) return lateThisMonth;
  if (d > earlyThisMonth.getDate()) return earlyThisMonth;
  return clampDayInMonth(y, m - 1, semiAnchors.late);
}

/** Project pay dates from user settings across [rangeStart, rangeEnd]. */
export function inferPaychecksFromSettings(
  settings: PayEstimationSettings,
  rangeStart: Date,
  rangeEnd: Date,
): EstimatedPaycheck[] {
  if (!isPayEstimationComplete(settings)) return [];

  const secondLast = parseIsoDay(settings.secondLastDate!)!;
  const last = parseIsoDay(settings.lastDate!)!;
  const frequency = settings.frequency!;
  const semiAnchors =
    frequency === 'semi_monthly' ? deriveSemiMonthlyAnchors(secondLast, last) : null;
  const amount = settings.averageAmount ?? 0;

  const rs = new Date(rangeStart);
  rs.setHours(0, 0, 0, 0);
  const re = new Date(rangeEnd);
  re.setHours(0, 0, 0, 0);

  let cursor = new Date(last);
  let guard = 0;
  while (cursor > rs && guard < 240) {
    const prev = subtractPayPeriod(cursor, frequency, semiAnchors);
    if (prev.getTime() >= cursor.getTime()) break;
    cursor = prev;
    guard += 1;
  }

  const results: EstimatedPaycheck[] = [];
  guard = 0;
  while (cursor <= re && guard < 240) {
    if (cursor >= rs) {
      results.push({
        dateKey: dateKeyFromDate(cursor),
        date: new Date(cursor),
        amount,
        source: 'settings',
      });
    }
    const next = addPayPeriod(cursor, frequency, semiAnchors);
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
    guard += 1;
  }

  return results;
}
