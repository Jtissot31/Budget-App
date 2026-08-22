/**
 * Transactions cashflow hero — Budget Proto (minimal, flat).
 * Slim header + flat amounts + short dual bars + quiet épargne footer.
 * No glass card shell, no carousel chrome.
 */
import { StyleSheet, Text, View } from 'react-native';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

const BAR_CHART_H = 56;
const BAR_MIN_H = 4;

type Props = {
  monthLabel: string;
  totalIncome: number;
  totalSpend: number;
};

/** Honest height vs max(income, spend) — taller bar = larger amount. */
function comparisonBarHeight(value: number, peer: number, chartH: number): number {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const max = Math.max(safe, Number.isFinite(peer) ? Math.max(0, peer) : 0);
  if (max <= 0 || safe <= 0) return 0;
  const h = (safe / max) * chartH;
  return Math.max(BAR_MIN_H, Math.min(chartH, h));
}

export function TransactionsCashflowHero({ monthLabel, totalIncome, totalSpend }: Props) {
  const { colors } = useAppTheme();
  const spend = Math.abs(totalSpend);
  const saved = totalIncome - spend;
  const savedPositive = saved >= 0;

  const incomeBarH = comparisonBarHeight(totalIncome, spend, BAR_CHART_H);
  const spendBarH = comparisonBarHeight(spend, totalIncome, BAR_CHART_H);
  const expenseBarColor = 'rgba(255,255,255,0.22)';

  return (
    <View>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
        {`CASHFLOW · ${monthLabel.toUpperCase()}`}
      </Text>

      <View style={styles.cols}>
        <View style={styles.col}>
          <Text style={[styles.colLabel, { color: colors.textMuted }]}>Revenus</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'stat', fontSize: 17 }),
              { color: colors.accentGreen, letterSpacing: -0.35 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            +{formatDisplayMoneyAbsolute(totalIncome)}
          </Text>
          <View
            style={[styles.barSlot, { height: BAR_CHART_H, backgroundColor: colors.borderSubtle }]}
            accessibilityRole="image"
            accessibilityLabel={`Revenus ${formatDisplayMoneyAbsolute(totalIncome)}`}
          >
            {incomeBarH > 0 ? (
              <View
                style={[styles.bar, { height: incomeBarH, backgroundColor: colors.accentGreen }]}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.col}>
          <Text style={[styles.colLabel, { color: colors.textMuted }]}>Dépenses</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'stat', fontSize: 17 }),
              { color: colors.text, letterSpacing: -0.35 },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            −{formatDisplayMoneyAbsolute(spend)}
          </Text>
          <View
            style={[styles.barSlot, { height: BAR_CHART_H, backgroundColor: colors.borderSubtle }]}
            accessibilityRole="image"
            accessibilityLabel={`Dépenses ${formatDisplayMoneyAbsolute(spend)}`}
          >
            {spendBarH > 0 ? (
              <View style={[styles.bar, { height: spendBarH, backgroundColor: expenseBarColor }]} />
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.footerLabel, { color: colors.textMuted }]}>Épargné ce mois</Text>
        <Text
          style={[
            moneyAmountTypography({ tier: 'card', fontSize: 15 }),
            { color: savedPositive ? colors.accentGreen : colors.danger },
          ]}
        >
          {savedPositive ? '+' : '−'}
          {formatDisplayMoneyAbsolute(Math.abs(saved))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    ...typographyKit.eyebrow,
    fontSize: 10,
    letterSpacing: 0.9,
    marginBottom: 12,
  },
  cols: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  col: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  colLabel: {
    ...typographyKit.metaSemibold,
    fontSize: 11,
    letterSpacing: 0.15,
  },
  barSlot: {
    width: '100%',
    maxWidth: 48,
    marginTop: 4,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: { ...typographyKit.metaMedium, fontSize: 12 },
});
