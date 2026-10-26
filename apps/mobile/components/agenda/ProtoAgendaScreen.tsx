/**
 * Agenda — paiements et revenus récurrents du mois, au style de l'historique.
 *
 * 1. Résumé du mois (solde prévu · entrées · sorties · reste à payer)
 * 2. Liste | Calendrier (segmented, même contrôle que Transactions)
 * 3. Paiements groupés par jour dans des cartes « verre »
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import {
  FitText,
  PressScale,
  HeaderIconButton,
  IconWell,
  ListCard,
  ListRow,
  PageHeader,
  RingGauge,
  SECTION_GAP,
  SectionLabel,
  SummaryCard,
  PillButton,
  Reveal,
} from '@/components/kit';
import { PageTransition } from '@/components/PageTransition';
import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { getCategoryIconName } from '@/constants/categoryOptions';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  jakartaMediumText,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
  moneyAmountTypography,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ensureDbReady } from '@/lib/init';
import { deleteRecurringPayment, getRecurringPayments, getTransactions } from '@/lib/db';
import { dataEvents, uiEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { daysUntilPayment } from '@/lib/paymentStatusBadge';
import {
  buildMonthTimeline,
  buildRecurringBillsByDate,
  dateKeyFromDate,
  dateKeyFromParts,
  sumMonthCashflow,
} from '@/lib/protoAgendaBills';
import { formatBudgetMonthLabel } from '@/lib/budgetMonth';
import { getMerchantLogoUrls } from '@/lib/merchantLogo';
import { hasMatchingRecurringPaymentTransaction } from '@/lib/recurringPaymentMatch';
import { GENERIC_RECURRING_ICON } from '@/lib/recurringPaymentPresentation';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { formatListShortDate } from '@/lib/transactionListSectionFormat';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { BUDGET_OVER } from '@/lib/budgetTone';
import { reportFabScroll } from '@/lib/fabScrollVisibility';
import { FabAutoHide } from '@/components/tabbar/FabAutoHide';
import type { PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import type { AgendaBill, RecurringPayment, Transaction } from '@/types';

type AgendaBodyMode = 'list' | 'calendar';

const AGENDA_BODY_TABS: { id: AgendaBodyMode; label: string }[] = [
  { id: 'list', label: 'Liste' },
  { id: 'calendar', label: 'Calendrier' },
];

/** Extra bottom inset so the agenda FAB clears the last payment rows. */
const AGENDA_FAB_SCROLL_CLEARANCE = 64;

const AGENDA_ADD_TYPE_OPTIONS: {
  variant: RecurringPaymentAddVariant;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}[] = [
  {
    variant: 'income',
    label: 'Revenu récurrent',
    icon: 'trending-up-outline',
    accessibilityLabel: 'Ajouter un revenu récurrent',
  },
  {
    variant: 'bill',
    label: 'Paiement récurrent',
    icon: 'document-text-outline',
    accessibilityLabel: 'Ajouter un paiement récurrent',
  },
  {
    variant: 'subscription',
    label: 'Abonnement',
    icon: 'repeat-outline',
    accessibilityLabel: 'Ajouter un abonnement',
  },
];

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/** Day-group eyebrow suffix — « aujourd'hui », « demain », « dans 5 jours ». */
function relativeDayLabel(dateKey: string, todayKey: string): string | null {
  if (dateKey === todayKey) return "aujourd'hui";
  if (dateKey < todayKey) return null;
  const days = daysUntilPayment(dateKey, new Date(`${todayKey}T12:00:00`));
  if (days <= 0) return null;
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

function formatBillDateLong(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Logo → stored/auto category-style icon → generic card (income: trending-up). */
function resolvePayIcon(bill: AgendaBill): string {
  const stored = bill.icon?.trim();
  if (
    stored &&
    stored !== GENERIC_RECURRING_ICON &&
    stored !== 'card-outline' &&
    stored !== 'repeat-outline'
  ) {
    return stored;
  }
  if (bill.categoryId?.trim() || bill.categoryName?.trim() || bill.name?.trim()) {
    return getCategoryIconName({
      categoryId: bill.categoryId ?? undefined,
      categoryName: bill.categoryName ?? undefined,
      name: bill.name,
    });
  }
  return (bill.kind ?? 'payment') === 'income' ? 'trending-up-outline' : 'card-outline';
}

export function PayIcon({ bill }: { bill: AgendaBill }) {
  const { colors, isLight } = useAppTheme();
  const logoUrl = bill.logoUrl?.trim() || null;
  return (
    <UserPickedIconWell
      icon={resolvePayIcon(bill)}
      size={40}
      color={isLight ? colors.text : bill.color}
      logoUrl={logoUrl}
      merchantLabel={bill.name}
      wellGlyphWhite={Boolean(bill.recurring) && bill.kind !== 'income'}
      noBackground={Boolean(logoUrl) || getMerchantLogoUrls(bill.name).length > 0}
      style={styles.payIconLogo}
    />
  );
}

function signedMoney(value: number, { plus = false } = {}): string {
  if (value < 0) return `−${formatDisplayMoneyAbsolute(Math.abs(value))}`;
  return `${plus && value > 0 ? '+' : ''}${formatDisplayMoneyAbsolute(value)}`;
}

type Props = {
  /** List-row tap → read-only payment detail (not the create/edit form). */
  onOpenPaymentDetail?: (detail: PaymentDetailPayload) => void;
  /** Header add → create form (parent hosts RecurringPaymentFormModal). Falls back to uiEvents. */
  onAddRecurringPayment?: (variant: RecurringPaymentAddVariant) => void;
};

/**
 * Swallows taps on a card so they never reach the background Pressable that resets the picked
 * day (buttons inside the card still win — they sit deeper).
 */
function AbsorbTouches({ children }: { children: ReactNode }) {
  // A button with no action: takes the native responder AND stops the web click from bubbling up.
  return (
    <Pressable accessible={false} focusable={false}>
      {children}
    </Pressable>
  );
}

export function ProtoAgendaScreen({ onOpenPaymentDetail, onAddRecurringPayment }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  /** Deep link: `/goals?payment=<recurring id>&date=YYYY-MM-DD` opens that payment. */
  const { payment: paymentParam, date: dateParam } = useLocalSearchParams<{ payment?: string; date?: string }>();
  const { colors } = useAppTheme();
  const now = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  /** null = full month list; set = filter to that calendar day. */
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [bodyMode, setBodyMode] = useState<AgendaBodyMode>('list');
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [managingPayments, setManagingPayments] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [addTypeChooserVisible, setAddTypeChooserVisible] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);
  const [calendarWidth, setCalendarWidth] = useState(0);

  const openAddFormForVariant = useCallback(
    (variant: RecurringPaymentAddVariant) => {
      if (onAddRecurringPayment) {
        onAddRecurringPayment(variant);
        return;
      }
      uiEvents.requestNewRecurringPayment(variant);
    },
    [onAddRecurringPayment],
  );

  const chooseAddType = useCallback(
    (variant: RecurringPaymentAddVariant) => {
      tapHaptic();
      setAddTypeChooserVisible(false);
      openAddFormForVariant(variant);
    },
    [openAddFormForVariant],
  );

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const todayKey = dateKeyFromDate(now);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [nextPayments, nextTx] = await Promise.all([getRecurringPayments(), getTransactions()]);
    setPayments(nextPayments);
    setTransactions(nextTx);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const rangeStart = useMemo(() => new Date(year, month0, 1), [year, month0]);
  const rangeEnd = useMemo(() => new Date(year, month0 + 1, 0), [year, month0]);

  const billsByDate = useMemo(
    () => buildRecurringBillsByDate(payments, rangeStart, rangeEnd),
    [payments, rangeStart, rangeEnd],
  );

  const paymentsById = useMemo(() => {
    const map = new Map<string, RecurringPayment>();
    for (const p of payments) map.set(p.id, p);
    return map;
  }, [payments]);

  const expenseTxs = useMemo(
    () => transactions.filter((tx) => tx.type === 'expense'),
    [transactions],
  );

  const timeline = useMemo(() => {
    const entries = buildMonthTimeline(billsByDate, todayKey, year, month0);
    return entries.map((entry) => {
      const billsPaid = entry.bills.map((bill) => {
        if ((bill.kind ?? 'payment') === 'income') {
          return { bill, paid: entry.dateKey <= todayKey };
        }
        const source = bill.sourceId ? paymentsById.get(bill.sourceId) : undefined;
        const matched = hasMatchingRecurringPaymentTransaction(bill, entry.dateKey, expenseTxs, source);
        return { bill, paid: matched || entry.dateKey < todayKey };
      });
      return { ...entry, billsPaid };
    });
  }, [billsByDate, expenseTxs, month0, paymentsById, todayKey, year]);

  const monthCash = useMemo(() => {
    const { income, expenses } = sumMonthCashflow(billsByDate);
    let events = 0;
    let unpaidOut = 0;
    let unpaidCount = 0;
    for (const entry of timeline) {
      for (const { bill, paid } of entry.billsPaid) {
        events += 1;
        if (!paid && (bill.kind ?? 'payment') !== 'income') {
          unpaidOut += bill.amount;
          unpaidCount += 1;
        }
      }
    }
    return { inflows: income, committed: expenses, net: income - expenses, events, unpaidOut, unpaidCount };
  }, [billsByDate, timeline]);

  const daysInMonth = rangeEnd.getDate();
  const safeSelectedDay = selectedDay == null ? null : Math.min(selectedDay, daysInMonth);
  const selectedDateKey =
    safeSelectedDay == null ? null : dateKeyFromParts(year, month0, safeSelectedDay);

  const listTimeline = useMemo(
    () =>
      selectedDateKey == null
        ? timeline
        : timeline.filter((entry) => entry.dateKey === selectedDateKey),
    [selectedDateKey, timeline],
  );

  /** Monday-first grid (L=0 … D=6). */
  const calendarCells = useMemo(() => {
    const js = new Date(year, month0, 1).getDay();
    const firstWeekday = js === 0 ? 6 : js - 1;
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [daysInMonth, month0, year]);

  /** Whole-pixel cell size so 7 columns always fit (no wrap → Sunday never drops). */
  const cellSize = calendarWidth > 0 ? Math.floor(calendarWidth / 7) : 0;

  /** Per-day payment status for the calendar dots. */
  const dayStatus = useMemo(() => {
    const map = new Map<string, { unpaid: number; paid: number; income: number }>();
    for (const entry of timeline) {
      let unpaid = 0;
      let paid = 0;
      let income = 0;
      for (const { bill, paid: isPaid } of entry.billsPaid) {
        const amount = Math.abs(bill.amount);
        if ((bill.kind ?? 'payment') === 'income') income += amount;
        else if (isPaid) paid += amount;
        else unpaid += amount;
      }
      map.set(entry.dateKey, { unpaid, paid, income });
    }
    return map;
  }, [timeline]);

  const resetSelectedDay = useCallback(() => {
    setSelectedDay((prev) => {
      if (prev != null) tapHaptic();
      return null;
    });
  }, []);

  const shiftMonth = useCallback(
    (delta: number) => {
      tapHaptic();
      setCursor(new Date(year, month0 + delta, 1));
      setSelectedDay(null);
    },
    [month0, year],
  );

  const openBill = (bill: AgendaBill, dateKey: string) => {
    if (managingPayments) {
      const id = bill.sourceId?.trim();
      if (!id) return;
      setSelectedPaymentIds((prev) =>
        prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
      );
      return;
    }
    if (!onOpenPaymentDetail) return;
    const payment = bill.sourceId ? paymentsById.get(bill.sourceId) : undefined;
    onOpenPaymentDetail({
      name: bill.name,
      amount: bill.amount,
      account: bill.account,
      recurring: bill.recurring,
      sourceId: bill.sourceId,
      kind: bill.kind,
      dateLabel: bill.date ?? formatBillDateLong(dateKey),
      logoUrl: bill.logoUrl,
      icon: bill.icon ?? payment?.icon,
      color: bill.color ?? payment?.color,
      frequencyLabel: payment ? frequencyLabel(payment.frequency) : null,
      frequency: payment?.frequency,
      active: payment?.active,
      categoryName: payment?.categoryName ?? bill.categoryName ?? null,
      categoryId: payment?.categoryId ?? bill.categoryId ?? null,
    });
  };

  useEffect(() => {
    if (!paymentParam) return;
    // Show the month of the requested occurrence first; the effect re-runs with its timeline.
    if (dateParam && dateParam.slice(0, 7) !== `${year}-${String(month0 + 1).padStart(2, '0')}`) {
      const [y, m] = dateParam.split('-').map(Number);
      if (y && m) setCursor(new Date(y, m - 1, 1));
      return;
    }
    for (const entry of timeline) {
      if (dateParam && entry.dateKey !== dateParam) continue;
      const match = entry.billsPaid.find(({ bill }) => bill.sourceId === paymentParam);
      if (match) {
        openBill(match.bill, entry.dateKey);
        router.setParams({ payment: undefined, date: undefined });
        return;
      }
    }
    // openBill is recreated each render; the deep link only depends on the data below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam, month0, paymentParam, router, timeline, year]);

  const toggleManagingPayments = useCallback(() => {
    tapHaptic();
    setManagingPayments((prev) => {
      if (prev) setSelectedPaymentIds([]);
      return !prev;
    });
  }, []);

  const openDeleteSelectedConfirm = useCallback(() => {
    if (deletingSelected || selectedPaymentIds.length === 0) return;
    tapHaptic();
    setConfirmDeleteVisible(true);
  }, [deletingSelected, selectedPaymentIds.length]);

  useEffect(() => {
    uiEvents.setAgendaManageFabState({
      managing: managingPayments,
      selectedCount: selectedPaymentIds.length,
    });
  }, [managingPayments, selectedPaymentIds.length]);

  useEffect(() => {
    return () => {
      uiEvents.setAgendaManageFabState({ managing: false, selectedCount: 0 });
    };
  }, []);

  useEffect(
    () => uiEvents.subscribeAgendaDeleteSelected(openDeleteSelectedConfirm),
    [openDeleteSelectedConfirm],
  );

  const handleConfirmDeleteSelected = useCallback(async () => {
    if (deletingSelected || selectedPaymentIds.length === 0) return;
    const ids = [...selectedPaymentIds];
    setConfirmDeleteVisible(false);
    setDeletingSelected(true);
    try {
      await Promise.all(ids.map((id) => deleteRecurringPayment(id)));
      setSelectedPaymentIds([]);
      setManagingPayments(false);
      successHaptic();
      dataEvents.emit();
      await load();
    } finally {
      setDeletingSelected(false);
    }
  }, [deletingSelected, load, selectedPaymentIds]);

  type AgendaItem = { bill: AgendaBill; paid: boolean; dateKey: string };

  const flatItems = useMemo<AgendaItem[]>(
    () =>
      listTimeline.flatMap((entry) =>
        entry.billsPaid.map(({ bill, paid }) => ({ bill, paid, dateKey: entry.dateKey })),
      ),
    [listTimeline],
  );
  const unpaidItems = useMemo(() => flatItems.filter((item) => !item.paid), [flatItems]);
  const paidItems = useMemo(() => flatItems.filter((item) => item.paid), [flatItems]);
  /** The next money-out still to pay (income never takes the hero slot). */
  const nextItem =
    unpaidItems.find((item) => (item.bill.kind ?? 'payment') !== 'income') ?? unpaidItems[0] ?? null;
  const weekLimitKey = useMemo(() => {
    const d = new Date(`${todayKey}T12:00:00`);
    d.setDate(d.getDate() + 7);
    return dateKeyFromDate(d);
  }, [todayKey]);
  const thisWeek = unpaidItems.filter((item) => item !== nextItem && item.dateKey <= weekLimitKey);
  const later = unpaidItems.filter((item) => item !== nextItem && item.dateKey > weekLimitKey);

  const sumOut = (items: AgendaItem[]) =>
    items.reduce(
      (sum, item) => sum + ((item.bill.kind ?? 'payment') === 'income' ? 0 : Math.abs(item.bill.amount)),
      0,
    );

  /** « Aujourd'hui », « Demain », « Dans 5 jours », else « Jeu. 15 oct ». */
  const dueLong = (dateKey: string) => {
    const relative = relativeDayLabel(dateKey, todayKey);
    const text = relative ?? formatListShortDate(dateKey);
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  /** Compact countdown for the hero pill. */
  const dueShort = (dateKey: string) => {
    if (dateKey === todayKey) return "Aujourd'hui";
    const days = daysUntilPayment(dateKey, new Date(`${todayKey}T12:00:00`));
    if (days <= 1) return 'Demain';
    return `Dans ${days} j`;
  };

  const renderBillRow = (item: AgendaItem, isLast: boolean) => {
    const { bill, paid, dateKey } = item;
    const isIncome = (bill.kind ?? 'payment') === 'income';
    const sourceId = bill.sourceId?.trim() ?? '';
    const isSelected = Boolean(sourceId) && selectedPaymentIds.includes(sourceId);
    const soon = !paid && daysUntilPayment(dateKey, new Date(`${todayKey}T12:00:00`)) <= 2;
    return (
      <ListRow
        key={`${dateKey}-${bill.sourceId ?? bill.name}`}
        leading={
          managingPayments ? (
            <IconWell
              icon={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              color={isSelected ? colors.text : colors.textMuted}
            />
          ) : paid ? (
            <IconWell icon="checkmark" color={colors.textMuted} />
          ) : (
            <PayIcon bill={bill} />
          )
        }
        title={bill.name}
        subtitle={paid ? `Payé · ${formatListShortDate(dateKey)}` : dueLong(dateKey)}
        value={`${isIncome ? '+' : '−'}${formatDisplayMoneyAbsolute(Math.abs(bill.amount))}`}
        valueColor={paid ? colors.textMuted : isIncome ? colors.accentGreen : colors.text}
        valueSub={soon ? 'Bientôt' : undefined}
        valueSubColor={soon ? colors.warning : undefined}
        isLast={isLast}
        onPress={() => openBill(bill, dateKey)}
      />
    );
  };

  const monthLabel = formatBudgetMonthLabel(cursor);

  return (
    <PageTransition animate={false}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.screen}
          // Padding lives on the background Pressable, so the side gutters and the space below the
          // content count as « background » too.
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          onScroll={reportFabScroll}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Tapping empty background (anywhere that isn't a card) drops the picked day. */}
          <Pressable
            accessible={false}
            onPress={resetSelectedDay}
            style={[
              styles.backgroundTap,
              {
                paddingHorizontal: PAGE_PADDING_HORIZONTAL,
                paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + AGENDA_FAB_SCROLL_CLEARANCE,
              },
            ]}
          >
          <PageHeader
            topInset={insets.top}
            title="Agenda"
            subtitle={monthLabel}
            trailing={
              bodyMode === 'calendar' ? undefined : (
                <>
                  <HeaderIconButton
                    icon="chevron-back"
                    accessibilityLabel="Mois précédent"
                    onPress={() => shiftMonth(-1)}
                  />
                  <HeaderIconButton
                    icon="chevron-forward"
                    accessibilityLabel="Mois suivant"
                    onPress={() => shiftMonth(1)}
                  />
                </>
              )
            }
          />

          <Reveal index={0} style={styles.section}>
            <AbsorbTouches>
            <SummaryCard
              label={monthCash.unpaidCount > 0 ? 'Reste à payer' : 'Tout est payé'}
              amount={formatDisplayMoneyAbsolute(monthCash.unpaidOut)}
              amountValue={monthCash.unpaidOut}
              formatAmount={formatDisplayMoneyAbsolute}
              badge={
                monthCash.unpaidCount > 0
                  ? {
                      label: `${monthCash.unpaidCount} paiement${monthCash.unpaidCount > 1 ? 's' : ''}`,
                      color: colors.textMuted,
                    }
                  : undefined
              }
              aside={
                <RingGauge
                  progress={monthCash.committed > 0 ? 1 - monthCash.unpaidOut / monthCash.committed : 1}
                  color={colors.accentGreen}
                  size={64}
                  stroke={7}
                >
                  <AppIcon family="ionicons" name="checkmark" size={20} color={colors.accentGreen} />
                </RingGauge>
              }
              stats={[
                // Scheduled (recurring) amounts only — the month's actual spending lives in Budget.
                { label: 'Prévu', value: `−${formatDisplayMoneyAbsolute(Math.round(monthCash.committed))}` },
                { label: 'Revenus', value: signedMoney(monthCash.inflows, { plus: true }), color: colors.accentGreen },
                {
                  label: 'Solde',
                  // No scheduled income: a red "−2 166$" balance only alarms, it tells nothing.
                  value: monthCash.inflows > 0 ? signedMoney(monthCash.net, { plus: true }) : '—',
                  color:
                    monthCash.inflows <= 0
                      ? colors.textMuted
                      : monthCash.net < 0
                        ? colors.danger
                        : colors.accentGreen,
                },
              ]}
            />
            </AbsorbTouches>
          </Reveal>

          {nextItem && !selectedDateKey && !managingPayments ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Prochain paiement : ${nextItem.bill.name}`}
              scaleTo={0.985}
              onPress={() => openBill(nextItem.bill, nextItem.dateKey)}
              style={styles.section}
            >
              <AbsorbTouches><ListCard padding={16} style={styles.nextCard}>
                <View style={styles.nextTop}>
                  <Text style={[styles.nextEyebrow, { color: colors.textMuted }]}>Prochain paiement</Text>
                  <View style={[styles.countdown, { backgroundColor: colors.text }]}>
                    <Text style={[styles.countdownText, { color: colors.background }]}>
                      {dueShort(nextItem.dateKey)}
                    </Text>
                  </View>
                </View>
                <View style={styles.nextBody}>
                  <PayIcon bill={nextItem.bill} />
                  <View style={styles.nextCopy}>
                    <FitText style={[styles.nextName, { color: colors.text }]}>
                      {nextItem.bill.name}
                    </FitText>
                    <FitText style={[styles.nextMeta, { color: colors.textMuted }]}>
                      {[dueLong(nextItem.dateKey), nextItem.bill.account].filter(Boolean).join(' · ')}
                    </FitText>
                  </View>
                </View>
                <FitText
                  style={[styles.nextAmount, { color: colors.text }]}
                  fontSize={30}
                  lineHeight={36}
                  minScale={0.6}
                >
                  {`${(nextItem.bill.kind ?? 'payment') === 'income' ? '+' : '−'}${formatDisplayMoneyAbsolute(Math.abs(nextItem.bill.amount))}`}
                </FitText>
              </ListCard></AbsorbTouches>
            </PressScale>
          ) : null}

          <View style={styles.modeRow}>
            <AbsorbTouches>
            <SegmentedTabs
              tabs={AGENDA_BODY_TABS}
              active={bodyMode}
              onChange={(id) => {
                tapHaptic();
                setBodyMode(id);
                if (id === 'list') setSelectedDay(null);
              }}
              size="section"
              variant="section"
              showDivider={false}
            />
            </AbsorbTouches>
          </View>

          {bodyMode === 'calendar' ? (
            <Reveal index={1} style={styles.section}>
              <AbsorbTouches><ListCard padding={12}>
                <View style={styles.calHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mois précédent"
                    onPress={() => shiftMonth(-1)}
                    style={styles.calNav}
                  >
                    <AppIcon family="ionicons" name="chevron-back" size={20} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.calMonth, { color: colors.text }]}>{monthLabel}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mois suivant"
                    onPress={() => shiftMonth(1)}
                    style={styles.calNav}
                  >
                    <AppIcon family="ionicons" name="chevron-forward" size={20} color={colors.text} />
                  </Pressable>
                </View>
                <View
                  onLayout={(e) => {
                    const w = Math.floor(e.nativeEvent.layout.width);
                    setCalendarWidth((prev) => (prev === w ? prev : w));
                  }}
                >
                  <View style={styles.weekRow}>
                    {DOW.map((d, i) => (
                      <View key={`${d}-${i}`} style={{ width: cellSize }}>
                        <Text style={[styles.dow, { color: colors.textMuted }]}>{d}</Text>
                      </View>
                    ))}
                  </View>
                  {calendarCells.length > 0 && cellSize > 0
                    ? Array.from({ length: calendarCells.length / 7 }, (_, week) => (
                        <View key={`w-${week}`} style={styles.weekRow}>
                          {calendarCells.slice(week * 7, week * 7 + 7).map((day, index) => {
                            if (day == null) {
                              return <View key={`e-${week}-${index}`} style={{ width: cellSize, height: cellSize }} />;
                            }
                            const key = dateKeyFromParts(year, month0, day);
                            const status = dayStatus.get(key);
                            const selected = safeSelectedDay === day;
                            const isToday = key === todayKey;
                            const isPast = key < todayKey;
                            const kind = !status
                              ? null
                              : status.unpaid > 0
                                ? 'due'
                                : status.income > 0
                                  ? 'income'
                                  : status.paid > 0
                                    ? 'paid'
                                    : null;
                            // The day number is the headline; the amount is the quiet, tinted detail
                            // (dusty red when still to pay, grey once paid, green for income).
                            const tone =
                              kind === 'due' ? BUDGET_OVER : kind === 'income' ? colors.accentGreen : colors.textMuted;
                            // Total of every payment that day (paid + still due); income only when there's no payment.
                            const paymentsTotal = status ? status.unpaid + status.paid : 0;
                            const shownAmount = paymentsTotal > 0 ? paymentsTotal : (status?.income ?? 0);
                            return (
                              <Pressable
                                key={key}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`${day}${isToday ? ', aujourd’hui' : ''}${kind === 'income' ? `, revenu ${formatDisplayMoneyAbsolute(shownAmount)}` : kind ? `, ${formatDisplayMoneyAbsolute(shownAmount)}${kind === 'paid' ? ', payé' : ' de paiements'}` : ''}`}
                                onPress={() => {
                                  tapHaptic();
                                  setSelectedDay((prev) => (prev === day ? null : day));
                                }}
                              >
                                <View style={[styles.dayCell, { width: cellSize, height: cellSize }]}>
                                  <View
                                    style={[
                                      styles.dayTile,
                                      { width: cellSize - 10, height: cellSize - 8 },
                                      kind === 'due' && !selected && { backgroundColor: colors.surfaceElevated },
                                      isToday && !selected && { borderColor: colors.text, borderWidth: 1.5 },
                                      selected && { backgroundColor: colors.text },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.dayNum,
                                        {
                                          color: selected
                                            ? colors.background
                                            : isPast
                                              ? colors.textMuted
                                              : colors.text,
                                        },
                                      ]}
                                    >
                                      {day}
                                    </Text>
                                    {kind ? (
                                      <Text
                                        style={[styles.dayTileAmount, { color: selected ? colors.background : tone }]}
                                        numberOfLines={1}
                                      >
                                        {kind === 'income' && paymentsTotal === 0 ? '+' : ''}
                                        {compactCalendarAmount(shownAmount)}$
                                      </Text>
                                    ) : null}
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      ))
                    : null}
                </View>
                <View style={[styles.calLegend, { borderTopColor: colors.borderSubtle }]}>
                  {(
                    [
                      { key: 'due', label: 'À payer', color: BUDGET_OVER },
                      { key: 'paid', label: 'Payé', color: colors.textMuted },
                      { key: 'income', label: 'Revenu', color: colors.accentGreen },
                    ] as const
                  ).map((item) => (
                    <View key={item.key} style={styles.calLegendItem}>
                      <View style={[styles.dayDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.calLegendText, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </ListCard></AbsorbTouches>
            </Reveal>
          ) : null}

          <SectionLabel
            title={
              selectedDateKey ? `Paiements du ${formatListShortDate(selectedDateKey)}` : 'Paiements du mois'
            }
            trailing={
              <View style={styles.sectionActions}>
                <TextAction label={managingPayments ? 'Terminé' : 'Modifier'} onPress={toggleManagingPayments} />
              </View>
            }
          />

          {listTimeline.length === 0 ? (
            <AbsorbTouches><ListCard>
              <View style={styles.emptyRow}>
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {selectedDateKey ? 'Aucun paiement ce jour' : 'Aucun paiement récurrent ce mois'}
                </Text>
              </View>
            </ListCard></AbsorbTouches>
          ) : selectedDateKey || managingPayments ? (
            <AbsorbTouches><ListCard>
              {flatItems.map((item, index) => renderBillRow(item, index === flatItems.length - 1))}
            </ListCard></AbsorbTouches>
          ) : (
            <>
              {thisWeek.length > 0 ? (
                <View style={styles.group}>
                  <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
                    Cette semaine · {formatDisplayMoneyAbsolute(sumOut(thisWeek))}
                  </Text>
                  <AbsorbTouches><ListCard>
                    {thisWeek.map((item, index) => renderBillRow(item, index === thisWeek.length - 1))}
                  </ListCard></AbsorbTouches>
                </View>
              ) : null}

              {later.length > 0 ? (
                <View style={styles.group}>
                  <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
                    Plus tard ce mois · {formatDisplayMoneyAbsolute(sumOut(later))}
                  </Text>
                  <AbsorbTouches><ListCard>
                    {later.map((item, index) => renderBillRow(item, index === later.length - 1))}
                  </ListCard></AbsorbTouches>
                </View>
              ) : null}

              {paidItems.length > 0 ? (
                <View style={styles.group}>
                  <AbsorbTouches><ListCard>
                    <ListRow
                      leading={<IconWell icon="checkmark-done" color={colors.accentGreen} />}
                      title={`${paidItems.length} déjà payé${paidItems.length > 1 ? 's' : ''}`}
                      chevron
                      value={formatDisplayMoneyAbsolute(sumOut(paidItems))}
                      valueColor={colors.textMuted}
                      isLast={!paidExpanded}
                      onPress={() => setPaidExpanded((open) => !open)}
                    />
                    {paidExpanded
                      ? paidItems.map((item, index) => renderBillRow(item, index === paidItems.length - 1))
                      : null}
                  </ListCard></AbsorbTouches>
                </View>
              ) : null}
            </>
          )}

          <View style={[styles.section, styles.subsLink]}>
            <AbsorbTouches><ListCard>
              <ListRow
                leading={<IconWell icon="repeat" />}
                title="Abonnements"
                subtitle="Coût par mois et par an"
                chevron
                isLast
                onPress={() => router.push('/subscriptions-insights')}
              />
            </ListCard></AbsorbTouches>
          </View>
          </Pressable>
        </ScrollView>

        <ConfirmDeleteModal
          visible={confirmDeleteVisible}
          title={
            selectedPaymentIds.length === 1
              ? 'Supprimer ce paiement récurrent ?'
              : `Supprimer ${selectedPaymentIds.length} paiements récurrents ?`
          }
          message="Les occurrences futures disparaîtront de l’agenda. L’historique des transactions reste intact."
          confirmLabel={selectedPaymentIds.length === 1 ? 'Supprimer' : 'Supprimer la sélection'}
          onConfirm={() => void handleConfirmDeleteSelected()}
          onCancel={() => setConfirmDeleteVisible(false)}
        />

        {!managingPayments && !addTypeChooserVisible ? (
          <FabAutoHide style={styles.fabLayer}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Ajouter un paiement récurrent"
              scaleTo={0.92}
              onPress={() => {
                tapHaptic();
                setAddTypeChooserVisible(true);
              }}
              style={[styles.fab, { backgroundColor: colors.text, bottom: Math.max(insets.bottom, 12) + 64 }]}
            >
              <AppIcon family="ionicons" name="add" size={28} color={colors.background} />
            </PressScale>
          </FabAutoHide>
        ) : null}

        {addTypeChooserVisible ? (
          <View style={styles.addTypeOverlay} accessibilityViewIsModal>
            <Pressable
              style={styles.addTypeBackdrop}
              onPress={() => setAddTypeChooserVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            />
            <View pointerEvents="box-none" style={styles.addTypeCardWrap}>
              <View
                style={[
                  styles.addTypeCard,
                  { backgroundColor: colors.background, borderColor: colors.containerBorder },
                ]}
              >
                <Text style={[styles.addTypeTitle, { color: colors.text }]}>Que veux-tu ajouter ?</Text>
                <AbsorbTouches><ListCard>
                  {AGENDA_ADD_TYPE_OPTIONS.map((option, index) => (
                    <ListRow
                      key={option.variant}
                      leading={<IconWell icon={option.icon} color={colors.text} />}
                      title={option.label}
                      chevron
                      isLast={index === AGENDA_ADD_TYPE_OPTIONS.length - 1}
                      accessibilityLabel={option.accessibilityLabel}
                      onPress={() => chooseAddType(option.variant)}
                    />
                  ))}
                </ListCard></AbsorbTouches>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Annuler"
                  onPress={() => setAddTypeChooserVisible(false)}
                  style={({ pressed }) => [styles.addTypeCancel, pressed && { opacity: 0.82 }]}
                >
                  <Text style={[styles.addTypeCancelLabel, { color: colors.textMuted }]}>Annuler</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </PageTransition>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <PillButton label={label} onPress={onPress} />;
}

/** Calendar: grey well = still to pay, green = income, ✓ = paid. */
/** Extra height under each day for its amount. */

function compactCalendarAmount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 1 })}k`;
  return String(Math.round(value));
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backgroundTap: { flexGrow: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
  subsLink: { marginTop: 8 },
  modeRow: { marginBottom: spacing.lg },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  group: { marginBottom: spacing.md },
  nextCard: { gap: 12 },
  nextTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextEyebrow: { ...typographyKit.metaMedium, fontSize: 12 },
  countdown: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  countdownText: { ...typographyKit.metaSemibold, fontSize: 12 },
  nextBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextCopy: { flex: 1, minWidth: 0, gap: 2 },
  nextName: { ...typographyKit.metaSemibold, fontSize: 17 },
  nextMeta: { ...typographyKit.metaMedium, fontSize: 13 },
  nextAmount: { ...moneyAmountTypography({ tier: 'stat', fontSize: 30 }), letterSpacing: -0.8 },
  dateLabel: {
    ...typographyKit.metaMedium,
    fontSize: 13.5,
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  emptyRow: { paddingHorizontal: 14, paddingVertical: 18 },
  empty: { ...typographyKit.metaMedium, fontSize: 13 },
  payIconLogo: { borderRadius: 12, overflow: 'hidden' },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  calNav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  calMonth: { ...typographyKit.metaSemibold, fontSize: 16 },
  weekRow: { flexDirection: 'row' },
  dow: { textAlign: 'center', ...typographyKit.microMedium, fontSize: 11, paddingBottom: 6 },
  dayCell: { alignItems: 'center', justifyContent: 'center' },
  dayTile: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 1 },
  dayNum: { ...typographyKit.metaSemibold, fontSize: 14 },
  dayTileAmount: { ...typographyKit.metaMedium, fontSize: 10.5, lineHeight: 13, letterSpacing: -0.1, includeFontPadding: false },
  dayDot: { width: 5, height: 5, borderRadius: 2.5 },
  calLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  calLegendText: { ...typographyKit.metaMedium, fontSize: 12, lineHeight: 16 },
  /** The FAB anchors on a zero-height wrapper that used to sit at the screen's bottom — keep it there. */
  fabLayer: { justifyContent: 'flex-end' },
  fab: {
    position: 'absolute',
    right: PAGE_PADDING_HORIZONTAL,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 6,
  },
  addTypeOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    elevation: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  addTypeBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.72)' },
  addTypeCardWrap: { width: '100%', maxWidth: 360, zIndex: 1 },
  addTypeCard: {
    width: '100%',
    borderRadius: radius.card + 4,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  addTypeTitle: { ...jakartaBoldText, fontSize: typography.body, textAlign: 'center', marginTop: spacing.xs },
  addTypeCancel: { alignSelf: 'stretch', paddingVertical: 10, alignItems: 'center' },
  addTypeCancelLabel: { ...jakartaMediumText, fontSize: typography.caption },
});
