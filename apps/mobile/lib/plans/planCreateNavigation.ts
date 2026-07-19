import { PLAN_SUBTYPE_LABELS, type PlanSuggere, type PlanSubtype } from './Plan';
import { suggestedPlanToCreateParams } from './planDashboardAdapter';

/** Entrée création manuelle depuis le hub (Phase 2 remplacera par flow complet). */
export function buildManualPlanCreateEntryParams(): Record<string, string> {
  return {
    total: '1',
    index: '1',
  };
}

export function buildPlanCreateParamsFromSuggestion(plan: PlanSuggere): Record<string, string> {
  return suggestedPlanToCreateParams(plan);
}

export function buildTemplateDetailParams(
  subtype: string,
  extras?: { raison?: string; suggestedId?: string },
): Record<string, string> {
  return {
    subtype,
    ...(extras?.raison ? { raison: extras.raison } : {}),
    ...(extras?.suggestedId ? { suggestedId: extras.suggestedId } : {}),
  };
}

export function buildPrefilledSubtypeEntryParams(
  subtype: string,
  category?: string,
): Record<string, string> {
  const titre = PLAN_SUBTYPE_LABELS[subtype as PlanSubtype];
  return {
    subtype,
    ...(category ? { category } : {}),
    ...(titre ? { titre } : {}),
    total: '1',
    index: '1',
  };
}
