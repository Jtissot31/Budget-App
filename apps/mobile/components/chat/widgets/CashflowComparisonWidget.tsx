import { StyleSheet, Text, View } from 'react-native';
import { moneyAmountTypography, spacing } from '@/constants/theme';
import type { CashflowComparisonData } from '@/types/aiWidgets';
import {
  buildCashflowInsightMessage,
  buildCashflowPeriodLabel,
  buildCashflowShellLabel,
  cashflowBarFlexWeights,
  cashflowHonestBarFraction,
  formatCashflowBarAmountLabel,
  formatCashflowHeroAmount,
  normalizeCashflowComparisonData,
  sanitizeCashflowAmount,
  withCashflowBarSignedLabel,
} from './cashflowWidgetUtils';
import {
  AI_WIDGET_RADIUS,
  aiWidgetAmountTextProps,
  aiWidgetAmountTypography,
  aiWidgetFonts,
  aiWidgetHeroAmountTextProps,
  aiWidgetLabelTextProps,
  aiWidgetTypography,
  useAIWidgetColors,
} from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: CashflowComparisonData;
};

const TRACK_HEIGHT = 4;

/**
 * Cashflow comparison — premium minimalist language aligned with Agenda
 * {@link AgendaCashHeroCard} / {@link BalanceSummaryWidget}: eyebrow, large net,
 * quiet insight, slim dual metric tracks (no chunky vertical bars).
 */
export function CashflowComparisonWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const normalized = normalizeCashflowComparisonData(data);
  if (!normalized) return null;

  const income = sanitizeCashflowAmount(normalized.income);
  const expenses = sanitizeCashflowAmount(normalized.expenses);
  const displaySurplus =
    typeof data.surplus === 'number' && Number.isFinite(data.surplus)
      ? data.surplus
      : normalized.surplus;

  const incomeBarLabel = normalized.income_label
    ? withCashflowBarSignedLabel(normalized.income_label, 'income')
    : formatCashflowBarAmountLabel(income, 'income');
  const expensesBarLabel = normalized.expenses_label
    ? withCashflowBarSignedLabel(normalized.expenses_label, 'expense')
    : formatCashflowBarAmountLabel(expenses, 'expense');
  const heroLabel =
    normalized.surplus_label ?? formatCashflowHeroAmount(displaySurplus);

  const shellLabel = buildCashflowShellLabel(normalized.label);
  const insightMessage = buildCashflowInsightMessage(income, expenses, displaySurplus);
  const periodLabel = buildCashflowPeriodLabel(normalized.period);

  const hasMetrics = income > 0 || expenses > 0;
  const incomeFraction = cashflowHonestBarFraction(income, income, expenses);
  const expenseFraction = cashflowHonestBarFraction(expenses, income, expenses);

  const surplusColor =
    Math.abs(displaySurplus) < 1
      ? palette.text
      : displaySurplus > 0
        ? palette.green
        : palette.expense;

  const metricsAccessibilityLabel = `Revenus ${incomeBarLabel}, dépenses ${expensesBarLabel}`;

  return (
    <WidgetCardShell style={styles.shell}>
      <Text
        style={[
          styles.eyebrow,
          aiWidgetTypography.eyebrow,
          { color: palette.accent, fontFamily: aiWidgetFonts.label },
        ]}
        {...aiWidgetLabelTextProps}
      >
        {shellLabel.toUpperCase()}
      </Text>

      <View style={styles.heroBlock}>
        <Text
          style={[
            moneyAmountTypography({ tier: 'netWorth' }),
            styles.heroAmount,
            { color: surplusColor },
          ]}
          {...aiWidgetHeroAmountTextProps}
          accessibilityLabel={`Cashflow net ${heroLabel}`}
        >
          {heroLabel}
        </Text>
        <Text
          style={[
            aiWidgetTypography.insight,
            { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
          ]}
          numberOfLines={3}
          ellipsizeMode="tail"
        >
          {insightMessage}
        </Text>
      </View>

      {hasMetrics ? (
        <View style={styles.metricsBlock} accessibilityLabel={metricsAccessibilityLabel}>
          <CashflowMetricRow
            label="Revenus"
            amountLabel={incomeBarLabel}
            amountColor={palette.green}
            fillColor={palette.green}
            trackColor={palette.track}
            labelColor={palette.textMuted}
            fraction={incomeFraction}
          />
          <CashflowMetricRow
            label="Dépenses"
            amountLabel={expensesBarLabel}
            amountColor={palette.expense}
            fillColor={palette.expense}
            trackColor={palette.track}
            labelColor={palette.textMuted}
            fraction={expenseFraction}
          />
        </View>
      ) : null}

      <Text
        style={[
          styles.period,
          aiWidgetTypography.caption,
          { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular },
        ]}
      >
        {periodLabel}
      </Text>
    </WidgetCardShell>
  );
}

type MetricRowProps = {
  label: string;
  amountLabel: string;
  amountColor: string;
  fillColor: string;
  trackColor: string;
  labelColor: string;
  fraction: number;
};

function CashflowMetricRow({
  label,
  amountLabel,
  amountColor,
  fillColor,
  trackColor,
  labelColor,
  fraction,
}: MetricRowProps) {
  const weights = cashflowBarFlexWeights(fraction);
  const showFill = fraction > 0;

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHeader}>
        <Text
          style={[
            styles.metricLabel,
            aiWidgetTypography.legend,
            { color: labelColor, fontFamily: aiWidgetFonts.labelRegular },
          ]}
          {...aiWidgetLabelTextProps}
        >
          {label}
        </Text>
        <Text
          style={[
            aiWidgetAmountTypography('row'),
            styles.metricAmount,
            { color: amountColor },
          ]}
          {...aiWidgetAmountTextProps}
        >
          {amountLabel}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        {showFill ? (
          <>
            <View
              style={[
                styles.trackFill,
                { flex: weights.fill, backgroundColor: fillColor },
              ]}
            />
            <View style={{ flex: weights.empty }} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.md,
  },
  eyebrow: {
    marginBottom: 0,
  },
  heroBlock: {
    gap: spacing.xs,
    minWidth: 0,
  },
  heroAmount: {
    letterSpacing: -1.2,
    minWidth: 0,
    width: '100%',
  },
  metricsBlock: {
    gap: spacing.md,
  },
  metricRow: {
    gap: spacing.sm,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    minWidth: 0,
  },
  metricLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  metricAmount: {
    flexShrink: 1,
    maxWidth: '58%',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: AI_WIDGET_RADIUS,
    overflow: 'hidden',
    flexDirection: 'row',
    width: '100%',
  },
  trackFill: {
    height: '100%',
    borderRadius: AI_WIDGET_RADIUS,
  },
  period: {
    marginTop: spacing.xs,
  },
});
