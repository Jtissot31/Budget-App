import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { MonthSelector } from '@/components/MonthSelector';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardDateBadge } from '@/components/DashboardDateBadge';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  FLOATING_NAV_CONTENT_PADDING,
  radius,
  spacing,
  typography,
  type AppColors,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { portfolioNumericText, rowValue } from '@/lib/textLayout';
import { UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { dataEvents } from '@/lib/events';
import { getEarliestExpenseMonthStart, getLoans, getRecentIncomeTransactions, getRecurringPayments } from '@/lib/db';
import {
  ESTIMATED_PAYCHECK_LABEL,
  inferAllEstimatedPaychecksForRange,
  PAYCHECK_TRANSACTION_LOOKBACK_LIMIT,
} from '@/lib/estimatedPaycheck';
import { tapHaptic } from '@/lib/haptics';
import { isMonthAfter, startOfMonth } from '@/lib/budgetMonth';
import { useAppTheme } from '@/lib/themeContext';
import { PaymentListRow, type PaymentListRowBadgeVariant } from '@/components/PaymentListRow';
import { TransactionAmountLabel, recurringPaymentAmountDirection } from '@/components/TransactionAmountLabel';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount } from '@/lib/formatDisplayMoney';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { resolvePaymentStatusBadge } from '@/lib/paymentStatusBadge';
import {
  buildLoanByRecurringPaymentId,
  resolveAgendaBillDisplayIcon,
} from '@/lib/recurringPaymentPresentation';
import type { Loan, RecurringPayment, Transaction } from '@/types';

type AgendaViewProps = {
  headerComponent?: ReactNode;
  onEditRecurring?: (payment: RecurringPayment) => void;
};

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

export type AgendaViewRef = {
  resetToTop: () => void;
};

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const PAY_LABEL = ESTIMATED_PAYCHECK_LABEL;

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

const UPCOMING_WINDOW_DAYS = 30;
const INCOME_TRANSACTION_LOOKBACK_LIMIT = PAYCHECK_TRANSACTION_LOOKBACK_LIMIT;
/** Jours avant/après la date estimée pour associer un vrai dépôt de paie à ce cycle. */
const ESTIMATED_PAY_CONFIRMED_WINDOW_BEFORE_DAYS = 5;
const ESTIMATED_PAY_CONFIRMED_WINDOW_AFTER_DAYS = 3;
/** Après cette date + N jours sans dépôt confirmé dans la fenêtre, retirer l’estimation de l’agenda. */
const ESTIMATED_PAY_HIDE_AFTER_DAYS = 3;
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

function mergeBillsByDate(...sources: Record<string, AgendaBill[]>[]) {
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

function isActualPayTransaction(transaction: Transaction) {
  const text = getTransactionSearchText(transaction);
  return transaction.type === 'income'
    && transaction.amount > 0
    && hasPayKeyword(text)
    && !hasExcludedIncomeKeyword(text);
}

function isEstimatedPayBill(bill: AgendaBill) {
  return (
    bill.sourceId === 'estimated-pay' ||
    bill.sourceId?.startsWith('estimated-pay-') === true ||
    bill.name === PAY_LABEL
  );
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

function formatAgendaUpcomingDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

function resolveBillDisplayLogo(bill: AgendaBill) {
  const storedLogo = bill.logoUrl?.trim();
  if (storedLogo) return storedLogo;
  if (bill.recurring || bill.sourceId) return getMerchantLogoUrl(bill.name);
  return null;
}

function resolveBillDisplayIcon(
  bill: AgendaBill,
  loanByRecurringPaymentId: Map<string, Loan>,
) {
  return resolveAgendaBillDisplayIcon(bill, loanByRecurringPaymentId, {
    isPayBill: (item) => isPayBill(item as AgendaBill),
  });
}

function getPaymentCardMeta(bill: AgendaBill) {
  return bill.account;
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

function buildAllEstimatedPaysByDate(
  estimates: ReturnType<typeof inferAllEstimatedPaychecksForRange>,
  existingBillsByDate: Record<string, AgendaBill[]>,
): Record<string, AgendaBill[]> {
  if (estimates.length === 0) return {};

  const billsByDate: Record<string, AgendaBill[]> = {};
  estimates.forEach((estimate) => {
    const existingOnDate = existingBillsByDate[estimate.dateKey] ?? [];
    if (existingOnDate.some((bill) => bill.kind === 'income')) return;

    const bill: AgendaBill = {
      name: PAY_LABEL,
      amount: estimate.amount,
      account: 'Dépôt',
      recurring: true,
      kind: 'income',
      sourceId: `estimated-pay-${estimate.dateKey}`,
    };
    billsByDate[estimate.dateKey] = [...(billsByDate[estimate.dateKey] ?? []), bill];
  });
  return billsByDate;
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

function resolveAgendaBillStatusLabel(
  dateKey: string,
  todayKey: string,
  bill: AgendaBill,
  transactions: Transaction[],
) {
  const estimated = isEstimatedPayBill(bill);
  return resolvePaymentStatusBadge(dateKey, todayKey, {
    isIncome: !estimated && (bill.kind ?? 'payment') === 'income',
    isPay: !estimated && isPayBill(bill),
    isEstimatedPay: estimated,
    hasConfirmedIncome: estimated && hasConfirmedPayInEstimateWindow(dateKey, transactions),
  });
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

/** Liste « À venir » : pas de dépôts de paie estimés — revenus/paiements récurrents uniquement. */
function excludeEstimatedPayFromBillsByDate(billsByDate: Record<string, AgendaBill[]>) {
  const next: Record<string, AgendaBill[]> = {};
  Object.entries(billsByDate).forEach(([key, bills]) => {
    const filtered = bills.filter((bill) => !isEstimatedPayBill(bill));
    if (filtered.length) next[key] = filtered;
  });
  return next;
}

/**
 * Marqueurs du calendrier, indépendants, pour distinguer dépôts réels et estimés :
 * - `hasConfirmedPay` : un vrai dépôt de paie enregistré ce jour (revenu réel, non estimé) → signe `$` en haut à droite.
 * - `hasEstimatedPay` : un dépôt de paie estimé non encore reçu → ligne verte sous le chiffre (masquée si déjà confirmé).
 * - `hasPayment` : un ou plusieurs paiements (dépense) ce jour → une seule ligne orange (sous la verte).
 * Les deux lignes peuvent coexister : un paiement saisi un jour de paie n'est jamais masqué.
 */
function calendarDayMarkers(dateKey: string, billsByDate: Record<string, AgendaBill[]>) {
  const items = billsByDate[dateKey];
  if (!items?.length) {
    return { hasConfirmedPay: false, hasEstimatedPay: false, hasPayment: false };
  }

  const hasConfirmedPay = items.some(
    (item) => (item.kind === 'income' || isPayBill(item)) && !isEstimatedPayBill(item),
  );
  const hasEstimatedPay = items.some(isEstimatedPayBill);
  const hasPayment = items.some((item) => (item.kind ?? 'payment') !== 'income');
  return { hasConfirmedPay, hasEstimatedPay, hasPayment };
}

export const AgendaView = forwardRef<AgendaViewRef, AgendaViewProps>(function AgendaView({ headerComponent, onEditRecurring }, ref) {
  const today = useMemo(() => startOfToday(), []);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [recentIncomeTransactions, setRecentIncomeTransactions] = useState<Transaction[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetailPayload | null>(null);
  const [earliestMonth, setEarliestMonth] = useState(() => startOfMonth(today));

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const viewMonth = useMemo(() => new Date(year, month, 1), [month, year]);
  const agendaEarliest = startOfMonth(earliestMonth);
  const canGoAgendaPrevious = isMonthAfter(viewMonth, agendaEarliest);
  const canGoAgendaNext = true;

  const loadRecurringPayments = useCallback(async () => {
    const [payments, incomeTransactions, loadedLoans] = await Promise.all([
      getRecurringPayments(),
      getRecentIncomeTransactions(INCOME_TRANSACTION_LOOKBACK_LIMIT),
      getLoans(),
    ]);
    setRecurringPayments(payments);
    setRecentIncomeTransactions(incomeTransactions);
    setLoans(loadedLoans);
  }, []);

  const loanByRecurringPaymentId = useMemo(
    () => buildLoanByRecurringPaymentId(loans),
    [loans],
  );

  useEffect(() => {
    void loadRecurringPayments();
  }, [loadRecurringPayments]);

  useEffect(() => {
    void (async () => {
      const dbEarliest = await getEarliestExpenseMonthStart();
      setEarliestMonth(dbEarliest);
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = dataEvents.subscribe(() => {
      void loadRecurringPayments();
    });
    return () => {
      unsubscribe();
    };
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
    const weekCount = Math.ceil((offset + dim) / 7);
    const total = weekCount * 7;
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
    const allEstimates = inferAllEstimatedPaychecksForRange(
      recentIncomeTransactions,
      recurringPayments,
      visibleStart,
      visibleEnd,
      today,
    );
    const withEstimate = mergeBillsByDate(
      billsWithActualPay,
      buildAllEstimatedPaysByDate(allEstimates, billsWithActualPay),
    );
    return filterEstimatedPayFromAgenda(withEstimate, recentIncomeTransactions, today);
  }, [recentIncomeTransactions, recurringPayments, today, visibleEnd, visibleStart]);

  const prevMonth = () => {
    if (!canGoAgendaPrevious) return;
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelectedKey(null);
  };

  const nextMonth = () => {
    if (!canGoAgendaNext) return;
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelectedKey(null);
  };

  const upcoming = useMemo(() => {
    const rangeEnd = addDays(today, UPCOMING_WINDOW_DAYS);
    const rangeEndKey = dateKey(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
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
    const upcomingBillsByDate = excludeEstimatedPayFromBillsByDate(
      mergeBillsByDate(baseBillsByDate, actualPayByDate),
    );

    return Object.entries(upcomingBillsByDate)
      .filter(([k]) => k >= todayKey && k <= rangeEndKey)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [recentIncomeTransactions, recurringPayments, today, todayKey]);

  const upcomingCount = useMemo(
    () => upcoming.reduce((acc, [, bills]) => acc + bills.length, 0),
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
      logoUrl: resolveBillDisplayLogo(b),
      icon: resolveBillDisplayIcon(b, loanByRecurringPaymentId),
      color: b.color ?? rp?.color,
      frequencyLabel: rp ? frequencyLabel(rp.frequency) : null,
      frequency: rp?.frequency,
      active: rp?.active,
      categoryName: rp?.categoryName ?? null,
      categoryId: rp?.categoryId ?? null,
    });
  };

  /** Ouvre la fiche détail ; édition/suppression via les boutons du sheet. */
  const onBillRowPress = (b: AgendaBill, dateKey: string) => {
    tapHaptic();
    openBillDetail(b, dateKey);
  };

  const renderAgendaPaymentCards = (items: { key: string; b: AgendaBill }[]) => (
    <View style={styles.agendaPaymentList}>
      {items.map(({ key, b }, index) => (
        <AgendaPaymentCard
          key={`${key}-${index}-${b.sourceId ?? b.name}`}
          bill={b}
          dateKey={key}
          statusLabel={resolveAgendaBillStatusLabel(key, todayKey, b, recentIncomeTransactions)}
          todayKey={todayKey}
          onPress={() => onBillRowPress(b, key)}
          styles={styles}
          colors={colors}
          loanByRecurringPaymentId={loanByRecurringPaymentId}
        />
      ))}
    </View>
  );

  const scrollBottomPadding = insets.bottom + FLOATING_NAV_CONTENT_PADDING;

  return (
    <>
      <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
      >
        {headerComponent}
        <View style={styles.agendaContentAfterHeader}>
          <DashboardCard
            padding={0}
            style={styles.calendarCard}
            innerStyle={styles.calendarCardInner}
          >
            <MonthSelector
              month={viewMonth}
              onPrevious={prevMonth}
              onNext={nextMonth}
              canGoPrevious={canGoAgendaPrevious}
              canGoNext={canGoAgendaNext}
            />
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
                const { hasConfirmedPay, hasEstimatedPay, hasPayment } = calendarDayMarkers(
                  key,
                  billsByDate,
                );
                const showEstimatedLine = hasEstimatedPay && !hasConfirmedPay;
                const isToday = key === todayKey;
                const isSel = key === selectedKey;
                const past = key < todayKey;
                return (
                  <Pressable
                    key={i}
                    style={styles.cell}
                    onPress={() => setSelectedKey(isSel ? null : key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                  >
                    <View
                      style={[
                        styles.dayPlate,
                        isSel && styles.dayPlateSelected,
                        isToday && !isSel && styles.dayPlateToday,
                      ]}
                    >
                      {hasConfirmedPay ? (
                        <Text style={styles.confirmedPayMark}>$</Text>
                      ) : null}
                      <Text
                        style={[
                          styles.dayNum,
                          past && styles.dayPast,
                          isToday && styles.dayNumToday,
                          isSel && styles.dayNumSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {showEstimatedLine || hasPayment ? (
                        <View style={styles.markStack}>
                          {showEstimatedLine ? (
                            <View style={[styles.markBar, styles.markBarPay]} />
                          ) : null}
                          {hasPayment ? (
                            <View style={[styles.markBar, styles.markBarPayment]} />
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.eventMarkSpacer} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </DashboardCard>
        </View>

        <View style={styles.calendarLegend}>
          <View style={styles.calendarLegendItem}>
            <View style={[styles.markBar, styles.markBarPayment]} />
            <Text style={styles.calendarLegendLabel}>Paiement</Text>
          </View>
          <View style={styles.calendarLegendItem}>
            <View style={[styles.markBar, styles.markBarPay]} />
            <Text style={styles.calendarLegendLabel}>Jour de paie estimé</Text>
          </View>
          <View style={styles.calendarLegendItem}>
            <Text style={styles.calendarLegendPayMark}>$</Text>
            <Text style={styles.calendarLegendLabel}>Dépôt de revenu confirmé</Text>
          </View>
        </View>

        {selBills && selBills.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderBlock}>
              <View style={styles.sectionLabelRow}>
                <DashboardDateBadge dateKey={selectedKey!} />
                <Text style={styles.sectionTitle} numberOfLines={2} ellipsizeMode="tail">
                  {new Date(selectedKey! + 'T12:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
              </View>
            </View>
            {renderAgendaPaymentCards(selBills.map((b) => ({ key: selectedKey!, b })))}
          </View>
        ) : selectedKey ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderBlock}>
              <View style={styles.sectionLabelRow}>
                <DashboardDateBadge dateKey={selectedKey} />
                <Text style={styles.sectionTitle} numberOfLines={2} ellipsizeMode="tail">
                  {new Date(selectedKey + 'T12:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
              </View>
            </View>
            <DashboardCard padding={spacing.lg} innerStyle={styles.emptyCardInner}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Aucun paiement ce jour.</Text>
            </DashboardCard>
          </View>
        ) : (
          <View style={styles.section}>
            <DashboardSectionLabel style={styles.sectionEyebrow}>À venir</DashboardSectionLabel>
            {upcomingCount > 0 ? (
              <View style={styles.upcomingGroupsList}>
                {upcoming.map(([key, bills]) => (
                  <View key={key} style={styles.upcomingGroup}>
                    <View style={styles.upcomingGroupHeader}>
                      <Text style={styles.upcomingGroupDate}>
                        {formatAgendaUpcomingDate(key)}
                      </Text>
                    </View>
                    <View style={styles.upcomingGroupItems}>
                      {bills.map((b, index) => (
                        <AgendaPaymentCard
                          key={`${key}-${index}-${b.sourceId ?? b.name}`}
                          bill={b}
                          dateKey={key}
                          statusLabel={resolveAgendaBillStatusLabel(
                            key,
                            todayKey,
                            b,
                            recentIncomeTransactions,
                          )}
                          todayKey={todayKey}
                          onPress={() => onBillRowPress(b, key)}
                          styles={styles}
                          colors={colors}
                          loanByRecurringPaymentId={loanByRecurringPaymentId}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <DashboardCard padding={spacing.lg} innerStyle={styles.emptyCardInner}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Rien de prévu</Text>
                <Text style={styles.emptyHint}>Les prochains 30 jours apparaîtront ici.</Text>
              </DashboardCard>
            )}
          </View>
        )}

      </ScrollView>
      </View>

      <PaymentDetailSheet
        detail={paymentDetail}
        onClose={() => setPaymentDetail(null)}
        onDeleted={loadRecurringPayments}
      />
    </>
  );
});

function resolveAgendaPaymentBadgeVariant(
  dateKey: string,
  todayKey: string,
  statusLabel: string,
  isIncome: boolean,
): PaymentListRowBadgeVariant {
  if (dateKey > todayKey) {
    return isIncome ? 'upcomingIncome' : 'upcoming';
  }
  if (statusLabel === 'REÇU') return 'received';
  if (statusLabel === 'ESTIMÉ' || statusLabel === "AUJOURD'HUI") {
    return isIncome ? 'upcomingIncome' : 'upcoming';
  }
  return 'paid';
}

function AgendaPaymentCard({
  bill,
  dateKey,
  statusLabel,
  todayKey,
  onPress,
  styles,
  colors,
  loanByRecurringPaymentId,
}: {
  bill: AgendaBill;
  dateKey: string;
  statusLabel: string;
  todayKey: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
  loanByRecurringPaymentId: Map<string, Loan>;
}) {
  const isIncome = isPayBill(bill) || bill.kind === 'income';
  const badgeVariant = resolveAgendaPaymentBadgeVariant(dateKey, todayKey, statusLabel, isIncome);
  const displayLogoUrl = resolveBillDisplayLogo(bill);
  const displayIcon = resolveBillDisplayIcon(bill, loanByRecurringPaymentId);
  const displayTint = bill.color ?? (isIncome ? colors.success : colors.warning);

  return (
    <PaymentListRow
      onPress={onPress}
      avatar={
        <UserPickedIconWell
          icon={displayIcon}
          color={displayTint}
          size={48}
          logoUrl={displayLogoUrl}
          wellGlyphWhite={Boolean(bill.recurring) && !isIncome}
          style={styles.agendaPaymentAvatar}
        />
      }
      title={bill.name}
      meta={getPaymentCardMeta(bill)}
      statusBadge={{ label: statusLabel, variant: badgeVariant }}
      amount={
        <TransactionAmountLabel
          amount={
            bill.recurring
              ? formatRecurringPaymentAmount(bill.amount, bill.kind ?? 'payment')
              : formatDisplayMoneyAbsolute(bill.amount)
          }
          direction={
            isIncome
              ? 'income'
              : bill.recurring || isRecurringExpenseBill(bill)
                ? recurringPaymentAmountDirection(bill.kind ?? 'payment')
                : 'neutral'
          }
          color={isIncome ? colors.success : colors.text}
          textStyle={[
            styles.agendaPaymentAmount,
            isPayBill(bill) && styles.agendaPaymentAmountIncome,
            isRecurringExpenseBill(bill) && styles.agendaPaymentAmountRecurring,
          ]}
        />
      }
    />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: spacing.md,
    paddingHorizontal: 0,
    backgroundColor: colors.background,
  },
  agendaContentAfterHeader: {
    marginTop: 20,
  },
  calendarCard: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: 3.5,
  },
  calendarCardInner: {
    gap: spacing.md,
    overflow: 'hidden',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 0,
  },
  dayPlate: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
  },
  dayPlateToday: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.text,
  },
  dayPlateSelected: {
    backgroundColor: colors.scopeActive,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dayNum: {
    ...portfolioNumericText,
    color: colors.text,
    fontSize: typography.caption,
  },
  dayNumToday: {
    ...portfolioNumericText,
    color: colors.text,
    fontSize: typography.caption,
  },
  dayNumSelected: {
    ...portfolioNumericText,
    color: colors.text,
    fontSize: typography.caption,
  },
  dayPast: { color: colors.textMuted, opacity: 0.62 },
  confirmedPayMark: {
    ...portfolioNumericText,
    position: 'absolute',
    top: 2,
    right: 3,
    color: colors.success,
    fontSize: typography.micro,
    lineHeight: typography.micro + 1,
    includeFontPadding: false,
  },
  markStack: {
    marginTop: 4,
    alignItems: 'center',
    gap: 2,
  },
  markBar: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  markBarPay: {
    backgroundColor: colors.success,
  },
  markBarPayment: {
    backgroundColor: colors.warning,
  },
  eventMarkSpacer: { height: 8, marginTop: 4 },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    marginTop: spacing.md,
  },
  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  calendarLegendLabel: {
    ...typographyKit.metaMedium,
    color: colors.textMuted,
  },
  calendarLegendPayMark: {
    ...portfolioNumericText,
    width: 16,
    textAlign: 'center',
    color: colors.success,
    fontSize: typography.micro,
    lineHeight: typography.micro + 1,
    includeFontPadding: false,
  },
  section: {
    gap: spacing.md,
    marginTop: 28,
  },
  sectionHeaderBlock: {
    minHeight: UNIFORM_SECTION_HEADER_MIN_HEIGHT,
  },
  sectionEyebrow: {
    marginBottom: spacing.xs,
    letterSpacing: 1.5,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  sectionTitle: {
    ...typographyKit.sectionTitle,
    flex: 1,
    minWidth: 0,
    color: colors.text,
    textTransform: 'capitalize',
  },
  agendaPaymentList: {
    gap: spacing.md,
  },
  upcomingGroupsList: {
    gap: 26,
  },
  upcomingGroup: {
    gap: spacing.sm,
  },
  upcomingGroupHeader: {
    minHeight: UNIFORM_SECTION_HEADER_MIN_HEIGHT,
    justifyContent: 'center',
    paddingBottom: spacing.xs,
  },
  upcomingGroupDate: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  upcomingGroupItems: {
    gap: spacing.md,
  },
  agendaPaymentAvatar: {
    flexShrink: 0,
  },
  agendaPaymentAmount: {
    ...rowValue,
    color: colors.text,
    textAlign: 'right',
  },
  agendaPaymentAmountIncome: {
    color: colors.success,
  },
  agendaPaymentAmountRecurring: {
    color: colors.danger,
  },
  emptyCardInner: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typographyKit.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.caption + 6,
    textAlign: 'center',
  },
  });
}
