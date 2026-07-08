import type { LoanPaymentFrequency } from '@/types';

export type SavingsGoalContributionFrequency = Extract<
  LoanPaymentFrequency,
  'weekly' | 'biweekly' | 'monthly'
>;

export const SAVINGS_GOAL_CONTRIBUTION_FREQUENCIES: Array<{
  id: SavingsGoalContributionFrequency;
  label: string;
}> = [
  { id: 'weekly', label: 'Par semaine' },
  { id: 'biweekly', label: 'Bihebdo' },
  { id: 'monthly', label: 'Par mois' },
];

export function savingsGoalContributionFrequencyLabel(
  frequency: SavingsGoalContributionFrequency | undefined,
): string {
  return (
    SAVINGS_GOAL_CONTRIBUTION_FREQUENCIES.find((item) => item.id === (frequency ?? 'weekly'))?.label ??
    'Par semaine'
  );
}

export function toWeeklyContributionAmount(
  amount: number,
  frequency: SavingsGoalContributionFrequency,
): number {
  if (frequency === 'weekly') return amount;
  if (frequency === 'biweekly') return amount / 2;
  return (amount * 12) / 52;
}

export function fromWeeklyContributionAmount(
  weeklyAmount: number,
  frequency: SavingsGoalContributionFrequency,
): number {
  if (frequency === 'weekly') return weeklyAmount;
  if (frequency === 'biweekly') return weeklyAmount * 2;
  return (weeklyAmount * 52) / 12;
}

export function convertContributionAmountBetweenFrequencies(
  amount: number,
  from: SavingsGoalContributionFrequency,
  to: SavingsGoalContributionFrequency,
): number {
  if (from === to) return amount;
  const weekly = toWeeklyContributionAmount(amount, from);
  return fromWeeklyContributionAmount(weekly, to);
}
