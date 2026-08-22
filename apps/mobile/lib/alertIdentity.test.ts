/**
 * Stable alert identity + duplicate repair.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/alertIdentity.test.ts
 */

import assert from 'node:assert/strict';
import type { AIAlert } from './ai/types';
import {
  alertKindKeyForAiAlert,
  balanceLowAlertKey,
  budgetOverAlertKey,
  currentBudgetOverAlertKey,
  dedupeAiAlerts,
  dedupeAlertItemsByIdentity,
  extractBudgetOverCategory,
  normalizeBudgetOverTitle,
  paymentAlertIdentityKey,
  planAdaptationAlertKey,
  repairStoredAlerts,
  resolveAlertIdentityKey,
} from './alertIdentity';

function makeAlert(overrides: Partial<AIAlert> & Pick<AIAlert, 'id' | 'createdAt'>): AIAlert {
  return {
    type: 'attention',
    categorie: 'budget',
    titre: 'Budget Essence dépassé, ajustement requis',
    message: 'L’enveloppe Essence a été dépassée ce mois-ci.',
    montant: 42.1,
    compteReference: null,
    dateEcheance: null,
    actionDisponible: 'modifier_budget',
    lu: false,
    ...overrides,
  };
}

// Identity keys are copy-independent and scoped to their entity + period.
assert.equal(budgetOverAlertKey('cat-essence', '2026-08'), 'budget_over:cat-essence:2026-08');
assert.equal(budgetOverAlertKey('Épicerie & Café', '2026-08'), 'budget_over:epicerie-cafe:2026-08');
assert.equal(balanceLowAlertKey('acc-1'), 'balance_low:acc-1');
assert.equal(planAdaptationAlertKey('plan-7', 'increase_cadence'), 'plan_adaptation:plan-7:increase-cadence');
assert.equal(paymentAlertIdentityKey('credit_limit', 'live'), 'credit-limit:live');
assert.equal(
  currentBudgetOverAlertKey('cat-essence', new Date(2026, 7, 10)),
  'budget_over:cat-essence:2026-08',
);

assert.equal(alertKindKeyForAiAlert({ categorie: 'budget' }), 'budget_over');
assert.equal(alertKindKeyForAiAlert({ categorie: 'solde_bas' }), 'balance_low');
assert.equal(alertKindKeyForAiAlert({ categorie: 'plan' }), 'plan_adaptation');
assert.equal(alertKindKeyForAiAlert({ categorie: 'autre' }), 'other');

// Legacy copy parsing feeds identity recovery for rows written before dedupe keys.
assert.equal(
  normalizeBudgetOverTitle('Budget Essence dépassé de 42,10$, ajustement requis'),
  'Budget Essence dépassé, ajustement requis',
);
assert.equal(normalizeBudgetOverTitle('Budget Essence dépassé'), 'Budget Essence dépassé');
assert.equal(extractBudgetOverCategory('Budget Essence dépassé, ajustement requis'), 'Essence');
assert.equal(
  extractBudgetOverCategory('Budget dépassé', 'L’enveloppe Essence a été dépassée ce mois-ci.'),
  'Essence',
);

// A stored key always wins over derivation.
assert.equal(
  resolveAlertIdentityKey(makeAlert({ id: 'a', createdAt: '2026-08-10T09:14:00.000Z', dedupeKey: 'budget_over:cat-x:2026-08' })),
  'budget_over:cat-x:2026-08',
);

// Legacy budget rows resolve to the same key as freshly evaluated ones (name → category id).
const legacyKey = resolveAlertIdentityKey(
  makeAlert({
    id: 'a',
    createdAt: '2026-08-10T09:14:00.000Z',
    titre: 'Budget Essence dépassé de 42,10$, ajustement requis',
  }),
  { resolveBudgetCategoryId: (name) => (name === 'Essence' ? 'cat-essence' : undefined) },
);
assert.equal(legacyKey, 'budget_over:cat-essence:2026-08');

// Without a resolver, legacy rows still collapse together on the category name.
assert.equal(
  resolveAlertIdentityKey(
    makeAlert({ id: 'a', createdAt: '2026-08-10T09:14:00.000Z', titre: 'Budget Essence dépassé' }),
  ),
  'budget_over:essence:2026-08',
);

// The reported bug: three rows whose titles only differed by the (now stripped) overrun amount.
const triplicate: AIAlert[] = [
  makeAlert({
    id: 'alert-3',
    createdAt: '2026-08-10T09:14:52.000Z',
    titre: 'Budget Essence dépassé de 42,10$, ajustement requis',
    montant: 42.1,
  }),
  makeAlert({
    id: 'alert-2',
    createdAt: '2026-08-10T09:14:31.000Z',
    titre: 'Budget Essence dépassé de 30,45$, ajustement requis',
    montant: 30.45,
  }),
  makeAlert({
    id: 'alert-1',
    createdAt: '2026-08-10T09:14:02.000Z',
    titre: 'Budget Essence dépassé de 12,00$, ajustement requis',
    montant: 12,
  }),
];

const repaired = repairStoredAlerts(triplicate, {
  resolveBudgetCategoryId: () => 'cat-essence',
});
assert.equal(repaired.length, 1);
assert.equal(repaired[0].dedupeKey, 'budget_over:cat-essence:2026-08');
// Oldest row keeps identity and first-seen time; freshest copy supplies the content.
assert.equal(repaired[0].id, 'alert-1');
assert.equal(repaired[0].createdAt, '2026-08-10T09:14:02.000Z');
assert.equal(repaired[0].montant, 42.1);
assert.equal(repaired[0].titre, 'Budget Essence dépassé, ajustement requis');
assert.equal(repaired[0].lu, false);

// A copy the user already read collapses to a read row (no re-nagging).
const partiallyRead = repairStoredAlerts(
  [triplicate[0], { ...triplicate[1], lu: true }, triplicate[2]],
  { resolveBudgetCategoryId: () => 'cat-essence' },
);
assert.equal(partiallyRead.length, 1);
assert.equal(partiallyRead[0].lu, true);

// Same category, different months stay distinct alerts.
const acrossMonths = repairStoredAlerts([
  makeAlert({ id: 'aug', createdAt: '2026-08-10T09:14:00.000Z' }),
  makeAlert({ id: 'jul', createdAt: '2026-07-04T09:14:00.000Z' }),
]);
assert.equal(acrossMonths.length, 2);

// Distinct categories are never merged, and non-budget alerts keep their own scoping.
const mixed = dedupeAiAlerts([
  makeAlert({ id: 'essence', createdAt: '2026-08-10T09:00:00.000Z', titre: 'Budget Essence dépassé' }),
  makeAlert({ id: 'epicerie', createdAt: '2026-08-10T09:00:00.000Z', titre: 'Budget Épicerie dépassé' }),
  makeAlert({
    id: 'solde-a',
    createdAt: '2026-08-10T09:00:00.000Z',
    categorie: 'solde_bas',
    compteReference: 'acc-1',
    titre: 'Desjardins : solde bas, ajout requis',
  }),
  makeAlert({
    id: 'solde-b',
    createdAt: '2026-08-10T10:00:00.000Z',
    categorie: 'solde_bas',
    compteReference: 'acc-1',
    titre: 'Desjardins : solde bas, ajout requis',
  }),
]);
assert.deepEqual(
  mixed.map((alert) => alert.id),
  ['essence', 'epicerie', 'solde-a'],
);

// Compose-level backstop keeps one row per identity and preserves an unread copy.
const items = dedupeAlertItemsByIdentity([
  { id: 'fyn-1', dedupeKey: 'budget_over:cat-essence:2026-08', read: true },
  { id: 'fyn-2', dedupeKey: 'budget_over:cat-essence:2026-08', read: false },
  { id: 'payment-live', dedupeKey: 'low-funds:live', read: false },
]);
assert.deepEqual(
  items.map((item) => item.id),
  ['fyn-1', 'payment-live'],
);
assert.equal(items[0].read, false);

// Items without a key fall back to their own id (never merged by accident).
assert.equal(
  dedupeAlertItemsByIdentity([
    { id: 'a', read: false },
    { id: 'b', read: false },
  ]).length,
  2,
);

console.log('alertIdentity tests passed');
