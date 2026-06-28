import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CHART_HORIZONTAL_INSET = 20;
const CHART_MAX_WIDTH = 330;
const CHART_BASE_SIZE = 283;
const TWO_PI = Math.PI * 2;
const SEGMENT_GAP = 0.008;

export type BudgetDonutCategory = {
  id: string;
  name: string;
  spent: number;
  limit: number;
};

type Segment = BudgetDonutCategory & {
  path: string;
  color: string;
  startAngle: number;
  endAngle: number;
};

function greenShades(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 0 : i / (n - 1);
    return `hsl(140, ${Math.round(72 - t * 30)}%, ${Math.round(63 - t * 55)}%)`;
  });
}

type Props = {
  categories: readonly BudgetDonutCategory[];
  totalAllocated: number;
  totalSpent: number;
  selectedId?: string | null;
  onSelectCategory?: (id: string | null) => void;
  size?: number;
  /** Hub eyebrow when no segment is selected (defaults to "CE MOIS-CI"). */
  hubEyebrow?: string;
  /** When false, under-budget amounts read as "surplus" instead of "restant". */
  isCurrentMonth?: boolean;
};

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(
  cx: number,
  cy: number,
  outerRadius: number,
  thickness: number,
  startAngle: number,
  endAngle: number,
) {
  const innerRadius = outerRadius - thickness;
  const outerStart = polar(cx, cy, outerRadius, startAngle);
  const outerEnd = polar(cx, cy, outerRadius, endAngle);
  const innerEnd = polar(cx, cy, innerRadius, endAngle);
  const innerStart = polar(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const format = (value: number) => value.toFixed(3);

  return `M${format(outerStart.x)} ${format(outerStart.y)} A${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${format(outerEnd.x)} ${format(outerEnd.y)} L${format(innerEnd.x)} ${format(innerEnd.y)} A${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${format(innerStart.x)} ${format(innerStart.y)} Z`;
}

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

function touchPointToBudgetSegment(
  x: number,
  y: number,
  segments: readonly Segment[],
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
): string | null {
  if (segments.length === 0) return null;

  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < innerRadius || distance > outerRadius) return null;

  const angle = Math.atan2(dy, dx);
  for (const segment of segments) {
    if (isAngleInSegment(angle, segment.startAngle, segment.endAngle)) {
      return segment.id;
    }
  }
  return null;
}

export type BudgetHubStatus = {
  text: string;
  tone: 'success' | 'danger';
};

/** Remaining / surplus / over / exact status below the "dépensé" hub line. */
export function getBudgetHubStatus(
  allocated: number,
  spent: number,
  isCurrentMonth: boolean,
  formatMoney: (amount: number) => string,
): BudgetHubStatus | null {
  const isOver = spent > allocated;
  const isExact = spent === allocated && allocated > 0;

  if (isOver) {
    return {
      text: `Dépassé de ${formatMoney(spent - allocated)}`,
      tone: 'danger',
    };
  }
  if (isExact) {
    return { text: 'Budget Respecté', tone: 'success' };
  }

  const diff = allocated - spent;
  if (isCurrentMonth) {
    return { text: `${formatMoney(diff)} restant`, tone: 'success' };
  }
  return { text: `${formatMoney(diff)} de surplus`, tone: 'success' };
}

/** Line height tracks fontSize so descenders (g, p, y, j) are not clipped in the hub. */
function hubTextMetrics(fontSize: number) {
  const rounded = Math.round(fontSize);
  return {
    fontSize: rounded,
    lineHeight: Math.round(rounded * 1.32),
  };
}

function buildSegments(
  categories: readonly BudgetDonutCategory[],
  cx: number,
  cy: number,
  outerRadius: number,
  thickness: number,
  gap: number,
): Segment[] {
  const sorted = [...categories].sort((left, right) => right.spent - left.spent);
  const shades = greenShades(sorted.length);
  const spentTotal = sorted.reduce((sum, category) => sum + category.spent, 0) || 1;
  let angle = -Math.PI / 2;

  return sorted.map((category, rank) => {
    const sweep = (category.spent / spentTotal) * 2 * Math.PI - gap;
    const startAngle = angle + gap / 2;
    const endAngle = startAngle + sweep;
    angle += (category.spent / spentTotal) * 2 * Math.PI;

    return {
      ...category,
      color: shades[rank],
      startAngle,
      endAngle,
      path: arcPath(cx, cy, outerRadius, thickness, startAngle, endAngle),
    };
  });
}

export function BudgetDonut({
  categories,
  totalAllocated,
  totalSpent,
  selectedId = null,
  onSelectCategory,
  size: sizeProp,
  hubEyebrow = 'CE MOIS-CI',
  isCurrentMonth = true,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isLight } = useAppTheme();

  const chartSize = sizeProp ?? Math.min(windowWidth - CHART_HORIZONTAL_INSET * 2, CHART_MAX_WIDTH);
  const scale = chartSize / CHART_BASE_SIZE;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const innerRadius = chartSize * 0.39;
  const thickness = chartSize * 0.078;
  const outerRadius = innerRadius + thickness;
  const gap = SEGMENT_GAP;
  const trackColor = isLight ? colors.border : '#181818';
  const hubSize = innerRadius * 1.9;

  const segments = useMemo(
    () => buildSegments(categories, cx, cy, outerRadius, thickness, gap),
    [categories, cx, cy, outerRadius, thickness],
  );

  const hubMetrics = useMemo(() => {
    const category = hubTextMetrics(13 * scale);
    const selectedAmountOffset = Math.round(6 * scale);
    return {
      category: { ...category, marginTop: -Math.round(6 * scale) },
      eyebrow: hubTextMetrics(11 * scale),
      amountSelected: hubTextMetrics(26 * scale),
      amountTotal: hubTextMetrics(28 * scale),
      spent: hubTextMetrics(13 * scale),
      status: hubTextMetrics(12 * scale),
      selectedAmountRowMarginTop: 2 + selectedAmountOffset,
      selectedSpentMarginTop: 2 + selectedAmountOffset,
    };
  }, [scale]);

  const selectedSegment = segments.find((segment) => segment.id === selectedId) ?? null;
  const brightestSegmentGreen = greenShades(Math.max(categories.length, 1))[0];

  const globalStatus = useMemo(
    () => getBudgetHubStatus(totalAllocated, totalSpent, isCurrentMonth, formatDisplayMoneyAbsolute),
    [totalAllocated, totalSpent, isCurrentMonth],
  );

  const selectedStatus = useMemo(
    () =>
      selectedSegment
        ? getBudgetHubStatus(
            selectedSegment.limit,
            selectedSegment.spent,
            isCurrentMonth,
            formatDisplayMoneyAbsolute,
          )
        : null,
    [selectedSegment, isCurrentMonth],
  );

  const statusColor = (tone: BudgetHubStatus['tone']) =>
    tone === 'danger' ? colors.danger : colors.accentGreen;

  const handleChartPress = (event: GestureResponderEvent) => {
    if (!onSelectCategory) return;

    const hitId = touchPointToBudgetSegment(
      event.nativeEvent.locationX,
      event.nativeEvent.locationY,
      segments,
      cx,
      cy,
      innerRadius,
      outerRadius,
    );

    tapHaptic();
    if (hitId) {
      onSelectCategory(selectedId === hitId ? null : hitId);
      return;
    }
    if (selectedId != null) {
      onSelectCategory(null);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Graphique de répartition mensuelle"
        style={[styles.chartBox, { width: chartSize, height: chartSize }]}
        onPress={handleChartPress}
      >
        <Svg width={chartSize} height={chartSize} pointerEvents="none">
          <Circle
            cx={cx}
            cy={cy}
            r={outerRadius - thickness / 2}
            fill="none"
            stroke={trackColor}
            strokeWidth={thickness}
          />
          {segments.map((segment) => {
            const isSelected = selectedId === segment.id;
            const dimmed = selectedId != null && !isSelected;

            return (
              <Path
                key={segment.id}
                d={segment.path}
                fill={segment.color}
                opacity={dimmed ? 0.3 : 1}
              />
            );
          })}
        </Svg>

        <View
          style={[
            styles.hub,
            {
              width: hubSize,
              height: hubSize,
              borderRadius: hubSize / 2,
            },
          ]}
          pointerEvents="none"
        >
          {selectedSegment ? (
            <>
              <Text
                style={[
                  styles.hubCategoryName,
                  typographyKit.rowTitle,
                  {
                    color: brightestSegmentGreen,
                    ...hubMetrics.category,
                  },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {selectedSegment.name}
              </Text>
              <View
                style={[
                  styles.hubAmountRow,
                  { marginTop: hubMetrics.selectedAmountRowMarginTop },
                ]}
              >
                <Text
                  style={[
                    styles.hubAmount,
                    moneyAmountTypography({
                      tier: 'stat',
                      fontSize: hubMetrics.amountSelected.fontSize,
                      lineHeight: hubMetrics.amountSelected.lineHeight,
                    }),
                    { color: colors.text, marginTop: 0 },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {formatDisplayMoneyAbsolute(selectedSegment.limit)}
                </Text>
                <Text
                  style={[
                    typographyKit.caption,
                    { color: colors.textMuted, ...hubMetrics.eyebrow },
                  ]}
                >
                  /mois
                </Text>
              </View>
              <Text
                style={[
                  styles.hubSpent,
                  typographyKit.caption,
                  {
                    color: colors.text,
                    ...hubMetrics.spent,
                    marginTop: hubMetrics.selectedSpentMarginTop,
                  },
                ]}
                numberOfLines={1}
              >
                {`${formatDisplayMoneyAbsolute(selectedSegment.spent)} dépensé`}
              </Text>
              {selectedStatus ? (
                <Text
                  style={[
                    styles.hubStatus,
                    typographyKit.caption,
                    {
                      color: statusColor(selectedStatus.tone),
                      ...hubMetrics.status,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {selectedStatus.text}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.hubEyebrow,
                  typographyKit.eyebrow,
                  { color: colors.textMuted, ...hubMetrics.eyebrow },
                ]}
              >
                {hubEyebrow}
              </Text>
              <Text
                style={[
                  styles.hubAmount,
                  moneyAmountTypography({
                    tier: 'stat',
                    fontSize: hubMetrics.amountTotal.fontSize,
                    lineHeight: hubMetrics.amountTotal.lineHeight,
                  }),
                  { color: colors.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {formatDisplayMoneyAbsolute(totalAllocated)}
              </Text>
              <Text
                style={[
                  styles.hubSpent,
                  typographyKit.caption,
                  {
                    color: colors.text,
                    ...hubMetrics.spent,
                  },
                ]}
                numberOfLines={1}
              >
                {`${formatDisplayMoneyAbsolute(totalSpent)} dépensé`}
              </Text>
              {globalStatus ? (
                <Text
                  style={[
                    styles.hubStatus,
                    typographyKit.caption,
                    {
                      color: statusColor(globalStatus.tone),
                      ...hubMetrics.status,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {globalStatus.text}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  chartBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hub: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  hubCategoryName: {
    textAlign: 'center',
    marginBottom: 2,
  },
  hubAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
  },
  hubEyebrow: {
    textAlign: 'center',
  },
  hubAmount: {
    textAlign: 'center',
    marginTop: 2,
  },
  hubSpent: {
    textAlign: 'center',
    marginTop: 2,
  },
  hubStatus: {
    textAlign: 'center',
    marginTop: 1,
  },
});
