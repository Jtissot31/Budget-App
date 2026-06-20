import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { DiamondLevelBadge } from '@/components/goals/DiamondLevelBadge';
import { GoalProgressionRow } from '@/components/goals/GoalProgressionRow';
import { SavingsStreakModule } from '@/components/goals/SavingsStreakModule';
import {
  GOAL_PROGRESS_FILL,
  PAGE_PADDING_HORIZONTAL,
  interBoldText,
  interExtraBoldText,
  spacing,
  typography,
} from '@/constants/theme';
import { computeSavingsGamification, buildSavingsGamificationInputsKey, EMPTY_SIMULATED_ACCOUNTS, EMPTY_SAVINGS_TRANSACTIONS } from '@/lib/savingsGamification';
import { getCurrentSavingsGoalsTotal } from '@/lib/buildSavingsGoalsTrendSeries';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

type Props = {
  goals: readonly SavingsGoal[];
  transactions?: readonly Transaction[];
  accounts?: readonly SimulatedAccount[];
  onGoalPress?: (goalId: string) => void;
};

export function SavingsGoalsProgressHub({
  goals,
  transactions = EMPTY_SAVINGS_TRANSACTIONS,
  accounts = EMPTY_SIMULATED_ACCOUNTS,
  onGoalPress,
}: Props) {
  const { colors, isLight } = useAppTheme();

  const gamificationInputKey = buildSavingsGamificationInputsKey(goals, transactions, accounts);

  const gamification = useMemo(
    () => computeSavingsGamification(goals, transactions, accounts),
    // gamificationInputKey captures goals/transactions/accounts content without unstable array refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gamificationInputKey],
  );

  const totalSaved = useMemo(
    () => getCurrentSavingsGoalsTotal(goals, transactions, accounts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gamificationInputKey],
  );

  const completedCount = gamification.goalProgressions.filter((goal) => goal.completed).length;

  return (
    <View style={styles.wrapper}>
      <View style={styles.heroHeader}>
        <DashboardSectionLabel style={styles.heroEyebrow}>{"PARCOURS D'ÉPARGNE"}</DashboardSectionLabel>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Continue, tu avances !</Text>
        <Text style={[styles.heroSaved, { color: GOAL_PROGRESS_FILL }]}>
          {formatDisplayMoneyAbsolute(totalSaved)} épargnés
        </Text>
      </View>

      <DashboardCard innerStyle={styles.hubCardInner} padding={spacing.lg}>
        <View style={styles.gamificationRow}>
          <DiamondLevelBadge levelStats={gamification.level} />
          <View style={styles.streakColumn}>
            <SavingsStreakModule streak={gamification.streak} />
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
            : 'Niveau max atteint pour l\'instant — continue d\'épargner !'}
        </Text>
      </DashboardCard>

      <View style={styles.progressionsSection}>
        <View style={styles.progressionsHeader}>
          <DashboardSectionLabel>PROGRESSION PAR OBJECTIF</DashboardSectionLabel>
          {completedCount > 0 ? (
            <Text style={[styles.completedBadge, { color: GOAL_PROGRESS_FILL }]}>
              {completedCount} atteint{completedCount > 1 ? 's' : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.progressionList}>
          {gamification.goalProgressions.map((goal) => (
            <GoalProgressionRow key={goal.goalId} goal={goal} onPress={onGoalPress} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    gap: spacing.lg,
  },
  heroHeader: {
    gap: spacing.xs,
  },
  heroEyebrow: {
    marginBottom: 2,
  },
  heroTitle: {
    ...interExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.3,
  },
  heroSaved: {
    ...interBoldText,
    fontSize: typography.caption,
  },
  hubCardInner: {
    gap: spacing.md,
  },
  gamificationRow: {
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
    ...interBoldText,
    fontSize: typography.micro,
    lineHeight: 16,
  },
  progressionsSection: {
    gap: spacing.sm,
  },
  progressionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  completedBadge: {
    ...interBoldText,
    fontSize: typography.micro,
  },
  progressionList: {
    gap: spacing.sm,
  },
});
