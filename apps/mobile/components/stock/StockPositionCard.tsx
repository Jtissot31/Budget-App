/**
 * « Ta position » — ce que tu as investi vs ce que ça vaut aujourd'hui,
 * en deux barres comparables + gain total et part du compte.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { MockStockDetail } from '@/constants/mockStockDetail';
import { AnimatedBar, ListCard, SectionLabel } from '@/components/kit';
import { jakartaMediumText, jakartaSemiboldText } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

export function StockPositionCard({ detail }: { detail: MockStockDetail }) {
  const { colors } = useAppTheme();
  const { bookCost, totalValue, totalReturnDollar, totalReturnPercent, sharesLabel, accountName, accountPercent } =
    detail.position;
  const max = Math.max(bookCost, totalValue, 1);
  const up = totalReturnDollar >= 0;
  const tone = up ? colors.accentGreen : colors.danger;

  const bars = [
    { label: 'Investi', value: bookCost, color: colors.textMuted },
    { label: 'Valeur actuelle', value: totalValue, color: tone },
  ];

  return (
    <View>
      <SectionLabel title="Ta position" />
      <ListCard padding={16}>
        <View style={styles.headRow}>
          <View style={styles.headCopy}>
            <Text style={[styles.gain, jakartaSemiboldText, { color: tone }]}>
              {`${up ? '+' : '−'}${formatDisplayMoneyAbsolute(Math.abs(totalReturnDollar))}`}
            </Text>
            <Text style={[styles.sub, jakartaMediumText, { color: colors.textMuted }]}>
              {`${up ? '+' : '−'}${Math.abs(totalReturnPercent).toLocaleString('fr-CA', { maximumFractionDigits: 2 })} % depuis l’achat`}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.pillText, jakartaSemiboldText, { color: colors.textSecondary }]}>
              {sharesLabel}
            </Text>
          </View>
        </View>

        {bars.map((bar, index) => (
          <View key={bar.label} style={styles.barBlock}>
            <View style={styles.barLine}>
              <Text style={[styles.barLabel, jakartaMediumText, { color: colors.textMuted }]}>{bar.label}</Text>
              <Text style={[styles.barValue, jakartaSemiboldText, { color: colors.text }]}>
                {formatDisplayMoneyAbsolute(bar.value)}
              </Text>
            </View>
            <AnimatedBar
              progress={bar.value / max}
              color={bar.color}
              trackColor={colors.borderSubtle}
              height={8}
              delay={index * 120}
            />
          </View>
        ))}

        <Text style={[styles.foot, jakartaMediumText, { color: colors.textMuted }]}>
          {`${accountPercent} de ton compte ${accountName}`}
        </Text>
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  headCopy: { flexShrink: 1 },
  gain: { fontSize: 22, letterSpacing: -0.5 },
  sub: { fontSize: 12, marginTop: 2 },
  pill: { height: 28, paddingHorizontal: 11, borderRadius: 14, justifyContent: 'center', flexShrink: 0 },
  pillText: { fontSize: 12.5 },
  barBlock: { marginTop: 12, gap: 6 },
  barLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barLabel: { fontSize: 12.5 },
  barValue: { fontSize: 13.5 },
  foot: { fontSize: 12, marginTop: 14 },
});
