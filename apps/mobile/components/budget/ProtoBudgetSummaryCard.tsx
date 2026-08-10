/**
 * Budget Proto summary hero — Dépensé / Restant + thick progress (Figma).
 */
import { StyleSheet, Text, View } from 'react-native';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { moneyAmountTypography, typographyKit } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  totalAllocated: number;
  totalSpent: number;
};

export function ProtoBudgetSummaryCard({ totalAllocated, totalSpent }: Props) {
  const { colors } = useAppTheme();
  const remaining = totalAllocated - totalSpent;
  const pct = totalAllocated > 0 ? totalSpent / totalAllocated : 0;
  const over = remaining < 0;
  const accent = over ? colors.danger : colors.accentGreen;

  return (
    <ProtoGlassCard padding={20} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.left}>
          <Text style={[styles.label, { color: colors.textMuted }]}>DÉPENSÉ</Text>
          <Text style={[moneyAmountTypography({ tier: 'hero', fontSize: 28 }), { color: colors.text, letterSpacing: -0.6 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatDisplayMoneyAbsolute(totalSpent)}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.label, { color: colors.textMuted }]}>RESTANT</Text>
          <Text
            style={[moneyAmountTypography({ tier: 'stat', fontSize: 18 }), { color: accent, letterSpacing: -0.4 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {remaining >= 0
              ? formatDisplayMoneyAbsolute(remaining)
              : `−${formatDisplayMoneyAbsolute(Math.abs(remaining))}`}
          </Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: colors.borderSubtle }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, Math.max(0, pct * 100))}%`,
              backgroundColor: accent,
            },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <Text style={[styles.pct, { color: accent }]}>{`${Math.round(pct * 100)}% utilisé`}</Text>
        <Text style={[styles.sur, { color: colors.textMuted }]}>
          sur {formatDisplayMoneyAbsolute(totalAllocated)}
        </Text>
      </View>
    </ProtoGlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
    gap: 12,
  },
  left: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', flexShrink: 1, minWidth: 0, maxWidth: '46%' },
  label: {
    ...typographyKit.eyebrow,
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: { height: '100%', borderRadius: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  pct: { ...typographyKit.metaSemibold, fontSize: 11 },
  sur: { ...typographyKit.metaMedium, fontSize: 11, flexShrink: 1, textAlign: 'right' },
});
