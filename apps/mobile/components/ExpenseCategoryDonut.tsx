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
import type { ExpenseCategorySlice } from '@/lib/transactionInsights';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CHART_HORIZONTAL_INSET = 20;
const CHART_MAX_WIDTH = 330;
const CHART_BASE_SIZE = 283;
const TWO_PI = Math.PI * 2;
const SEGMENT_GAP = 0.008;

type Segment = ExpenseCategorySlice & {
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
  categories: readonly ExpenseCategorySlice[];
  totalSpent: number;
  selectedId?: string | null;
  onSelectCategory?: (id: string | null) => void;
  size?: number;
  hubEyebrow?: string;
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

function touchPointToSegment(
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

function hubTextMetrics(fontSize: number) {
  const rounded = Math.round(fontSize);
  return {
    fontSize: rounded,
    lineHeight: Math.round(rounded * 1.32),
  };
}

function buildSegments(
  categories: readonly ExpenseCategorySlice[],
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

export function ExpenseCategoryDonut({
  categories,
  totalSpent,
  selectedId = null,
  onSelectCategory,
  size: sizeProp,
  hubEyebrow = 'CE MOIS-CI',
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
  const trackColor = isLight ? colors.border : colors.surfaceElevated;
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
      amount: hubTextMetrics(28 * scale),
      amountSelected: hubTextMetrics(26 * scale),
      detail: hubTextMetrics(12 * scale),
      selectedAmountRowMarginTop: 2 + selectedAmountOffset,
      selectedDetailMarginTop: 2 + selectedAmountOffset,
    };
  }, [scale]);

  const selectedSegment = segments.find((segment) => segment.id === selectedId) ?? null;
  const brightestSegmentGreen = greenShades(Math.max(categories.length, 1))[0];
  const selectedShare =
    selectedSegment && totalSpent > 0
      ? Math.round((selectedSegment.spent / totalSpent) * 100)
      : 0;

  const handleChartPress = (event: GestureResponderEvent) => {
    if (!onSelectCategory) return;

    const hitId = touchPointToSegment(
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
        accessibilityLabel="Graphique des dépenses par catégorie"
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
              <Text
                style={[
                  styles.hubAmount,
                  moneyAmountTypography({
                    tier: 'stat',
                    fontSize: hubMetrics.amountSelected.fontSize,
                    lineHeight: hubMetrics.amountSelected.lineHeight,
                  }),
                  {
                    color: colors.text,
                    marginTop: hubMetrics.selectedAmountRowMarginTop,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {formatDisplayMoneyAbsolute(selectedSegment.spent)}
              </Text>
              <Text
                style={[
                  styles.hubDetail,
                  typographyKit.caption,
                  {
                    color: colors.textMuted,
                    ...hubMetrics.detail,
                    marginTop: hubMetrics.selectedDetailMarginTop,
                  },
                ]}
                numberOfLines={1}
              >
                {`${selectedShare} % des dépenses`}
              </Text>
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
                    fontSize: hubMetrics.amount.fontSize,
                    lineHeight: hubMetrics.amount.lineHeight,
                  }),
                  { color: colors.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {formatDisplayMoneyAbsolute(totalSpent)}
              </Text>
              <Text
                style={[
                  styles.hubDetail,
                  typographyKit.caption,
                  { color: colors.textMuted, ...hubMetrics.detail },
                ]}
                numberOfLines={1}
              >
                {categories.length > 0
                  ? `${categories.length} catégorie${categories.length > 1 ? 's' : ''}`
                  : 'Aucune dépense'}
              </Text>
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
  hubEyebrow: {
    textAlign: 'center',
  },
  hubAmount: {
    textAlign: 'center',
    marginTop: 2,
  },
  hubDetail: {
    textAlign: 'center',
    marginTop: 2,
  },
});
