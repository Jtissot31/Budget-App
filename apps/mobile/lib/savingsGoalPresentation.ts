import type { GoalProgressionSnapshot } from '@/lib/savingsGamification';

/**
 * Hub list row copy for Plan financier → « Mes objectifs d'épargne ».
 *
 * Hierarchy (do not invert):
 * - `title` = goal name (primary, bold, first line)
 * - `meta` = progress % or completion status (muted, second line)
 */
export type SavingsGoalHubRowCopy = {
  title: string;
  meta: string;
};

/** Primary line: the savings goal display name. */
export function savingsGoalHubRowTitle(goal: Pick<GoalProgressionSnapshot, 'name'>): string {
  return goal.name;
}

/** Secondary line: muted progress label — never use as the row title. */
export function savingsGoalHubRowMeta(goal: Pick<GoalProgressionSnapshot, 'completed' | 'pct'>): string {
  if (goal.completed) return 'Objectif atteint';
  return `${goal.pct} %`;
}

export function formatSavingsGoalHubRowCopy(
  goal: Pick<GoalProgressionSnapshot, 'name' | 'completed' | 'pct'>,
): SavingsGoalHubRowCopy {
  return {
    title: savingsGoalHubRowTitle(goal),
    meta: savingsGoalHubRowMeta(goal),
  };
}
