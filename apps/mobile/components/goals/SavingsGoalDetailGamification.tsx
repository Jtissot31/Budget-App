import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DashboardCard } from '@/components/DashboardCard';
import { DiamondLevelBadge } from '@/components/goals/DiamondLevelBadge';
import { SavingsStreakModule } from '@/components/goals/SavingsStreakModule';
import {
  GOAL_PROGRESS_FILL,
  jakartaBoldText,
  spacing,
  typography,
} from '@/constants/theme';
import {
  buildSavingsGamificationInputsKey,
  computeSavingsGamification,
  EMPTY_SIMULATED_ACCOUNTS,
  EMPTY_SAVINGS_TRANSACTIONS,
} from '@/lib/savingsGamification';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

type Props = {
  goal: SavingsGoal;
  goals: readonly SavingsGoal[];
  transactions?: readonly Transaction[];
  accounts?: readonly SimulatedAccount[];
};

/** Compact gamification strip for a single savings goal detail screen. */
export function SavingsGoalDetailGamification({
  goal,
  goals,
  transactions = EMPTY_SAVINGS_TRANSACTIONS,
  accounts = EMPTY_SIMULATED_ACCOUNTS,
}: Props) {
  const { colors, isLight } = useAppTheme();

  const gamificationInputKey = buildSavingsGamificationInputsKey(
    goals,
    transactions,
    accounts,
    goal.id,
  );

  const gamification = useMemo(
    () =>
      computeSavingsGamification(goals, transactions, accounts, {
        goalId: goal.id,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gamificationInputKey],
  );

  return (
    <DashboardCard innerStyle={styles.cardInner} padding={spacing.lg}>
      <Text style={[styles.title, { color: colors.text }]}>Ta progression gamifiée</Text>
      <View style={styles.row}>
        <DiamondLevelBadge levelStats={gamification.level} />
        <View style={styles.streakColumn}>
          <SavingsStreakModule streak={gamification.streak} compact />
        </View>
      </View>
      <View style={[styles.levelBarWrap, { backgroundColor: isLight ? '#E8EDF3' : '#08090B' }]}>
        <View
          style={[
            styles.levelBarFill,
            {
              width: `${Math.max(Math.round(gamification.level.levelProgress * 100), gamification.level.points > 0 ? 4 : 0)}%`,
              backgroundColor: GOAL_PROGRESS_FILL,
            },
          ]}
        />
      </View>
      <Text style={[styles.levelHint, { color: colors.textMuted }]}>
        {gamification.level.pointsToNextLevel > 0
          ? `${gamification.level.pointsToNextLevel} pts avant le niveau ${gamification.level.level + 1}`
          : 'Continue tes dépôts pour monter de niveau !'}
      </Text>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    gap: spacing.md,
  },
  title: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  streakColumn: {
    flex: 1,
    minWidth: 0,
    paddingTop: spacing.xs,
  },
  levelBarWrap: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  levelHint: {
    ...jakartaBoldText,
    fontSize: typography.micro,
    lineHeight: 16,
  },
});
