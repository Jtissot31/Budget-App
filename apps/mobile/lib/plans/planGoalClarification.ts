import type { FinancialSummaryAnonymous } from '@/lib/ai/types';
import type { PlanSuggere } from './Plan';
import { buildPlanRecommendationContext } from './buildPlanRecommendationContext';
import { filterRfaDebtsEligibleForAcceleratedPlan } from './debtPlanEligibility';
import { buildRFAInputFromAppData, type RfaInputBundle } from '@/lib/ai/sanitizeForAI';
import { evaluatePlanRecommendations } from './planRecommendationEngine';
import {
  resolveSuggestedPlanGoal,
} from './planGoalPriority';
import { isInvestmentPlanSubtype, isDebtRepaymentPlanSubtype } from './planSuggestionCopy';

export { buildNegativeCashflowBudgetReason, resolveSuggestedPlanGoal } from './planGoalPriority';

export type PlanGoal =
  | 'budget_rebalance'
  | 'debt_repayment'
  | 'reduce_bills'
  | 'emergency_fund'
  | 'savings_investment';

export type PlanGoalOption = {
  goal: PlanGoal;
  title: string;
  subtitle: string;
  chipMessage: string;
};

export type PlanGoalRecommendation = {
  suggested: PlanGoal;
  reason: string;
};

export type ChatPlanGoalChoice = {
  suggested: PlanGoal;
  reason: string;
  options: PlanGoalOption[];
  frozen: boolean;
  confirmedGoal?: PlanGoal;
};

const PLAN_GOAL_OPTIONS: Record<PlanGoal, PlanGoalOption> = {
  budget_rebalance: {
    goal: 'budget_rebalance',
    title: 'Rééquilibrer mon budget',
    subtitle: 'Remettre dépenses et revenus en équilibre avant d’accélérer.',
    chipMessage: 'Je veux d’abord rééquilibrer mon budget et mon cashflow.',
  },
  debt_repayment: {
    goal: 'debt_repayment',
    title: 'Rembourser mes dettes',
    subtitle: 'Prioriser et éliminer tes soldes à crédit.',
    chipMessage: 'Je veux un plan pour payer mes dettes.',
  },
  reduce_bills: {
    goal: 'reduce_bills',
    title: 'Réduire mes factures',
    subtitle: 'Passer en revue abonnements et dépenses récurrentes.',
    chipMessage: 'Je veux réduire mes abonnements et factures récurrentes.',
  },
  emergency_fund: {
    goal: 'emergency_fund',
    title: "Fonds d'urgence",
    subtitle: 'Te constituer un plan B pour les imprévus.',
    chipMessage: "Je veux me constituer un fonds d'urgence / plan B.",
  },
  savings_investment: {
    goal: 'savings_investment',
    title: 'Épargner ou investir',
    subtitle: 'CELI, REER ou épargne structurée.',
    chipMessage: "Je veux un plan d'épargne ou d'investissement.",
  },
};

const GOAL_KEYWORD_PATTERNS: Record<PlanGoal, RegExp> = {
  budget_rebalance:
    /\b(budget|cashflow|cash\s*flow|reequilibr|rebalancer|depenses?\s*>|trop\s*depenser|couper\s*les\s*depenses|marge\s*mensuelle)\b/,
  debt_repayment:
    /\b(dette|dettes|rembours|rembourser|desendett|desendetter|snowball|avalanche|bombe\s*nucl|nucl[eé]aire|credit\s*card|carte\s*de\s*credit)\b/,
  reduce_bills:
    /\b(abonnement|abonnements|facture|factures|streaming|recurrent|recurrente|couper|reduire|reduction)\b/,
  emergency_fund:
    /\b(urgence|plan\s*b|fonds\s*d.?urgence|coussin|imprevu|securite\s*financiere)\b/,
  savings_investment:
    /\b(epargne|epargner|celi|reer|invest|investir|placer|cotis|cotisation|celiapp)\b/,
};

function normalizeUserText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatSurplusFr(surplus: number): string {
  const abs = Math.round(Math.abs(surplus)).toLocaleString('fr-CA');
  if (surplus < 0) return `−${abs}`;
  if (surplus > 0) return `+${abs}`;
  return '0';
}

export function detectPlanGoal(userText: string): PlanGoal | null {
  const normalized = normalizeUserText(userText);

  for (const [goal, pattern] of Object.entries(GOAL_KEYWORD_PATTERNS) as [PlanGoal, RegExp][]) {
    if (pattern.test(normalized)) return goal;
  }

  return null;
}

export function isVaguePlanRequest(userText: string): boolean {
  return detectPlanGoal(userText) === null;
}

export async function recommendPlanGoal(
  rfa: FinancialSummaryAnonymous,
  snapshotInput?: RfaInputBundle,
): Promise<PlanGoalRecommendation> {
  const input = snapshotInput ?? await buildRFAInputFromAppData();
  const ctx = buildPlanRecommendationContext(input, rfa);
  const dettesAccelerables = filterRfaDebtsEligibleForAcceleratedPlan(rfa.dettes);

  return resolveSuggestedPlanGoal({
    cashflowViableForDebtExtra: ctx.cashflow_viable_pour_extra_dette,
    surplusMensuel: ctx.surplus_mensuel,
    dettesAccelerablesCount: dettesAccelerables.length,
    detteTotale: dettesAccelerables.reduce((sum, debt) => sum + debt.solde, 0),
    couvertureMois: ctx.couverture_mois,
    nombreAbonnements: ctx.nombre_abonnements_recurrents,
    droitsCeli: ctx.droits_cotisation_celi_disponibles,
    droitsReer: ctx.droits_cotisation_reer_disponibles,
    contexteDetteLourde: ctx.contexte_dette_lourde,
    singleDebtLabel: dettesAccelerables[0]?.institution,
  });
}

export async function buildAvailablePlanGoalOptions(
  rfa: FinancialSummaryAnonymous,
  snapshotInput?: RfaInputBundle,
): Promise<PlanGoalOption[]> {
  const input = snapshotInput ?? await buildRFAInputFromAppData();
  const ctx = buildPlanRecommendationContext(input, rfa);
  const options: PlanGoalOption[] = [];
  const hasDebts = filterRfaDebtsEligibleForAcceleratedPlan(rfa.dettes).length > 0;

  if (!ctx.cashflow_viable_pour_extra_dette) {
    options.push(PLAN_GOAL_OPTIONS.budget_rebalance);
    if (hasDebts) {
      options.push({
        ...PLAN_GOAL_OPTIONS.debt_repayment,
        subtitle: 'Après avoir rétabli un surplus mensuel — catalogue toujours accessible.',
      });
    }
    options.push(PLAN_GOAL_OPTIONS.reduce_bills);
    options.push(PLAN_GOAL_OPTIONS.emergency_fund);
  } else {
    if (hasDebts) {
      options.push(PLAN_GOAL_OPTIONS.debt_repayment);
    }
    options.push(PLAN_GOAL_OPTIONS.emergency_fund);
    if (!ctx.contexte_dette_lourde) {
      options.push(PLAN_GOAL_OPTIONS.reduce_bills);
      options.push(PLAN_GOAL_OPTIONS.savings_investment);
    }
  }

  const seen = new Set<PlanGoal>();
  return options.filter((option) => {
    if (seen.has(option.goal)) return false;
    seen.add(option.goal);
    return true;
  });
}

export function buildPlanGoalChoiceIntro(recommendation: PlanGoalRecommendation): string {
  const goalLabel = planGoalLabel(recommendation.suggested);
  const reason =
    recommendation.reason.charAt(0).toLowerCase() + recommendation.reason.slice(1);

  return `Quel objectif veux-tu viser en premier ? Je te suggère de commencer par ${goalLabel} parce que ${reason}`;
}

export function planGoalLabel(goal: PlanGoal): string {
  switch (goal) {
    case 'budget_rebalance':
      return 'le rééquilibrage de ton budget';
    case 'debt_repayment':
      return 'le remboursement de tes dettes';
    case 'reduce_bills':
      return 'la réduction de tes factures récurrentes';
    case 'emergency_fund':
      return "un fonds d'urgence";
    case 'savings_investment':
      return "l'épargne ou l'investissement";
    default:
      return 'cet objectif';
  }
}

export function isPlanGoalFollowUpMessage(userText: string): boolean {
  const normalized = normalizeUserText(userText);
  const goal = detectPlanGoal(userText);
  if (!goal) return false;

  return (
    /\b(plan|objectif|strategie|bâtir|batir|propose|creer|generer|elaborer)\b/.test(normalized) ||
    /\b(je veux|j'aimerais|j aimerais|aide moi|aide-moi)\b/.test(normalized)
  );
}

export function parsePlanGoalFromText(
  text: string,
  suggested: PlanGoal,
  options: PlanGoalOption[],
): PlanGoal | null {
  const detected = detectPlanGoal(text);
  if (detected && options.some((option) => option.goal === detected)) {
    return detected;
  }

  const normalized = normalizeUserText(text).replace(/[!.?…]+$/g, '');

  const confirmsSuggestion =
    /^(oui|ok|okay|confirme|confirme|confirmer|yes|yep|d'accord|daccord|vas-y|vas y|go|c'est bon|c est bon)$/.test(
      normalized,
    );

  if (confirmsSuggestion) return suggested;

  return null;
}

function isBudgetRebalanceSubtype(subtype: string): boolean {
  return (
    subtype === 'enveloppe' ||
    subtype === 'no_spend_challenge' ||
    subtype === 'reduction_abonnements'
  );
}

function filterSuggestionsForGoal(suggestions: PlanSuggere[], goal: PlanGoal): PlanSuggere[] {
  switch (goal) {
    case 'budget_rebalance':
      return suggestions.filter((plan) => isBudgetRebalanceSubtype(plan.subtype));
    case 'debt_repayment':
      return suggestions.filter((plan) => isDebtRepaymentPlanSubtype(plan.subtype));
    case 'reduce_bills':
      return suggestions.filter((plan) => plan.subtype === 'reduction_abonnements');
    case 'emergency_fund':
      return suggestions.filter((plan) => plan.subtype === 'fonds_urgence');
    case 'savings_investment':
      return suggestions.filter((plan) => isInvestmentPlanSubtype(plan.subtype));
    default:
      return suggestions;
  }
}

export function buildDebtSummaryIntro(): string {
  return 'Voici un résumé de tes dettes actives.';
}

export function buildDebtStrategiesIntro(): string {
  return 'Voici les stratégies qui collent le mieux à ta situation :';
}

export function buildCashflowBlockedDebtIntro(surplusMensuel: number): string {
  const surplusLabel = formatSurplusFr(surplusMensuel);
  return `Tes dépenses dépassent ou serrent tes revenus (surplus d’environ ${surplusLabel} $/mois) — tu n’as pas de marge pour un extra sur tes dettes. Commençons par rééquilibrer le budget ; un plan snowball ou avalanche pourra suivre dès que le cashflow redevient positif.`;
}

export function buildPlanGoalConfirmedIntro(goal: PlanGoal): string {
  switch (goal) {
    case 'budget_rebalance':
      return 'Commençons par le budget — voici des pistes pour rétablir une marge mensuelle.';
    case 'debt_repayment':
      return buildDebtSummaryIntro();
    case 'reduce_bills':
      return 'Bonne idée — voici un plan pour alléger tes dépenses récurrentes.';
    case 'emergency_fund':
      return "Super — voici un plan pour te constituer un fonds d'urgence.";
    case 'savings_investment':
      return "Parfait — voici des pistes d'épargne ou d'investissement pour toi.";
    default:
      return 'Voici les plans les plus pertinents pour ton objectif.';
  }
}

export async function buildPlanSuggestionsForGoal(
  rfa: FinancialSummaryAnonymous,
  goal: PlanGoal,
  snapshotInput?: RfaInputBundle,
): Promise<PlanSuggere[]> {
  const debtHeavy = goal === 'debt_repayment';

  const suggestions = await evaluatePlanRecommendations({
    onDemand: true,
    debtHeavy,
    maxSuggestions: 4,
    snapshot: snapshotInput ? { input: snapshotInput, rfa } : undefined,
  });

  const filtered = filterSuggestionsForGoal(suggestions, goal);
  if (filtered.length > 0) return filtered;

  // Retry with broader fetch when the filtered set is empty.
  const broader = await evaluatePlanRecommendations({
    onDemand: true,
    debtHeavy,
    maxSuggestions: 6,
    snapshot: snapshotInput ? { input: snapshotInput, rfa } : undefined,
  });

  return filterSuggestionsForGoal(broader, goal);
}

export async function buildPlanGoalChoiceState(
  rfa: FinancialSummaryAnonymous,
  snapshotInput?: RfaInputBundle,
): Promise<ChatPlanGoalChoice> {
  const recommendation = await recommendPlanGoal(rfa, snapshotInput);
  const options = await buildAvailablePlanGoalOptions(rfa, snapshotInput);

  return {
    suggested: recommendation.suggested,
    reason: recommendation.reason,
    options,
    frozen: false,
  };
}
