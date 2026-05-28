import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { frequencyLabel } from '@/app/recurring-payments';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { GlassContainer } from '@/components/GlassContainer';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { FLOATING_NAV_CONTENT_PADDING, radius, spacing, typography, type AppColors } from '@/constants/theme';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategoryBudgets, getRecentIncomeTransactions, getRecurringPayments } from '@/lib/db';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { CategoryBudget, RecurringPayment, Transaction } from '@/types';

export type AgendaBill = {
  name: string;
  amount: number;
  account: string;
  recurring?: boolean;
  date?: string;
  kind?: 'payment' | 'income';
  sourceId?: string;
  icon?: string;
  color?: string;
  logoUrl?: string | null;
  categoryName?: string | null;
  categoryId?: string | null;
};

type IconName = keyof typeof Ionicons.glyphMap;

export type AgendaViewRef = {
  resetToTop: () => void;
};

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const PAY_LABEL = 'Dépôt de paie estimé';

/** Exemple d’échéances — à remplacer par des données API plus tard */
const BILLS_BY_DATE: Record<string, AgendaBill[]> = {
  '2026-05-08': [{ name: 'Paiement min. CC', amount: 850, account: 'Carte', recurring: false }],
  '2026-05-09': [{ name: 'Loyer', amount: 1200, account: 'Chèques', recurring: true }],
  '2026-05-15': [{ name: 'Hydro-Québec', amount: 120, account: 'Chèques', recurring: true }],
  '2026-05-20': [{ name: 'Netflix', amount: 15.99, account: 'Chèques', recurring: true }],
  '2026-05-25': [{ name: 'Gym', amount: 49.99, account: 'Chèques', recurring: true }],
  '2026-05-26': [
    {
      name: PAY_LABEL,
      amount: 2450,
      account: 'Dépôt',
      recurring: true,
      kind: 'income',
      sourceId: 'estimated-pay',
    },
  ],
  '2026-05-28': [{ name: 'Assurance auto', amount: 180, account: 'Chèques', recurring: true }],
};

const UPCOMING_WINDOW_DAYS = 120;
const INCOME_TRANSACTION_LOOKBACK_LIMIT = 120;
/** Jours avant/après la date estimée pour associer un vrai dépôt de paie à ce cycle. */
const ESTIMATED_PAY_CONFIRMED_WINDOW_BEFORE_DAYS = 5;
const ESTIMATED_PAY_CONFIRMED_WINDOW_AFTER_DAYS = 3;
/** Après cette date + N jours sans dépôt confirmé dans la fenêtre, retirer l’estimation de l’agenda. */
const ESTIMATED_PAY_HIDE_AFTER_DAYS = 3;
const PAY_INTERVALS = [7, 14] as const;
const MIN_PAY_DAYS_FOR_ESTIMATE = 2;

type CalendarMark = 'payment' | 'income' | 'mixed' | 'payEstimate' | 'payActual';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function formatBillDateLong(dateKey: string) {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function parseIsoDay(value?: string | null) {
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
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

function occurrenceDateAt(firstDate: Date, frequency: RecurringPayment['frequency'], index: number) {
  if (frequency === 'weekly') return addDays(firstDate, index * 7);
  if (frequency === 'biweekly') return addDays(firstDate, index * 14);
  if (frequency === 'yearly') return addYearsClamped(firstDate, index);
  return addMonthsClamped(firstDate, index);
}

function toAgendaBill(payment: RecurringPayment): AgendaBill {
  return {
    name: payment.name,
    amount: payment.amount,
    account: payment.accountLabel,
    recurring: true,
    kind: payment.kind === 'income' ? 'income' : 'payment',
    sourceId: payment.id,
    icon: payment.icon,
    color: payment.color,
    logoUrl: payment.logoUrl ?? null,
    categoryName: payment.categoryName ?? null,
    categoryId: payment.categoryId ?? null,
  };
}

function hasSameBill(items: AgendaBill[], bill: AgendaBill) {
  return items.some((item) => {
    if (bill.sourceId && item.sourceId === bill.sourceId) return true;
    return (
      item.name === bill.name &&
      item.amount === bill.amount &&
      item.account === bill.account &&
      (item.kind ?? 'payment') === (bill.kind ?? 'payment')
    );
  });
}

function mergeBillsByDate(...sources: Array<Record<string, AgendaBill[]>>) {
  const merged: Record<string, AgendaBill[]> = {};
  sources.forEach((source) => {
    Object.entries(source).forEach(([key, bills]) => {
      const next = merged[key] ?? [];
      bills.forEach((bill) => {
        if (!hasSameBill(next, bill)) {
          next.push(bill);
        }
      });
      if (next.length) merged[key] = next;
    });
  });
  return merged;
}

function buildRecurringBillsByDate(payments: RecurringPayment[], rangeStart: Date, rangeEnd: Date) {
  const billsByDate: Record<string, AgendaBill[]> = {};

  payments.forEach((payment) => {
    if (!payment.active) return;

    const firstDate = parseIsoDay(payment.nextDate);
    if (!firstDate) return;

    const endDate = parseIsoDay(payment.endDate);
    const effectiveEnd = endDate && endDate < rangeEnd ? endDate : rangeEnd;
    if (effectiveEnd < rangeStart || firstDate > effectiveEnd) return;

    let occurrenceIndex = 0;
    let occurrence = occurrenceDateAt(firstDate, payment.frequency, occurrenceIndex);
    while (occurrence <= effectiveEnd && occurrenceIndex < 1200) {
      if (occurrence >= rangeStart) {
        const key = dateKeyFromDate(occurrence);
        const bill = toAgendaBill(payment);
        const existing = billsByDate[key] ?? [];
        if (!hasSameBill(existing, bill)) existing.push(bill);
        billsByDate[key] = existing;
      }
      occurrenceIndex += 1;
      occurrence = occurrenceDateAt(firstDate, payment.frequency, occurrenceIndex);
    }
  });

  return billsByDate;
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
  return /\b(salaire|salary|paie|paye|payroll|paycheque|paycheck|pay|employeur)\b/.test(text)
    || text.includes('depot salaire')
    || text.includes('depot direct')
    || text.includes('direct deposit');
}

function hasExcludedIncomeKeyword(text: string) {
  return /\b(remboursement|refund|vente|vendu|sale|marketplace|kijiji|retour)\b/.test(text)
    || text.includes('facebook marketplace');
}

function isLikelyPayTransaction(transaction: Transaction) {
  const text = getTransactionSearchText(transaction);
  return transaction.type === 'income'
    && transaction.amount > 0
    && hasPayKeyword(text)
    && !hasExcludedIncomeKeyword(text);
}

function isActualPayTransaction(transaction: Transaction) {
  const text = getTransactionSearchText(transaction);
  return transaction.type === 'income'
    && transaction.amount > 0
    && hasPayKeyword(text)
    && !hasExcludedIncomeKeyword(text);
}

function isEstimatedPayBill(bill: AgendaBill) {
  return bill.sourceId === 'estimated-pay' || bill.name === PAY_LABEL;
}

function isActualPayBill(bill: AgendaBill) {
  return bill.sourceId?.startsWith('actual-pay-') === true;
}

function isPayBill(bill: AgendaBill) {
  return isActualPayBill(bill) || isEstimatedPayBill(bill);
}

function isRecurringExpenseBill(bill: AgendaBill) {
  return Boolean(bill.recurring) && (bill.kind ?? 'payment') === 'payment';
}

function billAmountStyles(
  bill: AgendaBill,
  styles: ReturnType<typeof createStyles>,
) {
  if (isPayBill(bill)) return [styles.rowAmt, styles.rowAmtPay];
  if (isRecurringExpenseBill(bill)) return [styles.rowAmt, styles.rowAmtRecurring];
  return styles.rowAmt;
}

function hasMatchingIncomeBill(items: AgendaBill[], bill: AgendaBill) {
  return items.some((item) => {
    if ((item.kind ?? 'payment') !== 'income') return false;
    if (item.sourceId === bill.sourceId) return true;
    return Math.abs(item.amount - bill.amount) < 0.01
      && (isPayBill(item) || hasPayKeyword(normalizeText(`${item.name} ${item.account}`)));
  });
}

function toActualPayBill(transaction: Transaction): AgendaBill {
  return {
    name: transaction.label || 'Salaire',
    amount: transaction.amount,
    account: transaction.categoryName ?? 'Dépôt',
    recurring: false,
    kind: 'income',
    sourceId: `actual-pay-${transaction.id}`,
    icon: transaction.transactionIcon ?? transaction.categoryIcon ?? 'cash-outline',
  };
}

function buildActualPayByDate(
  transactions: Transaction[],
  existingBillsByDate: Record<string, AgendaBill[]>,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const billsByDate: Record<string, AgendaBill[]> = {};

  transactions.filter(isActualPayTransaction).forEach((transaction) => {
    const key = getLocalDayKey(transaction.date);
    const date = key ? parseIsoDay(key) : null;
    if (!key || !date || date < rangeStart || date > rangeEnd) return;

    const bill = toActualPayBill(transaction);
    const existing = [...(existingBillsByDate[key] ?? []), ...(billsByDate[key] ?? [])];
    if (hasMatchingIncomeBill(existing, bill)) return;

    billsByDate[key] = [...(billsByDate[key] ?? []), bill];
  });

  return billsByDate;
}

function buildActualPayDateKeys(transactions: Transaction[]) {
  return new Set(
    transactions
      .filter(isActualPayTransaction)
      .map((transaction) => getLocalDayKey(transaction.date))
      .filter((key): key is string => key !== null),
  );
}

function nearestPayInterval(days: number) {
  const match = PAY_INTERVALS
    .map((interval) => ({ interval, delta: Math.abs(days - interval) }))
    .sort((a, b) => a.delta - b.delta)[0];

  return match && match.delta <= 2 ? match.interval : null;
}

function inferEstimatedPayBill(transactions: Transaction[], today: Date): { key: string; bill: AgendaBill } | null {
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

  const intervals = datedPayDays.slice(1)
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
      key: lastPayDay.key,
      bill: {
        name: PAY_LABEL,
        amount: lastPayDay.amount,
        account: 'Dépôt',
        recurring: true,
        kind: 'income',
        sourceId: 'estimated-pay',
      },
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
    key: dateKeyFromDate(nextPayDate),
    bill: {
      name: PAY_LABEL,
      amount: averageAmount,
      account: 'Dépôt',
      recurring: true,
      kind: 'income',
      sourceId: 'estimated-pay',
    },
  };
}

function buildEstimatedPayByDate(
  estimate: { key: string; bill: AgendaBill } | null,
  existingBillsByDate: Record<string, AgendaBill[]>,
) {
  if (!estimate) return {};

  const existingOnDate = existingBillsByDate[estimate.key] ?? [];
  if (existingOnDate.some((bill) => bill.kind === 'income')) return {};

  return { [estimate.key]: [estimate.bill] };
}

function hasConfirmedPayInEstimateWindow(estimateDateKey: string, transactions: Transaction[]) {
  const center = parseIsoDay(estimateDateKey);
  if (!center) return false;

  const windowStart = addDays(center, -ESTIMATED_PAY_CONFIRMED_WINDOW_BEFORE_DAYS);
  const windowEnd = addDays(center, ESTIMATED_PAY_CONFIRMED_WINDOW_AFTER_DAYS);

  return transactions.some((tx) => {
    if (!isActualPayTransaction(tx)) return false;
    const key = getLocalDayKey(tx.date);
    const txDay = key ? parseIsoDay(key) : null;
    if (!txDay) return false;
    return txDay >= windowStart && txDay <= windowEnd;
  });
}

/** Affiche l’estimation seulement si pas de paie confirmée dans la fenêtre du cycle et avant expiration (date estimée + N jours). */
function shouldShowEstimatedPayBill(estimateDateKey: string, transactions: Transaction[], today: Date) {
  if (hasConfirmedPayInEstimateWindow(estimateDateKey, transactions)) {
    return false;
  }
  const estimateDate = parseIsoDay(estimateDateKey);
  if (!estimateDate) return false;

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const hideAfter = addDays(estimateDate, ESTIMATED_PAY_HIDE_AFTER_DAYS);
  return todayStart <= hideAfter;
}

function filterEstimatedPayFromAgenda(
  billsByDate: Record<string, AgendaBill[]>,
  transactions: Transaction[],
  today: Date,
) {
  const next: Record<string, AgendaBill[]> = {};
  Object.entries(billsByDate).forEach(([key, bills]) => {
    const filtered = bills.filter(
      (bill) => !isEstimatedPayBill(bill) || shouldShowEstimatedPayBill(key, transactions, today),
    );
    if (filtered.length) next[key] = filtered;
  });
  return next;
}

function eventKindForDate(dateKey: string, billsByDate: Record<string, AgendaBill[]>): 'payment' | 'income' | 'mixed' | null {
  const items = billsByDate[dateKey];
  if (!items?.length) return null;
  const hasIncome = items.some((item) => item.kind === 'income');
  const hasPayment = items.some((item) => item.kind !== 'income');
  if (hasIncome && hasPayment) return 'mixed';
  return hasIncome ? 'income' : 'payment';
}

function calendarMarkForDate(
  dateKey: string,
  billsByDate: Record<string, AgendaBill[]>,
  actualPayDateKeys: Set<string>,
): CalendarMark | null {
  const items = billsByDate[dateKey];
  if (items?.some(isActualPayBill)) {
    return 'payActual';
  }
  if (items?.some(isEstimatedPayBill)) {
    return actualPayDateKeys.has(dateKey) ? 'payActual' : 'payEstimate';
  }

  return eventKindForDate(dateKey, billsByDate);
}

export const AgendaView = forwardRef<AgendaViewRef>(function AgendaView(_, ref) {
  const today = useMemo(() => startOfToday(), []);
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isLight), [colors, isLight]);
  const scrollRef = useRef<ScrollView>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recentIncomeTransactions, setRecentIncomeTransactions] = useState<Transaction[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetailPayload | null>(null);

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const loadRecurringPayments = useCallback(async () => {
    const [payments, budgets, incomeTransactions] = await Promise.all([
      getRecurringPayments(),
      getCategoryBudgets(),
      getRecentIncomeTransactions(INCOME_TRANSACTION_LOOKBACK_LIMIT),
    ]);
    setRecurringPayments(payments);
    setCategoryBudgets(budgets);
    setRecentIncomeTransactions(incomeTransactions);
  }, []);

  const categoryBudgetById = useMemo(() => {
    const lookup = new Map<string, CategoryBudget>();
    categoryBudgets.forEach((item) => lookup.set(item.categoryId, item));
    return lookup;
  }, [categoryBudgets]);

  useEffect(() => {
    void loadRecurringPayments();
  }, [loadRecurringPayments]);

  const resetToTop = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedKey(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [today]);

  useImperativeHandle(ref, () => ({ resetToTop }), [resetToTop]);

  useRefreshOnFocus(loadRecurringPayments);
  useScrollToTopOnFocus(resetToTop);

  const { cells } = useMemo(() => {
    const first = new Date(year, month, 1);
    const firstDow = first.getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    const dim = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((offset + dim) / 7) * 7;
    const cells: ({ day: number } | null)[] = [];
    for (let i = 0; i < total; i++) {
      const day = i - offset + 1;
      if (day < 1 || day > dim) cells.push(null);
      else cells.push({ day });
    }
    return { cells };
  }, [year, month]);

  const visibleStart = useMemo(() => {
    const start = new Date(year, month, 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [month, year]);

  const visibleEnd = useMemo(() => {
    const end = new Date(year, month + 1, 0);
    end.setHours(0, 0, 0, 0);
    return end;
  }, [month, year]);

  const billsByDate = useMemo(() => {
    const baseBillsByDate = mergeBillsByDate(
      BILLS_BY_DATE,
      buildRecurringBillsByDate(recurringPayments, visibleStart, visibleEnd),
    );
    const actualPayByDate = buildActualPayByDate(
      recentIncomeTransactions,
      baseBillsByDate,
      visibleStart,
      visibleEnd,
    );
    const billsWithActualPay = mergeBillsByDate(baseBillsByDate, actualPayByDate);
    const withEstimate = mergeBillsByDate(
      billsWithActualPay,
      buildEstimatedPayByDate(inferEstimatedPayBill(recentIncomeTransactions, today), billsWithActualPay),
    );
    return filterEstimatedPayFromAgenda(withEstimate, recentIncomeTransactions, today);
  }, [recentIncomeTransactions, recurringPayments, today, visibleEnd, visibleStart]);

  const actualPayDateKeys = useMemo(
    () => buildActualPayDateKeys(recentIncomeTransactions),
    [recentIncomeTransactions],
  );

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelectedKey(null);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelectedKey(null);
  };

  const upcoming = useMemo(() => {
    const rangeEnd = addDays(today, UPCOMING_WINDOW_DAYS);
    const baseBillsByDate = mergeBillsByDate(
      BILLS_BY_DATE,
      buildRecurringBillsByDate(recurringPayments, today, rangeEnd),
    );
    const actualPayByDate = buildActualPayByDate(
      recentIncomeTransactions,
      baseBillsByDate,
      today,
      rangeEnd,
    );
    const billsWithActualPay = mergeBillsByDate(baseBillsByDate, actualPayByDate);
    const upcomingBillsByDate = filterEstimatedPayFromAgenda(
      mergeBillsByDate(
        billsWithActualPay,
        buildEstimatedPayByDate(inferEstimatedPayBill(recentIncomeTransactions, today), billsWithActualPay),
      ),
      recentIncomeTransactions,
      today,
    );

    return Object.entries(upcomingBillsByDate)
      .filter(([k]) => k >= todayKey)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [recentIncomeTransactions, recurringPayments, today, todayKey]);

  const upcomingFlat = useMemo(
    () => upcoming.flatMap(([key, bills]) => bills.map((b) => ({ key, b }))),
    [upcoming],
  );

  const selBills = selectedKey ? (billsByDate[selectedKey] ?? []) : null;

  const openBillDetail = (b: AgendaBill, dateKey: string) => {
    const rp = b.sourceId ? recurringPayments.find((p) => p.id === b.sourceId) : undefined;
    setPaymentDetail({
      name: b.name,
      amount: b.amount,
      account: b.account,
      recurring: b.recurring,
      sourceId: b.sourceId,
      kind: b.kind,
      dateLabel: b.date ?? formatBillDateLong(dateKey),
      logoUrl: b.logoUrl ?? rp?.logoUrl ?? null,
      icon: b.icon ?? rp?.icon,
      color: b.color ?? rp?.color,
      frequencyLabel: rp ? frequencyLabel(rp.frequency) : null,
      categoryName: rp?.categoryName ?? null,
      categoryId: rp?.categoryId ?? null,
    });
  };

  const resolveBillCategoryBudget = useCallback(
    (bill: AgendaBill) => {
      if (!bill.categoryId || (bill.kind ?? 'payment') === 'income') return null;
      return categoryBudgetById.get(bill.categoryId) ?? null;
    },
    [categoryBudgetById],
  );

  /** Ouvre la fiche détail ; édition/suppression via les boutons du sheet. */
  const onBillRowPress = (b: AgendaBill, dateKey: string) => {
    tapHaptic();
    openBillDetail(b, dateKey);
  };

  const getAgendaMeta = (b: AgendaBill) => {
    if (b.recurring) return 'récurrent';
    return b.account;
  };

  return (
    <>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING }]}>
        <View style={styles.monthHeader}>
          <Pressable onPress={prevMonth} hitSlop={14} style={styles.navHit}>
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.monthTitles}>
            <Text style={styles.monthName}>{MONTHS_FR[month]}</Text>
            <Text style={styles.yearSub}>{year}</Text>
          </View>
          <Pressable onPress={nextMonth} hitSlop={14} style={styles.navHit}>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.insetGroupShadow}>
          <GlassContainer
            borderRadius={radius.xxl}
            padding={0}
            innerStyle={styles.insetGroupInner}
          >
            <View style={styles.dowRow}>
              {DAYS.map((d, i) => (
                <Text key={i} style={styles.dow}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((cell, i) => {
                if (!cell) {
                  return <View key={i} style={styles.cell} />;
                }
                const key = dateKey(year, month, cell.day);
                const calendarMark = calendarMarkForDate(key, billsByDate, actualPayDateKeys);
                const isToday = key === todayKey;
                const isSel = key === selectedKey;
                const past = key < todayKey;
                return (
                  <Pressable
                    key={i}
                    style={styles.cell}
                    onPress={() => setSelectedKey(isSel ? null : key)}
                  >
                    <View
                      style={[
                        styles.dayPlate,
                        isSel && styles.dayPlateSelected,
                        isToday && !isSel && styles.dayPlateToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          past && styles.dayPast,
                          isToday && styles.dayNumToday,
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {calendarMark === 'payActual' ? (
                        <Text style={styles.eventMarkPayActual}>$</Text>
                      ) : calendarMark ? (
                        <View
                          style={[
                            styles.eventMark,
                            calendarMark === 'income' && styles.eventMarkIncome,
                            calendarMark === 'mixed' && styles.eventMarkMixed,
                            calendarMark === 'payEstimate' && styles.eventMarkPayEstimate,
                          ]}
                        />
                      ) : (
                        <View style={styles.eventMarkSpacer} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassContainer>
        </View>

        {selBills && selBills.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {new Date(selectedKey! + 'T12:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            <GlassContainer borderRadius={radius.xxl} padding={0}>
              {selBills.map((b, idx) => (
                <Pressable
                  key={idx}
                  android_ripple={null}
                  onPress={() => onBillRowPress(b, selectedKey!)}
                  style={[styles.listRow, idx < selBills.length - 1 && styles.rowHairline]}
                >
                  <BillAvatar bill={b} size={34} />
                  <View style={styles.listRowMain}>
                    <Text style={styles.rowTitle}>{b.name}</Text>
                    <Text style={styles.rowMeta}>
                      {getAgendaMeta(b)}
                    </Text>
                    <AgendaBillBudgetHint bill={b} categoryBudget={resolveBillCategoryBudget(b)} />
                  </View>
                  <Text style={billAmountStyles(b, styles)}>
                    {b.amount.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    $
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
                </Pressable>
              ))}
            </GlassContainer>
          </View>
        ) : selectedKey ? (
          <Text style={styles.emptyDay}>Aucun paiement ce jour.</Text>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>À venir</Text>
            <GlassContainer borderRadius={radius.xxl} padding={0}>
              {upcomingFlat.map(({ key, b }, index) => (
                <Pressable
                  key={`${key}-${index}`}
                  android_ripple={null}
                  onPress={() => onBillRowPress(b, key)}
                  style={[styles.upcomingRow, index < upcomingFlat.length - 1 && styles.rowHairline]}
                >
                  <Text style={styles.rowDateCol}>
                    {new Date(key + 'T12:00:00').getDate()}
                    {'\n'}
                    <Text style={styles.rowDateMonth}>
                      {MONTHS_FR[new Date(key + 'T12:00:00').getMonth()].slice(0, 3)}
                    </Text>
                  </Text>
                  {shouldShowBillAvatar(b) ? <BillAvatar bill={b} size={34} /> : null}
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
                      {b.name}
                    </Text>
                    <AgendaBillBudgetHint bill={b} categoryBudget={resolveBillCategoryBudget(b)} />
                  </View>
                  <View style={styles.amountStack}>
                    <Text style={billAmountStyles(b, styles)}>
                      {b.amount.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      $
                    </Text>
                    {!b.recurring ? (
                      <Text style={styles.amountMeta} numberOfLines={1} ellipsizeMode="tail">
                        {b.account}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
                </Pressable>
              ))}
            </GlassContainer>
          </View>
        )}
      </ScrollView>

      <PaymentDetailSheet
        detail={paymentDetail}
        onClose={() => setPaymentDetail(null)}
        onDeleted={loadRecurringPayments}
      />
    </>
  );
});

function AgendaBillBudgetHint({
  bill,
  categoryBudget,
}: {
  bill: AgendaBill;
  categoryBudget: CategoryBudget | null;
}) {
  if (!categoryBudget || (bill.kind ?? 'payment') === 'income') return null;

  return (
    <CategoryBudgetProgress
      budget={{
        limitAmount: categoryBudget.limitAmount,
        spent: categoryBudget.spent,
        categoryColor: categoryBudget.categoryColor,
        categoryName: categoryBudget.categoryName,
      }}
      compactOverspendOnly
    />
  );
}

function BillAvatar({ bill, size }: { bill: AgendaBill; size: number }) {
  const icon = isIconName(bill.icon) && bill.icon !== 'repeat-outline'
    ? bill.icon
    : bill.kind === 'income' ? 'cash-outline' : 'receipt-outline';

  return (
    <UserPickedIconBadge icon={icon} color={bill.color} size={size} iconSize={17} logoUrl={bill.logoUrl} />
  );
}

function shouldShowBillAvatar(bill: AgendaBill) {
  return Boolean(bill.logoUrl || bill.kind === 'income' || (bill.icon && bill.icon !== 'repeat-outline'));
}

function isIconName(value?: string): value is IconName {
  return Boolean(value && value in Ionicons.glyphMap);
}

function createStyles(colors: AppColors, isLight: boolean) {
  return StyleSheet.create({
  scroll: {
    paddingBottom: spacing.md,
    paddingHorizontal: 0,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  navHit: {
    padding: spacing.sm,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitles: {
    alignItems: 'center',
    flex: 1,
  },
  monthName: {
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '600',
    letterSpacing: -0.35,
  },
  yearSub: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '700',
    marginTop: 2,
  },
  /** Calendrier style liste groupée iOS */
  insetGroupShadow: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surfaceSolid,
    ...(isLight
      ? {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 5,
        }
      : {}),
    marginBottom: spacing.xl,
  },
  insetGroupInner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  dow: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  dayPlate: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
  },
  dayPlateToday: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  dayPlateSelected: {
    backgroundColor: colors.blueMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  dayNum: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  dayNumToday: {
    fontWeight: '600',
    color: colors.text,
  },
  dayPast: { color: colors.textMuted, opacity: 0.62 },
  eventMark: {
    marginTop: 4,
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.warning,
    opacity: 0.85,
  },
  eventMarkIncome: {
    backgroundColor: colors.primary,
  },
  eventMarkPayEstimate: {
    backgroundColor: colors.success,
  },
  eventMarkPayActual: {
    marginTop: 0,
    height: 12,
    color: colors.success,
    fontSize: typography.micro,
    fontWeight: '800',
    lineHeight: 12,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  eventMarkMixed: {
    width: 16,
    backgroundColor: colors.primaryAlt,
  },
  eventMarkSpacer: { height: 6, marginTop: 4 },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.65,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowHairline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  listRowMain: { flex: 1, minWidth: 0, gap: spacing.xs },
  rowDateCol: {
    width: 44,
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: typography.caption + 2,
    textAlign: 'center',
  },
  rowDateMonth: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '700',
  },
  rowBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  rowTitle: { color: colors.text, fontSize: typography.body, fontWeight: '700', lineHeight: typography.body + 4 },
  rowMeta: { color: colors.textMuted, fontSize: typography.meta, lineHeight: typography.meta + 4, marginTop: 3 },
  rowAmt: { color: colors.text, fontSize: typography.body, fontWeight: '600', flexShrink: 0 },
  rowAmtPay: { color: colors.success },
  rowAmtRecurring: { color: colors.danger },
  amountStack: { alignItems: 'flex-end', flexShrink: 1, maxWidth: 128, minWidth: 82 },
  amountMeta: {
    color: colors.textMuted,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    marginTop: 3,
    maxWidth: '100%',
  },
  chevron: { opacity: 0.55, flexShrink: 0 },
  emptyDay: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  });
}
