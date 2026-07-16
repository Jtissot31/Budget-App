import { useMemo } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { MdiIcon } from '@/components/MdiIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { PLAN_DETAIL, planDetailFonts } from '@/components/plans/planDetailTheme';
import type { IconName } from '@/constants/categoryOptions';
import { PLAN_FINANCE_CONTAINER } from '@/constants/planFinanceKit';
import { interMediumText, moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { resolveMdiOrLegacyIcon, resolveStoredIconToMdi } from '@/lib/mdiIconCatalog';
import {
  buildSavingsGamificationInputsKey,
  computeSavingsGamification,
  EMPTY_SIMULATED_ACCOUNTS,
  EMPTY_SAVINGS_TRANSACTIONS,
} from '@/lib/savingsGamification';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  goal: SavingsGoal;
  goals: readonly SavingsGoal[];
  transactions?: readonly Transaction[];
  accounts?: readonly SimulatedAccount[];
  weeklyContributionLabel?: string | null;
  plannedDates?: string | null;
};

function goalPlanSummary(goal: SavingsGoal): string {
  const normalized = goal.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (normalized.includes('fonds') && normalized.includes('urgence')) {
    return 'Réserve pour couvrir 3 mois de dépenses essentielles.';
  }
  if (normalized.includes('vacances')) {
    return 'Mettre de côté pour un voyage planifié.';
  }
  if (normalized.includes('mise') && (normalized.includes('fonds') || normalized.includes('cote'))) {
    return 'Épargner pour un achat immobilier ou un projet important.';
  }
  if (goal.targetAmount > 0) {
    return `Objectif · ${formatDisplayMoneyAbsolute(goal.targetAmount)}`;
  }
  return 'Épargne vers un objectif défini.';
}

function GoalIcon({ icon, color }: { icon: string; color: string }) {
  const mdiName = resolveStoredIconToMdi(icon) ?? resolveMdiOrLegacyIcon(icon);
  const isMdi = resolveStoredIconToMdi(icon) != null;

  if (isMdi) {
    return <MdiIcon name={mdiName} size={28} color={color} />;
  }

  return <AppIcon family="ionicons" name={icon as IconName} size={28} color={color} />;
}

/** Premium hero for savings goal detail — plan context, progression, streak/level meta. */
export function SavingsGoalDetailGamification({
  goal,
  goals,
  transactions = EMPTY_SAVINGS_TRANSACTIONS,
  accounts = EMPTY_SIMULATED_ACCOUNTS,
  weeklyContributionLabel,
  plannedDates,
}: Props) {
  const { colors } = useAppTheme();

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

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const progressPct =
    goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const progressComplete = progressPct >= 100;
  const accentColor = progressComplete ? colors.success : PLAN_DETAIL.accent;
  const levelBarWidth = Math.max(
    Math.round(gamification.level.levelProgress * 100),
    gamification.level.points > 0 ? 4 : 0,
  );
  const hasContribution =
    weeklyContributionLabel != null &&
    weeklyContributionLabel.trim().length > 0 &&
    weeklyContributionLabel !== 'N/A';

  return (
    <View style={styles.root}>
      <View style={styles.planHeader}>
        <GoalIcon icon={goal.icon} color={PLAN_DETAIL.textMuted} />
        <Text style={[planDetailFonts.body, styles.planSummary, { color: PLAN_DETAIL.textMuted }]}>
          {goalPlanSummary(goal)}
        </Text>
        {hasContribution ? (
          <Text style={[styles.planMeta, interMediumText, { color: PLAN_DETAIL.textMuted }]}>
            Versement · {weeklyContributionLabel}
          </Text>
        ) : null}
        {plannedDates ? (
          <Text style={[styles.planMeta, interMediumText, { color: PLAN_DETAIL.textMuted }]}>
            Fin estimée · {plannedDates}
          </Text>
        ) : null}
      </View>

      <PlanFinanceContainer style={styles.progressCard}>
        <Text style={[moneyAmountTypography({ tier: 'hero' }), { color: PLAN_DETAIL.text }]}>
          {formatDisplayMoneyAbsolute(goal.currentAmount)} /{' '}
          {formatDisplayMoneyAbsolute(goal.targetAmount)}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: PLAN_DETAIL.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, Math.max(progressPct, progressPct > 0 ? 3 : 0))}%`,
                backgroundColor: accentColor,
              },
            ]}
          />
        </View>
        <Text style={[planDetailFonts.heroMeta, { color: PLAN_DETAIL.textMuted }]}>
          {Math.round(progressPct)} % · {formatDisplayMoneyAbsolute(remaining)} restants
        </Text>
      </PlanFinanceContainer>

      <PlanFinanceContainer halo={false} style={styles.engagementCard}>
        <View style={styles.engagementBlock}>
          <View style={styles.engagementHeader}>
            <Text style={[planDetailFonts.sectionCaps, { color: PLAN_DETAIL.textMuted }]}>SÉRIE</Text>
            <Text style={[typographyKit.metaMedium, { color: PLAN_DETAIL.text }]}>
              {gamification.streak.current} sem.
            </Text>
          </View>
          <Text
            style={[
              planDetailFonts.body,
              {
                color:
                  gamification.streak.current > 0 ? PLAN_DETAIL.text : PLAN_DETAIL.textMuted,
              },
            ]}
            numberOfLines={2}
          >
            {gamification.streak.encouragingMessage}
          </Text>
          {gamification.streak.best > 0 ? (
            <Text style={[styles.streakRecord, { color: PLAN_DETAIL.textMuted }]}>
              Record · {gamification.streak.best} sem.
            </Text>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: PLAN_DETAIL.border }]} />

        <View style={styles.engagementBlock}>
          <View style={styles.engagementHeader}>
            <Text style={[planDetailFonts.sectionCaps, { color: PLAN_DETAIL.textMuted }]}>
              NIVEAU {gamification.level.level}
            </Text>
            <Text style={[typographyKit.metaMedium, { color: PLAN_DETAIL.textMuted }]}>
              {gamification.level.rankLabel}
            </Text>
          </View>
          <View style={[styles.levelTrack, { backgroundColor: PLAN_DETAIL.border }]}>
            <View
              style={[
                styles.levelFill,
                {
                  width: `${levelBarWidth}%`,
                  backgroundColor: PLAN_DETAIL.accent,
                },
              ]}
            />
          </View>
          <Text style={[styles.levelHint, { color: PLAN_DETAIL.textMuted }]}>
            {gamification.level.pointsToNextLevel > 0
              ? `${gamification.level.pointsToNextLevel} pts avant le niveau ${gamification.level.level + 1}`
              : `${gamification.level.points} pts accumulés`}
          </Text>
        </View>
      </PlanFinanceContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: PLAN_DETAIL.sectionGap,
  },
  planHeader: {
    gap: spacing.sm,
  },
  planSummary: {
    maxWidth: '100%',
  },
  planMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
  progressCard: {
    padding: PLAN_FINANCE_CONTAINER.padding.card,
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
  engagementCard: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  engagementBlock: {
    gap: spacing.sm,
  },
  engagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  streakRecord: {
    ...typographyKit.microMedium,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  levelTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: 2,
  },
  levelHint: {
    ...typographyKit.microMedium,
  },
});
