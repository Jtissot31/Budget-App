import { StyleSheet, Text, View } from 'react-native';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import {
  goalProgressTrackColor,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsGoal } from '@/types';

type Props = {
  goal: SavingsGoal;
};

/** Progress hero for savings goal detail. */
export function SavingsGoalDetailGamification({ goal }: Props) {
  const { colors, isLight } = useAppTheme();

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const progressPct =
    goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const progressComplete = progressPct >= 100;
  const progressFillColor = isLight && !progressComplete ? colors.text : colors.success;

  return (
    <OnyxContainer style={styles.progressCard}>
      <Text style={[moneyAmountTypography({ tier: 'hero' }), { color: colors.text }]}>
        {formatDisplayMoneyAbsolute(goal.currentAmount)} /{' '}
        {formatDisplayMoneyAbsolute(goal.targetAmount)}
      </Text>
      <View style={[styles.progressTrack, { backgroundColor: goalProgressTrackColor(isLight) }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(100, Math.max(progressPct, progressPct > 0 ? 3 : 0))}%`,
              backgroundColor: progressFillColor,
            },
          ]}
        />
      </View>
      <View style={styles.progressMetaRow}>
        <Text style={[typographyKit.metaMedium, { color: colors.textMuted }]}>
          {Math.round(progressPct)} %
        </Text>
        <Text
          style={[moneyAmountTypography({ tier: 'row', fontSize: 13 }), { color: colors.textMuted }]}
        >
          {formatDisplayMoneyAbsolute(remaining)} restants
        </Text>
      </View>
    </OnyxContainer>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.md,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
