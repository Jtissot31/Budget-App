import { regenerateRFA } from '@/lib/ai/rfaService';
import { enrichPlanSuggestions } from '@/lib/ai/planAdaptationService';
import { buildHeuristicRFA, buildRFAInputFromAppData } from '@/lib/ai/sanitizeForAI';
import type { RfaInputBundle } from '@/lib/ai/sanitizeForAI';
import type { FinancialSummaryAnonymous } from '@/lib/ai/types';
import {
  PLAN_CATEGORY_LABELS,
  PLAN_SUBTYPE_LABELS,
  planCategoryForSubtype,
  planSubtypeSansMontantCible,
  type PlanSuggere,
} from './Plan';
import { buildPlanRecommendationContext } from './buildPlanRecommendationContext';
import { isInvestmentPlanSubtype } from './planSuggestionCopy';
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
  /** Heuristic raisons only — skip Gemini enrichment on the critical path. */
  skipEnrichment?: boolean;
  /** Chat / widget context — renforce l'exclusion des plans investissement. */
  debtHeavy?: boolean;
  snapshot?: {
    input: RfaInputBundle;
    rfa: FinancialSummaryAnonymous;
  };
};

function debtAwareRuleRank(
  rule: PlanRecommendationRule,
  debtHeavy: boolean,
  cashflowTight: boolean,
): number {
  if (cashflowTight) {
    if (rule.category === 'budget' || rule.category === 'comportemental') return 0;
    if (rule.subtype === 'fonds_urgence') return 1;
    if (rule.category === 'dette') return 4;
    if (isInvestmentPlanSubtype(rule.subtype)) return 5;
    return 2;
  }
  if (!debtHeavy) return 0;
  if (rule.category === 'dette') return 0;
  if (rule.category === 'comportemental') return 1;
  if (rule.category === 'budget' || rule.category === 'fiscal') return 2;
  if (rule.subtype === 'fonds_urgence') return 3;
  if (isInvestmentPlanSubtype(rule.subtype)) return 4;
  return 2;
}

function sortRulesByPriority(
  rules: PlanRecommendationRule[],
  debtHeavy: boolean,
  cashflowTight: boolean,
): PlanRecommendationRule[] {
  return [...rules].sort((a, b) => {
    const debtRankA = debtAwareRuleRank(a, debtHeavy, cashflowTight);
    const debtRankB = debtAwareRuleRank(b, debtHeavy, cashflowTight);
    if (debtRankA !== debtRankB) return debtRankA - debtRankB;

    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.titre.localeCompare(b.titre, 'fr', { sensitivity: 'base' });
  });
}

function isDebtContextExcludedSubtype(subtype: PlanRecommendationRule['subtype']): boolean {
  return isInvestmentPlanSubtype(subtype) || subtype === 'reduction_abonnements';
}

function filterRulesForContext(
  rules: PlanRecommendationRule[],
  ctx: ReturnType<typeof buildPlanRecommendationContext>,
  debtHeavy: boolean,
): PlanRecommendationRule[] {
  // Cashflow serré : garder budget / abonnements / no-spend — ne pas les exclure pour « dette lourde ».
  if (!ctx.cashflow_viable_pour_extra_dette) {
    return rules.filter((rule) => !isInvestmentPlanSubtype(rule.subtype));
  }

  const debtContext = ctx.contexte_dette_lourde || debtHeavy;
  if (!debtContext) return rules;

  const preferred = rules.filter((rule) => !isDebtContextExcludedSubtype(rule.subtype));
  if (preferred.length > 0) return preferred;

  // Fallback: keep non–debt-context exclusions (e.g. investissement) but never subscription reduction.
  return rules.filter((rule) => rule.subtype !== 'reduction_abonnements');
}

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

/**
 * Évalue les règles contre le RFA courant et retourne des plans `suggere`.
 * Mode passif dashboard : max 2 suggestions. Mode chat à la demande : max 4, sans throttle.
 */
export async function evaluatePlanRecommendations(
  options: PlanRecommendationEngineOptions = {},
): Promise<PlanSuggere[]> {
  const onDemand = options.onDemand ?? false;
  const debtHeavy = options.debtHeavy ?? false;
  const maxSuggestions = options.maxSuggestions ?? (onDemand ? ON_DEMAND_PLAN_SUGGESTION_LIMIT : PASSIVE_DASHBOARD_PLAN_SUGGESTION_LIMIT);

  const input = options.snapshot?.input ?? await buildRFAInputFromAppData();
  const rfa = options.snapshot?.rfa ?? (onDemand
    ? buildHeuristicRFA(input)
    : await regenerateRFA({ reason: 'plan_change' }));
  const ctx = buildPlanRecommendationContext(input, rfa);

  const eligible = PLAN_RECOMMENDATION_RULES.filter((rule) => {
    if (ctx.activePlanSubtypes.has(rule.subtype)) return false;
    return rule.evaluate(ctx);
  });

  const triggered = sortRulesByPriority(
    filterRulesForContext(eligible, ctx, debtHeavy),
    ctx.contexte_dette_lourde || debtHeavy,
    !ctx.cashflow_viable_pour_extra_dette,
  );

  const deduped: PlanRecommendationRule[] = [];
  const seenSubtypes = new Set<string>();
  for (const rule of triggered) {
    if (seenSubtypes.has(rule.subtype)) continue;
    seenSubtypes.add(rule.subtype);
    deduped.push(rule);
    if (deduped.length >= maxSuggestions) break;
  }

  const suggestions = deduped.map((rule) => ruleToPlanSuggere(rule, ctx));
  if (options.skipEnrichment) return suggestions;

  const snapshot = rfa.analyse?.slice(0, 200);
  return enrichPlanSuggestions(suggestions, snapshot);
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
