import { StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { BudgetOverrunData } from '@/lib/resolveBudgetOverrun';
import { resolveUserPickedIconWellBackground } from '@/lib/userPickedIcon';
import {
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  data: BudgetOverrunData;
};

const BAR_HEIGHT = 8;

/**
 * Budget-over alert visual — category identity, spent vs allocated bar (can exceed 100 %),
 * alloué + surplus amounts.
 */
export function BudgetOverrunDiagnostic({ data }: Props) {
  const { colors, isLight } = useAppTheme();
  const trackBg = resolveUserPickedIconWellBackground(isLight);
  const over = data.surplus > 0 && data.allocated > 0;
  const allocatedRatio =
    over && data.spent > 0 ? Math.min(1, data.allocated / data.spent) : null;
  const onTrackFill =
    data.allocated > 0 ? Math.min(1, data.spent / data.allocated) : data.spent > 0 ? 1 : 0;

  const categoryColor = data.categoryColor?.trim() || colors.surfaceElevated;

  return (
    <View style={styles.root}>
      <View style={styles.categoryRow}>
        <View style={[styles.iconWell, { backgroundColor: categoryColor }]}>
          <BudgetCategoryIcon
            icon={data.categoryIcon}
            name={data.categoryName}
            id={data.categoryId}
            wellSize={48}
            glyphSize={22}
          />
        </View>
        <View style={styles.categoryCopy}>
          <Text style={[styles.categoryEyebrow, { color: colors.textMuted }]}>Catégorie</Text>
          <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
            {data.categoryName}
          </Text>
        </View>
        <View style={styles.percentCol}>
          <Text
            style={[
              moneyAmountTypography({ tier: 'row', fontSize: 22, lineHeight: 26 }),
              styles.percent,
              { color: over ? colors.danger : colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {data.usagePercent} %
          </Text>
          <Text style={[styles.percentCaption, { color: colors.textMuted }]}>utilisé</Text>
        </View>
      </View>

      <View
        style={[styles.track, { backgroundColor: trackBg, height: BAR_HEIGHT }]}
        accessibilityRole="image"
        accessibilityLabel={`${data.usagePercent} pour cent du budget ${data.categoryName}`}
      >
        {allocatedRatio != null ? (
          <>
            <View
              style={[
                styles.fill,
                {
                  width: `${allocatedRatio * 100}%`,
                  backgroundColor: colors.text,
                  opacity: 0.28,
                },
              ]}
            />
            <View style={[styles.fill, styles.overflowFill, { backgroundColor: colors.danger }]} />
          </>
        ) : (
          <View
            style={[
              styles.fill,
              {
                width: `${onTrackFill * 100}%`,
                backgroundColor: data.spent > data.allocated ? colors.danger : colors.accentGreen,
              },
            ]}
          />
        )}
      </View>

      <Text style={[styles.spentCaption, { color: colors.textMuted }]}>
        {formatDisplayMoneyAbsolute(data.spent)} dépensé
      </Text>

      <View style={[styles.metrics, { borderTopColor: colors.borderSubtle }]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Alloué</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'row' }),
              styles.metricValue,
              { color: colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatDisplayMoneyAbsolute(data.allocated)}
          </Text>
        </View>
        <View style={[styles.metric, styles.metricEnd]}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Surplus</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'row' }),
              styles.metricValue,
              { color: over || data.surplus > 0 ? colors.danger : colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatDisplayMoneyAbsolute(data.surplus)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'stretch',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  categoryEyebrow: {
    ...typographyKit.metaMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  categoryName: {
    ...typographyKit.rowTitle,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  percentCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 1,
  },
  percent: {
    letterSpacing: -0.8,
    textAlign: 'right',
  },
  percentCaption: {
    ...typographyKit.metaMedium,
    fontSize: 11,
    lineHeight: 14,
  },
  track: {
    alignSelf: 'stretch',
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: {
    height: '100%',
    borderRadius: BAR_HEIGHT / 2,
  },
  overflowFill: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  spentCaption: {
    ...typographyKit.metaMedium,
    fontSize: 12,
    lineHeight: 16,
    marginTop: -spacing.xs,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  metricEnd: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    ...typographyKit.metaMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricValue: {
    letterSpacing: -0.4,
  },
});
