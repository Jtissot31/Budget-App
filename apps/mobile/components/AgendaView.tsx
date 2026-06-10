import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardDateBadge } from '@/components/DashboardDateBadge';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { EXPENSE_DEFAULT_ICON } from '@/lib/expenseIcon';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import {
  FLOATING_NAV_CONTENT_PADDING,
  interBoldText,
  interExtraBoldText,
  interMediumText,
  radius,
  spacing,
  typography,
  type AppColors,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { listRowTitle, portfolioNumericText, rowValue, singleLineAmountProps } from '@/lib/textLayout';
import { UNIFORM_ACTION_BUTTON_MIN_HEIGHT, UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { dataEvents } from '@/lib/events';
import { getCategoryBudgets, getRecentIncomeTransactions, getRecurringPayments } from '@/lib/db';
import {
  ESTIMATED_PAYCHECK_LABEL,
  inferAllEstimatedPaychecksForRange,
  PAYCHECK_TRANSACTION_LOOKBACK_LIMIT,
} from '@/lib/estimatedPaycheck';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount } from '@/lib/formatDisplayMoney';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { resolvePaymentStatusBadge } from '@/lib/paymentStatusBadge';
import type { CategoryBudget, RecurringPayment, Transaction } from '@/types';

type AgendaViewProps = {
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

function resolveBillDisplayIcon(bill: AgendaBill) {
  if (isIconName(bill.icon) && bill.icon !== 'repeat-outline') return bill.icon;
  if (bill.kind === 'income' || isPayBill(bill)) return 'cash-outline';
  return EXPENSE_DEFAULT_ICON;
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

const SUBSCRIPTION_CATEGORY_PATTERN = /abonnement|subscription|loisir|divertissement|streaming/;

/** Heuristique d’affichage : range les paiements de type loisir/abonnement sous « Abonnements ». */
function isSubscriptionPayment(payment: RecurringPayment) {
  if ((payment.kind ?? 'payment') === 'income') return false;
  if (payment.categoryId === 'cat-fun') return true;
  return SUBSCRIPTION_CATEGORY_PATTERN.test(normalizeText(payment.categoryName));
}

function nextRecurringOccurrence(payment: RecurringPayment, from: Date) {
  const firstDate = parseIsoDay(payment.nextDate);
  if (!firstDate) return null;

  const endDate = parseIsoDay(payment.endDate);
  let index = 0;
  let occurrence = occurrenceDateAt(firstDate, payment.frequency, index);
  while (occurrence < from && index < 1200) {
    index += 1;
    occurrence = occurrenceDateAt(firstDate, payment.frequency, index);
  }
  if (occurrence < from) return null;
  if (endDate && occurrence > endDate) return null;
  return occurrence;
}

function formatRecurringListDate(date: Date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function recurringListMeta(payment: RecurringPayment, from: Date) {
  const parts: string[] = [];
  if (!payment.active) parts.push('Inactif');
  parts.push(frequencyLabel(payment.frequency));
  const next = payment.active ? nextRecurringOccurrence(payment, from) : null;
  if (next) parts.push(formatRecurringListDate(next));
  return parts.join(' · ');
}

function resolveRecurringListIcon(payment: RecurringPayment) {
  if (payment.icon?.trim() && payment.icon !== 'repeat-outline') return payment.icon;
  return (payment.kind ?? 'payment') === 'income' ? 'cash-outline' : EXPENSE_DEFAULT_ICON;
}

export const AgendaView = forwardRef<AgendaViewRef, AgendaViewProps>(function AgendaView({ onEditRecurring }, ref) {
  const today = useMemo(() => startOfToday(), []);
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [recentIncomeTransactions, setRecentIncomeTransactions] = useState<Transaction[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetailPayload | null>(null);
  const [showRecurringList, setShowRecurringList] = useState(false);

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
    const billsWithActualPay = mergeBillsByDate(baseBillsByDate, actualPayByDate);
    const allEstimates = inferAllEstimatedPaychecksForRange(
      recentIncomeTransactions,
      recurringPayments,
      today,
      rangeEnd,
      today,
    );
    const upcomingBillsByDate = filterEstimatedPayFromAgenda(
      mergeBillsByDate(
        billsWithActualPay,
        buildAllEstimatedPaysByDate(allEstimates, billsWithActualPay),
      ),
      recentIncomeTransactions,
      today,
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
      icon: b.icon ?? rp?.icon,
      color: b.color ?? rp?.color,
      frequencyLabel: rp ? frequencyLabel(rp.frequency) : null,
      frequency: rp?.frequency,
      active: rp?.active,
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

  const handleOpenRecurringList = () => {
    tapHaptic();
    setShowRecurringList(true);
  };

  const handleEditRecurring = (payment: RecurringPayment) => {
    tapHaptic();
    setShowRecurringList(false);
    onEditRecurring?.(payment);
  };

  const recurringListSections = useMemo(() => {
    const sortKey = (payment: RecurringPayment) => {
      const next = nextRecurringOccurrence(payment, today);
      return next ? dateKeyFromDate(next) : '9999-99-99';
    };
    const sorted = [...recurringPayments].sort(
      (a, b) => sortKey(a).localeCompare(sortKey(b)) || a.name.localeCompare(b.name, 'fr'),
    );
    return [
      { key: 'subscriptions', title: 'Abonnements', items: sorted.filter(isSubscriptionPayment) },
      {
        key: 'bills',
        title: 'Factures et paiements récurrents',
        items: sorted.filter(
          (payment) => (payment.kind ?? 'payment') !== 'income' && !isSubscriptionPayment(payment),
        ),
      },
      {
        key: 'incomes',
        title: 'Revenus récurrents',
        items: sorted.filter((payment) => (payment.kind ?? 'payment') === 'income'),
      },
    ].filter((section) => section.items.length > 0);
  }, [recurringPayments, today]);

  const renderAgendaPaymentCards = (
    items: { key: string; b: AgendaBill }[],
    variant: 'default' | 'upcoming' = 'default',
  ) => (
    <View style={styles.agendaPaymentList}>
      {items.map(({ key, b }, index) => (
        <AgendaPaymentCard
          key={`${key}-${index}-${b.sourceId ?? b.name}`}
          bill={b}
          dateKey={key}
          variant={variant}
          statusLabel={resolvePaymentStatusBadge(key, todayKey, {
            isIncome: (b.kind ?? 'payment') === 'income',
            isPay: isPayBill(b),
          })}
          todayKey={todayKey}
          onPress={() => onBillRowPress(b, key)}
          styles={styles}
          colors={colors}
          categoryBudget={resolveBillCategoryBudget(b)}
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
          <DashboardCard padding={0} innerStyle={styles.calendarInner}>
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
          </DashboardCard>
        </View>

        {onEditRecurring ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Liste des paiements récurrents"
            accessibilityHint="Affiche tous les abonnements, paiements et revenus récurrents pour les modifier"
            onPress={handleOpenRecurringList}
            style={({ pressed }) => [
              styles.premiumAddCta,
              {
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
                borderColor: colors.borderStrong,
              },
              pressed && floatingGlassButtonPressed,
            ]}
          >
            <Ionicons name="repeat-outline" size={22} color={colors.textSecondary} />
            <Text style={[styles.premiumAddCtaLabel, { color: colors.text }]}>
              Liste des paiements récurrents
            </Text>
          </Pressable>
        ) : null}

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
              <View style={styles.agendaPaymentList}>
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
                          variant="upcoming"
                          statusLabel={resolvePaymentStatusBadge(key, todayKey, {
                            isIncome: (b.kind ?? 'payment') === 'income',
                            isPay: isPayBill(b),
                          })}
                          todayKey={todayKey}
                          onPress={() => onBillRowPress(b, key)}
                          styles={styles}
                          colors={colors}
                          categoryBudget={resolveBillCategoryBudget(b)}
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

      <Modal
        visible={showRecurringList}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecurringList(false)}
      >
        <View style={[styles.pickerBackdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Fermer la liste des paiements récurrents"
            onPress={() => setShowRecurringList(false)}
          />
          <View
            style={[
              styles.pickerSheet,
              styles.recurringListSheet,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={[styles.pickerHandle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Paiements récurrents</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                hitSlop={12}
                onPress={() => setShowRecurringList(false)}
                style={[styles.pickerClose, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <Ionicons name="close" size={19} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.pickerSubtitle, { color: colors.textMuted }]}>
              Touche un élément pour le modifier.
            </Text>
            {recurringListSections.length ? (
              <ScrollView
                style={styles.recurringListScroll}
                contentContainerStyle={styles.recurringListContent}
                showsVerticalScrollIndicator={false}
              >
                {recurringListSections.map((section) => (
                  <View key={section.key} style={styles.recurringListSection}>
                    <DashboardSectionLabel>{section.title}</DashboardSectionLabel>
                    <View style={styles.recurringListItems}>
                      {section.items.map((payment) => {
                        const isIncome = (payment.kind ?? 'payment') === 'income';
                        return (
                          <Pressable
                            key={payment.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Modifier ${payment.name}`}
                            onPress={() => handleEditRecurring(payment)}
                            style={({ pressed }) => [
                              styles.pickerRow,
                              {
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.border,
                              },
                              !payment.active && styles.recurringListRowInactive,
                              pressed && styles.pickerRowPressed,
                            ]}
                          >
                            <UserPickedIconWell
                              icon={resolveRecurringListIcon(payment)}
                              color={payment.color}
                              size={44}
                              logoUrl={payment.logoUrl?.trim() || getMerchantLogoUrl(payment.name)}
                              wellGlyphWhite
                            />
                            <View style={styles.pickerCopy}>
                              <Text
                                style={[styles.pickerLabel, { color: colors.text }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {payment.name}
                              </Text>
                              <Text
                                style={[styles.pickerDescription, { color: colors.textMuted }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {recurringListMeta(payment, today)}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.recurringListAmount,
                                isIncome
                                  ? styles.agendaPaymentAmountIncome
                                  : styles.agendaPaymentAmountRecurring,
                              ]}
                              {...singleLineAmountProps}
                            >
                              {formatRecurringPaymentAmount(payment.amount, payment.kind ?? 'payment')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.recurringListEmpty}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="repeat-outline" size={22} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Aucun élément récurrent</Text>
                <Text style={styles.emptyHint}>
                  Utilise le bouton + pour ajouter un abonnement, une facture ou un revenu récurrent.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

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

function AgendaPaymentCard({
  bill,
  dateKey,
  variant = 'default',
  statusLabel,
  todayKey,
  onPress,
  styles,
  colors,
  categoryBudget,
}: {
  bill: AgendaBill;
  dateKey: string;
  variant?: 'default' | 'upcoming';
  statusLabel: string;
  todayKey: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
  categoryBudget: CategoryBudget | null;
}) {
  const isIncome = isPayBill(bill) || bill.kind === 'income';
  const badgeVariant =
    dateKey > todayKey ? 'upcoming' : statusLabel === 'REÇU' ? 'received' : 'paid';
  const showIncomeCheck = isIncome;
  const displayLogoUrl = resolveBillDisplayLogo(bill);
  const displayIcon = resolveBillDisplayIcon(bill);
  const displayTint = bill.color ?? (isIncome ? colors.success : colors.warning);

  return (
    <Pressable onPress={onPress} android_ripple={null}>
      <DashboardCard style={styles.agendaPaymentCard}>
        <UserPickedIconWell
          icon={displayIcon}
          color={displayTint}
          size={48}
          logoUrl={displayLogoUrl}
          wellGlyphWhite={Boolean(bill.recurring)}
          style={styles.agendaPaymentAvatar}
        />
        <View style={styles.agendaPaymentCopy}>
          <Text style={styles.agendaPaymentTitle} numberOfLines={2} ellipsizeMode="tail">
            {bill.name}
          </Text>
          <View style={styles.agendaPaymentMetaRow}>
            {showIncomeCheck ? (
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            ) : null}
            <Text style={styles.agendaPaymentMeta} numberOfLines={1} ellipsizeMode="tail">
              {getPaymentCardMeta(bill)}
            </Text>
          </View>
          <AgendaBillBudgetHint bill={bill} categoryBudget={categoryBudget} />
        </View>
        <View style={styles.agendaPaymentAmountBlock}>
          <View
            style={[
              styles.agendaPaymentBadge,
              badgeVariant === 'received' && styles.agendaPaymentBadgeReceived,
              badgeVariant === 'paid' && styles.agendaPaymentBadgePaid,
              badgeVariant === 'upcoming' && (isIncome ? styles.agendaPaymentBadgeUpcomingIncome : styles.agendaPaymentBadgeUpcoming),
            ]}
          >
            <Text
              style={[
                styles.agendaPaymentBadgeText,
                badgeVariant === 'received' && styles.agendaPaymentBadgeTextReceived,
                badgeVariant === 'paid' && styles.agendaPaymentBadgeTextPaid,
                badgeVariant === 'upcoming' && (isIncome ? styles.agendaPaymentBadgeTextUpcomingIncome : styles.agendaPaymentBadgeTextUpcoming),
              ]}
            >
              {statusLabel}
            </Text>
          </View>
          <Text
            style={[
              styles.agendaPaymentAmount,
              isPayBill(bill) && styles.agendaPaymentAmountIncome,
              isRecurringExpenseBill(bill) && styles.agendaPaymentAmountRecurring,
            ]}
            {...singleLineAmountProps}
          >
            {bill.recurring
              ? formatRecurringPaymentAmount(bill.amount, bill.kind ?? 'payment')
              : formatDisplayMoneyAbsolute(bill.amount)}
          </Text>
        </View>
      </DashboardCard>
    </Pressable>
  );
}

function isIconName(value?: string): value is IconName {
  return Boolean(value && value in Ionicons.glyphMap);
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  navHit: {
    padding: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitles: {
    alignItems: 'center',
    flex: 1,
  },
  monthName: {
    ...interBoldText,
    color: colors.text,
    fontSize: typography.screenTitle,
    letterSpacing: -0.35,
  },
  yearSub: {
    color: colors.textMuted,
    fontSize: typography.meta,
    fontWeight: '700',
    marginTop: 2,
  },
  insetGroupShadow: {
    marginBottom: spacing.xl,
  },
  calendarInner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
  },
  dayPlateToday: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
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
    color: colors.primary,
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
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
    marginTop: spacing.xl,
  },
  sectionHeaderBlock: {
    minHeight: UNIFORM_SECTION_HEADER_MIN_HEIGHT,
  },
  sectionEyebrow: {
    marginBottom: spacing.xs,
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
  agendaPaymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  agendaPaymentAvatar: {
    flexShrink: 0,
  },
  agendaPaymentCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  agendaPaymentTitle: {
    ...listRowTitle,
    fontSize: 13,
    color: colors.text,
  },
  agendaPaymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  agendaPaymentMeta: {
    ...interMediumText,
    fontSize: typography.micro,
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
  },
  agendaPaymentAmountBlock: {
    alignItems: 'flex-end',
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
  agendaPaymentBadge: {
    marginBottom: spacing.xs,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  agendaPaymentBadgeUpcoming: {
    backgroundColor: 'rgba(230,160,0,0.14)',
  },
  agendaPaymentBadgeUpcomingIncome: {
    backgroundColor: 'rgba(0,230,100,0.1)',
  },
  agendaPaymentBadgePaid: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  agendaPaymentBadgeReceived: {
    backgroundColor: 'rgba(0,230,100,0.1)',
  },
  agendaPaymentBadgeText: {
    ...interMediumText,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  agendaPaymentBadgeTextUpcoming: {
    color: colors.warning,
  },
  agendaPaymentBadgeTextUpcomingIncome: {
    color: colors.success,
  },
  agendaPaymentBadgeTextPaid: {
    color: colors.textMuted,
  },
  agendaPaymentBadgeTextReceived: {
    color: colors.success,
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
  premiumAddCta: {
    marginBottom: spacing.md,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  premiumAddCtaLabel: {
    ...typographyKit.bodyBold,
    letterSpacing: 0.15,
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pickerTitle: {
    flex: 1,
    ...interExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  pickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSubtitle: {
    ...interMediumText,
    fontSize: typography.meta,
    lineHeight: 17,
  },
  recurringListSheet: {
    maxHeight: '82%',
  },
  recurringListScroll: {
    flexGrow: 0,
  },
  recurringListContent: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  recurringListSection: {
    gap: spacing.sm,
  },
  recurringListItems: {
    gap: spacing.sm,
  },
  recurringListRowInactive: {
    opacity: 0.58,
  },
  recurringListAmount: {
    ...rowValue,
    flexShrink: 0,
    textAlign: 'right',
  },
  recurringListEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: UNIFORM_ACTION_BUTTON_MIN_HEIGHT,
  },
  pickerRowPressed: {
    opacity: 0.78,
  },
  pickerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pickerLabel: {
    ...interBoldText,
    fontSize: typography.body,
  },
  pickerDescription: {
    ...interMediumText,
    fontSize: typography.micro,
    lineHeight: 15,
  },
  });
}
