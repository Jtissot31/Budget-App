import type { SavingsGoal } from '@/types';

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Baseline already saved when the goal was created (immutable after first save). */
export function goalInitialSaved(goal: Pick<SavingsGoal, 'initialSavedAmount'>) {
  return Math.max(goal.initialSavedAmount ?? 0, 0);
}

/**
 * Progress on the savings **journey**: how much of the gap (target − initial) is filled.
 * Formula: (currentAmount − initial) / (target − initial), clamped to [0, 1].
 */
export function savingsGoalIncrementalProgress(
  goal: Pick<SavingsGoal, 'targetAmount' | 'currentAmount' | 'initialSavedAmount'>,
) {
  const initial = goalInitialSaved(goal);
  const current = Math.max(goal.currentAmount, 0);
  const target = Math.max(goal.targetAmount, 0);
  const denom = target - initial;
  if (denom <= 0) {
    if (target <= 0) return 0;
    return current >= target ? 1 : 0;
  }
  return clamp((current - initial) / denom, 0, 1);
}
