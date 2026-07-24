import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Platform, Pressable, StyleSheet, Text, View, ScrollView, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { AgendaPaymentRow } from '@/components/AgendaPaymentRow';
import { AgendaCashHeroCard } from '@/components/AgendaCashHeroCard';
import { DashboardCard } from '@/components/DashboardCard';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  screenHorizontalGutter,
  spacing,
  type AppColors,
} from '@/constants/theme';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { computeAvailableCashToday } from '@/lib/availableCashToday';
import { dataEvents } from '@/lib/events';
import {
  getEarliestExpenseMonthStart,
  getLoans,
  getRecentIncomeTransactions,
  getRecurringPayments,
  getSimulatedAccounts,
} from '@/lib/db';
import {
  ESTIMATED_PAYCHECK_LABEL,
  inferAllEstimatedPaychecksForRange,
  PAYCHECK_TRANSACTION_LOOKBACK_LIMIT,
  resolveNextPaycheckForAccount,
} from '@/lib/estimatedPaycheck';
import { tapHaptic } from '@/lib/haptics';
import { isMonthAfter, startOfMonth } from '@/lib/budgetMonth';
import { useAppTheme } from '@/lib/themeContext';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { resolvePaymentStatusBadge } from '@/lib/paymentStatusBadge';
import {
  buildLoanByRecurringPaymentId,
  resolveAgendaBillDisplayIcon,
} from '@/lib/recurringPaymentPresentation';
import type { Loan, RecurringPayment, SimulatedAccount, Transaction } from '@/types';

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
const PAY_DISPLAY_LABEL = 'Paie estimée';
type AgendaViewMode = 'list' | 'calendar';

type AgendaUpcomingSection = {
  titleBold: string;
  titleSuffix?: string;
  items: Array<{ bill: AgendaBill; dateKey: string }>;
};

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

const UPCOMING_WINDOW_DAYS = 31;
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

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveBillDisplayLogo(bill: AgendaBill) {
  const storedLogo = bill.logoUrl?.trim();
  if (storedLogo) return storedLogo;
  if (bill.recurring || bill.sourceId) return getMerchantLogoUrl(bill.name);
  return null;
}

function formatAgendaShortDate(dateKey: string) {
  const date = parseIsoDay(dateKey);
  if (!date) return dateKey;
  const weekday = date
    .toLocaleDateString('fr-FR', { weekday: 'short' })
    .replace(/\.$/, '')
    .toLowerCase();
  const day = date.getDate();
  const month = date.toLocaleDateString('fr-FR', { month: 'short' }).replace(/\.$/, '');
  const dayLabel = day === 1 ? '1er' : String(day);
  return `${capitalizeFirst(weekday)}. ${dayLabel} ${month}`;
}

function formatAgendaFullDate(dateKey: string) {
  const date = parseIsoDay(dateKey);
  if (!date) return dateKey;
  const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('fr-FR', { month: 'long' });
  const dayLabel = day === 1 ? '1er' : String(day);
  return `${capitalizeFirst(weekday)} ${dayLabel} ${month}`;
}

function formatAgendaSectionSuffix(dateKey: string) {
  return ` · ${formatAgendaShortDate(dateKey).toLowerCase()}`;
}

function endOfWeek(date: Date) {
  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  return addDays(date, daysUntilSunday);
}

function groupUpcomingIntoSections(
  upcoming: Array<[string, AgendaBill[]]>,
  todayKey: string,
): AgendaUpcomingSection[] {
  const today = parseIsoDay(todayKey);
  if (!today || upcoming.length === 0) return [];

  const tomorrow = addDays(today, 1);
  const tomorrowKey = dateKeyFromDate(tomorrow);
  const weekEnd = endOfWeek(today);
  const nextWeekStart = addDays(weekEnd, 1);
  const nextWeekEnd = addDays(nextWeekStart, 6);

  const tomorrowItems: AgendaUpcomingSection['items'] = [];
  const thisWeekItems: AgendaUpcomingSection['items'] = [];
  const nextWeekItems: AgendaUpcomingSection['items'] = [];
  const laterBuckets = new Map<string, AgendaUpcomingSection['items']>();

  upcoming.forEach(([dateKey, bills]) => {
    const date = parseIsoDay(dateKey);
    if (!date) return;
    const entries = bills.map((bill) => ({ bill, dateKey }));

    if (dateKey === tomorrowKey) {
      tomorrowItems.push(...entries);
      return;
    }
    if (date > tomorrow && date <= weekEnd) {
      thisWeekItems.push(...entries);
      return;
    }
    if (date >= nextWeekStart && date <= nextWeekEnd) {
      nextWeekItems.push(...entries);
      return;
    }

    const inNewMonth = date.getMonth() !== today.getMonth() || date.getFullYear() !== today.getFullYear();
    const label =
      inNewMonth && date.getDate() <= 7
        ? `Début ${date.toLocaleDateString('fr-FR', { month: 'long' })}`
        : 'Plus tard';
    const bucket = laterBuckets.get(label) ?? [];
    bucket.push(...entries);
    laterBuckets.set(label, bucket);
  });

  const sections: AgendaUpcomingSection[] = [];
  if (tomorrowItems.length) {
    sections.push({
      titleBold: 'Demain',
      titleSuffix: formatAgendaSectionSuffix(tomorrowKey),
      items: tomorrowItems,
    });
  }
  if (thisWeekItems.length) {
    sections.push({
      titleBold: 'Cette semaine',
      items: thisWeekItems,
    });
  }
  if (nextWeekItems.length) {
    sections.push({
      titleBold: 'Semaine prochaine',
      items: nextWeekItems,
    });
  }
  laterBuckets.forEach((items, titleBold) => {
    sections.push({
      titleBold,
      items,
    });
  });

  return sections;
}

function buildAgendaRowSubtitle(
  dateKey: string,
  options?: { hideDate?: boolean },
) {
  if (options?.hideDate) return null;
  return formatAgendaShortDate(dateKey);
}

function resolveBillDisplayName(bill: AgendaBill) {
  return isEstimatedPayBill(bill) ? PAY_DISPLAY_LABEL : bill.name;
}

function resolveBillDisplayIcon(
  bill: AgendaBill,
  loanByRecurringPaymentId: Map<string, Loan>,
) {
  return resolveAgendaBillDisplayIcon(bill, loanByRecurringPaymentId, {
    isPayBill: (item) => isPayBill(item as AgendaBill),
  });
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

/**
 * Marqueurs du calendrier — points sous le jour (paiement / revenu).
 */
function calendarDayMarkers(dateKey: string, billsByDate: Record<string, AgendaBill[]>) {
  const items = billsByDate[dateKey];
  if (!items?.length) {
    return { hasPayment: false, hasIncome: false };
  }

  const hasIncome = items.some(
    (item) => (item.kind === 'income' || isPayBill(item)) && !isEstimatedPayBill(item),
  ) || items.some(isEstimatedPayBill);
  const hasPayment = items.some((item) => (item.kind ?? 'payment') !== 'income' && !isEstimatedPayBill(item));
  return { hasPayment, hasIncome };
}

function CalendarDayDots({
  hasPayment,
  hasIncome,
  styles,
  colors,
}: {
  hasPayment: boolean;
  hasIncome: boolean;
  styles: AgendaViewStyles;
  colors: AppColors;
}) {
  if (!hasPayment && !hasIncome) {
    return <View style={styles.dotSpacer} />;
  }

  return (
    <View style={styles.dotsRow}>
      {hasPayment ? <View style={[styles.eventDot, { backgroundColor: colors.warning }]} /> : null}
      {hasIncome ? <View style={[styles.eventDot, styles.eventDotIncome, { backgroundColor: colors.accentGreen }]} /> : null}
    </View>
  );
}

export const AgendaView = forwardRef<AgendaViewRef, AgendaViewProps>(function AgendaView({ headerComponent, onEditRecurring }, ref) {
  const today = useMemo(() => startOfToday(), []);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<AgendaViewMode>('list');
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [simulatedAccounts, setSimulatedAccounts] = useState<SimulatedAccount[]>([]);
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
    const [payments, incomeTransactions, loadedLoans, accounts] = await Promise.all([
      getRecurringPayments(),
      getRecentIncomeTransactions(INCOME_TRANSACTION_LOOKBACK_LIMIT),
      getLoans(),
      getSimulatedAccounts(),
    ]);
    setRecurringPayments(payments);
    setRecentIncomeTransactions(incomeTransactions);
    setLoans(loadedLoans);
    setSimulatedAccounts(accounts);
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
    setViewMode('list');
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

  const upcomingSections = useMemo(
    () => groupUpcomingIntoSections(upcoming, todayKey),
    [todayKey, upcoming],
  );

  const heroSnapshot = useMemo(() => {
    const cash = computeAvailableCashToday({
      simulatedAccounts,
      recurringPayments,
      incomeTransactions: recentIncomeTransactions,
      today,
    });
    const nextPaycheck = resolveNextPaycheckForAccount(
      undefined,
      recurringPayments,
      recentIncomeTransactions,
      today,
    );
    return { cash, nextPaycheck };
  }, [recentIncomeTransactions, recurringPayments, simulatedAccounts, today]);

  const upcomingCount = useMemo(
    () => upcoming.reduce((acc, [, bills]) => acc + bills.length, 0),
    [upcoming],
  );

  const upcomingBillsByDate = useMemo(() => {
    const map: Record<string, AgendaBill[]> = {};
    upcoming.forEach(([key, bills]) => {
      map[key] = bills;
    });
    return map;
  }, [upcoming]);

  const selBills = selectedKey
    ? viewMode === 'list'
      ? (upcomingBillsByDate[selectedKey] ?? [])
      : (billsByDate[selectedKey] ?? [])
    : null;

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

  const renderFlatBillRows = (
    items: Array<{ bill: AgendaBill; dateKey: string }>,
    options?: { hideDate?: boolean },
  ) =>
    items.map(({ bill, dateKey: billDateKey }, index) => (
      <AgendaPaymentRow
        key={`${billDateKey}-${index}-${bill.sourceId ?? bill.name}`}
        bill={bill}
        dateKey={billDateKey}
        statusLabel={resolveAgendaBillStatusLabel(billDateKey, todayKey, bill, recentIncomeTransactions)}
        todayKey={todayKey}
        onPress={() => onBillRowPress(bill, billDateKey)}
        loanByRecurringPaymentId={loanByRecurringPaymentId}
        embedded
        displayName={resolveBillDisplayName(bill)}
        subtitle={buildAgendaRowSubtitle(billDateKey, options) ?? undefined}
        estimatedIncome={isEstimatedPayBill(bill)}
      />
    ));

  const monthTitle = viewMonth.toLocaleDateString('fr-FR', { month: 'long' });
  const monthYear = String(viewMonth.getFullYear());
  const textFaint = colors.textMuted;
  const textMutedSoft = colors.textSecondary;
  const surfaceSoft = colors.surfaceElevated;
  const heroPaycheck = heroSnapshot.nextPaycheck;

  const stripPaymentDateKeys = useMemo(() => {
    const endKey = (() => {
      const date = new Date(`${todayKey}T12:00:00`);
      date.setDate(date.getDate() + 30);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();

    return upcoming
      .filter(([key]) => key >= todayKey && key <= endKey)
      .filter(([, bills]) =>
        bills.some((bill) => (bill.kind ?? 'payment') !== 'income' && !isEstimatedPayBill(bill)),
      )
      .map(([key]) => key);
  }, [todayKey, upcoming]);

  /** Outgoing totals per day for orange timeline markers (excludes income / estimated pay). */
  const paymentDayAmounts = useMemo(() => {
    const amounts: Record<string, number> = {};
    for (const [key, bills] of upcoming) {
      let dayTotal = 0;
      for (const bill of bills) {
        if ((bill.kind ?? 'payment') === 'income' || isEstimatedPayBill(bill)) continue;
        dayTotal += bill.amount;
      }
      if (dayTotal > 0) amounts[key] = dayTotal;
    }
    return amounts;
  }, [upcoming]);
  const selectedDaySuffix =
    selectedKey === dateKeyFromDate(addDays(today, 1))
      ? 'demain'
      : selectedKey === todayKey
        ? "aujourd'hui"
        : null;

  const setAgendaViewMode = (mode: AgendaViewMode) => {
    tapHaptic();
    setViewMode(mode);
    if (mode === 'list') {
      setSelectedKey(null);
    }
  };

  const clearDaySelection = () => {
    if (selectedKey) setSelectedKey(null);
  };

  const onStripDayPress = (key: string) => {
    tapHaptic();
    setSelectedKey(selectedKey === key ? null : key);
  };

  const renderSelectedDayPanel = () => (
    <View style={styles.dayPanel}>
      <View style={styles.dayPanelHead}>
        <Text style={[styles.dayPanelTitle, { color: colors.text }]}>
          {formatAgendaFullDate(selectedKey!)}
        </Text>
        {selectedDaySuffix ? (
          <Text style={[styles.dayPanelSuffix, { color: textFaint }]}>{selectedDaySuffix}</Text>
        ) : null}
      </View>
      {selBills && selBills.length > 0 ? (
        <DashboardCard padding={0} innerStyle={styles.groupCard}>
          {renderFlatBillRows(selBills.map((bill) => ({ bill, dateKey: selectedKey! })), {
            hideDate: true,
          })}
        </DashboardCard>
      ) : (
        <View style={styles.emptyStateCompact}>
          <Text style={[styles.emptyHint, { color: textMutedSoft }]}>Aucun paiement ce jour.</Text>
        </View>
      )}
    </View>
  );

  const renderUpcomingSections = () =>
    upcomingCount > 0 ? (
      upcomingSections.map((section) => (
        <View key={`${section.titleBold}${section.titleSuffix ?? ''}`} style={styles.section}>
          <View style={styles.dateHeader}>
            <Text style={[styles.dateHeaderLabel, { color: textFaint }]}>
              <Text style={[styles.dateHeaderBold, { color: textMutedSoft }]}>{section.titleBold}</Text>
              {section.titleSuffix ?? ''}
            </Text>
          </View>
          <DashboardCard padding={0} innerStyle={styles.groupCard}>
            {renderFlatBillRows(section.items)}
          </DashboardCard>
        </View>
      ))
    ) : (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: surfaceSoft, borderColor: colors.borderSubtle }]}>
          <AppIcon family="ionicons" name="checkmark-circle-outline" size={22} color={textMutedSoft} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Rien de prévu</Text>
        <Text style={[styles.emptyHint, { color: textMutedSoft }]}>
          Les prochains {UPCOMING_WINDOW_DAYS} jours apparaîtront ici.
        </Text>
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
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding, paddingHorizontal: contentGutter }]}
      >
        {headerComponent}

        <View style={styles.contextBar}>
          {viewMode === 'calendar' ? (
            <View style={styles.ctxMonthCentered} pointerEvents="box-none">
              <View style={styles.ctxMonthRow}>
                <Text style={[styles.ctxTitle, { color: colors.text }]}>
                  {capitalizeFirst(monthTitle)}{' '}
                  <Text style={[styles.ctxTitleMuted, { color: textFaint }]}>{monthYear}</Text>
                </Text>
                <View style={styles.calNav}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mois précédent"
                    disabled={!canGoAgendaPrevious}
                    onPress={prevMonth}
                    style={({ pressed }) => [styles.calNavBtn, pressed && styles.pressed, !canGoAgendaPrevious && styles.calNavBtnDisabled]}
                  >
                    <AppIcon
                      family="ionicons"
                      name="chevron-back"
                      size={14}
                      color={canGoAgendaPrevious ? colors.textSecondary : textFaint}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mois suivant"
                    disabled={!canGoAgendaNext}
                    onPress={nextMonth}
                    style={({ pressed }) => [styles.calNavBtn, pressed && styles.pressed, !canGoAgendaNext && styles.calNavBtnDisabled]}
                  >
                    <AppIcon
                      family="ionicons"
                      name="chevron-forward"
                      size={14}
                      color={canGoAgendaNext ? colors.textSecondary : textFaint}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          <View style={[styles.viewSwitch, { backgroundColor: surfaceSoft, borderColor: colors.borderSubtle }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vue liste"
              accessibilityState={{ selected: viewMode === 'list' }}
              onPress={() => setAgendaViewMode('list')}
              style={[
                styles.viewSwitchBtn,
                viewMode === 'list' && [styles.viewSwitchBtnActive, { backgroundColor: colors.toggleTrackOff }],
              ]}
            >
              <AppIcon
                family="ionicons"
                name="list-outline"
                size={16}
                color={viewMode === 'list' ? colors.text : textFaint}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vue calendrier"
              accessibilityState={{ selected: viewMode === 'calendar' }}
              onPress={() => setAgendaViewMode('calendar')}
              style={[
                styles.viewSwitchBtn,
                viewMode === 'calendar' && [styles.viewSwitchBtnActive, { backgroundColor: colors.toggleTrackOff }],
              ]}
            >
              <AppIcon
                family="ionicons"
                name="calendar-outline"
                size={16}
                color={viewMode === 'calendar' ? colors.text : textFaint}
              />
            </Pressable>
          </View>
        </View>

        {viewMode === 'list' ? (
          <Pressable onPress={clearDaySelection}>
            <View style={styles.hero}>
              <AgendaCashHeroCard
                checkingBalanceTotal={heroSnapshot.cash.checkingBalanceTotal}
                upcomingBillsBeforePaycheck={heroSnapshot.cash.upcomingBillsBeforePaycheck}
                billCount={heroSnapshot.cash.billCount}
                todayKey={todayKey}
                paymentDateKeys={stripPaymentDateKeys}
                paymentDayAmounts={paymentDayAmounts}
                selectedDateKey={selectedKey}
                onDayPress={onStripDayPress}
                paycheck={
                  heroPaycheck
                    ? { amount: heroPaycheck.amount, dateKey: heroPaycheck.dateKey }
                    : null
                }
              />
            </View>

            {selectedKey ? renderSelectedDayPanel() : renderUpcomingSections()}
          </Pressable>
        ) : (
          <Pressable onPress={clearDaySelection}>
            <DashboardCard padding={spacing.md} style={styles.calCard} innerStyle={styles.calCardInner}>
              <View style={[styles.dowRow, { borderBottomColor: colors.borderSubtle }]}>
                {DAYS.map((d, i) => (
                  <Text
                    key={`${d}-${i}`}
                    style={[
                      styles.dow,
                      { color: textFaint },
                      i < DAYS.length - 1 && {
                        borderRightWidth: StyleSheet.hairlineWidth,
                        borderRightColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.grid}>
                {Array.from({ length: cells.length / 7 }, (_, weekIndex) => {
                  const week = cells.slice(weekIndex * 7, weekIndex * 7 + 7);
                  const isLastWeek = weekIndex === cells.length / 7 - 1;
                  return (
                    <View
                      key={`week-${weekIndex}`}
                      style={[
                        styles.calWeekRow,
                        !isLastWeek && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.borderSubtle,
                        },
                      ]}
                    >
                      {week.map((cell, dayIndex) => {
                        const i = weekIndex * 7 + dayIndex;
                        const cellDividerStyle =
                          dayIndex < 6
                            ? {
                                borderRightWidth: StyleSheet.hairlineWidth,
                                borderRightColor: colors.borderSubtle,
                              }
                            : null;
                        if (!cell) {
                          return <View key={i} style={[styles.cell, cellDividerStyle]} />;
                        }
                        const key = dateKey(year, month, cell.day);
                        const { hasPayment, hasIncome } = calendarDayMarkers(key, billsByDate);
                        const isToday = key === todayKey;
                        const isSel = key === selectedKey;
                        const past = key < todayKey;
                        return (
                          <Pressable
                            key={i}
                            style={[styles.cell, cellDividerStyle]}
                            onPress={() => {
                              tapHaptic();
                              setSelectedKey(isSel ? null : key);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSel }}
                          >
                            <View
                              style={[
                                styles.calCell,
                                isSel && [
                                  styles.calCellSelected,
                                  {
                                    backgroundColor: colors.surfaceElevated,
                                    borderColor: colors.borderStrong,
                                  },
                                ],
                              ]}
                            >
                              <Text
                                style={[
                                  styles.dayNum,
                                  past && !isSel && { color: textFaint },
                                  isToday && { color: colors.accentGreen, ...jakartaExtraBoldText },
                                  !past && !isToday && !isSel && { color: colors.text },
                                  isSel && !isToday && { color: colors.text },
                                ]}
                              >
                                {cell.day}
                              </Text>
                              <CalendarDayDots
                                hasPayment={hasPayment}
                                hasIncome={hasIncome}
                                styles={styles}
                                colors={colors}
                              />
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </DashboardCard>

            {selectedKey ? (
              renderSelectedDayPanel()
            ) : (
              renderUpcomingSections()
            )}
          </Pressable>
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

type AgendaViewStyles = {
  root: ViewStyle;
  scrollView: ViewStyle;
  scroll: ViewStyle;
  contextBar: ViewStyle;
  ctxMonthCentered: ViewStyle;
  ctxMonthRow: ViewStyle;
  ctxTitle: TextStyle;
  ctxTitleMuted: TextStyle;
  calNav: ViewStyle;
  calNavBtn: ViewStyle;
  calNavBtnDisabled: ViewStyle;
  viewSwitch: ViewStyle;
  viewSwitchBtn: ViewStyle;
  viewSwitchBtnActive: ViewStyle;
  hero: ViewStyle;
  section: ViewStyle;
  groupCard: ViewStyle;
  dateHeader: ViewStyle;
  dateHeaderLabel: TextStyle;
  dateHeaderBold: TextStyle;
  calCard: ViewStyle;
  calCardInner: ViewStyle;
  dowRow: ViewStyle;
  dow: TextStyle;
  grid: ViewStyle;
  calWeekRow: ViewStyle;
  cell: ViewStyle;
  calCell: ViewStyle;
  calCellSelected: ViewStyle;
  dayNum: TextStyle;
  dotsRow: ViewStyle;
  dotSpacer: ViewStyle;
  eventDot: ViewStyle;
  eventDotIncome: ViewStyle;
  dayPanel: ViewStyle;
  dayPanelHead: ViewStyle;
  dayPanelTitle: TextStyle;
  dayPanelSuffix: TextStyle;
  emptyState: ViewStyle;
  emptyStateCompact: ViewStyle;
  emptyIcon: ViewStyle;
  emptyTitle: TextStyle;
  emptyHint: TextStyle;
  pressed: ViewStyle;
};

function createStyles(colors: AppColors): AgendaViewStyles {
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
    backgroundColor: colors.background,
  },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    position: 'relative',
    minHeight: 34,
  },
  ctxMonthCentered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctxMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctxTitle: {
    ...jakartaBoldText,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  ctxTitleMuted: {
    ...jakartaSemiboldText,
  },
  calNav: {
    flexDirection: 'row',
    gap: 6,
  },
  calNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavBtnDisabled: {
    opacity: 0.35,
  },
  viewSwitch: {
    flexDirection: 'row',
    gap: 2,
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    marginLeft: 'auto',
    zIndex: 1,
  },
  viewSwitchBtn: {
    width: 34,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewSwitchBtnActive: {},
  hero: {
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  groupCard: {
    overflow: 'hidden',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: spacing.sm,
  },
  dateHeaderLabel: {
    ...jakartaBoldText,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  dateHeaderBold: {
    ...jakartaBoldText,
  },
  calCard: {
    marginTop: spacing.sm,
  },
  calCardInner: {
    gap: 0,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: 0,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dow: {
    flex: 1,
    textAlign: 'center',
    ...jakartaBoldText,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'column',
  },
  calWeekRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  cell: {
    width: '14.28%',
    alignItems: 'center',
  },
  calCell: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 7,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calCellSelected: {
    borderWidth: 1,
  },
  dayNum: {
    ...jakartaSemiboldText,
    fontSize: 14,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    minHeight: 4,
  },
  dotSpacer: {
    height: 4,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventDotIncome: {},
  dayPanel: {
    marginTop: 14,
  },
  dayPanelHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: 14,
    paddingBottom: 6,
  },
  dayPanelTitle: {
    ...jakartaBoldText,
    fontSize: 15,
    letterSpacing: -0.1,
    flexShrink: 1,
    minWidth: 0,
  },
  dayPanelSuffix: {
    ...jakartaMediumText,
    fontSize: 12.5,
    flexShrink: 0,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyStateCompact: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...jakartaBoldText,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyHint: {
    ...jakartaMediumText,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
  }) as AgendaViewStyles;
}
