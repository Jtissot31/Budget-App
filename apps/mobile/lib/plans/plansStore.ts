import { loadEncryptedJson, saveEncryptedJson } from '@/lib/ai/encryptedStorage';
import type { PlanActifOuTermine, PlanSuggere } from './Plan';

const PLANS_STORAGE_KEY = 'bt_financial_plans_v1';

export async function loadUserPlans(): Promise<PlanActifOuTermine[]> {
  const stored = await loadEncryptedJson<PlanActifOuTermine[]>(PLANS_STORAGE_KEY);
  return stored ?? [];
}

export async function appendUserPlan(plan: PlanActifOuTermine): Promise<PlanActifOuTermine[]> {
  const existing = await loadUserPlans();
  const next = [...existing, plan];
  await saveEncryptedJson(PLANS_STORAGE_KEY, next);
  return next;
}

export function activateSuggestedPlan(
  suggestion: PlanSuggere,
  fields: {
    compte_lie?: string;
    cadence?: string;
    date_cible?: string;
    montant_cible?: number | null;
  },
): PlanActifOuTermine {
  return {
    id: `plan-${suggestion.subtype}-${Date.now()}`,
    category: suggestion.category,
    subtype: suggestion.subtype,
    titre: suggestion.titre,
    description: suggestion.description,
    statut: 'actif',
    montant_actuel: suggestion.montant_actuel ?? 0,
    montant_cible: fields.montant_cible ?? suggestion.montant_cible,
    compte_lie: fields.compte_lie,
    cadence: fields.cadence,
    date_debut: new Date().toISOString().slice(0, 10),
    date_cible: fields.date_cible,
    etapes: suggestion.etapes,
    signal_declencheur: suggestion.signal_declencheur,
  };
}
