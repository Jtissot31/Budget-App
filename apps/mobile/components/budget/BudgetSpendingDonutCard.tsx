/**
 * Budget tab — spending mix donut (thin ring) + category legend.
 * Segments = share of total spent per category for the selected month.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
} from '@/constants/planFinanceKit';
import {
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  buildDonutSegmentArcs,
  touchPointToSegment,
  type DonutSegmentInput,
} from '@/lib/donutGeometry';
import {
  getBudgetStatus,
  getCategoryBudgetUsage,
} from '@/lib/categoryBudgetUsage';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CHART_HORIZONTAL_INSET = 20;
const CHART_MAX_WIDTH = 300;

export type BudgetSpendingCategory = {
  id: string;
  name: string;
  spent: number;
  limit: number;
  color: string;
};

type SpendingCategoryWithSegmentColor = BudgetSpendingCategory & {
  segmentColor: string;
};

/** On track → category palette; overspend → shared budget status colors. */
function spendingDonutSegmentColor(
  spent: number,
  limit: number,
  categoryPaletteColor: string,
): string {
  const usage = getCategoryBudgetUsage(limit, spent);
  if (!usage.isOverBudget) {
    return categoryPaletteColor;
  }
  return getBudgetStatus(spent, limit).color;
}

type Props = {
  categories: readonly BudgetSpendingCategory[];
  totalSpent: number;
  hubEyebrow?: string;
};

export function BudgetSpendingDonutCard({
  categories,
  totalSpent,
  hubEyebrow = 'RÉPARTITION',
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isLight } = useAppTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const spendingCategories = useMemo((): SpendingCategoryWithSegmentColor[] => {
    return [...categories]
      .filter((category) => category.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .map((category) => ({
        ...category,
        segmentColor: spendingDonutSegmentColor(
          category.spent,
          category.limit,
          category.color,
        ),
      }));
  }, [categories]);

  const chartSize = Math.min(windowWidth - CHART_HORIZONTAL_INSET * 2, CHART_MAX_WIDTH);
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const innerRadius = chartSize * 0.38;
  const outerRadius = chartSize * 0.45;
  const hubSize = innerRadius * 1.85;
  const trackColor = isLight ? colors.border : colors.scopeTrack;

  const layout = useMemo(
    () => ({ cx, cy, innerRadius, outerRadius }),
    [cx, cy, innerRadius, outerRadius],
  );

  const segments: readonly DonutSegmentInput[] = useMemo(
    () =>
      spendingCategories.map((category) => ({
        id: category.id,
        value: category.spent,
        color: category.segmentColor,
      })),
    [spendingCategories],
  );

  const arcs = useMemo(() => buildDonutSegmentArcs(segments, layout), [layout, segments]);

  const selectedCategory =
    spendingCategories.find((category) => category.id === selectedId) ?? null;

  const selectedHub = useMemo(() => {
    if (!selectedCategory) return null;

    const usage = getCategoryBudgetUsage(selectedCategory.limit, selectedCategory.spent);
    const budgetStatus = getBudgetStatus(selectedCategory.spent, selectedCategory.limit);
    const remaining = selectedCategory.limit - selectedCategory.spent;

    if (usage.isOverBudget) {
      return {
        line: `−${formatDisplayMoneyAbsolute(Math.abs(remaining))} dépassé`,
        color: budgetStatus.color,
      };
    }

    return {
      line: `${formatDisplayMoneyAbsolute(remaining)} restant`,
      color: colors.text,
    };
  }, [colors.text, selectedCategory]);

  if (totalSpent <= 0 || spendingCategories.length === 0) {
    return null;
  }

  const handleChartPress = (locationX: number, locationY: number) => {
    const hitId = touchPointToSegment(locationX, locationY, arcs, layout);
    tapHaptic();
    if (hitId) {
      setSelectedId((prev) => (prev === hitId ? null : hitId));
      return;
    }
    if (selectedId != null) {
      setSelectedId(null);
    }
  };

  const handleLegendPress = (id: string) => {
    tapHaptic();
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Graphique de répartition des dépenses par catégorie"
        style={[styles.chartBox, { width: chartSize, height: chartSize }]}
        onPress={(event) =>
          handleChartPress(event.nativeEvent.locationX, event.nativeEvent.locationY)
        }
      >
        <Svg width={chartSize} height={chartSize} pointerEvents="none">
          <Circle
            cx={cx}
            cy={cy}
            r={(innerRadius + outerRadius) / 2}
            fill="none"
            stroke={trackColor}
            strokeWidth={outerRadius - innerRadius + 2}
          />
          {arcs.map((arc) => {
            const isSelected = selectedId === arc.id;
            const dimmed = selectedId != null && !isSelected;
            return (
              <Path
                key={arc.id}
                d={arc.path}
                fill={arc.color}
                opacity={dimmed ? 0.32 : 1}
                stroke={isSelected ? arc.color : 'transparent'}
                strokeWidth={isSelected ? 2 : 0}
                strokeLinejoin="round"
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
          {selectedCategory && selectedHub ? (
            <>
              <Text
                style={[styles.hubCategoryLabel, typographyKit.caption, { color: colors.textMuted }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {selectedCategory.name}
              </Text>
              <Text
                style={[
                  moneyAmountTypography({ tier: 'stat', fontSize: 24 }),
                  styles.hubAmount,
                  { color: selectedHub.color },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {selectedHub.line}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.hubEyebrow, typographyKit.eyebrow, { color: colors.textMuted }]}>
                {hubEyebrow}
              </Text>
              <Text
                style={[
                  moneyAmountTypography({ tier: 'stat', fontSize: 26 }),
                  styles.hubAmount,
                  { color: colors.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {formatDisplayMoneyAbsolute(totalSpent)}
              </Text>
              <Text style={[styles.hubDetail, typographyKit.caption, { color: colors.textMuted }]}>
                {`${spendingCategories.length} catégorie${spendingCategories.length > 1 ? 's' : ''}`}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      <OnyxContainer style={styles.legendCard}>
        <View style={styles.legendGrid}>
          {spendingCategories.map((category) => {
            const share = totalSpent > 0 ? Math.round((category.spent / totalSpent) * 100) : 0;
            const isSelected = selectedId === category.id;
            const dimmed = selectedId != null && !isSelected;

            return (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={`${category.name} ${share} pour cent, ${formatDisplayMoneyAbsolute(category.spent)}`}
                onPress={() => handleLegendPress(category.id)}
                style={({ pressed }) => [
                  styles.legendItem,
                  pressed && onyxContainerPressedStyle(),
                  dimmed && styles.legendItemDimmed,
                ]}
              >
                <View style={styles.legendLeft}>
                  <View style={[styles.legendDot, { backgroundColor: category.segmentColor }]} />
                  <Text
                    style={[
                      styles.legendName,
                      { color: isSelected ? colors.text : colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                </View>
                <View style={styles.legendRight}>
                  <Text
                    style={[
                      styles.legendAmount,
                      moneyAmountTypography({ tier: 'row', fontSize: 12, lineHeight: 16 }),
                      { color: colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {formatDisplayMoneyAbsolute(category.spent)}
                  </Text>
                  <Text
                    style={[
                      styles.legendPct,
                      { color: isSelected ? category.segmentColor : colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {`${share} %`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </OnyxContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'stretch',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  chartBox: {
    alignSelf: 'center',
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
  hubEyebrow: {
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  hubCategoryLabel: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 2,
  },
  hubAmount: {
    textAlign: 'center',
    marginTop: 2,
  },
  hubDetail: {
    textAlign: 'center',
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
  },
  legendCard: {
    padding: ONYX_CONTAINER.padding.card,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: ONYX_CONTAINER.listGap,
  },
  legendItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minWidth: 0,
  },
  legendItemDimmed: {
    opacity: 0.55,
  },
  legendLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    minWidth: 0,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: radius.sm / 4,
    flexShrink: 0,
  },
  legendName: {
    ...typographyKit.microMedium,
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.sm - 2,
  },
  legendAmount: {
    fontVariant: ['tabular-nums'],
  },
  legendPct: {
    ...typographyKit.microMedium,
    fontSize: 11,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
});
