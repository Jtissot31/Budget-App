import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ProgressBar } from '@/components/ProgressBar';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import {
  jakartaSemiboldText,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  buildBudgetCashflowImpact,
  type BudgetCashflowImpactInput,
} from '@/lib/budgetCashflowImpact';
import { useAppTheme } from '@/lib/themeContext';

type Props = BudgetCashflowImpactInput & {
  style?: StyleProp<ViewStyle>;
};

/** Shared “Impact cashflow” Onyx card — add form + existing category detail. */
export function BudgetCashflowImpactCard({ style, ...input }: Props) {
  const { colors } = useAppTheme();
  const { rows, shareOfAllocated } = buildBudgetCashflowImpact(input);

  return (
    <OnyxContainer
      halo={false}
      style={[
        {
          padding: ONYX_CONTAINER.padding.card,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <Text style={[styles.impactTitle, { color: colors.textMuted }]}>Impact cashflow</Text>
      {rows.map((row) => (
        <View key={row.id} style={styles.impactRow}>
          <Text style={[styles.impactLabel, { color: colors.textMuted }]}>{row.label}</Text>
          <Text
            style={[
              row.monetary ? styles.impactMoney : styles.impactValue,
              { color: colors.text },
              row.emphasize && jakartaSemiboldText,
            ]}
            numberOfLines={1}
          >
            {row.value}
          </Text>
        </View>
      ))}
      {shareOfAllocated != null ? (
        <View style={styles.shareBar}>
          <ProgressBar
            progress={Math.min(1, Math.max(0, shareOfAllocated))}
            color={colors.primary}
            height={4}
            trackColor={colors.border}
          />
        </View>
      ) : null}
    </OnyxContainer>
  );
}

const styles = StyleSheet.create({
  impactTitle: {
    ...typographyKit.eyebrow,
    marginBottom: spacing.xs,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  impactLabel: {
    flex: 1,
    ...typographyKit.metaMedium,
  },
  impactValue: {
    ...typographyKit.metaSemibold,
  },
  impactMoney: {
    ...moneyAmountTypography({ tier: 'row' }),
  },
  shareBar: {
    marginTop: spacing.xs,
  },
});
