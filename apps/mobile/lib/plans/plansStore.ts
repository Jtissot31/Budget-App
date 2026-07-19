import { loadEncryptedJson, saveEncryptedJson } from '@/lib/ai/encryptedStorage';
import { dataEvents } from '@/lib/events';
import type { PlanActifOuTermine, PlanParametres, PlanSuggere } from './Plan';
import { registerPlanDetailForNavigation } from './planDashboardAdapter';

const PLANS_STORAGE_KEY = 'bt_financial_plans_v1';

export async function loadUserPlans(): Promise<PlanActifOuTermine[]> {
  const stored = await loadEncryptedJson<PlanActifOuTermine[]>(PLANS_STORAGE_KEY);
  return stored ?? [];
}

export async function saveUserPlans(
  plans: PlanActifOuTermine[],
  options?: { emit?: boolean },
): Promise<void> {
  await saveEncryptedJson(PLANS_STORAGE_KEY, plans);
  for (const plan of plans) {
    registerPlanDetailForNavigation(plan);
  }
  if (options?.emit !== false) {
    dataEvents.emit();
  }
}

export async function appendUserPlan(plan: PlanActifOuTermine): Promise<PlanActifOuTermine[]> {
  const existing = await loadUserPlans();
  const next = [...existing, plan];
  await saveUserPlans(next);
  return next;
}

export function activateSuggestedPlan(
  suggestion: PlanSuggere,
  fields: {
    compte_lie?: string;
    cadence?: string;
    date_cible?: string;
    montant_cible?: number | null;
    montant_actuel?: number;
    parametres?: PlanParametres;
  },
): PlanActifOuTermine {
  return {
    id: `plan-${suggestion.subtype}-${Date.now()}`,
    category: suggestion.category,
    subtype: suggestion.subtype,
    titre: suggestion.titre,
    description: suggestion.description,
    statut: 'actif',
    montant_actuel: fields.montant_actuel ?? suggestion.montant_actuel ?? 0,
    montant_cible: fields.montant_cible ?? suggestion.montant_cible,
    compte_lie: fields.compte_lie,
    cadence: fields.cadence,
    date_debut: new Date().toISOString().slice(0, 10),
    date_cible: fields.date_cible,
    parametres: fields.parametres,
    etapes: suggestion.etapes,
    signal_declencheur: suggestion.signal_declencheur,
  };
}
