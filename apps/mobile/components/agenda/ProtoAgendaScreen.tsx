/**
 * Budget Proto Agenda — Figma exact layout (not legacy AgendaView).
 * Month calendar · dots · PAIEMENTS DU MOIS (full month) / DU JOUR (day filter).
 * No day selected by default; tap empty areas to clear day selection.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { MonthSelector } from '@/components/MonthSelector';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PageTransition } from '@/components/PageTransition';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoHeaderIconActions } from '@/components/proto/ProtoHeaderIconActions';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { getCategoryIconName } from '@/constants/categoryOptions';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  CHIP_BORDER_WIDTH,
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  jakartaMediumText,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  radius,
  spacing,
  typography,
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
  markersForDay,
  type ProtoTimelineEntry,
} from '@/lib/protoAgendaBills';
import { getMerchantLogoUrls } from '@/lib/merchantLogo';
import { hasMatchingRecurringPaymentTransaction } from '@/lib/recurringPaymentMatch';
import { GENERIC_RECURRING_ICON } from '@/lib/recurringPaymentPresentation';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import type { AgendaBill, RecurringPayment, Transaction } from '@/types';
import { Ionicons } from '@expo/vector-icons';

const PAY_ICON_SIZE = 32;

/** Extra bottom inset so green agenda FAB (+ stack) clears last payment rows. */
const AGENDA_FAB_SCROLL_CLEARANCE = 64;

/** Header + chooser — same variants as Agenda FAB speed-dial. */
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

function dayUnitFr(n: number) {
  return n === 1 ? '1 jour' : `${n} jours`;
}

function weekUnitFr(n: number) {
  return n === 1 ? '1 semaine' : `${n} semaines`;
}

/** Compact Accueil-style disclosure for paid date groups above the GPS cursor. */
function pastPaymentsDisclosureLabel(count: number, expanded: boolean) {
  if (expanded) return 'Réduire';
  if (count === 1) return 'Voir le paiement déjà passé';
  return `Voir les ${count} paiements déjà passés`;
}

/** Relative urgency copy — week-aware after 7 days, non-anxiogène phrasing. */
function urgencyLabel(dateKey: string, todayKey: string): string | null {
  if (dateKey <= todayKey) return null;
  const days = daysUntilPayment(dateKey, new Date(`${todayKey}T12:00:00`));
  if (days <= 0) return null;
  if (days === 1) return 'dans 1 jour';
  if (days < 7) return `dans ${days} jours`;
  if (days === 7) return 'dans 1 semaine';

  const weeks = Math.floor(days / 7);
  const rem = days % 7;

  if (weeks === 1) {
    return rem === 0 ? 'dans 1 semaine' : `1 semaine et ${dayUnitFr(rem)}`;
  }
  if (weeks === 2) {
    return rem === 0 ? '2 semaines' : `2 semaines et ${dayUnitFr(rem)}`;
  }
  // 21+ (≥ 3 weeks): lead with « dans »
  return rem === 0
    ? `dans ${weekUnitFr(weeks)}`
    : `dans ${weekUnitFr(weeks)} et ${dayUnitFr(rem)}`;
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
function resolveProtoAgendaPayIcon(bill: AgendaBill): string {
  const stored = bill.icon?.trim();
  if (
    stored &&
    stored !== GENERIC_RECURRING_ICON &&
    stored !== 'card-outline' &&
    stored !== 'repeat-outline'
  ) {
    return stored;
  }

  const hasLabel = Boolean(
    bill.categoryId?.trim() || bill.categoryName?.trim() || bill.name?.trim(),
  );
  if (hasLabel) {
    return getCategoryIconName({
      categoryId: bill.categoryId ?? undefined,
      categoryName: bill.categoryName ?? undefined,
      name: bill.name,
    });
  }

  return (bill.kind ?? 'payment') === 'income' ? 'trending-up-outline' : 'card-outline';
}

function TimelinePayIcon({
  bill,
  paid,
  colors,
  isLight,
}: {
  bill: AgendaBill;
  paid: boolean;
  colors: ReturnType<typeof useAppTheme>['colors'];
  isLight: boolean;
}) {
  if (paid) {
    return (
      <View style={[styles.payIcon, { backgroundColor: 'rgba(34,197,94,0.14)' }]}>
        <AppIcon family="ionicons" name="checkmark" size={14} color={colors.accentGreen} />
      </View>
    );
  }

  const logoUrl = bill.logoUrl?.trim() || null;
  const hasRemoteLogo =
    Boolean(logoUrl) || getMerchantLogoUrls(bill.name).length > 0;

  return (
    <UserPickedIconWell
      icon={resolveProtoAgendaPayIcon(bill)}
      size={PAY_ICON_SIZE}
      color={isLight ? colors.text : bill.color}
      logoUrl={logoUrl}
      merchantLabel={bill.name}
      wellGlyphWhite={Boolean(bill.recurring) && bill.kind !== 'income'}
      noBackground={hasRemoteLogo}
      style={hasRemoteLogo ? styles.payIconLogo : undefined}
    />
  );
}

type Props = {
  /** List-row tap → read-only payment detail (not the create/edit form). */
  onOpenPaymentDetail?: (detail: PaymentDetailPayload) => void;
  /**
   * Header type chooser → create form. Prefer this when the parent hosts
   * RecurringPaymentFormModal (Agenda tab). Falls back to uiEvents (same as FAB).
   */
  onAddRecurringPayment?: (variant: RecurringPaymentAddVariant) => void;
};

export function ProtoAgendaScreen({ onOpenPaymentDetail, onAddRecurringPayment }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const now = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  /** null = full month list; set = filter to that calendar day. Never defaults to today. */
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [managingPayments, setManagingPayments] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [addTypeChooserVisible, setAddTypeChooserVisible] = useState(false);
  /** Paid groups above the GPS cursor start collapsed (full-month list only). */
  const [pastPaymentsExpanded, setPastPaymentsExpanded] = useState(false);

  const openAddFormForVariant = useCallback(
    (variant: RecurringPaymentAddVariant) => {
      if (onAddRecurringPayment) {
        onAddRecurringPayment(variant);
        return;
      }
      // Same bus as FloatingTabBar agenda FAB / Accueil « Créer un rappel ».
      uiEvents.requestNewRecurringPayment(variant);
    },
    [onAddRecurringPayment],
  );

  const dismissAddTypeChooser = useCallback(() => {
    setAddTypeChooserVisible(false);
  }, []);

  const chooseAddType = useCallback(
    (variant: RecurringPaymentAddVariant) => {
      tapHaptic();
      // Overlay (not RN Modal) — safe to open RecurringPaymentFormModal in the same turn.
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
    const [nextPayments, nextTx] = await Promise.all([
      getRecurringPayments(),
      getTransactions(),
    ]);
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

  const daysInMonth = rangeEnd.getDate();
  const safeSelectedDay =
    selectedDay == null ? null : Math.min(selectedDay, daysInMonth);
  const selectedDateKey =
    safeSelectedDay == null ? null : dateKeyFromParts(year, month0, safeSelectedDay);
  const dayFilterActive = selectedDateKey != null;

  const timeline = useMemo(() => {
    const entries = buildMonthTimeline(billsByDate, todayKey, year, month0);
    return entries.map((entry) => {
      const billsPaid = entry.bills.map((bill) => {
        if ((bill.kind ?? 'payment') === 'income') {
          return { bill, paid: entry.dateKey <= todayKey };
        }
        const source = bill.sourceId ? paymentsById.get(bill.sourceId) : undefined;
        const matched = hasMatchingRecurringPaymentTransaction(
          bill,
          entry.dateKey,
          expenseTxs,
          source,
        );
        const paid = matched || entry.dateKey < todayKey;
        return { bill, paid };
      });
      const allPaid = billsPaid.every((b) => b.paid);
      return { ...entry, paid: allPaid, billsPaid };
    });
  }, [billsByDate, expenseTxs, month0, paymentsById, todayKey, year]);

  /** Full month when no day selected; otherwise filter to that day. */
  const listTimeline = useMemo(
    () =>
      selectedDateKey == null
        ? timeline
        : timeline.filter((entry) => entry.dateKey === selectedDateKey),
    [selectedDateKey, timeline],
  );

  /**
   * GPS heading on the month rail: last paid group → first unpaid date chip.
   * Hidden for the single-day filter (no month track to follow).
   */
  const gpsCursorAt = useMemo(() => {
    if (dayFilterActive) return null;
    const firstUnpaid = listTimeline.findIndex((entry) => !entry.paid);
    if (firstUnpaid < 0) return null;
    if (firstUnpaid === 0) {
      return listTimeline.length > 1
        ? { index: 0, placement: 'lead' as const }
        : null;
    }
    return { index: firstUnpaid - 1, placement: 'after' as const };
  }, [dayFilterActive, listTimeline]);

  /** Prefix of fully-paid groups above the GPS cursor (not future paid-after-unpaid). */
  const firstUnpaidIndex = useMemo(() => {
    const i = listTimeline.findIndex((entry) => !entry.paid);
    return i < 0 ? listTimeline.length : i;
  }, [listTimeline]);

  const pastPaymentCount = useMemo(() => {
    if (dayFilterActive) return 0;
    return listTimeline
      .slice(0, firstUnpaidIndex)
      .reduce((sum, entry) => sum + entry.billsPaid.length, 0);
  }, [dayFilterActive, firstUnpaidIndex, listTimeline]);

  const collapsePast = pastPaymentCount > 0 && !pastPaymentsExpanded;
  const firstVisibleIndex = collapsePast ? firstUnpaidIndex : 0;
  const upcomingExists = firstUnpaidIndex < listTimeline.length;

  /** Monday-first grid (L=0 … D=6). JS getDay: Sun=0 → map to 6. */
  const firstWeekday = (() => {
    const js = new Date(year, month0, 1).getDay();
    return js === 0 ? 6 : js - 1;
  })();

  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [daysInMonth, firstWeekday]);

  const clearDaySelection = useCallback(() => {
    setSelectedDay((prev) => (prev == null ? prev : null));
  }, []);

  const selectOrToggleDay = useCallback((day: number) => {
    tapHaptic();
    setSelectedDay((prev) => (prev === day ? null : day));
  }, []);

  const goPrevMonth = useCallback(() => {
    setCursor(new Date(year, month0 - 1, 1));
    setSelectedDay(null);
    setPastPaymentsExpanded(false);
  }, [month0, year]);
  const goNextMonth = useCallback(() => {
    setCursor(new Date(year, month0 + 1, 1));
    setSelectedDay(null);
    setPastPaymentsExpanded(false);
  }, [month0, year]);

  const openBill = (bill: AgendaBill, dateKey: string) => {
    if (managingPayments) {
      const id = bill.sourceId?.trim();
      if (!id) return;
      tapHaptic();
      setSelectedPaymentIds((prev) =>
        prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
      );
      return;
    }
    if (!onOpenPaymentDetail) return;
    const payment = bill.sourceId ? paymentsById.get(bill.sourceId) : undefined;
    tapHaptic();
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

  return (
    <PageTransition animate={false}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.fixedTitle,
            {
              paddingTop: insets.top + SCREEN_TOP_GUTTER,
              paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            },
          ]}
        >
          <Text style={[PAGE_TITLE_STYLE, { color: colors.text }]} numberOfLines={1}>
            Agenda
          </Text>
        </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom:
            insets.bottom + FLOATING_NAV_CONTENT_PADDING + AGENDA_FAB_SCROLL_CLEARANCE,
          paddingHorizontal: PAGE_PADDING_HORIZONTAL,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Tap empty areas (not day cells / payment rows / edit-add) → clear day filter */}
        <Pressable onPress={clearDaySelection} style={styles.scrollBody}>

        {/* Same MonthSelector as Budget (above budget widget) — outside calendar shell */}
            <View style={styles.calHeader}>
              <MonthSelector
                month={cursor}
                onPrevious={goPrevMonth}
                onNext={goNextMonth}
                canGoPrevious
                canGoNext
              />
            </View>

        <ProtoGlassCard
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
            <View style={styles.dowRow}>
              {DOW.map((d, i) => (
                <Text key={`${d}-${i}`} style={[styles.dow, { color: colors.textMuted }]}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {calendarCells.map((day, index) => {
                if (day == null) {
                  return <View key={`e-${index}`} style={styles.cell} />;
                }
                const key = dateKeyFromParts(year, month0, day);
                const markers = markersForDay(key, billsByDate);
                const selected = safeSelectedDay != null && day === safeSelectedDay;
                const isToday = key === todayKey;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={isToday ? `${day}, aujourd’hui` : String(day)}
                    onPress={() => selectOrToggleDay(day)}
                    style={styles.cell}
                  >
                    {/* Outer = today ring; inner = selected fill. Same geometry in every state. */}
                    <View
                      style={[
                        styles.dayWell,
                        {
                          borderWidth: CHIP_BORDER_WIDTH,
                          borderColor: isToday ? colors.text : 'transparent',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.dayInner,
                          selected && { backgroundColor: colors.text },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNum,
                            {
                              color: selected
                                ? colors.background
                                : isToday
                                  ? colors.text
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          {day}
                        </Text>
                        <View style={styles.dots}>
                          {markers.hasExpense ? (
                            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                          ) : null}
                          {markers.hasIncome ? (
                            <View style={[styles.dot, { backgroundColor: colors.accentGreen }]} />
                          ) : null}
                          {!markers.hasExpense && !markers.hasIncome && (billsByDate[key]?.length ?? 0) > 0 ? (
                            <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ProtoGlassCard>

        <View>
          <ProtoSectionHeader
            title={dayFilterActive ? 'PAIEMENTS DU JOUR' : 'PAIEMENTS DU MOIS'}
            trailing={
              <ProtoHeaderIconActions
                managing={managingPayments}
                canAdd
                onEdit={toggleManagingPayments}
                onAdd={() => {
                    tapHaptic();
                  setAddTypeChooserVisible(true);
                }}
                editAccessibilityLabel="Gérer les paiements récurrents"
                editDoneAccessibilityLabel="Terminer la gestion"
                addAccessibilityLabel="Ajouter un paiement récurrent"
              />
            }
          />
          {listTimeline.length === 0 ? (
            <ProtoGlassCard padding={16}>
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                {dayFilterActive
                  ? 'Aucun paiement récurrent ce jour'
                  : 'Aucun paiement récurrent ce mois'}
              </Text>
            </ProtoGlassCard>
          ) : (
            <View style={styles.timeline}>
              {pastPaymentCount > 0 ? (
                <View style={styles.timelineRow}>
                  <View style={styles.rail}>
                    {collapsePast && upcomingExists ? (
                      <GpsRailCursor
                        color={isLight ? colors.text : colors.accentGreen}
                        placement="after"
                      />
                    ) : null}
                    {collapsePast && upcomingExists ? (
                      <SegmentedRailLine
                        color={isLight ? colors.text : RAIL_COLOR_DARK}
                        flushTop
                      />
                    ) : !collapsePast && listTimeline.length > 0 ? (
                      <View
                        style={[
                          styles.railSolid,
                          styles.disclosureRailFlush,
                          {
                            backgroundColor: isLight ? colors.text : RAIL_COLOR_DARK,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.cardsCol,
                      (collapsePast ? upcomingExists : listTimeline.length > 0) && {
                        paddingBottom: TIMELINE_BLOCK_GAP,
                      },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        pastPaymentsExpanded
                          ? 'Réduire les paiements déjà passés'
                          : pastPaymentsDisclosureLabel(pastPaymentCount, false)
                      }
                      accessibilityState={{ expanded: pastPaymentsExpanded }}
                      onPress={() => {
                        tapHaptic();
                        setPastPaymentsExpanded((open) => !open);
                      }}
                      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                    >
                      <OnyxContainer
                        style={[onyxContainerRowLayoutStyle(), styles.pastToggleInner]}
                      >
                        <AppIcon
                          family="ionicons"
                          name="checkmark-outline"
                          size={16}
                          color={colors.accentGreen}
                        />
                        <Text style={[styles.pastToggleLabel, { color: colors.textMuted }]}>
                          {pastPaymentsDisclosureLabel(
                            pastPaymentCount,
                            pastPaymentsExpanded,
                          )}
                        </Text>
                        <AppIcon
                          family="ionicons"
                          name={pastPaymentsExpanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={colors.textMuted}
                        />
                      </OnyxContainer>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {listTimeline.map((entry, index) => {
                if (collapsePast && index < firstUnpaidIndex) return null;
                const nextEntry =
                  index < listTimeline.length - 1 ? listTimeline[index + 1]! : null;
                return (
                <TimelineBlock
                  key={entry.dateKey}
                  entry={entry}
                    isFirst={index === firstVisibleIndex}
                    isLast={nextEntry == null}
                    nextIsFuture={nextEntry != null ? nextEntry.dateKey > todayKey : false}
                    nextHasUrgency={
                      nextEntry != null
                        ? urgencyLabel(nextEntry.dateKey, todayKey) != null
                        : false
                  }
                  gpsCursor={
                    collapsePast
                      ? null
                      : gpsCursorAt?.index === index
                        ? gpsCursorAt.placement
                        : null
                  }
                  railColor={isLight ? colors.text : RAIL_COLOR_DARK}
                  isLight={isLight}
                  todayKey={todayKey}
                  colors={colors}
                    selecting={managingPayments}
                    selectedPaymentIds={selectedPaymentIds}
                  onPressBill={openBill}
                />
                );
              })}
            </View>
          )}

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
        confirmLabel={
          selectedPaymentIds.length === 1 ? 'Supprimer' : 'Supprimer la sélection'
        }
        onConfirm={() => void handleConfirmDeleteSelected()}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      {addTypeChooserVisible ? (
        <View
          style={styles.addTypeOverlay}
          accessibilityViewIsModal
          // In-tree overlay — avoids RN Modal + RecurringPaymentFormModal stacking (Android/web).
        >
          <Pressable
            style={styles.addTypeBackdrop}
            onPress={dismissAddTypeChooser}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          />
          <View
            pointerEvents="box-none"
            style={styles.addTypeCardWrap}
          >
            <View
              style={[
                styles.addTypeCard,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.containerBorder,
                },
              ]}
            >
              <Text style={[styles.addTypeTitle, { color: colors.text }]}>
                Que veux-tu ajouter ?
              </Text>
              <View style={styles.addTypeOptions}>
                {AGENDA_ADD_TYPE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.variant}
                    accessibilityRole="button"
                    accessibilityLabel={option.accessibilityLabel}
                    onPress={() => chooseAddType(option.variant)}
                    style={({ pressed }) => [
                      styles.addTypeOption,
                      {
                        backgroundColor: colors.modalAction,
                        borderColor: colors.containerBorder,
                      },
                      pressed && styles.addTypePressed,
                    ]}
                  >
                    <View
                      style={[styles.addTypeIconWrap, { backgroundColor: colors.surfaceElevated }]}
                    >
                      <AppIcon
                        family="ionicons"
                        name={option.icon}
                        size={18}
                        color={colors.text}
                      />
                    </View>
                    <Text style={[styles.addTypeOptionLabel, { color: colors.text }]}>
                      {option.label}
                    </Text>
                    <AppIcon
                      family="ionicons"
                      name="chevron-forward"
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Annuler"
                onPress={dismissAddTypeChooser}
                style={({ pressed }) => [styles.addTypeCancel, pressed && styles.addTypePressed]}
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

type GpsCursorPlacement = 'lead' | 'after';

type TimelineBlockProps = {
  entry: ProtoTimelineEntry & {
    billsPaid: { bill: AgendaBill; paid: boolean }[];
  };
  isFirst: boolean;
  isLast: boolean;
  nextIsFuture: boolean;
  /** Next group shows an urgency tag above its date — rail must span that stack too. */
  nextHasUrgency: boolean;
  /** Navigation chevron on this block’s rail, pointing down toward unpaid dates. */
  gpsCursor?: GpsCursorPlacement | null;
  railColor: string;
  isLight: boolean;
  todayKey: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  selecting?: boolean;
  selectedPaymentIds?: readonly string[];
  onPressBill: (bill: AgendaBill, dateKey: string) => void;
};

/** Fixed dash pitch — density stays constant when the connector stretches. */
const RAIL_DASH_W = 4;
const RAIL_DASH_H = 5;
const RAIL_DASH_GAP = 4;
const RAIL_DASH_PITCH = RAIL_DASH_H + RAIL_DASH_GAP;
const DATE_MARKER_SIZE = 46;
/** GPS-nav chevron — Ionicons glyph (sharp vertex), not two round-cap strokes. */
const GPS_CURSOR_ICON_SIZE = 26;
/** Dark-theme rail stroke — light theme uses `colors.text`. */
const RAIL_COLOR_DARK = 'rgba(255,255,255,0.22)';
/** Small inset under the current date badge (bottom of rail has no inset — abuts next badge). */
const RAIL_GAP_FROM_MARKER = 4;
/** Breathing room between day groups — now inside the previous block so the rail can fill it. */
const TIMELINE_BLOCK_GAP = 14;
/**
 * Vertical space taken by an urgency row before its date badge.
 * Tag: pad 5+5 + lineHeight 15 + hairline border×2; row marginBottom 6.
 */
const GROUP_URGENCY_STACK = 5 + 5 + 15 + 2 * StyleSheet.hairlineWidth + 6;

/**
 * GPS heading on the payments rail — Ionicons chevron (clean vertex), no disc/fill.
 * Sits behind the rail (lower zIndex) so the dotted/solid line stays visible through the glyph.
 * Horizontally centered on the 4px rail axis. Decorative; does not capture presses.
 */
function GpsRailCursor({
  color,
  placement,
}: {
  color: string;
  placement: GpsCursorPlacement;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.gpsCursor,
        placement === 'after' ? styles.gpsCursorAfter : styles.gpsCursorLead,
      ]}
    >
      <Ionicons name="chevron-down" size={GPS_CURSOR_ICON_SIZE} color={color} />
    </View>
  );
}

/** Future / transition rail: repeating dashes at fixed period (not flex-spaced). */
function SegmentedRailLine({
  color,
  flushTop = false,
}: {
  color: string;
  /** No gap under a date chip — used on the past-payments disclosure row. */
  flushTop?: boolean;
}) {
  const [height, setHeight] = useState(0);
  const count = height > 0 ? Math.ceil(height / RAIL_DASH_PITCH) : 0;

  return (
    <View
      style={[styles.railDashed, flushTop && styles.disclosureRailFlush]}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        setHeight((prev) => (prev === h ? prev : h));
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.railDash,
            {
              top: i * RAIL_DASH_PITCH,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const TimelineBlock = memo(function TimelineBlock({
  entry,
  isFirst,
  isLast,
  nextIsFuture,
  nextHasUrgency,
  gpsCursor = null,
  railColor,
  isLight,
  todayKey,
  colors,
  selecting = false,
  selectedPaymentIds = [],
  onPressBill,
}: TimelineBlockProps) {
  /** Solid only between strictly past dates; today + future stay pointillé. */
  const useSolidRail = entry.dateKey < todayKey && !nextIsFuture;
  /** Past dates only — never today / future (keeps "where we are" readable). */
  const isPast = entry.dateKey < todayKey;
  const groupUrgency = urgencyLabel(entry.dateKey, todayKey);
  /**
   * Extra column height after the cards so the rail reaches the next date top.
   * Next urgency (if any) is pulled up into this zone via negative marginTop.
   */
  const railExtendBelow = isLast
    ? 0
    : TIMELINE_BLOCK_GAP + (nextHasUrgency ? GROUP_URGENCY_STACK : 0);

  return (
    <View
      style={[
        styles.timelineBlock,
        /** Sit urgency in the previous rail's extend zone (not above an empty gap). */
        !isFirst && groupUrgency ? { marginTop: -GROUP_URGENCY_STACK } : null,
      ]}
    >
      {/* Tag above the date+cards row so the badge shares a line with the first card. */}
      {groupUrgency ? (
        <View style={styles.groupUrgencyRow}>
          <View
            style={[
              styles.groupUrgencyTag,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.containerBorder,
              },
            ]}
          >
            <Text style={[styles.groupUrgencyText, { color: colors.textSecondary }]}>
              {groupUrgency}
            </Text>
          </View>
        </View>
      ) : null}

    <View style={styles.timelineRow}>
      <View style={styles.rail}>
        <View style={styles.dateMarkerWrap}>
          <View
            style={[
              styles.dateMarker,
              {
                backgroundColor: colors.surfaceElevated,
                opacity: isPast ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.dateDay, { color: colors.text }]}>{entry.day}</Text>
            <Text style={[styles.dateMonth, { color: colors.textMuted }]}>{entry.monthShort}</Text>
          </View>
          {entry.paid ? (
            <View style={[styles.checkBadge, { backgroundColor: colors.accentGreen }]}>
              <AppIcon family="ionicons" name="checkmark" size={10} color="#070709" />
            </View>
          ) : null}
        </View>
        {gpsCursor ? (
          <GpsRailCursor
            color={isLight ? colors.text : colors.accentGreen}
            placement={gpsCursor}
          />
        ) : null}
        {!isLast ? (
            useSolidRail ? (
            <View style={[styles.railSolid, { backgroundColor: railColor }]} />
            ) : (
              <SegmentedRailLine color={railColor} />
          )
        ) : null}
      </View>

        <View style={[styles.cardsCol, railExtendBelow > 0 && { paddingBottom: railExtendBelow }]}>
        {entry.billsPaid.map(({ bill, paid }) => {
          const isIncome = (bill.kind ?? 'payment') === 'income';
            const dimPastPaid = paid && isPast && !selecting;
            const sourceId = bill.sourceId?.trim() ?? '';
            const canSelect = Boolean(sourceId);
            const isSelected = canSelect && selectedPaymentIds.includes(sourceId);
          return (
            <Pressable
              key={`${entry.dateKey}-${bill.sourceId ?? bill.name}`}
                accessibilityRole={selecting ? 'checkbox' : 'button'}
                accessibilityState={
                  selecting ? { selected: isSelected, disabled: !canSelect } : undefined
                }
              onPress={() => onPressBill(bill, entry.dateKey)}
              style={({ pressed }) => [
                dimPastPaid && { opacity: 0.55 },
                pressed && { opacity: dimPastPaid ? 0.45 : 0.85 },
              ]}
            >
              <ProtoGlassCard style={styles.payCard} padding={10}>
                <View style={styles.payInner}>
                    {selecting ? (
                  <View
                    style={[
                          styles.selectCheck,
                          {
                            backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                            borderColor: isSelected
                              ? '#FFFFFF'
                              : canSelect
                                ? colors.borderStrong
                                : colors.borderSubtle,
                            opacity: canSelect ? 1 : 0.35,
                      },
                    ]}
                  >
                        {isSelected ? (
                          <AppIcon family="ionicons" name="checkmark" size={12} color="#0D0D0F" />
                        ) : null}
                      </View>
                    ) : (
                      <TimelinePayIcon bill={bill} paid={paid} colors={colors} isLight={isLight} />
                    )}
                  <View style={styles.payCopy}>
                    <Text style={[styles.payTitle, { color: colors.text }]}>
                      {bill.name}
                    </Text>
                    <View style={styles.payMetaRow}>
                      <Text style={[styles.payCat, { color: colors.textMuted }]}>
                        {bill.categoryName ?? bill.account}
                      </Text>
                      {bill.recurring ? (
                        <AppIcon
                          family="ionicons"
                          name="sync-outline"
                          size={11}
                          color={isLight ? colors.text : colors.textMuted}
                        />
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.payRight}>
                    {!paid ? (
                      <Text
                        style={[
                          moneyAmountTypography({ tier: 'row', fontSize: 13 }),
                          {
                            color: isIncome ? colors.accentGreen : colors.text,
                            letterSpacing: -0.3,
                          },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {isIncome ? '+' : '−'}
                        {formatDisplayMoneyAbsolute(Math.abs(bill.amount))}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </ProtoGlassCard>
            </Pressable>
          );
        })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  fixedTitle: {
    flexShrink: 0,
    paddingBottom: spacing.sm,
  },
  /** Title → month nav → calendar card → payments. Title→month also uses calHeader.marginTop. */
  scrollBody: { gap: spacing.lg },
  selectCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /** Flat on `colors.background` — no card chrome. Extra top margin beyond scrollBody gap. */
  calHeader: {
    marginTop: spacing.md,
  },
  dowRow: { flexDirection: 'row', marginBottom: spacing.sm },
  dow: {
    flex: 1,
    textAlign: 'center',
    ...typographyKit.microMedium,
    fontSize: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayWell: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
    borderRadius: radius.md,
  },
  dayInner: {
    flex: 1,
    margin: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.sm,
  },
  dayNum: { ...typographyKit.metaSemibold, fontSize: 13 },
  dots: { flexDirection: 'row', gap: 3, minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  empty: { ...typographyKit.metaMedium, fontSize: 13 },
  /**
   * No inter-block gap — spacing lives in `cardsCol.paddingBottom` so the rail
   * column stretches through it and abuts the next date badge.
   */
  timeline: { gap: 0 },
  timelineBlock: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  pastToggleInner: {
    justifyContent: 'center',
    gap: 6,
  },
  pastToggleLabel: {
    ...typographyKit.metaSemibold,
    fontSize: 13,
  },
  rail: {
    width: 50,
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  dateMarkerWrap: {
    width: DATE_MARKER_SIZE,
    height: DATE_MARKER_SIZE,
    position: 'relative',
    zIndex: 3,
  },
  dateMarker: {
    width: DATE_MARKER_SIZE,
    height: DATE_MARKER_SIZE,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  dateDay: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  dateMonth: {
    ...typographyKit.micro,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railSolid: {
    flex: 1,
    width: RAIL_DASH_W,
    marginTop: RAIL_GAP_FROM_MARKER,
    minHeight: 24,
    borderRadius: 2,
    position: 'relative',
    zIndex: 2,
  },
  railDashed: {
    flex: 1,
    width: RAIL_DASH_W,
    marginTop: RAIL_GAP_FROM_MARKER,
    minHeight: 24,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 2,
  },
  /** Disclosure row has no date chip — rail fills the full column height. */
  disclosureRailFlush: {
    marginTop: 0,
  },
  railDash: {
    position: 'absolute',
    left: 0,
    width: RAIL_DASH_W,
    height: RAIL_DASH_H,
    borderRadius: 2,
  },
  /**
   * GPS heading — behind the rail (zIndex 1 < rail 2); centered on the rail axis.
   * Never covers date chips or checkmarks.
   */
  gpsCursor: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    height: GPS_CURSOR_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  gpsCursorAfter: {
    bottom: 2,
  },
  gpsCursorLead: {
    top: DATE_MARKER_SIZE + RAIL_GAP_FROM_MARKER,
  },
  cardsCol: { flex: 1, minWidth: 0, gap: 8, paddingBottom: 0 },
  /** Offset past the date rail; modest bottom gap so tag → own cards stays tight. */
  groupUrgencyRow: {
    marginLeft: 60,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  groupUrgencyTag: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  groupUrgencyText: {
    ...jakartaMediumText,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: -0.1,
  },
  payCard: { borderRadius: 16 },
  payInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payIcon: {
    width: PAY_ICON_SIZE,
    height: PAY_ICON_SIZE,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  payIconLogo: {
    borderRadius: 9,
    overflow: 'hidden',
  },
  payCopy: { flex: 1, minWidth: 0, gap: 2, flexShrink: 1 },
  payTitle: {
    ...typographyKit.rowTitle,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  payMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  payCat: { ...typographyKit.micro, fontSize: 10, lineHeight: 13, flexShrink: 1 },
  payRight: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
    maxWidth: '38%',
    minWidth: 64,
  },
  addTypeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  addTypeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  addTypeCardWrap: {
    width: '100%',
    maxWidth: 340,
    zIndex: 1,
  },
  addTypeCard: {
    width: '100%',
    borderRadius: radius.card + 4,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  addTypeTitle: {
    ...jakartaBoldText,
    fontSize: typography.body,
    textAlign: 'center',
  },
  addTypeOptions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  addTypeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTypeOptionLabel: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    flex: 1,
  },
  addTypeCancel: {
    alignSelf: 'stretch',
    paddingVertical: 10,
    alignItems: 'center',
  },
  addTypeCancelLabel: {
    ...jakartaMediumText,
    fontSize: typography.caption,
  },
  addTypePressed: {
    opacity: 0.82,
  },
});
