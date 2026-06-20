import {
  buildSavingsGoalDepositEvents,
  type SavingsGoalDepositEvent,
} from '@/lib/savingsGoalDeposits';
import { savingsGoalIncrementalProgress } from '@/lib/savingsGoalProgress';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

/** Stable empty collections for gamification props (avoid new [] each render). */
export const EMPTY_SAVINGS_TRANSACTIONS: readonly Transaction[] = [];
export const EMPTY_SIMULATED_ACCOUNTS: readonly SimulatedAccount[] = [];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const POINTS_PER_LEVEL = 150;

/** Milestone streak lengths used for bonus points and streak-bar targets. */
export const STREAK_MILESTONES = [2, 4, 8, 12] as const;

export type SavingsRankTier = {
  minLevel: number;
  label: string;
};

export const SAVINGS_RANK_TIERS: readonly SavingsRankTier[] = [
  { minLevel: 1, label: 'Débutant' },
  { minLevel: 2, label: 'Épargnant' },
  { minLevel: 4, label: 'Discipliné' },
  { minLevel: 6, label: 'Champion' },
  { minLevel: 9, label: 'Maître' },
] as const;

export type SavingsStreakStats = {
  current: number;
  best: number;
  encouragingMessage: string;
  nextMilestone: number;
  milestoneProgress: number;
};

export type SavingsLevelStats = {
  points: number;
  level: number;
  rankLabel: string;
  pointsInLevel: number;
  pointsToNextLevel: number;
  levelProgress: number;
};

export type GoalProgressionSnapshot = {
  goalId: string;
  name: string;
  icon: string;
  progress: number;
  pct: number;
  currentAmount: number;
  targetAmount: number;
  completed: boolean;
};

export type SavingsGamificationSnapshot = {
  level: SavingsLevelStats;
  streak: SavingsStreakStats;
  goalProgressions: GoalProgressionSnapshot[];
};

export function getWeekStartMs(ts: number): number {
  const date = new Date(ts);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function positiveDepositWeeks(
  events: readonly SavingsGoalDepositEvent[],
  goalFilter?: ReadonlySet<string>,
): Set<number> {
  const weeks = new Set<number>();
  for (const event of events) {
    if (event.amount <= 0) continue;
    if (goalFilter && !goalFilter.has(event.goalId)) continue;
    weeks.add(getWeekStartMs(event.ts));
  }
  return weeks;
}

export function computeBestStreak(depositWeeks: ReadonlySet<number>): number {
  if (depositWeeks.size === 0) return 0;

  const sorted = [...depositWeeks].sort((a, b) => a - b);
  let best = 1;
  let run = 1;

  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]!;
    const current = sorted[index]!;
    if (current - prev === MS_PER_WEEK) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  return best;
}

export function computeCurrentStreak(depositWeeks: ReadonlySet<number>, nowMs: number = Date.now()): number {
  if (depositWeeks.size === 0) return 0;

  const currentWeekStart = getWeekStartMs(nowMs);
  const previousWeekStart = currentWeekStart - MS_PER_WEEK;

  let anchorWeek: number | null = null;
  if (depositWeeks.has(currentWeekStart)) {
    anchorWeek = currentWeekStart;
  } else if (depositWeeks.has(previousWeekStart)) {
    anchorWeek = previousWeekStart;
  }

  if (anchorWeek == null) return 0;

  let streak = 0;
  let week = anchorWeek;
  while (depositWeeks.has(week)) {
    streak += 1;
    week -= MS_PER_WEEK;
  }

  return streak;
}

export function getRankLabelForLevel(level: number): string {
  let label = SAVINGS_RANK_TIERS[0]!.label;
  for (const tier of SAVINGS_RANK_TIERS) {
    if (level >= tier.minLevel) label = tier.label;
  }
  return label;
}

export function computeLevelFromPoints(points: number): SavingsLevelStats {
  const safePoints = Math.max(0, Math.floor(points));
  const level = Math.floor(safePoints / POINTS_PER_LEVEL) + 1;
  const pointsInLevel = safePoints % POINTS_PER_LEVEL;
  const pointsToNextLevel = POINTS_PER_LEVEL - pointsInLevel;

  return {
    points: safePoints,
    level,
    rankLabel: getRankLabelForLevel(level),
    pointsInLevel,
    pointsToNextLevel: pointsInLevel === 0 && safePoints > 0 ? 0 : pointsToNextLevel,
    levelProgress: pointsInLevel / POINTS_PER_LEVEL,
  };
}

function milestoneProgress(currentStreak: number): { nextMilestone: number; progress: number } {
  const next = STREAK_MILESTONES.find((milestone) => currentStreak < milestone) ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1]!;
  const previous = STREAK_MILESTONES.filter((milestone) => milestone <= currentStreak).pop() ?? 0;
  const span = Math.max(next - previous, 1);
  const progress = currentStreak >= next ? 1 : (currentStreak - previous) / span;
  return { nextMilestone: next, progress: Math.min(1, Math.max(0, progress)) };
}

export function formatStreakEncouragement(current: number, best: number): string {
  if (current <= 0) {
    if (best > 0) {
      return `Meilleure série : ${best} semaine${best > 1 ? 's' : ''} — relance ta série !`;
    }
    return 'Fais un dépôt cette semaine pour démarrer ta série !';
  }

  if (current === 1) return '1 semaine d\'affilée — bravo, continue !';
  if (current < 4) return `${current} semaines d'affilée — continue !`;
  if (current < 8) return `${current} semaines d'affilée — tu es régulier·e !`;
  return `${current} semaines d'affilée — impressionnant !`;
}

export function computeStreakStats(
  events: readonly SavingsGoalDepositEvent[],
  goalFilter?: ReadonlySet<string>,
  nowMs: number = Date.now(),
): SavingsStreakStats {
  const depositWeeks = positiveDepositWeeks(events, goalFilter);
  const current = computeCurrentStreak(depositWeeks, nowMs);
  const best = Math.max(computeBestStreak(depositWeeks), current);
  const { nextMilestone, progress } = milestoneProgress(current);

  return {
    current,
    best,
    encouragingMessage: formatStreakEncouragement(current, best),
    nextMilestone,
    milestoneProgress: progress,
  };
}

function goalMilestonePoints(progress: number): number {
  let bonus = 0;
  if (progress >= 0.25) bonus += 20;
  if (progress >= 0.5) bonus += 20;
  if (progress >= 0.75) bonus += 25;
  if (progress >= 1) bonus += 80;
  return bonus;
}

function streakBonusPoints(currentStreak: number): number {
  let bonus = 0;
  if (currentStreak >= 2) bonus += 10;
  if (currentStreak >= 4) bonus += 25;
  if (currentStreak >= 8) bonus += 50;
  if (currentStreak >= 12) bonus += 100;
  return bonus;
}

export function computeSavingsPoints(
  goals: readonly SavingsGoal[],
  events: readonly SavingsGoalDepositEvent[],
  streak: Pick<SavingsStreakStats, 'current'>,
  goalFilter?: ReadonlySet<string>,
): number {
  let points = 0;

  for (const event of events) {
    if (event.amount <= 0) continue;
    if (goalFilter && !goalFilter.has(event.goalId)) continue;
    points += 10;
    points += Math.floor(event.amount / 50);
  }

  const scopedGoals = goalFilter ? goals.filter((goal) => goalFilter.has(goal.id)) : goals;
  for (const goal of scopedGoals) {
    const progress = savingsGoalIncrementalProgress(goal);
    points += goalMilestonePoints(progress);
  }

  points += streakBonusPoints(streak.current);
  return points;
}

export function buildGoalProgressions(goals: readonly SavingsGoal[]): GoalProgressionSnapshot[] {
  return goals.map((goal) => {
    const progress = savingsGoalIncrementalProgress(goal);
    const pct = Math.round(progress * 100);
    return {
      goalId: goal.id,
      name: goal.name,
      icon: goal.icon || 'flag-outline',
      progress,
      pct,
      currentAmount: goal.currentAmount,
      targetAmount: goal.targetAmount,
      completed: progress >= 1,
    };
  });
}

/** Stable string key for useMemo — avoids recomputing when array refs change but data is unchanged. */
export function buildSavingsGamificationInputsKey(
  goals: readonly SavingsGoal[],
  transactions: readonly Transaction[],
  accounts: readonly SimulatedAccount[],
  goalId?: string,
): string {
  const goalsPart = goals
    .map(
      (goal) =>
        `${goal.id}:${goal.currentAmount}:${goal.targetAmount}:${goal.initialSavedAmount ?? 0}:${goal.weeklyContribution ?? ''}`,
    )
    .join('|');
  const txPart = transactions.map((tx) => `${tx.id}:${tx.amount}:${tx.date}:${tx.type}`).join('|');
  const acPart = accounts
    .map((account) => `${account.id}:${account.linkedSavingsGoalId ?? ''}:${account.balance}`)
    .join('|');
  return `${goalId ?? '*'}::${goalsPart}::${txPart}::${acPart}`;
}

export function computeSavingsGamification(
  goals: readonly SavingsGoal[],
  transactions: readonly Transaction[] = EMPTY_SAVINGS_TRANSACTIONS,
  accounts: readonly SimulatedAccount[] = EMPTY_SIMULATED_ACCOUNTS,
  options?: {
    goalId?: string;
    nowMs?: number;
  },
): SavingsGamificationSnapshot {
  const nowMs = options?.nowMs ?? Date.now();
  const goalFilter = options?.goalId ? new Set([options.goalId]) : undefined;
  const scopedGoals = goalFilter ? goals.filter((goal) => goalFilter.has(goal.id)) : goals;
  const events = buildSavingsGoalDepositEvents(scopedGoals, transactions, accounts, nowMs);
  const streak = computeStreakStats(events, goalFilter, nowMs);
  const points = computeSavingsPoints(scopedGoals, events, streak, goalFilter);
  const level = computeLevelFromPoints(points);
  const goalProgressions = buildGoalProgressions(scopedGoals);

  return { level, streak, goalProgressions };
}
