/**
 * Budget Proto Agenda — Figma exact layout (not legacy AgendaView).
 * Summary cards · Mois|Semaine · calendar dots · PAIEMENTS DU MOIS timeline.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { PageTransition } from '@/components/PageTransition';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  FLOATING_NAV_CONTENT_PADDING,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_STYLE,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ensureDbReady } from '@/lib/init';
import { getRecurringPayments, getTransactions } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { daysUntilPayment } from '@/lib/paymentStatusBadge';
import { averageMonthlyCashflow } from '@/lib/plans/monthlyCashflowAverage';
import {
  getPayEstimationSettings,
  toMonthlyAveragePayAmount,
  type PayEstimationSettings,
} from '@/lib/payEstimationSettings';
import {
  buildMonthTimeline,
  buildRecurringBillsByDate,
  dateKeyFromDate,
  dateKeyFromParts,
  markersForDay,
  sumMonthCashflow,
  type ProtoTimelineEntry,
} from '@/lib/protoAgendaBills';
import { hasMatchingRecurringPaymentTransaction } from '@/lib/recurringPaymentMatch';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import type { AgendaBill, RecurringPayment, Transaction } from '@/types';

/** Normalize a recurring payment to a monthly amount (same factors as goalProjection / pay estimation). */
function monthlyObligationEquivalent(payment: RecurringPayment): number {
  const amount = Number.isFinite(payment.amount) ? Math.max(0, payment.amount) : 0;
  if (payment.frequency === 'weekly') return (amount * 52) / 12;
  if (payment.frequency === 'biweekly') return (amount * 26) / 12;
  if (payment.frequency === 'yearly') return amount / 12;
  return amount;
}

type ViewMode = 'month' | 'week';

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const MONTH_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthTitle(year: number, month0: number) {
  return `${capitalize(MONTH_FR[month0] ?? '')} ${year}`;
}

function urgencyLabel(dateKey: string, todayKey: string): string | null {
  if (dateKey <= todayKey) return null;
  const days = daysUntilPayment(dateKey, new Date(`${todayKey}T12:00:00`));
  if (days <= 0) return null;
  return `dans ${days}j`;
}

function urgencyColor(days: number, danger: string, warning: string) {
  if (days <= 3) return danger;
  if (days <= 10) return warning;
  return warning;
}

function formatBillDateLong(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

type Props = {
  /** List-row tap → read-only payment detail (not the create/edit form). */
  onOpenPaymentDetail?: (detail: PaymentDetailPayload) => void;
};

export function ProtoAgendaScreen({ onOpenPaymentDetail }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const now = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDay, setSelectedDay] = useState(() => now.getDate());
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paySettings, setPaySettings] = useState<PayEstimationSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const todayKey = dateKeyFromDate(now);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [nextPayments, nextTx, nextPaySettings] = await Promise.all([
      getRecurringPayments(),
      getTransactions(),
      getPayEstimationSettings(),
    ]);
    setPayments(nextPayments);
    setTransactions(nextTx);
    setPaySettings(nextPaySettings);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load);

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

  const { expenses, income } = useMemo(() => sumMonthCashflow(billsByDate), [billsByDate]);

  /** Active non-income recurrings, normalized to a monthly amount. */
  const monthlyObligations = useMemo(
    () =>
      payments
        .filter((payment) => payment.active && payment.kind !== 'income')
        .reduce((sum, payment) => sum + monthlyObligationEquivalent(payment), 0),
    [payments],
  );

  /** Pay-average salary first; else historical income average (3 months). */
  const estimatedMonthlyRevenue = useMemo(() => {
    const fromPay =
      paySettings?.averageAmount != null
        ? toMonthlyAveragePayAmount(paySettings.averageAmount, paySettings.frequency)
        : null;
    if (fromPay != null && fromPay > 0) return fromPay;
    return averageMonthlyCashflow(transactions, now, 3).monthlyIncome;
  }, [now, paySettings, transactions]);

  const availableAfterObligations = estimatedMonthlyRevenue - monthlyObligations;

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

  const daysInMonth = rangeEnd.getDate();
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

  const weekStrip = useMemo(() => {
    const selected = new Date(year, month0, Math.min(selectedDay, daysInMonth));
    const js = selected.getDay();
    const mondayOffset = js === 0 ? -6 : 1 - js;
    const monday = new Date(selected);
    monday.setDate(selected.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [daysInMonth, month0, selectedDay, year]);

  const goPrevMonth = () => {
    tapHaptic();
    setCursor(new Date(year, month0 - 1, 1));
    setSelectedDay(1);
  };
  const goNextMonth = () => {
    tapHaptic();
    setCursor(new Date(year, month0 + 1, 1));
    setSelectedDay(1);
  };

  const openBill = (bill: AgendaBill, dateKey: string) => {
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

  const subtitle = monthTitle(year, month0);

  return (
    <PageTransition>
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingTop: insets.top + SCREEN_TOP_GUTTER,
          paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
          paddingHorizontal: PAGE_PADDING_HORIZONTAL,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View>
          <Text style={[PAGE_TITLE_STYLE, { color: colors.text }]}>Agenda</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <ProtoGlassCard style={styles.summaryCard} padding={12}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Dépenses</Text>
              <Text
                style={[
                  moneyAmountTypography({ tier: 'stat', fontSize: 18 }),
                  { color: colors.text, letterSpacing: -0.5 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                −{formatDisplayMoneyAbsolute(expenses)}
              </Text>
            </ProtoGlassCard>
            <ProtoGlassCard style={styles.summaryCard} padding={12}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Revenus</Text>
              <Text
                style={[
                  moneyAmountTypography({ tier: 'stat', fontSize: 18 }),
                  { color: colors.accentGreen, letterSpacing: -0.5 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                +{formatDisplayMoneyAbsolute(income)}
              </Text>
            </ProtoGlassCard>
          </View>

          <View style={styles.summaryRow}>
            <ProtoGlassCard style={styles.summaryCard} padding={12}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Obligations</Text>
              <Text
                style={[
                  moneyAmountTypography({ tier: 'stat', fontSize: 18 }),
                  { color: colors.text, letterSpacing: -0.5 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                −{formatDisplayMoneyAbsolute(monthlyObligations)}
              </Text>
            </ProtoGlassCard>
            <ProtoGlassCard style={styles.summaryCard} padding={12}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Revenu moyen estimé</Text>
              <Text
                style={[
                  moneyAmountTypography({ tier: 'stat', fontSize: 18 }),
                  { color: colors.accentGreen, letterSpacing: -0.5 },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                +{formatDisplayMoneyAbsolute(estimatedMonthlyRevenue)}
              </Text>
            </ProtoGlassCard>
          </View>

          <ProtoGlassCard style={styles.summaryCard} padding={12}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Disponible</Text>
            <Text
              style={[
                moneyAmountTypography({ tier: 'stat', fontSize: 18 }),
                {
                  color:
                    availableAfterObligations >= 0 ? colors.accentGreen : colors.danger,
                  letterSpacing: -0.5,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {availableAfterObligations >= 0 ? '+' : '−'}
              {formatDisplayMoneyAbsolute(Math.abs(availableAfterObligations))}
            </Text>
          </ProtoGlassCard>
        </View>

        <View style={styles.modeRow}>
          <View style={[styles.modeSwitch, { backgroundColor: colors.surfaceElevated }]}>
            {(['month', 'week'] as const).map((mode) => {
              const active = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    tapHaptic();
                    setViewMode(mode);
                  }}
                  style={[
                    styles.modeChip,
                    active && { backgroundColor: 'rgba(255,255,255,0.12)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeLabel,
                      { color: active ? colors.text : colors.textMuted },
                    ]}
                  >
                    {mode === 'month' ? 'Mois' : 'Semaine'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {viewMode === 'month' ? (
          <ProtoGlassCard padding={16}>
            <View style={styles.calHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mois précédent"
                onPress={goPrevMonth}
                hitSlop={10}
                style={styles.calChevron}
              >
                <AppIcon family="ionicons" name="chevron-back" size={16} color={colors.textSecondary} />
              </Pressable>
              <Text
                style={[styles.calTitle, { color: colors.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {subtitle}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mois suivant"
                onPress={goNextMonth}
                hitSlop={10}
                style={styles.calChevron}
              >
                <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

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
                const selected = day === selectedDay;
                const isToday = key === todayKey;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      tapHaptic();
                      setSelectedDay(day);
                    }}
                    style={styles.cell}
                  >
                    <View
                      style={[
                        styles.dayWell,
                        selected && {
                          backgroundColor: colors.surfaceElevated,
                          borderRadius: 10,
                        },
                        isToday && !selected && { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          { color: selected || isToday ? colors.text : colors.textSecondary },
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
                  </Pressable>
                );
              })}
            </View>
          </ProtoGlassCard>
        ) : (
          <View style={styles.weekStrip}>
            {weekStrip.map((d) => {
              const key = dateKeyFromDate(d);
              const dayNum = d.getDate();
              const selected = dayNum === selectedDay && d.getMonth() === month0;
              const markers = markersForDay(key, billsByDate);
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    tapHaptic();
                    if (d.getMonth() !== month0) {
                      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                    }
                    setSelectedDay(dayNum);
                  }}
                  style={styles.weekDay}
                >
                  <Text
                    style={[
                      styles.weekDayNum,
                      { color: selected ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {dayNum}
                  </Text>
                  {markers.hasExpense || markers.hasIncome || key === todayKey ? (
                    <View
                      style={[
                        styles.weekDot,
                        {
                          backgroundColor: markers.hasExpense
                            ? colors.danger
                            : markers.hasIncome
                              ? colors.accentGreen
                              : colors.text,
                        },
                      ]}
                    />
                  ) : (
                    <View style={styles.weekDotSpacer} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <View>
          <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>
            PAIEMENTS DU MOIS
          </Text>
          {timeline.length === 0 ? (
            <ProtoGlassCard padding={16}>
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Aucun paiement récurrent ce mois-ci
              </Text>
            </ProtoGlassCard>
          ) : (
            <View style={styles.timeline}>
              {timeline.map((entry, index) => (
                <TimelineBlock
                  key={entry.dateKey}
                  entry={entry}
                  isLast={index === timeline.length - 1}
                  nextIsFuture={
                    index < timeline.length - 1 ? timeline[index + 1]!.dateKey > todayKey : false
                  }
                  todayKey={todayKey}
                  colors={colors}
                  onPressBill={openBill}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </PageTransition>
  );
}

type TimelineBlockProps = {
  entry: ProtoTimelineEntry & {
    billsPaid: { bill: AgendaBill; paid: boolean }[];
  };
  isLast: boolean;
  nextIsFuture: boolean;
  todayKey: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  onPressBill: (bill: AgendaBill, dateKey: string) => void;
};

/** Future / transition rail: short dashes matching paid solid connector height. */
function SegmentedRailLine() {
  const dash = {
    width: 4,
    height: 6,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  } as const;
  return (
    <View
      style={{
        flex: 1,
        width: 4,
        marginVertical: 4,
        minHeight: 24,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        gap: 3,
      }}
    >
      <View style={dash} />
      <View style={dash} />
      <View style={dash} />
    </View>
  );
}

function TimelineBlock({
  entry,
  isLast,
  nextIsFuture,
  todayKey,
  colors,
  onPressBill,
}: TimelineBlockProps) {
  const solidLine = entry.dateKey <= todayKey && !nextIsFuture;
  const showDashed = entry.dateKey >= todayKey || nextIsFuture;
  /** Past dates only — never today / future (keeps "where we are" readable). */
  const isPast = entry.dateKey < todayKey;

  return (
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
        {!isLast ? (
          showDashed && !solidLine ? (
            <SegmentedRailLine />
          ) : (
            <View style={styles.railSolid} />
          )
        ) : null}
      </View>

      <View style={styles.cardsCol}>
        {entry.billsPaid.map(({ bill, paid }) => {
          const urgency = urgencyLabel(entry.dateKey, todayKey);
          const days = urgency ? daysUntilPayment(entry.dateKey, new Date(`${todayKey}T12:00:00`)) : 0;
          const isIncome = (bill.kind ?? 'payment') === 'income';
          const dimPastPaid = paid && isPast;
          return (
            <Pressable
              key={`${entry.dateKey}-${bill.sourceId ?? bill.name}`}
              accessibilityRole="button"
              onPress={() => onPressBill(bill, entry.dateKey)}
              style={({ pressed }) => [
                dimPastPaid && { opacity: 0.55 },
                pressed && { opacity: dimPastPaid ? 0.45 : 0.85 },
              ]}
            >
              <ProtoGlassCard style={styles.payCard} padding={10}>
                <View style={styles.payInner}>
                  <View
                    style={[
                      styles.payIcon,
                      {
                        backgroundColor: paid
                          ? 'rgba(34,197,94,0.14)'
                          : colors.surfaceElevated,
                      },
                    ]}
                  >
                    {paid ? (
                      <AppIcon family="ionicons" name="checkmark" size={14} color={colors.accentGreen} />
                    ) : (
                      <AppIcon
                        family="ionicons"
                        name={isIncome ? 'trending-up-outline' : 'card-outline'}
                        size={14}
                        color={colors.textMuted}
                      />
                    )}
                  </View>
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
                          color={colors.textMuted}
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
                    {!paid && urgency ? (
                      <Text
                        style={[
                          styles.urgency,
                          {
                            color: urgencyColor(days, colors.danger, '#FBBF24'),
                          },
                        ]}
                      >
                        {urgency}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  subtitle: {
    ...typographyKit.metaMedium,
    fontSize: 13,
    marginTop: 4,
  },
  summarySection: { gap: 10 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, gap: 6, minWidth: 0 },
  summaryLabel: { ...typographyKit.metaMedium, fontSize: 11 },
  modeRow: { alignItems: 'flex-end' },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeLabel: { ...typographyKit.metaSemibold, fontSize: 12 },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  calChevron: { padding: 4 },
  calTitle: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  dowRow: { flexDirection: 'row', marginBottom: 6 },
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayNum: { ...typographyKit.metaSemibold, fontSize: 13 },
  dots: { flexDirection: 'row', gap: 3, minHeight: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  weekDay: { alignItems: 'center', flex: 1, gap: 6 },
  weekDayNum: { ...typographyKit.rowTitle, fontSize: 15 },
  weekDot: { width: 5, height: 5, borderRadius: 2.5 },
  weekDotSpacer: { height: 5 },
  sectionEyebrow: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  empty: { ...typographyKit.metaMedium, fontSize: 13 },
  timeline: { gap: 4 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  rail: { width: 50, alignItems: 'center' },
  dateMarkerWrap: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  dateMarker: {
    width: 46,
    height: 46,
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
    width: 4,
    marginVertical: 4,
    minHeight: 24,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  cardsCol: { flex: 1, minWidth: 0, gap: 8, paddingBottom: 0 },
  payCard: { borderRadius: 16 },
  payInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
  urgency: { ...typographyKit.metaSemibold, fontSize: 10, letterSpacing: -0.1 },
});
