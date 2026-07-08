import {
  PLAN_CATEGORIES,
  type Plan,
  type PlanCategory,
  type PlanStatut,
  type PlanSuggere,
} from './Plan';
import { registerPlanDetailForNavigation } from './planDashboardAdapter';
import { evaluatePlanRecommendations } from './planRecommendationEngine';
import { loadUserPlans } from './plansStore';

export type PlanCategoryFilter = 'all' | PlanCategory;

const STATUT_SORT_ORDER: Record<PlanStatut, number> = {
  actif: 0,
  suggere: 1,
  en_pause: 2,
  complete: 3,
};

export function sortPlansForHub(plans: readonly Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const byStatus = STATUT_SORT_ORDER[a.statut] - STATUT_SORT_ORDER[b.statut];
    if (byStatus !== 0) return byStatus;
    return a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base' });
  });
}

export function filterPlansByCategory(plans: readonly Plan[], filter: PlanCategoryFilter): Plan[] {
  if (filter === 'all') return [...plans];
  return plans.filter((plan) => plan.category === filter);
}

export function isPlanCategoryFilter(value: string): value is PlanCategoryFilter {
  return value === 'all' || (PLAN_CATEGORIES as readonly string[]).includes(value);
}

export type PlanHubSnapshot = {
  listPlans: Plan[];
  suggestedPlans: PlanSuggere[];
};

/** Plans visibles sur la page principale: actifs, ou en pause s'il n'y a pas d'actifs. */
export function selectPlansForMainHub(plans: readonly Plan[]): Plan[] {
  const eligible = plans.filter((plan) => plan.statut !== 'suggere' && plan.statut !== 'complete');
  const active = eligible.filter((plan) => plan.statut === 'actif');
  if (active.length > 0) return sortPlansForHub(active);
  const paused = eligible.filter((plan) => plan.statut === 'en_pause');
  return sortPlansForHub(paused);
}

export async function loadExplorerSnapshot(): Promise<Pick<PlanHubSnapshot, 'suggestedPlans'>> {
  const snapshot = await loadPlanHubSnapshot();
  return { suggestedPlans: snapshot.suggestedPlans };
}

export async function loadPlanHubSnapshot(): Promise<PlanHubSnapshot> {
  const [storedPlans, suggestedPlans] = await Promise.all([
    loadUserPlans(),
    evaluatePlanRecommendations({ onDemand: true, maxSuggestions: 4 }),
  ]);

  for (const plan of storedPlans) {
    registerPlanDetailForNavigation(plan);
  }

  const activeSubtypes = new Set(storedPlans.map((plan) => plan.subtype));

  const filteredSuggestions = suggestedPlans.filter((plan) => !activeSubtypes.has(plan.subtype));
  const suggestionIds = new Set(filteredSuggestions.map((plan) => plan.id));

  const listPlans = sortPlansForHub(storedPlans).filter(
    (plan) => plan.statut !== 'suggere' && !suggestionIds.has(plan.id),
  );

  return {
    listPlans,
    suggestedPlans: filteredSuggestions,
  };
}
