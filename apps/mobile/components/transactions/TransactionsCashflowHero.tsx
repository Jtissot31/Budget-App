/**
 * Transactions cashflow hero — Budget Proto (screenshot-faithful).
 * Grey dépenses segment left · green épargné segment right · carousel dots.
 */
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { RADIUS, SPACING } from '@/constants/design-tokens';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  monthLabel: string;
  totalIncome: number;
  totalSpend: number;
};

export function TransactionsCashflowHero({ monthLabel, totalIncome, totalSpend }: Props) {
  const { colors } = useAppTheme();
  const spend = Math.abs(totalSpend);
  const saved = totalIncome - spend;
  const savedPositive = saved >= 0;

  let spendPct = 0;
  let savePct = 0;
  if (totalIncome > 0) {
    spendPct = Math.min(100, Math.round((spend / totalIncome) * 100));
    savePct = Math.max(0, 100 - spendPct);
  } else if (spend > 0) {
    spendPct = 100;
    savePct = 0;
  }

  return (
    <View style={styles.wrap}>
      <ProtoGlassCard padding={18}>
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          {`CASHFLOW · ${monthLabel.toUpperCase()}`}
        </Text>

        <View style={styles.cols}>
          <View style={[styles.mini, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.miniLabel}>
              <AppIcon family="ionicons" name="trending-up" size={13} color={colors.accentGreen} />
              <Text style={[styles.miniTitle, { color: colors.textMuted }]}>Revenus</Text>
            </View>
            <Text
              style={[
                styles.miniAmount,
                moneyAmountTypography({ tier: 'stat', fontSize: 18 }),
                { color: colors.text, letterSpacing: -0.4 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              +{formatDisplayMoneyAbsolute(totalIncome)}
            </Text>
          </View>
          <View style={[styles.mini, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.miniLabel}>
              <AppIcon family="ionicons" name="trending-down" size={13} color={colors.textMuted} />
              <Text style={[styles.miniTitle, { color: colors.textMuted }]}>Dépenses</Text>
            </View>
            <Text
              style={[
                styles.miniAmount,
                moneyAmountTypography({ tier: 'stat', fontSize: 18 }),
                { color: colors.text, letterSpacing: -0.4 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              −{formatDisplayMoneyAbsolute(spend)}
            </Text>
          </View>
        </View>

        <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
          {spendPct > 0 ? (
            <View
              style={[
                styles.segment,
                {
                  flex: spendPct,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                },
              ]}
            />
          ) : null}
          {savePct > 0 ? (
            <View
              style={[
                styles.segment,
                {
                  flex: savePct,
                  backgroundColor: colors.accentGreen,
                },
              ]}
            />
          ) : null}
        </View>
        <View style={styles.pctRow}>
          <Text style={[styles.pctLabel, { color: colors.textMuted }]}>{`Dépenses ${spendPct}%`}</Text>
          <Text style={[styles.pctLabel, { color: colors.accentGreen }]}>{`Épargné ${savePct}%`}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerLabel, { color: colors.textMuted }]}>Épargné ce mois</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'card' }),
              { color: savedPositive ? colors.accentGreen : colors.danger },
            ]}
          >
            {savedPositive ? '+' : '−'}
            {formatDisplayMoneyAbsolute(Math.abs(saved))}
          </Text>
        </View>
      </ProtoGlassCard>
      <View style={styles.dots}>
        <View style={[styles.dot, { backgroundColor: colors.text }]} />
        <View style={[styles.dot, { backgroundColor: colors.textMuted, opacity: 0.35 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm },
  eyebrow: {
    ...typographyKit.eyebrow,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  cols: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  mini: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  miniLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniTitle: { ...typographyKit.metaSemibold, fontSize: 11 },
  miniAmount: { letterSpacing: -0.4 },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
    flexDirection: 'row',
  },
  segment: { height: '100%' },
  pctRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  pctLabel: { ...typographyKit.metaMedium, fontSize: 11, flexShrink: 1 },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: { ...typographyKit.metaMedium, fontSize: 13 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: RADIUS.pill },
});
