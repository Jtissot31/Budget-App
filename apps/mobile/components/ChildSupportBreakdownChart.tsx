import { StyleSheet, Text, View } from 'react-native';
import { GlassContainer } from '@/components/GlassContainer';
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { parseChildSupportFromLoan } from '@/lib/childSupportLoan';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan } from '@/types';

export function ChildSupportBreakdownChart({ loan }: { loan: Loan }) {
  const { colors, isLight } = useAppTheme();
  const { baseMonthly, specialFeesMonthly, totalMonthly } = parseChildSupportFromLoan(loan);

  const baseColor = colors.primary;
  const feesColor = colors.purple;
  const trackBg = isLight ? '#E8EDF3' : '#08090B';

  const hasFees = specialFeesMonthly > 0 && totalMonthly > 0;
  const basePct = hasFees ? Math.round((baseMonthly / totalMonthly) * 100) : 100;
  const feesPct = 100 - basePct;

  return (
    <GlassContainer
      style={styles.shell}
      innerStyle={styles.inner}
      padding={spacing.md}
      borderRadius={radius.lg}
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          PAIEMENT MENSUEL
        </Text>
        <Text style={[styles.totalAmount, { color: colors.text }]}>
          {formatDisplayMoneyAbsolute(totalMonthly)}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: trackBg }]}>
        {hasFees ? (
          <>
            <View style={[styles.segment, { flex: baseMonthly, backgroundColor: baseColor }]} />
            <View style={[styles.segment, { flex: specialFeesMonthly, backgroundColor: feesColor }]} />
          </>
        ) : (
          <View style={[styles.segment, { flex: 1, backgroundColor: baseColor }]} />
        )}
      </View>

      {hasFees ? (
        <View style={styles.legendBlock}>
          <View style={styles.legendItem}>
            <View style={styles.legendTitleRow}>
              <View style={[styles.legendDot, { backgroundColor: baseColor }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                Montant de base
              </Text>
            </View>
            <Text style={[styles.legendMeta, { color: colors.textMuted }]}>
              {formatDisplayMoneyAbsolute(baseMonthly)} · {basePct} %
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendTitleRow}>
              <View style={[styles.legendDot, { backgroundColor: feesColor }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>
                Frais particuliers
              </Text>
            </View>
            <Text style={[styles.legendMeta, { color: colors.textMuted }]}>
              {formatDisplayMoneyAbsolute(specialFeesMonthly)} · {feesPct} %
            </Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.fixedNote, { color: colors.textMuted }]}>
          Obligation fixe · aucun frais particuliers
        </Text>
      )}
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.lg,
  },
  inner: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: {
    ...jakartaBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flex: 1,
    flexShrink: 1,
  },
  totalAmount: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.3,
    flexShrink: 0,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  segment: {
    height: 10,
  },
  legendBlock: {
    gap: spacing.sm,
  },
  legendItem: {
    gap: 2,
  },
  legendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendLabel: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    flex: 1,
    minWidth: 0,
  },
  legendMeta: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    marginLeft: 11,
  },
  fixedNote: {
    ...jakartaMediumText,
    fontSize: typography.meta,
  },
});
