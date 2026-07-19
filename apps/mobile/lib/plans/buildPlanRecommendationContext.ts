import type { RfaInputBundle } from '@/lib/ai/sanitizeForAI';
import type { FinancialSummaryAnonymous } from '@/lib/ai/types';
import { filterRfaDebtsEligibleForAcceleratedPlan } from './debtPlanEligibility';
import {
  isCashflowViableForAcceleratedDebtPlan,
  monthlySurplusFromCashflow,
} from './debtPlanFeasibility';
import type { PlanSubtype } from './Plan';

/** Agrégats dérivés du RFA pour évaluer les règles de recommandation. */
export type PlanRecommendationContext = {
  couverture_mois: number;
  plan_epargne_actif: boolean;
  revenu_stable: boolean;
  tranche_imposition: 'basse' | 'moyenne' | 'haute';
  droits_cotisation_reer_disponibles: number;
  droits_cotisation_celi_disponibles: number;
  objectif_court_terme_actif: boolean;
  est_proprietaire: boolean;
  age: number | null;
  epargne_recurrente_detectee: boolean;
  /** Dettes accélérables (hors hypothèques) — aligné sur debtPlanEligibility. */
  nombre_dettes_actives: number;
  revenu_travailleur_autonome_detecte: boolean;
  categorie_depassee_mois_consecutifs: number;
  depense_discretionnaire_tendance: 'hausse' | 'stable' | 'baisse';
  mois_consecutifs_depense_hausse: number;
  nombre_abonnements_recurrents: number;
  /** Solde total des dettes accélérables (hors hypothèques). */
  dette_totale: number;
  /** Liquidités au-delà d'environ 1 mois de dépenses — candidat bombe nucléaire. */
  liquidites_excedentaires: number;
  /** Marge de crédit active dans le profil de dettes. */
  a_marge_credit_active: boolean;
  /** Dettes dominent — prioriser remboursement / cashflow, pas l'investissement. */
  contexte_dette_lourde: boolean;
  /**
   * Revenu − dépenses (même base RFA / dashboard que le wizard Extra).
   * Négatif ou trop faible → ne pas pousser snowball/avalanche en proactif.
   */
  surplus_mensuel: number;
  /** Assez de marge pour un petit extra au-dessus des minimums. */
  cashflow_viable_pour_extra_dette: boolean;
  activePlanSubtypes: ReadonlySet<PlanSubtype>;
  revenu_mensuel_net: number;
  depenses_mensuelles: number;
  liquidites_totales: number;
};

function inferTaxBracket(revenuMensuelNet: number): PlanRecommendationContext['tranche_imposition'] {
  const annual = revenuMensuelNet * 12;
  if (annual >= 90_000) return 'haute';
  if (annual >= 45_000) return 'moyenne';
  return 'basse';
}

function inferAge(profileType: FinancialSummaryAnonymous['profil']['typeDetecte']): number | null {
  switch (profileType) {
    case 'etudiant':
      return 22;
    case 'jeune_travailleur':
      return 28;
    case 'famille':
      return 38;
    case 'retraite':
      return 67;
    default:
      return null;
  }
}

function inferOwner(profileType: FinancialSummaryAnonymous['profil']['typeDetecte'], loans: RfaInputBundle['loans']): boolean {
  return profileType === 'famille' || loans.some((loan) => loan.type === 'mortgage');
}

function inferFreelance(profileType: FinancialSummaryAnonymous['profil']['typeDetecte'], revenu: number): boolean {
  return profileType === 'inconnu' && revenu > 0;
}

export function buildPlanRecommendationContext(
  input: RfaInputBundle,
  rfa: FinancialSummaryAnonymous,
): PlanRecommendationContext {
  const depenses = Math.max(rfa.profil.depensesMensuellesMoyennes, 1);
  const liquidites = rfa.comptes
    .filter((account) => account.type !== 'credit')
    .reduce((sum, account) => sum + account.solde, 0);

  const overBudgetCount = input.budgets.filter(
    (budget) => budget.spent > budget.limitAmount && budget.limitAmount > 0,
  ).length;

  const savingsRate = rfa.profil.tauxEpargneActuel;
  const epargneRecurrente = savingsRate >= 5;

  const activeSubtypes = new Set<PlanSubtype>();
  for (const plan of rfa.plansFinanciersActifs) {
    const subtype = plan.templateId as PlanSubtype;
    if (subtype) activeSubtypes.add(subtype);
  }

  const planEpargneActif = rfa.plansFinanciersActifs.some((plan) =>
    ['fonds_urgence', 'mise_de_fonds', 'voyage', 'achat_majeur', 'coussin_saisonnier', 'evenement_vie'].includes(
      plan.templateId,
    ),
  );

  const objectifCourtTerme = rfa.objectifsActifs.some((goal) => {
    const remaining = Math.max(goal.cible - goal.progression, 0);
    return remaining > 0 && goal.cible <= 15_000;
  });

  const revenu = rfa.profil.revenuMensuelNet;
  const depensesMensuelles = rfa.profil.depensesMensuellesMoyennes;
  const surplusMensuel = monthlySurplusFromCashflow({
    monthlyIncome: revenu,
    monthlyExpenses: depensesMensuelles,
  });
  const cashflowViablePourExtraDette = isCashflowViableForAcceleratedDebtPlan(surplusMensuel);
  const celiRoom = Math.max(0, Math.round(revenu * 12 * 0.18));
  const reerRoom = Math.max(0, Math.round(revenu * 12 * 0.18));

  const discretionaryTrend: PlanRecommendationContext['depense_discretionnaire_tendance'] =
    savingsRate < 0 ? 'hausse' : savingsRate < 5 ? 'hausse' : 'stable';

  const dettesAccelerables = filterRfaDebtsEligibleForAcceleratedPlan(rfa.dettes);
  const detteTotale = dettesAccelerables.reduce((sum, debt) => sum + debt.solde, 0);
  const situationStressante =
    rfa.profil.situationGlobale === 'critique' || rfa.profil.situationGlobale === 'tendue';
  const contexteDetteLourde =
    dettesAccelerables.length >= 1 &&
    (situationStressante ||
      detteTotale >= Math.max(revenu * 3, 3_000) ||
      (liquidites > 0 && detteTotale > liquidites * 1.5));

  return {
    couverture_mois: liquidites / depenses,
    plan_epargne_actif: planEpargneActif,
    revenu_stable: revenu > 0 && rfa.profil.situationGlobale !== 'critique',
    tranche_imposition: inferTaxBracket(revenu),
    droits_cotisation_reer_disponibles: reerRoom,
    droits_cotisation_celi_disponibles: celiRoom,
    objectif_court_terme_actif: objectifCourtTerme,
    est_proprietaire: inferOwner(rfa.profil.typeDetecte, input.loans),
    age: inferAge(rfa.profil.typeDetecte),
    epargne_recurrente_detectee: epargneRecurrente,
    nombre_dettes_actives: dettesAccelerables.length,
    revenu_travailleur_autonome_detecte: inferFreelance(rfa.profil.typeDetecte, revenu),
    categorie_depassee_mois_consecutifs: overBudgetCount >= 2 ? overBudgetCount : overBudgetCount >= 1 ? 1 : 0,
    depense_discretionnaire_tendance: discretionaryTrend,
    mois_consecutifs_depense_hausse: discretionaryTrend === 'hausse' ? 3 : 0,
    nombre_abonnements_recurrents: rfa.abonnementsDetectes.length,
    dette_totale: detteTotale,
    liquidites_excedentaires: Math.max(0, liquidites - depenses),
    a_marge_credit_active: dettesAccelerables.some((debt) => debt.type === 'marge'),
    contexte_dette_lourde: contexteDetteLourde,
    surplus_mensuel: surplusMensuel,
    cashflow_viable_pour_extra_dette: cashflowViablePourExtraDette,
    activePlanSubtypes: activeSubtypes,
    revenu_mensuel_net: revenu,
    depenses_mensuelles: depensesMensuelles,
    liquidites_totales: liquidites,
  };
}
