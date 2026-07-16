import { getGoalGreenShade } from '@/constants/theme';
import { MOCK_DASHBOARD_PLANS } from '@/lib/dashboardPlansMock';
import { getSavingsGoals, getSetting, setSetting, upsertSavingsGoal } from '@/lib/db';
import { isSavingsGoalPlanSubtype, type PlanActifOuTermine } from '@/lib/plans/Plan';
import { registerPlanDetailForNavigation } from '@/lib/plans/planDashboardAdapter';
import { loadUserPlans, saveUserPlans } from '@/lib/plans/plansStore';
import type { SavingsGoal } from '@/types';

/**
 * One-time migration: remove Fonds d'urgence from financial plans and seed it as a
 * savings goal under ÉPARGNE. Bump FINANCIAL_PLANS_HUB_RESET_VERSION to re-run.
 */
export const FINANCIAL_PLANS_HUB_RESET_VERSION = '2';
const FINANCIAL_PLANS_HUB_RESET_KEY = 'financial_plans_hub_reset_version';

const FONDS_URGENCE_GOAL_ID = 'goal-fonds-urgence';

function buildCanonicalFondsUrgenceGoal(): SavingsGoal {
  const mock = MOCK_DASHBOARD_PLANS.find((plan) => plan.id === 'mock-fonds-urgence');
  if (!mock) {
    throw new Error('mock-fonds-urgence introuvable dans MOCK_DASHBOARD_PLANS');
  }

  return {
    id: FONDS_URGENCE_GOAL_ID,
    name: mock.name,
    targetAmount: mock.targetAmount,
    currentAmount: mock.currentAmount,
    initialSavedAmount: 0,
    weeklyContribution: 150,
    contributionFrequency: 'weekly',
    dueDate: undefined,
    color: getGoalGreenShade(FONDS_URGENCE_GOAL_ID, true),
    icon: mock.icon,
    createdAt: new Date().toISOString(),
  };
}

function fondsUrgenceGoalFromPlan(plan: PlanActifOuTermine): SavingsGoal {
  return {
    id: FONDS_URGENCE_GOAL_ID,
    name: plan.titre,
    targetAmount: plan.montant_cible ?? 10_000,
    currentAmount: plan.montant_actuel ?? 0,
    initialSavedAmount: 0,
    weeklyContribution: 150,
    contributionFrequency: 'weekly',
    dueDate: plan.date_cible,
    color: getGoalGreenShade(FONDS_URGENCE_GOAL_ID, true),
    icon: 'shield-check-outline',
    createdAt: new Date().toISOString(),
  };
}

async function ensureFondsUrgenceSavingsGoal(fondsPlan?: PlanActifOuTermine): Promise<void> {
  const existingGoals = await getSavingsGoals();
  const hasFondsGoal = existingGoals.some(
    (goal) =>
      goal.id === FONDS_URGENCE_GOAL_ID ||
      goal.name.localeCompare("Fonds d'urgence", 'fr', { sensitivity: 'base' }) === 0,
  );
  if (hasFondsGoal) return;

  const goal = fondsPlan ? fondsUrgenceGoalFromPlan(fondsPlan) : buildCanonicalFondsUrgenceGoal();
  await upsertSavingsGoal(goal);
}

export async function resetFinancialPlansHubIfNeeded(): Promise<boolean> {
  const version = await getSetting(FINANCIAL_PLANS_HUB_RESET_KEY, '0');
  if (version === FINANCIAL_PLANS_HUB_RESET_VERSION) return false;

  const storedPlans = await loadUserPlans();
  const fondsPlan = storedPlans.find((plan) => isSavingsGoalPlanSubtype(plan.subtype));
  const plansWithoutSavingsGoals = storedPlans.filter((plan) => !isSavingsGoalPlanSubtype(plan.subtype));

  await saveUserPlans(plansWithoutSavingsGoals, { emit: false });
  for (const plan of plansWithoutSavingsGoals) {
    registerPlanDetailForNavigation(plan);
  }

  await ensureFondsUrgenceSavingsGoal(fondsPlan);
  await setSetting(FINANCIAL_PLANS_HUB_RESET_KEY, FINANCIAL_PLANS_HUB_RESET_VERSION, { emit: false });
  return true;
}
