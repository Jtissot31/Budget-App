import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardDateBadge } from '@/components/DashboardDateBadge';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import {
  FLOATING_NAV_CONTENT_PADDING,
  interBoldText,
  radius,
  spacing,
  typography,
  type AppColors,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { dashboardPaymentAmount, portfolioNumericText, singleLineAmountProps } from '@/lib/textLayout';
import { UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategoryBudgets, getRecentIncomeTransactions, getRecurringPayments } from '@/lib/db';
import {
  ESTIMATED_PAYCHECK_LABEL,
  inferEstimatedPaycheckFromTransactions,
  PAYCHECK_TRANSACTION_LOOKBACK_LIMIT,
  resolveNextPaycheckForAccount,
} from '@/lib/estimatedPaycheck';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { getMerchantLogoUrl } from '@/lib/merchantLogo';
import { resolvePaymentStatusBadge } from '@/lib/paymentStatusBadge';
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

function resolveBillDisplayIcon(bill: AgendaBill): IconName {
  if (isIconName(bill.icon) && bill.icon !== 'repeat-outline') return bill.icon;
  if (bill.kind === 'income' || isPayBill(bill)) return 'cash-outline';
  return 'receipt-outline';
}

function getPaymentCardMeta(bill: AgendaBill, dateKey?: string, showDate = false) {
  if (showDate && dateKey) {
    return `${formatAgendaUpcomingDate(dateKey)} · ${bill.account}`;
  }
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

function buildActualPayDateKeys(transactions: Transaction[]) {
  return new Set(
    transactions
      .filter(isActualPayTransaction)
      .map((transaction) => getLocalDayKey(transaction.date))
      .filter((key): key is string => key !== null),
  );
}

function inferEstimatedPayBill(
  transactions: Transaction[],
  recurringPayments: RecurringPayment[],
  today: Date,
): { key: string; bill: AgendaBill } | null {
  const estimate =
    resolveNextPaycheckForAccount(undefined, recurringPayments, transactions, today) ??
    inferEstimatedPaycheckFromTransactions(transactions, today);
  if (!estimate) return null;

  return {
    key: estimate.dateKey,
    bill: {
      name: PAY_LABEL,
      amount: estimate.amount,
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
  const { colors } = useAppTheme();
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
      buildEstimatedPayByDate(inferEstimatedPayBill(recentIncomeTransactions, recurringPayments, today), billsWithActualPay),
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
    const upcomingBillsByDate = filterEstimatedPayFromAgenda(
      mergeBillsByDate(
        billsWithActualPay,
        buildEstimatedPayByDate(inferEstimatedPayBill(recentIncomeTransactions, recurringPayments, today), billsWithActualPay),
      ),
      recentIncomeTransactions,
      today,
    );

    return Object.entries(upcomingBillsByDate)
      .filter(([k]) => k >= todayKey && k <= rangeEndKey)
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

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING }]}
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
                const calendarMark = calendarMarkForDate(key, billsByDate, actualPayDateKeys);
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
          </DashboardCard>
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
            {upcomingFlat.length > 0 ? (
              renderAgendaPaymentCards(upcomingFlat, 'upcoming')
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
  const showUpcomingStyle = variant === 'upcoming';
  const displayLogoUrl = resolveBillDisplayLogo(bill);
  const displayIcon = resolveBillDisplayIcon(bill);
  const displayTint = bill.color ?? (isIncome ? colors.success : colors.warning);

  return (
    <Pressable onPress={onPress} android_ripple={null}>
      <DashboardCard style={styles.agendaPaymentCard}>
        {showUpcomingStyle ? (
          <UserPickedIconBadge
            icon={displayIcon}
            color={displayTint}
            size={44}
            logoUrl={displayLogoUrl}
            style={styles.agendaPaymentAvatar}
          />
        ) : (
          <DashboardDateBadge dateKey={dateKey} />
        )}
        <View style={styles.agendaPaymentCopy}>
          <Text style={styles.agendaPaymentTitle} numberOfLines={2} ellipsizeMode="tail">
            {bill.name}
          </Text>
          <View style={styles.agendaPaymentMetaRow}>
            {showIncomeCheck ? (
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            ) : null}
            <Text style={styles.agendaPaymentMeta} numberOfLines={1} ellipsizeMode="tail">
              {getPaymentCardMeta(bill, dateKey, showUpcomingStyle)}
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
            {formatDisplayMoneyAbsolute(bill.amount)}
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
    ...portfolioNumericText,
    marginTop: 0,
    height: 12,
    color: colors.success,
    fontSize: typography.micro,
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
    ...typographyKit.listPrimary,
    color: colors.text,
  },
  agendaPaymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  agendaPaymentMeta: {
    ...typographyKit.micro,
    flex: 1,
    minWidth: 0,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  agendaPaymentAmountBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  agendaPaymentAmount: {
    ...dashboardPaymentAmount,
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
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
    ...typographyKit.micro,
    letterSpacing: 0.5,
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
  });
}
