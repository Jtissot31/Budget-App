import { enrichPlanSuggestions } from '@/lib/ai/planAdaptationService';
import { loadRFA } from '@/lib/ai/rfaService';
import {
  isSavingsGoalPlanSubtype,
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

export type LoadPlanHubSnapshotOptions = {
  /** Heuristic raisons only — skip Gemini on the critical path. */
  skipEnrichment?: boolean;
};

function isHubCarouselPlan(plan: Pick<Plan, 'subtype' | 'statut'>): boolean {
  return plan.statut !== 'suggere' && plan.statut !== 'complete' && !isSavingsGoalPlanSubtype(plan.subtype);
}

/** Plans visibles sur la page principale: actifs, ou en pause s'il n'y a pas d'actifs. */
export function selectPlansForMainHub(plans: readonly Plan[]): Plan[] {
  const eligible = plans.filter(isHubCarouselPlan);
  const active = eligible.filter((plan) => plan.statut === 'actif');
  if (active.length > 0) return sortPlansForHub(active);
  const paused = eligible.filter((plan) => plan.statut === 'en_pause');
  return sortPlansForHub(paused);
}

function filterSuggestionsForHub(
  storedPlans: readonly Plan[],
  suggestedPlans: readonly PlanSuggere[],
): PlanSuggere[] {
  const activeSubtypes = new Set(storedPlans.map((plan) => plan.subtype));
  return suggestedPlans.filter(
    (plan) => !activeSubtypes.has(plan.subtype) && !isSavingsGoalPlanSubtype(plan.subtype),
  );
}

function buildListPlans(storedPlans: readonly Plan[], suggestionIds: ReadonlySet<string>): Plan[] {
  return sortPlansForHub(storedPlans).filter(
    (plan) => plan.statut !== 'suggere' && !suggestionIds.has(plan.id) && !isSavingsGoalPlanSubtype(plan.subtype),
  );
}

async function readStoredPlansWithNavigation(): Promise<Plan[]> {
  const storedPlans = await loadUserPlans();
  for (const plan of storedPlans) {
    registerPlanDetailForNavigation(plan);
  }
  return storedPlans;
}

/** Fast path: encrypted plans store only — no RFA, rules, or Gemini. */
export async function loadPlanHubStoredPlans(): Promise<Plan[]> {
  const storedPlans = await readStoredPlansWithNavigation();
  return buildListPlans(storedPlans, new Set());
}

/** Rule-based suggestions; Gemini enrichment optional. */
export async function loadPlanHubSuggestions(
  options: LoadPlanHubSnapshotOptions = {},
): Promise<PlanSuggere[]> {
  const storedPlans = await readStoredPlansWithNavigation();
  const suggestedPlans = await evaluatePlanRecommendations({
    onDemand: true,
    maxSuggestions: 4,
    skipEnrichment: options.skipEnrichment ?? false,
  });
  return filterSuggestionsForHub(storedPlans, suggestedPlans);
}

/** Background Gemini pass — safe to call after first paint. */
export async function enrichPlanHubSuggestions(suggestions: PlanSuggere[]): Promise<PlanSuggere[]> {
  if (suggestions.length === 0) return suggestions;
  const rfa = await loadRFA();
  const snapshot = rfa?.analyse?.slice(0, 200);
  return enrichPlanSuggestions(suggestions, snapshot);
}

export async function loadExplorerSnapshot(
  options: LoadPlanHubSnapshotOptions = {},
): Promise<Pick<PlanHubSnapshot, 'suggestedPlans'>> {
  const snapshot = await loadPlanHubSnapshot(options);
  return { suggestedPlans: snapshot.suggestedPlans };
}

export async function loadPlanHubSnapshot(
  options: LoadPlanHubSnapshotOptions = {},
): Promise<PlanHubSnapshot> {
  const [storedPlans, suggestedPlans] = await Promise.all([
    readStoredPlansWithNavigation(),
    evaluatePlanRecommendations({
      onDemand: true,
      maxSuggestions: 4,
      skipEnrichment: options.skipEnrichment ?? false,
    }),
  ]);

  const filteredSuggestions = filterSuggestionsForHub(storedPlans, suggestedPlans);
  const suggestionIds = new Set(filteredSuggestions.map((plan) => plan.id));

  return {
    listPlans: buildListPlans(storedPlans, suggestionIds),
    suggestedPlans: filteredSuggestions,
  };
}
