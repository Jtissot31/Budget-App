import { StyleSheet, Text, View } from 'react-native';
import {
  planDetailFonts,
  usePlanDetailTheme,
} from '@/components/plans/planDetailTheme';
import {
  formatDisplayMoneyAbsolute,
  formatSignedDisplayMoney,
} from '@/lib/formatDisplayMoney';
import type { CreditLimitTimelineData } from '@/lib/resolveCreditLimitTimeline';
import {
  creditLimitMarginHintColor,
  creditLimitUtilizationBarColor,
  utilizationPercentColor,
} from '@/lib/creditLimitUtilization';
import {
  moneyAmountTypography,
  spacing,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

/** Slim track — matches CashflowComparisonWidget metric bars. */
const UTIL_TRACK_HEIGHT = 4;

/** Credit used / payment outflow — always debt-signed (−). */
function formatDebtAmount(absValue: number): string {
  return formatSignedDisplayMoney(-Math.abs(absValue));
}

type Props = {
  data: CreditLimitTimelineData;
};

/**
 * Credit-limit IMPACT for alerts — risk-first, not a plan journey.
 * Visual language aligned with CashflowComparisonWidget / AlertProblemInsightCard:
 * eyebrow → hero outcome → quiet metric rows → slim utilization track.
 * Trigger payment + after state are primary; current balance is quiet context.
 */
export function CreditLimitProblemTimeline({ data }: Props) {
  const { colors, isLight } = useAppTheme();
  const theme = usePlanDetailTheme();

  const afterAmountColor = data.isOverLimit ? colors.warning : theme.text;
  const afterHint = data.isOverLimit
    ? `Dépassement · ${formatDisplayMoneyAbsolute(data.overLimitBy)}`
    : `Marge disponible · ${formatDisplayMoneyAbsolute(Math.max(0, data.availableAfter))}`;
  const afterHintColor = creditLimitMarginHintColor(
    data.utilizationAfterPct,
    data.isOverLimit,
    colors,
  );

  const utilizationAfter = Math.min(data.utilizationAfterPct, 100);
  const utilizationRemainder = Math.max(0, 100 - utilizationAfter);
  const barFillColor = data.isOverLimit
    ? colors.warning
    : creditLimitUtilizationBarColor(data.utilizationAfterPct, colors, isLight);
  const percentColor = data.isOverLimit
    ? colors.warning
    : utilizationPercentColor(data.utilizationAfterPct, colors);

  return (
    <View style={styles.root}>
      <Text style={[planDetailFonts.sectionCaps, { color: theme.textMuted }]}>IMPACT</Text>

      {/* Risk outcome first — hero block like cashflow surplus */}
      <View style={styles.heroBlock}>
        <Text style={[planDetailFonts.detailLabel, { color: theme.textMuted }]}>
          Après le paiement
        </Text>
        <Text
          style={[moneyAmountTypography({ tier: 'stat' }), styles.heroAmount, { color: afterAmountColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {formatDebtAmount(data.balanceUsedAfter)}
        </Text>
        <Text style={[planDetailFonts.stepMeta, { color: afterHintColor }]}>{afterHint}</Text>
      </View>

      {/* Trigger — clean metric row, no nested surface */}
      <View style={styles.metricRow}>
        <View style={styles.metricCopy}>
          <Text style={[planDetailFonts.detailLabel, { color: theme.textMuted }]}>
            Paiement déclencheur
          </Text>
          <Text style={[planDetailFonts.stepLabel, { color: theme.text }]} numberOfLines={2}>
            {data.paymentLabel}
          </Text>
        </View>
        <Text
          style={[
            moneyAmountTypography({ tier: 'row' }),
            styles.metricAmount,
            { color: theme.text },
          ]}
        >
          {formatDebtAmount(data.paymentAmount)}
        </Text>
      </View>

      {/* Current state as secondary context — not a completed plan step */}
      <Text style={[planDetailFonts.stepMeta, { color: theme.textMuted }]}>
        Actuellement · {formatDebtAmount(data.balanceUsedBefore)} · Marge{' '}
        {formatDisplayMoneyAbsolute(Math.max(0, data.availableBefore))}
      </Text>

      {/* Utilization — CashflowComparisonWidget-style slim track */}
      <View style={styles.utilBlock}>
        <View style={styles.utilHeader}>
          <Text style={[planDetailFonts.detailLabel, { color: theme.textMuted }]}>
            Limite carte · {formatDisplayMoneyAbsolute(data.creditLimit)}
          </Text>
          <Text
            style={[
              planDetailFonts.stepLabel,
              styles.utilPercent,
              { color: percentColor },
            ]}
          >
            {Math.round(data.utilizationAfterPct)} %
          </Text>
        </View>
        <View style={[styles.utilTrack, { backgroundColor: colors.input }]}>
          <View
            style={[
              styles.utilFill,
              {
                flex: utilizationAfter,
                backgroundColor: barFillColor,
              },
            ]}
          />
          {utilizationRemainder > 0 ? <View style={{ flex: utilizationRemainder }} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  heroBlock: {
    gap: spacing.xs,
  },
  heroAmount: {
    letterSpacing: -0.8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metricAmount: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  utilBlock: {
    gap: spacing.sm,
  },
  utilHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  utilPercent: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  utilTrack: {
    height: UTIL_TRACK_HEIGHT,
    borderRadius: 13,
    overflow: 'hidden',
    flexDirection: 'row',
    width: '100%',
  },
  utilFill: {
    height: '100%',
    borderRadius: 13,
  },
});
