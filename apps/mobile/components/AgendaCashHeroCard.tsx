import { Fragment, useMemo, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DashboardCard } from '@/components/DashboardCard';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  moneyAmountTypography,
  radius,
  spacing,
  transactionRowAmountTypography,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

type PaycheckPreview = {
  amount: number;
  dateKey: string;
};

type DaySquare = {
  dateKey: string;
  dayNum: number;
  weekday: string;
  hasPayment: boolean;
  isPaycheck: boolean;
  isToday: boolean;
};

type Props = {
  checkingBalanceTotal: number;
  upcomingBillsBeforePaycheck: number;
  billCount: number;
  paycheck?: PaycheckPreview | null;
  /** Local day key YYYY-MM-DD for "today". */
  todayKey: string;
  /** Day keys in the strip window that have at least one outgoing payment. */
  paymentDateKeys?: readonly string[];
  /** Outgoing payment totals by day key (excludes income / paycheck). */
  paymentDayAmounts?: Readonly<Record<string, number>>;
  /** Local day key YYYY-MM-DD for the selected strip day (list view). */
  selectedDateKey?: string | null;
  onDayPress?: (dateKey: string) => void;
};

const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const;
const STRIP_DAY_COUNT = 31;
/** Day cell width — shared by strip columns and timeline segments. */
const DAY_SQUARE_WIDTH = 46;
/** Vertical separator between day columns (same as strip dividers). */
const DAY_DIVIDER_WIDTH = StyleSheet.hairlineWidth;
/** One day column + trailing divider (uniform strip pitch). */
const DAY_PITCH = DAY_SQUARE_WIDTH + DAY_DIVIDER_WIDTH;
/** Timeline maps to N day columns currently visible in the strip viewport. */
const TIMELINE_VISIBLE_DAYS = 7;
const TIMELINE_DOT_SIZE = 8;
/** Right-pointing chevron (`>`) marking today on the timeline track. */
const TODAY_CURSOR_SIZE = 16;
/** Alias kept so Fast Refresh / older evals never throw ReferenceError. */
const TODAY_CURSOR_HEIGHT = TODAY_CURSOR_SIZE;
const TIMELINE_SEGMENT_TICK_HEIGHT = 7;
/** Track stays ~12px; today chevron may overflow vertically when centered. */
const TIMELINE_TRACK_HEIGHT = Math.max(
  TIMELINE_DOT_SIZE,
  TIMELINE_SEGMENT_TICK_HEIGHT,
  12,
);
/** Extra gap beyond estimated label half-widths before treating as clear. */
const AMOUNT_COLLISION_PAD_PX = 4;
/** Vertical step when stacking colliding amount labels downward. */
const TIMELINE_STACK_STEP = 14;
/** Gap between track bottom and the first (level 0) amount label. */
const TIMELINE_LABEL_TOP_GAP = 2;
/** Reserved vertical room for one amount-label row below the track. */
const TIMELINE_AMOUNT_RESERVE = 18;
/** Approx half-width for micro tabular amount labels (e.g. `≈ +609,87$`). */
const TIMELINE_LABEL_CHAR_HALF_WIDTH = 3.4;
const TIMELINE_LABEL_MIN_HALF_WIDTH = 28;
/** Timeline day ticks — slightly wider than strip hairlines for contrast. */
const TIMELINE_SEGMENT_TICK_WIDTH = Math.max(2, StyleSheet.hairlineWidth * 3);

/** Width of the N-day timeline track (= first N strip columns + N−1 dividers). */
const TIMELINE_WEEK_WIDTH =
  TIMELINE_VISIBLE_DAYS * DAY_SQUARE_WIDTH + (TIMELINE_VISIBLE_DAYS - 1) * DAY_DIVIDER_WIDTH;

type TimelineAmountMarker = {
  key: string;
  left: number;
  label: string;
  kind: 'payment' | 'paycheck';
  accessibilityLabel: string;
  /** 0 = default below track; higher = stacked further down on collision. */
  stackLevel: number;
};

function addDaysToKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T12:00:00`).getTime();
  const to = new Date(`${toKey}T12:00:00`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function buildDaySquares(
  todayKey: string,
  paymentKeys: ReadonlySet<string>,
  paycheckDateKey: string | null,
  dayCount: number,
): DaySquare[] {
  const squares: DaySquare[] = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    const key = addDaysToKey(todayKey, offset);
    const date = new Date(`${key}T12:00:00`);
    squares.push({
      dateKey: key,
      dayNum: date.getDate(),
      weekday: WEEKDAY_SHORT[date.getDay()] ?? '',
      hasPayment: paymentKeys.has(key),
      isPaycheck: paycheckDateKey === key,
      isToday: offset === 0,
    });
  }
  return squares;
}

/**
 * X of a day-column center inside the timeline track for the current visible window.
 * Returns null when the day is outside the visible N-day window.
 */
function markerLeftInTrack(dayIndex: number, visibleStartIndex: number): number | null {
  const relative = dayIndex - visibleStartIndex;
  if (relative < 0 || relative >= TIMELINE_VISIBLE_DAYS) return null;
  return relative * DAY_PITCH + DAY_SQUARE_WIDTH / 2;
}

/** X of each day-column center — same positions as markers (today, payday, payments). */
const TIMELINE_DAY_TICK_XS = Array.from(
  { length: TIMELINE_VISIBLE_DAYS },
  (_, dayIndexInWindow) => dayIndexInWindow * DAY_PITCH + DAY_SQUARE_WIDTH / 2,
);

function visibleStartIndexFromScroll(scrollX: number): number {
  const maxStart = Math.max(0, STRIP_DAY_COUNT - TIMELINE_VISIBLE_DAYS);
  const raw = Math.round(scrollX / DAY_PITCH);
  return Math.max(0, Math.min(maxStart, raw));
}

function estimateLabelHalfWidth(labelText: string): number {
  return Math.max(
    TIMELINE_LABEL_MIN_HALF_WIDTH,
    labelText.length * TIMELINE_LABEL_CHAR_HALF_WIDTH,
  );
}

/** True when two centered amount labels would overlap horizontally. */
function amountLabelsCollide(
  a: { left: number; label: string },
  b: { left: number; label: string },
): boolean {
  const gap = Math.abs(a.left - b.left);
  return (
    gap <
    estimateLabelHalfWidth(a.label) + estimateLabelHalfWidth(b.label) + AMOUNT_COLLISION_PAD_PX
  );
}

/**
 * Place amounts below the track. When labels collide horizontally, stack the
 * later one further down than each prior colliding label (never above the track).
 */
function resolveAmountStackLevels(
  markers: Array<Omit<TimelineAmountMarker, 'stackLevel'>>,
): TimelineAmountMarker[] {
  const sorted = [...markers].sort((a, b) => a.left - b.left || a.key.localeCompare(b.key));
  const placed: TimelineAmountMarker[] = sorted.map((marker) => ({
    ...marker,
    stackLevel: 0,
  }));

  for (let i = 0; i < placed.length; i += 1) {
    let level = 0;
    for (let j = 0; j < i; j += 1) {
      if (!amountLabelsCollide(placed[j], placed[i])) continue;
      level = Math.max(level, placed[j].stackLevel + 1);
    }
    placed[i].stackLevel = level;
  }

  return placed;
}

/** Keep a centered (`translateX: -50%`) label inside the timeline amounts layer. */
function clampTimelineLabelLeft(left: number, labelText: string, containerWidth: number): number {
  if (containerWidth <= 0) return left;
  const halfWidth = Math.max(
    TIMELINE_LABEL_MIN_HALF_WIDTH,
    labelText.length * TIMELINE_LABEL_CHAR_HALF_WIDTH,
  );
  return Math.min(containerWidth - halfWidth, Math.max(halfWidth, left));
}

/** Cash hero — balance, payment/paycheck timeline, scrollable day strip. */
export function AgendaCashHeroCard({
  checkingBalanceTotal,
  upcomingBillsBeforePaycheck,
  billCount: _billCount,
  paycheck,
  todayKey,
  paymentDateKeys = [],
  paymentDayAmounts = {},
  selectedDateKey = null,
  onDayPress,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const [timelineAmountsWidth, setTimelineAmountsWidth] = useState(TIMELINE_WEEK_WIDTH);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const timelineTrackColor = isLight ? colors.borderStrong : 'rgba(255, 255, 255, 0.22)';
  const timelineTickColor = isLight ? colors.borderStrong : 'rgba(255, 255, 255, 0.34)';
  const daySegmentColor = isLight ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.20)';
  const amountLeaderColor = isLight ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.28)';
  const billsAmountLabel =
    upcomingBillsBeforePaycheck > 0
      ? `−${formatDisplayMoneyAbsolute(upcomingBillsBeforePaycheck)}`
      : null;

  const paymentKeySet = useMemo(() => new Set(paymentDateKeys), [paymentDateKeys]);
  const daySquares = useMemo(
    () => buildDaySquares(todayKey, paymentKeySet, paycheck?.dateKey ?? null, STRIP_DAY_COUNT),
    [todayKey, paymentKeySet, paycheck?.dateKey],
  );
  const paycheckInStrip = Boolean(paycheck && daySquares.some((day) => day.isPaycheck));

  const paycheckDateKey = useMemo(() => {
    if (!paycheck?.dateKey || paycheck.dateKey < todayKey) return null;
    return paycheck.dateKey;
  }, [paycheck?.dateKey, todayKey]);

  const timeline = useMemo(() => {
    const windowStartKey = addDaysToKey(todayKey, visibleStartIndex);
    const windowEndKey = addDaysToKey(todayKey, visibleStartIndex + TIMELINE_VISIBLE_DAYS - 1);

    const paycheckDayIndex =
      paycheckDateKey != null ? daysBetweenKeys(todayKey, paycheckDateKey) : null;
    const paycheckLeft =
      paycheckDayIndex != null ? markerLeftInTrack(paycheckDayIndex, visibleStartIndex) : null;

    // All outgoing payment days in the visible window (including after payday).
    const paymentDayKeys = [
      ...new Set(
        paymentDateKeys.filter((key) => key >= windowStartKey && key <= windowEndKey),
      ),
    ].sort();

    if (paymentDayKeys.length === 0 && paycheckLeft == null) return null;

    const paymentMarkers = paymentDayKeys.flatMap((dateKey) => {
      const dayIndex = daysBetweenKeys(todayKey, dateKey);
      const left = markerLeftInTrack(dayIndex, visibleStartIndex);
      if (left == null) return [];
      return [{ dateKey, left, amount: paymentDayAmounts[dateKey] ?? 0 }];
    });

    const amountCandidates: Array<Omit<TimelineAmountMarker, 'stackLevel'>> = [];
    paymentMarkers.forEach((marker, index) => {
      if (!(marker.amount > 0)) return;
      amountCandidates.push({
        key: `payment-${marker.dateKey}`,
        left: marker.left,
        label: `−${formatDisplayMoneyAbsolute(marker.amount)}`,
        kind: 'payment',
        accessibilityLabel:
          index === 0 ? 'Montant prochain paiement' : `Montant paiement ${index + 1}`,
      });
    });

    if (paycheck != null && paycheckDateKey != null && paycheckLeft != null) {
      amountCandidates.push({
        key: `paycheck-${paycheckDateKey}`,
        left: paycheckLeft,
        label: `≈ +${formatDisplayMoneyAbsolute(paycheck.amount)}`,
        kind: 'paycheck',
        accessibilityLabel: 'Montant paie estimée',
      });
    }

    const todayDayIndex = 0;
    const todayLeft = markerLeftInTrack(todayDayIndex, visibleStartIndex);

    return {
      paymentMarkers,
      paycheckLeft,
      todayLeft,
      amountMarkers: resolveAmountStackLevels(amountCandidates),
    };
  }, [
    todayKey,
    paymentDateKeys,
    paymentDayAmounts,
    paycheckDateKey,
    paycheck,
    visibleStartIndex,
  ]);

  const showTimeline =
    timeline != null &&
    (timeline.paymentMarkers.length > 0 || timeline.paycheckLeft != null);

  const onTimelineAmountsLayout = (width: number) => {
    if (width > 0 && width !== timelineAmountsWidth) {
      setTimelineAmountsWidth(width);
    }
  };

  const onDayStripScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = visibleStartIndexFromScroll(event.nativeEvent.contentOffset.x);
    if (next !== visibleStartIndex) {
      setVisibleStartIndex(next);
    }
  };

  const amountMarkers = timeline?.amountMarkers ?? [];
  const maxStackLevel = amountMarkers.reduce((max, marker) => Math.max(max, marker.stackLevel), 0);
  const amountsBelowMinHeight =
    TIMELINE_AMOUNT_RESERVE + maxStackLevel * TIMELINE_STACK_STEP;

  const labelTopForStack = (stackLevel: number) =>
    TIMELINE_LABEL_TOP_GAP + stackLevel * TIMELINE_STACK_STEP;

  const renderAmountLabel = (marker: TimelineAmountMarker) => (
    <Text
      key={marker.key}
      style={[
        typographyKit.micro,
        styles.timelineMarkerAmount,
        {
          color: marker.kind === 'paycheck' ? colors.success : colors.warning,
          left: clampTimelineLabelLeft(marker.left, marker.label, timelineAmountsWidth),
          top: labelTopForStack(marker.stackLevel),
        },
      ]}
      numberOfLines={1}
      accessibilityLabel={marker.accessibilityLabel}
    >
      {marker.label}
    </Text>
  );

  const renderAmountLeader = (marker: TimelineAmountMarker) => {
    if (marker.stackLevel <= 0) return null;
    const labelTop = labelTopForStack(marker.stackLevel);
    const leaderTop = TIMELINE_TRACK_HEIGHT / 2;
    const leaderHeight = TIMELINE_TRACK_HEIGHT / 2 + labelTop;
    return (
      <View
        key={`leader-${marker.key}`}
        pointerEvents="none"
        style={[
          styles.timelineAmountLeader,
          {
            backgroundColor: amountLeaderColor,
            left: marker.left,
            marginLeft: -StyleSheet.hairlineWidth / 2,
            top: leaderTop,
            height: Math.max(StyleSheet.hairlineWidth, leaderHeight),
          },
        ]}
      />
    );
  };

  return (
    <DashboardCard padding={spacing.lg} innerStyle={styles.cardInner}>
      <Text style={[typographyKit.eyebrow, { color: colors.primary }]}>Solde chèque</Text>

      <Text
        style={[moneyAmountTypography({ tier: 'netWorth' }), styles.amount, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {formatDisplayMoneyAbsolute(Math.abs(checkingBalanceTotal))}
      </Text>

      <View style={styles.gaugeBlock}>
        {showTimeline && timeline ? (
          <View style={styles.timelineBlock}>
            <View style={[styles.timelineWeek, { width: TIMELINE_WEEK_WIDTH }]}>
              <View style={styles.timelineTrackAndAmounts}>
                {amountMarkers.map(renderAmountLeader)}
                <View
                  style={styles.timelineTrack}
                  accessibilityLabel="Chronologie paiements et paie, alignée sur les jours"
                >
                  <View style={[styles.timelineLine, { backgroundColor: timelineTrackColor }]} />
                  {TIMELINE_DAY_TICK_XS.map((x, index) => (
                    <View
                      key={`tick-${index}`}
                      style={[
                        styles.timelineSegmentTick,
                        {
                          backgroundColor: timelineTickColor,
                          left: x,
                          // Center tick on day column (same X as markers).
                          marginLeft: -TIMELINE_SEGMENT_TICK_WIDTH / 2,
                        },
                      ]}
                    />
                  ))}
                  {timeline.todayLeft != null ? (
                    <View
                      style={[
                        styles.timelineTodayCursor,
                        {
                          left: timeline.todayLeft,
                          marginLeft: -TODAY_CURSOR_SIZE / 2,
                        },
                      ]}
                      accessibilityLabel="Aujourd'hui"
                    >
                      <AppIcon
                        family="ionicons"
                        name="chevron-forward"
                        size={TODAY_CURSOR_SIZE}
                        color={colors.primary}
                      />
                    </View>
                  ) : null}
                  {timeline.paymentMarkers.map((marker, index) => (
                    <View
                      key={marker.dateKey}
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: colors.warning,
                          left: marker.left,
                          marginLeft: -TIMELINE_DOT_SIZE / 2,
                          zIndex: 1,
                        },
                      ]}
                      accessibilityLabel={
                        index === 0 ? 'Prochain paiement' : `Paiement ${index + 1}`
                      }
                    />
                  ))}
                  {timeline.paycheckLeft != null ? (
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: colors.success,
                          left: timeline.paycheckLeft,
                          marginLeft: -TIMELINE_DOT_SIZE / 2,
                          zIndex: 2,
                        },
                      ]}
                      accessibilityLabel="Paie estimée"
                    />
                  ) : null}
                </View>
                <View
                  style={[styles.timelineAmountsBelow, { minHeight: amountsBelowMinHeight }]}
                  onLayout={(event) => onTimelineAmountsLayout(event.nativeEvent.layout.width)}
                >
                  {amountMarkers.map(renderAmountLabel)}
                </View>
              </View>
            </View>
          </View>
        ) : billsAmountLabel ? (
          <View style={styles.billsMeta}>
            <Text
              style={[
                transactionRowAmountTypography(),
                styles.billsAmount,
                { color: colors.warning },
              ]}
              numberOfLines={1}
            >
              {billsAmountLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayStrip}
        scrollEventThrottle={16}
        onScroll={onDayStripScroll}
      >
        {daySquares.map((day, index) => {
          const isPaycheck = day.isPaycheck;
          const isToday = day.isToday;
          const isSelected = selectedDateKey === day.dateKey;
          return (
            <Fragment key={day.dateKey}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={
                  isToday
                    ? `Aujourd'hui ${day.weekday} ${day.dayNum}`
                    : isPaycheck
                      ? `Paie estimée le ${day.weekday} ${day.dayNum}`
                      : day.hasPayment
                        ? `Paiement le ${day.weekday} ${day.dayNum}`
                        : `${day.weekday} ${day.dayNum}`
                }
                disabled={!onDayPress}
                onPress={(event) => {
                  event.stopPropagation?.();
                  onDayPress?.(day.dateKey);
                }}
                style={({ pressed }) => [
                  styles.daySquare,
                  {
                    backgroundColor: isToday
                      ? '#D0D0D0'
                      : isSelected
                        ? colors.surfaceElevated
                        : 'transparent',
                    borderColor: isToday
                      ? isSelected
                        ? colors.primary
                        : '#D0D0D0'
                      : isSelected
                        ? colors.primary
                        : 'transparent',
                  },
                  pressed && onDayPress ? styles.daySquarePressed : null,
                ]}
              >
                <Text
                  style={[
                    typographyKit.micro,
                    styles.dayWeekday,
                    {
                      color: isToday
                        ? colors.background
                        : isSelected
                          ? colors.primary
                          : colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {day.weekday.replace('.', '')}
                </Text>
                <Text
                  style={[
                    typographyKit.rowTitle,
                    styles.dayNum,
                    {
                      color: isToday
                        ? colors.background
                        : isSelected
                          ? colors.primary
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {day.dayNum}
                </Text>
                <View style={styles.dayMarkerSlot}>
                  {isPaycheck ? (
                    <AppIcon family="ionicons" name="cash-outline" size={10} color={colors.success} />
                  ) : day.hasPayment ? (
                    <View style={[styles.dayDot, { backgroundColor: colors.warning }]} />
                  ) : (
                    <View style={styles.dayDotSpacer} />
                  )}
                </View>
              </Pressable>
              {index < daySquares.length - 1 ? (
                <View style={[styles.dayDivider, { backgroundColor: daySegmentColor }]} />
              ) : null}
            </Fragment>
          );
        })}
      </ScrollView>

      {paycheck && !paycheckInStrip ? (
        <View style={styles.paycheckMeta}>
          <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]} numberOfLines={1}>
            Paie hors {STRIP_DAY_COUNT} jours
          </Text>
          <Text style={[transactionRowAmountTypography(), { color: colors.success }]}>
            +{formatDisplayMoneyAbsolute(paycheck.amount)}
          </Text>
        </View>
      ) : null}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    gap: spacing.md,
  },
  amount: {
    letterSpacing: -1.2,
  },
  gaugeBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  timelineBlock: {
    width: '100%',
    minHeight: TIMELINE_TRACK_HEIGHT + TIMELINE_AMOUNT_RESERVE,
    paddingBottom: spacing.md,
    gap: 2,
  },
  /** Same width as the first N day columns + dividers — left-aligned with the strip. */
  timelineWeek: {
    alignSelf: 'flex-start',
    gap: 2,
  },
  /** Track + below amounts share a box so leader hairlines can span both. */
  timelineTrackAndAmounts: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },
  timelineTrack: {
    width: '100%',
    height: TIMELINE_TRACK_HEIGHT,
    justifyContent: 'center',
  },
  timelineLine: {
    height: StyleSheet.hairlineWidth * 2,
    width: '100%',
    borderRadius: 1,
  },
  timelineSegmentTick: {
    position: 'absolute',
    top: (TIMELINE_TRACK_HEIGHT - TIMELINE_SEGMENT_TICK_HEIGHT) / 2,
    width: TIMELINE_SEGMENT_TICK_WIDTH,
    height: TIMELINE_SEGMENT_TICK_HEIGHT,
    borderRadius: 1,
    zIndex: 0,
  },
  timelineTodayCursor: {
    position: 'absolute',
    top: (TIMELINE_TRACK_HEIGHT - TODAY_CURSOR_HEIGHT) / 2,
    width: TODAY_CURSOR_SIZE,
    height: TODAY_CURSOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  timelineDot: {
    position: 'absolute',
    top: (TIMELINE_TRACK_HEIGHT - TIMELINE_DOT_SIZE) / 2,
    width: TIMELINE_DOT_SIZE,
    height: TIMELINE_DOT_SIZE,
    borderRadius: TIMELINE_DOT_SIZE / 2,
  },
  timelineAmountLeader: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    zIndex: 0,
  },
  timelineAmountsBelow: {
    position: 'relative',
    width: '100%',
    minHeight: TIMELINE_AMOUNT_RESERVE,
    overflow: 'visible',
  },
  timelineMarkerAmount: {
    position: 'absolute',
    transform: [{ translateX: '-50%' }],
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  billsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  billsAmount: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  dayStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: spacing.sm,
  },
  daySquare: {
    width: DAY_SQUARE_WIDTH,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  daySquarePressed: {
    opacity: 0.78,
  },
  dayDivider: {
    width: DAY_DIVIDER_WIDTH,
    height: typographyKit.micro.lineHeight + typographyKit.rowTitle.lineHeight + 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: 1,
  },
  dayWeekday: {
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  dayNum: {
    fontVariant: ['tabular-nums'],
  },
  dayMarkerSlot: {
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayDotSpacer: {
    width: 4,
    height: 4,
  },
  paycheckMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
