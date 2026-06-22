import { loadRFA, regenerateRFA } from '@/lib/ai/rfaService';
import { buildHeuristicRFA, buildRFAInputFromAppData } from '@/lib/ai/sanitizeForAI';
import {
  PLAN_CATEGORY_LABELS,
  PLAN_SUBTYPE_LABELS,
  planCategoryForSubtype,
  planSubtypeSansMontantCible,
  type PlanSuggere,
} from './Plan';
import { buildPlanRecommendationContext } from './buildPlanRecommendationContext';
import {
  PLAN_RECOMMENDATION_RULES,
  resolveDefaultMontantCible,
  type PlanRecommendationRule,
} from './planRecommendationRules';

export const ON_DEMAND_PLAN_SUGGESTION_LIMIT = 4;
export const PASSIVE_DASHBOARD_PLAN_SUGGESTION_LIMIT = 2;

export type PlanRecommendationEngineOptions = {
  /** Bypass le throttle 24h — utilisé par le chat à la demande. */
  onDemand?: boolean;
  maxSuggestions?: number;
};

function ruleToPlanSuggere(rule: PlanRecommendationRule, ctx: ReturnType<typeof buildPlanRecommendationContext>): PlanSuggere {
  const montantCible = planSubtypeSansMontantCible(rule.subtype)
    ? null
    : resolveDefaultMontantCible(rule, ctx);

  return {
    id: `suggere-${rule.subtype}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: rule.category,
    subtype: rule.subtype,
    titre: rule.titre,
    description: rule.description,
    statut: 'suggere',
    montant_actuel: montantCible !== null ? 0 : null,
    montant_cible: montantCible,
    etapes: [],
    raison_recommandation: rule.buildRaisonHeuristique(ctx),
    signal_declencheur: rule.signal,
  };
}

function sortRulesByPriority(rules: PlanRecommendationRule[]): PlanRecommendationRule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base' });
  });
}

/**
 * Évalue les règles contre le RFA courant et retourne des plans `suggere`.
 * Mode passif dashboard : max 2 suggestions. Mode chat à la demande : max 4, sans throttle.
 */
export async function evaluatePlanRecommendations(
  options: PlanRecommendationEngineOptions = {},
): Promise<PlanSuggere[]> {
  const onDemand = options.onDemand ?? false;
  const maxSuggestions = options.maxSuggestions ?? (onDemand ? ON_DEMAND_PLAN_SUGGESTION_LIMIT : PASSIVE_DASHBOARD_PLAN_SUGGESTION_LIMIT);

  const input = await buildRFAInputFromAppData();
  const rfa = onDemand ? (await loadRFA()) ?? buildHeuristicRFA(input) : await regenerateRFA({ reason: 'plan_change' });
  const ctx = buildPlanRecommendationContext(input, rfa);

  const triggered = sortRulesByPriority(
    PLAN_RECOMMENDATION_RULES.filter((rule) => {
      if (ctx.activePlanSubtypes.has(rule.subtype)) return false;
      return rule.evaluate(ctx);
    }),
  );

  const deduped: PlanRecommendationRule[] = [];
  const seenSubtypes = new Set<string>();
  for (const rule of triggered) {
    if (seenSubtypes.has(rule.subtype)) continue;
    seenSubtypes.add(rule.subtype);
    deduped.push(rule);
    if (deduped.length >= maxSuggestions) break;
  }

  return deduped.map((rule) => ruleToPlanSuggere(rule, ctx));
}

export function planSuggestionCategoryLabel(plan: PlanSuggere): string {
  return PLAN_CATEGORY_LABELS[plan.category] ?? PLAN_CATEGORY_LABELS[planCategoryForSubtype(plan.subtype)];
}

export function planSuggestionSubtypeLabel(plan: PlanSuggere): string {
  return PLAN_SUBTYPE_LABELS[plan.subtype];
}

export function buildPlanSuggestionsIntro(count: number): string {
  if (count === 0) {
    return "Rien à proposer pour l'instant — tes finances sont stables.";
  }
  return `Voici ${count} plan${count > 1 ? 's' : ''} qui pourraient t'aider en ce moment :`;
}

export function buildPlansCreatedConfirmation(count: number): string {
  return `${count} plan${count > 1 ? 's' : ''} créé${count > 1 ? 's' : ''} ✓`;
}
