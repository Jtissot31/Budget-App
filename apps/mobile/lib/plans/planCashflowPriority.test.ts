/**
 * Cashflow priority for plan recommendations (debt vs budget).
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/plans/planCashflowPriority.test.ts
 */

import assert from 'node:assert/strict';
import {
  isCashflowViableForAcceleratedDebtPlan,
  MIN_SURPLUS_FOR_ACCELERATED_DEBT_PLAN,
  monthlySurplusFromCashflow,
} from './debtPlanFeasibility';
import { resolveSuggestedPlanGoal } from './planGoalPriority';
import { PLAN_RECOMMENDATION_RULES } from './planRecommendationRules';
import type { PlanRecommendationContext } from './buildPlanRecommendationContext';

assert.equal(monthlySurplusFromCashflow({ monthlyIncome: 2037, monthlyExpenses: 2049 }), -12);
assert.equal(isCashflowViableForAcceleratedDebtPlan(-11), false);
assert.equal(isCashflowViableForAcceleratedDebtPlan(0), false);
assert.equal(isCashflowViableForAcceleratedDebtPlan(MIN_SURPLUS_FOR_ACCELERATED_DEBT_PLAN - 1), false);
assert.equal(isCashflowViableForAcceleratedDebtPlan(MIN_SURPLUS_FOR_ACCELERATED_DEBT_PLAN), true);
assert.equal(isCashflowViableForAcceleratedDebtPlan(150), true);

// Negative / tight cashflow → budget first, even with multiple debts.
const tight = resolveSuggestedPlanGoal({
  cashflowViableForDebtExtra: false,
  surplusMensuel: -11,
  dettesAccelerablesCount: 3,
  detteTotale: 12_000,
  couvertureMois: 0.4,
  nombreAbonnements: 6,
  droitsCeli: 5_000,
  droitsReer: 5_000,
  contexteDetteLourde: true,
});
assert.equal(tight.suggested, 'budget_rebalance');
assert.match(tight.reason, /surplus/i);

// Healthy surplus + debts → debt repayment.
const healthy = resolveSuggestedPlanGoal({
  cashflowViableForDebtExtra: true,
  surplusMensuel: 400,
  dettesAccelerablesCount: 3,
  detteTotale: 12_000,
  couvertureMois: 2,
  nombreAbonnements: 2,
  droitsCeli: 0,
  droitsReer: 0,
  contexteDetteLourde: true,
});
assert.equal(healthy.suggested, 'debt_repayment');

function ctxPartial(
  overrides: Partial<PlanRecommendationContext>,
): PlanRecommendationContext {
  return {
    couverture_mois: 1,
    plan_epargne_actif: false,
    revenu_stable: true,
    tranche_imposition: 'moyenne',
    droits_cotisation_reer_disponibles: 0,
    droits_cotisation_celi_disponibles: 0,
    objectif_court_terme_actif: false,
    est_proprietaire: false,
    age: 30,
    epargne_recurrente_detectee: false,
    nombre_dettes_actives: 3,
    revenu_travailleur_autonome_detecte: false,
    categorie_depassee_mois_consecutifs: 0,
    depense_discretionnaire_tendance: 'stable',
    mois_consecutifs_depense_hausse: 0,
    nombre_abonnements_recurrents: 2,
    dette_totale: 8000,
    liquidites_excedentaires: 0,
    a_marge_credit_active: false,
    contexte_dette_lourde: true,
    surplus_mensuel: -11,
    cashflow_viable_pour_extra_dette: false,
    activePlanSubtypes: new Set(),
    revenu_mensuel_net: 2037,
    depenses_mensuelles: 2049,
    liquidites_totales: 500,
    ...overrides,
  };
}

const snowball = PLAN_RECOMMENDATION_RULES.find((rule) => rule.subtype === 'snowball')!;
const avalanche = PLAN_RECOMMENDATION_RULES.find((rule) => rule.subtype === 'avalanche')!;
const enveloppe = PLAN_RECOMMENDATION_RULES.find((rule) => rule.subtype === 'enveloppe')!;

assert.equal(snowball.evaluate(ctxPartial({})), false);
assert.equal(avalanche.evaluate(ctxPartial({})), false);
assert.equal(enveloppe.evaluate(ctxPartial({})), true);

assert.equal(
  snowball.evaluate(
    ctxPartial({
      surplus_mensuel: 200,
      cashflow_viable_pour_extra_dette: true,
    }),
  ),
  true,
);
assert.equal(
  avalanche.evaluate(
    ctxPartial({
      surplus_mensuel: 200,
      cashflow_viable_pour_extra_dette: true,
    }),
  ),
  true,
);

console.log('planCashflowPriority.test.ts: ok');
