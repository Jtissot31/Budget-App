import type { DashboardPlanDetail } from '@/lib/dashboardPlansMock';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

export function planRemainingAmount(plan: DashboardPlanDetail): number {
  return Math.max(0, plan.targetAmount - plan.currentAmount);
}

export function planCompletedSteps(plan: DashboardPlanDetail): { done: number; total: number } {
  const total = plan.steps.length;
  const done = plan.steps.filter((step) => step.completed).length;
  return { done, total };
}

export function planProgressSummary(plan: DashboardPlanDetail): string {
  const remaining = planRemainingAmount(plan);
  if (plan.category === 'Budget') {
    return `${formatDisplayMoneyAbsolute(remaining)} restants sur l'enveloppe mensuelle`;
  }
  return `${formatDisplayMoneyAbsolute(remaining)} restants sur ${formatDisplayMoneyAbsolute(plan.targetAmount)}`;
}

export function planListSubtitle(plan: DashboardPlanDetail): string {
  const { done, total } = planCompletedSteps(plan);
  return `${plan.progress} % · ${done}/${total} étapes · ${plan.estimatedCompletionLabel}`;
}

export function planActiveStepIndex(plan: DashboardPlanDetail): number {
  const index = plan.steps.findIndex((step) => !step.completed);
  return index === -1 ? Math.max(0, plan.steps.length - 1) : index;
}

export function planHeroAmountLine(plan: DashboardPlanDetail): string {
  return `${formatDisplayMoneyAbsolute(plan.currentAmount)} / ${formatDisplayMoneyAbsolute(plan.targetAmount)}`;
}

export function planHeroSecondaryLine(plan: DashboardPlanDetail): string {
  const remaining = planRemainingAmount(plan);
  return `${plan.progress} % complété · ${formatDisplayMoneyAbsolute(remaining)} restants`;
}
