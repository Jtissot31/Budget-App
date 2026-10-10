/**
 * Agenda — paiements et revenus récurrents du mois, au style de l'historique.
 *
 * 1. Résumé du mois (solde prévu · entrées · sorties · reste à payer)
 * 2. Liste | Calendrier (segmented, même contrôle que Transactions)
 * 3. Paiements groupés par jour dans des cartes « verre »
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

function PayIcon({ bill }: { bill: AgendaBill }) {
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

export function ProtoAgendaScreen({ onOpenPaymentDetail, onAddRecurringPayment }: Props) {
  const insets = useSafeAreaInsets();
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
          contentContainerStyle={{
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + AGENDA_FAB_SCROLL_CLEARANCE,
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <PageHeader
            topInset={insets.top}
            title="Agenda"
            subtitle={monthLabel}
            trailing={
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
            }
          />

          <View style={styles.section}>
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
                { label: 'Sorties', value: `−${formatDisplayMoneyAbsolute(monthCash.committed)}` },
                { label: 'Entrées', value: signedMoney(monthCash.inflows, { plus: true }), color: colors.accentGreen },
                {
                  label: 'Solde',
                  value: signedMoney(monthCash.net, { plus: true }),
                  color: monthCash.net < 0 ? colors.danger : colors.accentGreen,
                },
              ]}
            />
          </View>

          <View style={styles.modeRow}>
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
          </View>

          {bodyMode === 'calendar' ? (
            <View style={styles.section}>
              <ListCard padding={12}>
                <View style={styles.dowRow}>
                  {DOW.map((d, i) => (
                    <Text key={`${d}-${i}`} style={[styles.dow, { color: colors.textMuted }]}>
                      {d}
                    </Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {calendarCells.map((day, index) => {
                    if (day == null) return <View key={`e-${index}`} style={styles.cell} />;
                    const key = dateKeyFromParts(year, month0, day);
                    const bills = billsByDate[key] ?? [];
                    const out = bills.reduce(
                      (sum, bill) => sum + ((bill.kind ?? 'payment') === 'income' ? 0 : Math.abs(bill.amount)),
                      0,
                    );
                    const hasIncome = bills.some((bill) => (bill.kind ?? 'payment') === 'income');
                    const selected = safeSelectedDay === day;
                    const isToday = key === todayKey;
                    const isPast = key < todayKey;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${day}${isToday ? ', aujourd’hui' : ''}${out > 0 ? `, ${formatDisplayMoneyAbsolute(out)} à payer` : ''}`}
                        onPress={() => {
                          tapHaptic();
                          setSelectedDay((prev) => (prev === day ? null : day));
                        }}
                        style={styles.cell}
                      >
                        <View
                          style={[
                            styles.dayInner,
                            bills.length > 0 && { backgroundColor: colors.surfaceElevated },
                            selected && { borderColor: colors.text, borderWidth: 1.5 },
                          ]}
                        >
                          <View style={[styles.dayNumWrap, isToday && { backgroundColor: colors.text }]}>
                            <Text
                              style={[
                                styles.dayNum,
                                {
                                  color: isToday
                                    ? colors.background
                                    : isPast
                                      ? colors.textMuted
                                      : colors.text,
                                },
                              ]}
                            >
                              {day}
                            </Text>
                          </View>
                          {out > 0 ? (
                            <Text
                              style={[styles.dayAmount, { color: isPast ? colors.textMuted : colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {out >= 1000 ? `${Math.round(out / 100) / 10}k` : Math.round(out)}
                            </Text>
                          ) : hasIncome ? (
                            <View style={[styles.incomeDot, { backgroundColor: colors.accentGreen }]} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ListCard>
            </View>
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
            <ListCard>
              <View style={styles.emptyRow}>
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {selectedDateKey ? 'Aucun paiement ce jour' : 'Aucun paiement récurrent ce mois'}
                </Text>
              </View>
            </ListCard>
          ) : selectedDateKey || managingPayments ? (
            <ListCard>
              {flatItems.map((item, index) => renderBillRow(item, index === flatItems.length - 1))}
            </ListCard>
          ) : (
            <>
              {nextItem ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Prochain paiement : ${nextItem.bill.name}`}
                  scaleTo={0.985}
                  onPress={() => openBill(nextItem.bill, nextItem.dateKey)}
                  style={styles.group}
                >
                  <ListCard padding={16} style={styles.nextCard}>
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
                        <Text style={[styles.nextName, { color: colors.text }]} numberOfLines={1}>
                          {nextItem.bill.name}
                        </Text>
                        <Text style={[styles.nextMeta, { color: colors.textMuted }]} numberOfLines={1}>
                          {[dueLong(nextItem.dateKey), nextItem.bill.account].filter(Boolean).join(' · ')}
                        </Text>
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
                  </ListCard>
                </PressScale>
              ) : null}

              {thisWeek.length > 0 ? (
                <View style={styles.group}>
                  <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
                    Cette semaine · {formatDisplayMoneyAbsolute(sumOut(thisWeek))}
                  </Text>
                  <ListCard>
                    {thisWeek.map((item, index) => renderBillRow(item, index === thisWeek.length - 1))}
                  </ListCard>
                </View>
              ) : null}

              {later.length > 0 ? (
                <View style={styles.group}>
                  <Text style={[styles.dateLabel, { color: colors.textMuted }]}>
                    Plus tard ce mois · {formatDisplayMoneyAbsolute(sumOut(later))}
                  </Text>
                  <ListCard>
                    {later.map((item, index) => renderBillRow(item, index === later.length - 1))}
                  </ListCard>
                </View>
              ) : null}

              {paidItems.length > 0 ? (
                <View style={styles.group}>
                  <ListCard>
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
                  </ListCard>
                </View>
              ) : null}
            </>
          )}
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
                <ListCard>
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
                </ListCard>
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
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      <Text style={[typographyKit.metaSemibold, { fontSize: 11, color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
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
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  emptyRow: { paddingHorizontal: 14, paddingVertical: 18 },
  empty: { ...typographyKit.metaMedium, fontSize: 13 },
  payIconLogo: { borderRadius: 12, overflow: 'hidden' },
  dowRow: { flexDirection: 'row', marginBottom: 6 },
  dow: { flex: 1, textAlign: 'center', ...typographyKit.microMedium, fontSize: 11, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.9, padding: 2 },
  dayInner: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayNumWrap: { minWidth: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dayNum: { ...typographyKit.metaSemibold, fontSize: 13 },
  dayAmount: { ...typographyKit.metaMedium, fontSize: 9.5, lineHeight: 11 },
  incomeDot: { width: 5, height: 5, borderRadius: 2.5 },
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
