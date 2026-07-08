import { getSetting, setSetting } from '@/lib/db';
import { MOCK_DASHBOARD_PLANS } from '@/lib/dashboardPlansMock';
import { mockDashboardPlanToPlan, registerPlanDetailForNavigation } from '@/lib/plans/planDashboardAdapter';
import { saveUserPlans } from '@/lib/plans/plansStore';

/**
 * One-time migration: replace persisted financial plans with a single canonical
 * Fonds d'urgence plan. Bump FINANCIAL_PLANS_HUB_RESET_VERSION to re-run.
 */
export const FINANCIAL_PLANS_HUB_RESET_VERSION = '1';
const FINANCIAL_PLANS_HUB_RESET_KEY = 'financial_plans_hub_reset_version';

function buildCanonicalFondsUrgencePlan() {
  const mock = MOCK_DASHBOARD_PLANS.find((plan) => plan.id === 'mock-fonds-urgence');
  if (!mock) {
    throw new Error('mock-fonds-urgence introuvable dans MOCK_DASHBOARD_PLANS');
  }

  const plan = mockDashboardPlanToPlan(mock);
  return {
    ...plan,
    id: 'plan-fonds-urgence',
    subtype: 'fonds_urgence' as const,
    statut: 'actif' as const,
  };
}

export async function resetFinancialPlansHubIfNeeded(): Promise<boolean> {
  const version = await getSetting(FINANCIAL_PLANS_HUB_RESET_KEY, '0');
  if (version === FINANCIAL_PLANS_HUB_RESET_VERSION) return false;

  const plan = buildCanonicalFondsUrgencePlan();
  await saveUserPlans([plan], { emit: false });
  registerPlanDetailForNavigation(plan);
  await setSetting(FINANCIAL_PLANS_HUB_RESET_KEY, FINANCIAL_PLANS_HUB_RESET_VERSION, { emit: false });
  return true;
}
