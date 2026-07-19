import { StyleSheet, Text, View } from 'react-native';
import { fontFamilies } from '@/constants/plusJakartaFonts';
import { moneyAmountTypography, spacing } from '@/constants/theme';
import type { CashflowComparisonData } from '@/types/aiWidgets';
import {
  buildCashflowInsightMessage,
  buildCashflowPeriodLabel,
  buildCashflowShellLabel,
  cashflowVerticalBarHeight,
  formatCashflowBarAmountLabel,
  formatCashflowHeroAmount,
  normalizeCashflowComparisonData,
  sanitizeCashflowAmount,
  withCashflowBarSignedLabel,
} from './cashflowWidgetUtils';
import { aiWidgetFonts, useAIWidgetColors } from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: CashflowComparisonData;
};

/** Maquette « Revenus vs dépenses » — vertical bar pair, honest scale. */
const MOCK = {
  secondary: '#8A8A8A',
  barGreen: '#00E664',
  barRed: '#FF5555',
  barColumnWidth: 88,
  chartHeight: 110,
  barGap: 20,
  barRadius: 10,
  heroFontSize: 40,
  /** Stat tier preset lineHeight is 28px — too small at 40px and clips ascenders/$/minus. */
  heroLineHeight: 48,
} as const;

const titleStyle = {
  fontFamily: fontFamilies.bold,
  fontSize: 14,
  lineHeight: 18,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
};

const insightStyle = {
  fontFamily: aiWidgetFonts.labelRegular,
  fontSize: 14,
  lineHeight: 18,
};

const heroAmountStyle = {
  ...moneyAmountTypography({
    tier: 'stat',
    fontSize: MOCK.heroFontSize,
    lineHeight: MOCK.heroLineHeight,
    letterSpacing: -1.2,
  }),
  includeFontPadding: false,
};

const barAmountStyle = {
  ...moneyAmountTypography({ tier: 'row', fontSize: 14, lineHeight: 20, letterSpacing: -0.3 }),
  includeFontPadding: false,
};

const BAR_AMOUNT_GAP = 8;

/** Reserved space above bars — label line + gap (must stay outside chartHeight). */
const BAR_AMOUNT_LABEL_AREA = barAmountStyle.lineHeight + BAR_AMOUNT_GAP;

const legendStyle = {
  fontFamily: aiWidgetFonts.label,
  fontSize: 13,
  lineHeight: 18,
};

const periodStyle = {
  fontFamily: aiWidgetFonts.labelRegular,
  fontSize: 13,
  lineHeight: 18,
};

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

  const hasChart = income > 0 || expenses > 0;
  const incomeBarHeight = cashflowVerticalBarHeight(
    income,
    income,
    expenses,
    MOCK.chartHeight,
  );
  const expenseBarHeight = cashflowVerticalBarHeight(
    expenses,
    income,
    expenses,
    MOCK.chartHeight,
  );

  const surplusColor =
    Math.abs(displaySurplus) < 1
      ? palette.text
      : displaySurplus > 0
        ? MOCK.barGreen
        : MOCK.barRed;

  const chartAccessibilityLabel = `Revenus ${incomeBarLabel}, dépenses ${expensesBarLabel}`;

  return (
    <WidgetCardShell style={styles.shell}>
      <Text style={[styles.title, titleStyle, { color: palette.text }]}>{shellLabel.toUpperCase()}</Text>

      <View style={styles.heroBlock}>
        <View style={styles.heroAmountSlot}>
          <Text
            style={[
              heroAmountStyle,
              styles.heroAmount,
              { color: surplusColor },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {heroLabel}
          </Text>
        </View>
        <Text style={[styles.insight, insightStyle, { color: MOCK.secondary }]}>{insightMessage}</Text>
      </View>

      {hasChart ? (
        <>
          <View
            style={[
              styles.barPairRow,
              { height: MOCK.chartHeight + BAR_AMOUNT_LABEL_AREA },
            ]}
            accessibilityRole="image"
            accessibilityLabel={chartAccessibilityLabel}
          >
            <CashflowBarColumn
              amountLabel={incomeBarLabel}
              barColor={MOCK.barGreen}
              barHeight={incomeBarHeight}
            />
            <CashflowBarColumn
              amountLabel={expensesBarLabel}
              barColor={MOCK.barRed}
              barHeight={expenseBarHeight}
            />
          </View>

          <View style={styles.legendRow}>
            <Text style={[styles.legendLabel, legendStyle, { color: MOCK.secondary }]}>Revenus</Text>
            <Text style={[styles.legendLabel, legendStyle, { color: MOCK.secondary }]}>Dépenses</Text>
          </View>
        </>
      ) : null}

      <Text style={[styles.period, periodStyle, { color: MOCK.secondary }]}>{periodLabel}</Text>
    </WidgetCardShell>
  );
}

type BarColumnProps = {
  amountLabel: string;
  barColor: string;
  barHeight: number;
};

function CashflowBarColumn({ amountLabel, barColor, barHeight }: BarColumnProps) {
  const safeHeight = Number.isFinite(barHeight) && barHeight > 0 ? barHeight : 0;

  return (
    <View style={styles.barColumn}>
      <View style={[styles.barAmountSlot, { height: BAR_AMOUNT_LABEL_AREA }]}>
        <Text
          style={[styles.barAmount, barAmountStyle, { color: MOCK.secondary }]}
          numberOfLines={1}
        >
          {amountLabel}
        </Text>
      </View>
      <View style={[styles.barTrack, { height: MOCK.chartHeight }]}>
        {safeHeight > 0 ? (
          <View
            style={[
              styles.bar,
              {
                height: safeHeight,
                backgroundColor: barColor,
              },
            ]}
          />
        ) : (
          <View style={styles.barPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 0,
  },
  title: {
    marginBottom: 20,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 26,
    overflow: 'visible',
  },
  heroAmountSlot: {
    width: '100%',
    minHeight: MOCK.heroLineHeight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  heroAmount: {
    textAlign: 'center',
    width: '100%',
    minHeight: MOCK.heroLineHeight,
  },
  insight: {
    textAlign: 'center',
    marginTop: 6,
  },
  barPairRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: MOCK.barGap,
    width: '100%',
    marginBottom: 12,
    overflow: 'visible',
  },
  barColumn: {
    width: MOCK.barColumnWidth,
    alignItems: 'center',
    overflow: 'visible',
  },
  barAmountSlot: {
    width: '100%',
    paddingBottom: BAR_AMOUNT_GAP,
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  barAmount: {
    textAlign: 'center',
    width: '100%',
    minHeight: barAmountStyle.lineHeight,
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: MOCK.barRadius,
  },
  barPlaceholder: {
    width: '100%',
    height: 0,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: MOCK.barGap,
    marginBottom: 18,
  },
  legendLabel: {
    width: MOCK.barColumnWidth,
    textAlign: 'center',
  },
  period: {
    marginBottom: spacing.md,
  },
});
