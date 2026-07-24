import { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppIcon } from '@/components/icons/AppIcon';
import { DashboardCard } from '@/components/DashboardCard';
import {
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { getBudgetStatus } from '@/lib/categoryBudgetUsage';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Classic ring-left hero: category donut is the principal visual; % UTILISÉ
 * sits in the center. Month total + Dépensé / Restant sit to the right.
 */
const RING_SIZE_PREFERRED = 148;
const RING_SIZE_MIN = 112;
const RING_SIZE_MAX = 168;
const RING_RADIUS = 42;
const RING_STROKE = 10;
const RING_GAP = 2;
const ON_TRACK_OPACITY = 0.7;
const OVER_OPACITY = 1;
const TWO_PI = Math.PI * 2;
/** Below this content width, stack ring above stats to avoid clipping. */
const STACK_BREAKPOINT = 300;

export type BudgetHeroCategory = {
  id: string;
  name: string;
  spent: number;
  limit: number;
  /** Category tint — retained for callers; ring segments use status colors. */
  color?: string;
};

type Segment = {
  id: string;
  color: string;
  opacity: number;
  startAngle: number;
  endAngle: number;
  dasharray: string;
  dashoffset: number;
};

type Props = {
  categories: readonly BudgetHeroCategory[];
  totalAllocated: number;
  totalSpent: number;
  hubEyebrow: string;
  isCurrentMonth?: boolean;
  onSelectCategory?: (id: string) => void;
};

function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function isAngleInSegment(angle: number, startAngle: number, endAngle: number): boolean {
  const a = normalizeAngle(angle);
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  if (Math.abs(endAngle - startAngle) >= TWO_PI - 1e-6) return true;
  if (start <= end) return a >= start && a <= end;
  return a >= start || a <= end;
}

function buildSegments(categories: readonly BudgetHeroCategory[]): Segment[] {
  const withSpend = categories.filter((category) => category.spent > 0 && category.limit > 0);
  if (withSpend.length === 0) return [];

  /** Ring fills from spend mix only — unused budget must not leave a gap. */
  const spentTotal = withSpend.reduce((sum, category) => sum + category.spent, 0);
  if (spentTotal <= 0) return [];

  const circumference = TWO_PI * RING_RADIUS;
  const totalGap = RING_GAP * withSpend.length;
  const usable = Math.max(circumference - totalGap, 0);
  let offset = 0;
  let angle = -Math.PI / 2;

  return withSpend.map((category) => {
    const status = getBudgetStatus(category.spent, category.limit);
    const isOver = category.spent > category.limit;
    const fraction = category.spent / spentTotal;
    const arcLen = fraction * usable;
    const sweep = (arcLen / circumference) * TWO_PI;
    const startAngle = angle;
    const endAngle = angle + sweep;
    const seg: Segment = {
      id: category.id,
      color: status.color,
      opacity: isOver ? OVER_OPACITY : ON_TRACK_OPACITY,
      startAngle,
      endAngle,
      dasharray: `${arcLen} ${circumference - arcLen}`,
      dashoffset: -offset,
    };
    offset += arcLen + RING_GAP;
    angle = endAngle + (RING_GAP / circumference) * TWO_PI;
    return seg;
  });
}

export function BudgetHeroCard({
  categories,
  totalAllocated,
  totalSpent,
  hubEyebrow,
  isCurrentMonth = true,
  onSelectCategory,
}: Props) {
  const { colors } = useAppTheme();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [legendOpen, setLegendOpen] = useState(true);

  const trackColor = colors.border;
  const remaining = totalAllocated - totalSpent;
  const isOver = remaining < 0;
  const remainingAbs = Math.abs(remaining);
  const usagePercent =
    totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  const cardPad = spacing.lg + spacing.sm;
  const contentWidth = Math.max(
    0,
    windowWidth - PAGE_PADDING_HORIZONTAL * 2 - cardPad * 2,
  );
  const stackLayout = contentWidth < STACK_BREAKPOINT || fontScale > 1.35;

  /** Sizable ring beside stats — shrinks on narrow / large a11y text. */
  const fontBump = Math.min(Math.max(fontScale - 1, 0), 0.35);
  const ringBudget = stackLayout
    ? Math.min(RING_SIZE_PREFERRED, contentWidth * 0.55)
    : Math.min(RING_SIZE_PREFERRED, contentWidth * 0.42);
  const ringSize = Math.round(
    Math.min(
      RING_SIZE_MAX,
      Math.max(RING_SIZE_MIN, ringBudget - fontBump * 20),
    ),
  );
  const centerPercentSize = Math.max(20, Math.round(ringSize * 0.18));
  const centerPercentLine = Math.round(centerPercentSize * 1.12);
  const centerLabelSize = Math.max(9, Math.round(ringSize * 0.055));

  const totalAmountSize = fontScale > 1.2 ? 22 : 26;
  const metricAmountSize = fontScale > 1.15 ? 14 : 15;

  const remainingLabel = isOver
    ? 'Dépassé'
    : isCurrentMonth
      ? 'Restant'
      : 'Surplus';
  const remainingColor = isOver ? colors.danger : colors.accentGreen;

  const segments = useMemo(() => buildSegments(categories), [categories]);

  const legendCategories = useMemo(
    () => categories.filter((category) => category.limit > 0),
    [categories],
  );

  const handlePress = (event: GestureResponderEvent) => {
    if (!onSelectCategory || segments.length === 0) return;

    const native = event.nativeEvent;
    const isWeb = Platform.OS === 'web';
    const webOffsetX = (native as { offsetX?: number }).offsetX;
    const webOffsetY = (native as { offsetY?: number }).offsetY;
    const x = isWeb && webOffsetX != null ? webOffsetX : native.locationX;
    const y = isWeb && webOffsetY != null ? webOffsetY : native.locationY;

    const cx = ringSize / 2;
    const cy = ringSize / 2;
    const scale = ringSize / 100;
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const outer = (RING_RADIUS + RING_STROKE / 2 + 4) * scale;
    const inner = (RING_RADIUS - RING_STROKE / 2 - 4) * scale;
    if (distance < inner || distance > outer) return;

    const visualAngle = Math.atan2(dy, dx);
    const pathAngle = normalizeAngle(visualAngle + Math.PI / 2) - Math.PI / 2;

    for (const segment of segments) {
      if (isAngleInSegment(pathAngle, segment.startAngle, segment.endAngle)) {
        tapHaptic();
        onSelectCategory(segment.id);
        return;
      }
    }
  };

  const toggleLegend = () => {
    tapHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLegendOpen((open) => !open);
  };

  return (
    <DashboardCard padding={cardPad} innerStyle={styles.cardInner}>
      <View
        style={[
          styles.heroRow,
          stackLayout && styles.heroRowStacked,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Budget mensuel ${usagePercent} pour cent utilisé`}
          onPress={handlePress}
          style={[
            styles.ringWrap,
            { width: ringSize, height: ringSize },
            stackLayout && styles.ringWrapStacked,
          ]}
        >
          <Svg
            width={ringSize}
            height={ringSize}
            viewBox="0 0 100 100"
            style={styles.ringSvg}
            pointerEvents="none"
          >
            <Circle
              cx={50}
              cy={50}
              r={RING_RADIUS}
              fill="none"
              stroke={trackColor}
              strokeWidth={RING_STROKE}
            />
            {segments.map((segment) => (
              <Circle
                key={segment.id}
                cx={50}
                cy={50}
                r={RING_RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={RING_STROKE}
                strokeLinecap="butt"
                strokeDasharray={segment.dasharray}
                strokeDashoffset={segment.dashoffset}
                opacity={segment.opacity}
              />
            ))}
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text
              style={[
                moneyAmountTypography({
                  tier: 'card',
                  fontSize: centerPercentSize,
                  lineHeight: centerPercentLine,
                  letterSpacing: -0.6,
                }),
                { color: colors.text },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {`${usagePercent}%`}
            </Text>
            <Text
              style={[
                styles.ringCenterLabel,
                {
                  color: colors.textMuted,
                  fontSize: centerLabelSize,
                  lineHeight: centerLabelSize + 3,
                },
              ]}
              numberOfLines={1}
            >
              UTILISÉ
            </Text>
          </View>
        </Pressable>

        <View
          style={[
            styles.statsCol,
            stackLayout && styles.statsColStacked,
          ]}
        >
          <Text
            style={[
              typographyKit.eyebrow,
              styles.eyebrow,
              { color: colors.textMuted },
              stackLayout && styles.textCentered,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {hubEyebrow}
          </Text>

          <Text
            style={[
              moneyAmountTypography({
                tier: 'stat',
                fontSize: totalAmountSize,
                lineHeight: totalAmountSize + 4,
                letterSpacing: -0.8,
              }),
              styles.totalAmount,
              { color: colors.text },
              stackLayout && styles.textCentered,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {formatDisplayMoneyAbsolute(totalAllocated)}
          </Text>

          <View style={[styles.metricRow, stackLayout && styles.metricRowStacked]}>
            <View style={[styles.metricCol, stackLayout && styles.metricColStacked]}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: colors.textMuted },
                  stackLayout && styles.textCentered,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Dépensé
              </Text>
              <Text
                style={[
                  moneyAmountTypography({
                    tier: 'row',
                    fontSize: metricAmountSize,
                    lineHeight: metricAmountSize + 3,
                  }),
                  styles.metricAmount,
                  { color: colors.text },
                  stackLayout && styles.textCentered,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.45}
              >
                {formatDisplayMoneyAbsolute(totalSpent)}
              </Text>
            </View>

            <View style={[styles.metricCol, stackLayout && styles.metricColStacked]}>
              <Text
                style={[
                  styles.metricLabel,
                  { color: colors.textMuted },
                  stackLayout && styles.textCentered,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {remainingLabel}
              </Text>
              <Text
                style={[
                  moneyAmountTypography({
                    tier: 'row',
                    fontSize: metricAmountSize,
                    lineHeight: metricAmountSize + 3,
                  }),
                  styles.metricAmount,
                  { color: remainingColor },
                  stackLayout && styles.textCentered,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.45}
              >
                {formatDisplayMoneyAbsolute(remainingAbs)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {legendCategories.length > 0 ? (
        <View style={[styles.legendBlock, { borderTopColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={legendOpen ? 'Masquer la légende' : 'Afficher la légende'}
            accessibilityState={{ expanded: legendOpen }}
            onPress={toggleLegend}
            style={styles.legendToggle}
          >
            <Text style={[styles.legendToggleLabel, { color: colors.textMuted }]}>
              Légende
            </Text>
            <AppIcon
              family="ionicons"
              name={legendOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.textMuted}
            />
          </Pressable>

          {legendOpen ? (
            <View style={styles.legendGrid}>
              {legendCategories.map((category) => {
                const status = getBudgetStatus(category.spent, category.limit);
                const pct =
                  category.limit > 0
                    ? Math.round((category.spent / category.limit) * 100)
                    : 0;
                const categoryOver = category.spent > category.limit;
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${category.name} ${pct} pour cent`}
                    onPress={() => {
                      if (!onSelectCategory) return;
                      tapHaptic();
                      onSelectCategory(category.id);
                    }}
                    style={styles.legendItem}
                  >
                    <View style={styles.legendItemLeft}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: status.color },
                        ]}
                      />
                      <Text
                        style={[styles.legendName, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {category.name}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.legendPct,
                        { color: categoryOver ? status.color : colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {`${pct}%`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 0,
    overflow: 'visible',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    width: '100%',
    minWidth: 0,
    overflow: 'visible',
  },
  heroRowStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.md,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ringWrapStacked: {
    alignSelf: 'center',
  },
  ringSvg: {
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  ringCenterLabel: {
    ...typographyKit.eyebrow,
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  statsCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  statsColStacked: {
    width: '100%',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
  },
  totalAmount: {
    width: '100%',
    minWidth: 0,
  },
  textCentered: {
    textAlign: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.xs,
    width: '100%',
    minWidth: 0,
  },
  metricRowStacked: {
    justifyContent: 'center',
    maxWidth: 280,
  },
  metricCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 3,
  },
  metricColStacked: {
    alignItems: 'center',
  },
  metricLabel: {
    ...typographyKit.eyebrow,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.5,
  },
  metricAmount: {
    width: '100%',
    minWidth: 0,
  },
  legendBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendToggleLabel: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  legendGrid: {
    marginTop: spacing.sm + 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm - 2,
  },
  legendItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm - 2,
  },
  legendItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    minWidth: 0,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: radius.sm / 4,
    flexShrink: 0,
  },
  legendName: {
    ...typographyKit.microMedium,
    fontSize: 11,
    lineHeight: 14,
    flexShrink: 1,
  },
  legendPct: {
    ...typographyKit.microMedium,
    fontSize: 10,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
});
