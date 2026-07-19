/**
 * Targeted checks for mortgage exclusion from accelerated debt plans.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/plans/debtPlanEligibility.test.ts
 */

import assert from 'node:assert/strict';
import {
  excludeMortgagesFromDebtSelections,
  filterEligibleDebtPlanCandidates,
  filterRfaDebtsEligibleForAcceleratedPlan,
  isDebtPlanCandidateEligibleForAcceleratedPlan,
  isLoanEligibleForAcceleratedDebtPlan,
  isRfaDebtEligibleForAcceleratedDebtPlan,
  sanitizeDebtParametresForAcceleratedPlan,
} from './debtPlanEligibility';
import type { PlanDebtSelection } from './Plan';

function selection(
  partial: Pick<PlanDebtSelection, 'id' | 'source' | 'label' | 'solde'> &
    Partial<PlanDebtSelection>,
): PlanDebtSelection {
  return {
    taux_interet: 0,
    paiement_minimum: 50,
    ordre: 1,
    ...partial,
  };
}

// Mixed book: mortgage + credit card + personal loan — only card/personal remain.
const loans = [
  { id: 'm1', type: 'mortgage' as const },
  { id: 'p1', type: 'personal_loan' as const },
  { id: 'loc1', type: 'line_of_credit' as const },
];

assert.equal(isLoanEligibleForAcceleratedDebtPlan({ type: 'mortgage' }), false);
assert.equal(isLoanEligibleForAcceleratedDebtPlan({ type: 'personal_loan' }), true);
assert.equal(isLoanEligibleForAcceleratedDebtPlan({ type: 'line_of_credit' }), true);
assert.equal(isLoanEligibleForAcceleratedDebtPlan({ type: 'friend_debt' }), true);
assert.equal(isLoanEligibleForAcceleratedDebtPlan({ type: 'child_support' }), true);

assert.equal(isRfaDebtEligibleForAcceleratedDebtPlan({ type: 'hypotheque' }), false);
assert.equal(isRfaDebtEligibleForAcceleratedDebtPlan({ type: 'marge' }), true);
assert.equal(isRfaDebtEligibleForAcceleratedDebtPlan({ type: 'autre' }), true);
assert.deepEqual(
  filterRfaDebtsEligibleForAcceleratedPlan([
    { type: 'hypotheque', solde: 209_000 },
    { type: 'autre', solde: 30_000 },
    { type: 'marge', solde: 9_000 },
  ]).map((d) => d.solde),
  [30_000, 9_000],
);

assert.equal(
  isDebtPlanCandidateEligibleForAcceleratedPlan({ source: 'loan', loanType: 'mortgage' }),
  false,
);
assert.equal(
  isDebtPlanCandidateEligibleForAcceleratedPlan({ source: 'loan', loanType: 'personal_loan' }),
  true,
);
assert.equal(isDebtPlanCandidateEligibleForAcceleratedPlan({ source: 'credit_card' }), true);
assert.equal(isDebtPlanCandidateEligibleForAcceleratedPlan({ source: 'manual' }), true);

const mixedCandidates = filterEligibleDebtPlanCandidates([
  { id: 'loan:m1', source: 'loan' as const, loanType: 'mortgage' as const },
  { id: 'loan:p1', source: 'loan' as const, loanType: 'personal_loan' as const },
  { id: 'credit:c1', source: 'credit_card' as const },
  { id: 'loan:loc1', source: 'loan' as const, loanType: 'line_of_credit' as const },
]);
assert.deepEqual(
  mixedCandidates.map((c) => c.id),
  ['loan:p1', 'credit:c1', 'loan:loc1'],
);

const staleSelections = [
  selection({ id: 'loan:m1', source: 'loan', label: 'Hypothèque Maison', solde: 320_000, ordre: 1 }),
  selection({ id: 'credit:c1', source: 'credit_card', label: 'Visa', solde: 2_400, ordre: 2 }),
  selection({ id: 'loan:p1', source: 'loan', label: 'Prêt auto', solde: 8_000, ordre: 3 }),
];
const filtered = excludeMortgagesFromDebtSelections(staleSelections, loans);
assert.deepEqual(
  filtered.map((d) => d.id),
  ['credit:c1', 'loan:p1'],
);

const sanitized = sanitizeDebtParametresForAcceleratedPlan(
  {
    dettes: staleSelections,
    solde_initial: 330_400,
    paiement_mensuel: 2_000,
    extra_paiement: 200,
    extra_cadence: 'month',
    strategie_dette: 'snowball',
  },
  loans,
);
assert.equal(sanitized.dettes?.length, 2);
assert.deepEqual(
  sanitized.dettes?.map((d) => ({ id: d.id, ordre: d.ordre })),
  [
    { id: 'credit:c1', ordre: 1 },
    { id: 'loan:p1', ordre: 2 },
  ],
);
assert.equal(sanitized.solde_initial, 10_400);
assert.equal(sanitized.paiement_mensuel, 50 + 50 + 200);

console.log('debtPlanEligibility.test.ts: ok');
