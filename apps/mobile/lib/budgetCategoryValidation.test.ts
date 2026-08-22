/**
 * Guardrails for the « Nouvelle catégorie » budget form.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/budgetCategoryValidation.test.ts
 */

import assert from 'node:assert/strict';
import {
  MAX_BUDGET_CATEGORY_LIMIT,
  MAX_BUDGET_CATEGORY_NAME_LENGTH,
  PERIOD_ABOVE_MONTHLY_MESSAGE,
  categoryNameComparisonKey,
  duplicateFromValidation,
  findDuplicateBudgetCategory,
  limitTooLargeMessage,
  normalizeCategoryName,
  parseBudgetLimitInput,
  validateBudgetCategoryDraft,
  type ExistingBudgetCategory,
} from './budgetCategoryValidation';

const AUGUST_2026 = new Date(2026, 7, 1);
const JULY_2026 = new Date(2026, 6, 1);

/** Reported state: 1 894$ allocated across three categories, no « gas » row. */
const REPORTED_CATEGORIES: ExistingBudgetCategory[] = [
  { id: 'cat-appart', name: 'Appartement / maison', limit: 1200 },
  { id: 'cat-transport', name: 'Transport', limit: 347 },
  { id: 'cat-resto', name: 'restaurant', limit: 347 },
];

// --- Reported scenario: « gas » at 100$ against a 1 954$ envelope ------------

const reported = validateBudgetCategoryDraft({
  name: 'gas',
  limitInput: '100',
  existing: REPORTED_CATEGORIES,
  monthlyIncome: 1954,
  monthDate: AUGUST_2026,
});

assert.equal(reported.ok, true, 'creating « gas » at 100$ must be allowed');
assert.deepEqual(reported.fieldErrors, {});
assert.equal(reported.blocked, null);
assert.equal(reported.parsedLimit, 100);
assert.equal(reported.projectedAllocatedTotal, 1994);

// Over the income envelope: soft notice with both numbers, never a block.
assert.equal(reported.notices.length, 1);
assert.equal(reported.notices[0].code, 'envelope-exceeded');
assert.match(reported.notices[0].message, /1\s?994\$/u);
assert.match(reported.notices[0].message, /1\s?954\$/u);
assert.match(reported.notices[0].message, /août 2026/u);
assert.match(reported.notices[0].message, /Tu peux créer quand même/u);

// Same draft with room in the envelope: no notice at all.
const withinEnvelope = validateBudgetCategoryDraft({
  name: 'gas',
  limitInput: '100',
  existing: REPORTED_CATEGORIES,
  monthlyIncome: 4200,
  monthDate: AUGUST_2026,
});
assert.equal(withinEnvelope.ok, true);
assert.deepEqual(withinEnvelope.notices, []);

// --- Duplicate detection: case, accents, spacing ----------------------------

assert.equal(normalizeCategoryName('  Épicerie   Métro '), 'Épicerie Métro');
assert.equal(categoryNameComparisonKey('GAS'), categoryNameComparisonKey('gas'));
assert.equal(categoryNameComparisonKey('  Épicerie   Métro '), 'epicerie metro');

const withGas: ExistingBudgetCategory[] = [
  ...REPORTED_CATEGORIES,
  { id: 'cat-gas', name: 'Gas', limit: 347 },
];

const duplicate = validateBudgetCategoryDraft({
  name: '  gas ',
  limitInput: '100',
  existing: withGas,
  monthDate: AUGUST_2026,
});
assert.equal(duplicate.ok, false);
assert.equal(duplicate.firstInvalidField, 'name');
assert.equal(
  duplicate.fieldErrors.name,
  "Une catégorie « Gas » existe déjà pour août 2026. Modifie sa limite au lieu d'en créer une deuxième.",
);
// The message names the row and exposes its id so the sheet can offer to edit it.
assert.deepEqual(duplicateFromValidation(duplicate), { id: 'cat-gas', name: 'Gas' });

assert.equal(
  findDuplicateBudgetCategory('epicerie', [{ id: 'a', name: 'Épicerie' }])?.id,
  'a',
  'accents must fold',
);
assert.equal(
  findDuplicateBudgetCategory('ÉPICERIE', [{ id: 'a', name: 'epicerie' }])?.id,
  'a',
  'case must fold',
);
assert.equal(findDuplicateBudgetCategory('gas', REPORTED_CATEGORIES), null);
assert.equal(findDuplicateBudgetCategory('   ', withGas), null);

// Editing a row never collides with itself.
assert.equal(
  validateBudgetCategoryDraft({
    name: 'Gas',
    limitInput: '347',
    existing: withGas,
    editingCategoryId: 'cat-gas',
    monthDate: AUGUST_2026,
  }).ok,
  true,
);

// --- Duplicates must not fire on stale / other-month rows -------------------

const staleRows: ExistingBudgetCategory[] = [
  { id: 'cat-gas-deleted', name: 'gas', limit: 200, deletedAt: '2026-07-30T00:00:00.000Z' },
  { id: 'cat-gas-archived', name: 'gas', limit: 200, archivedAt: '2026-07-30T00:00:00.000Z' },
  { id: 'cat-gas-july', name: 'gas', limit: 200, monthKey: '2026-07' },
  { id: 'cat-gas-weekly', name: 'gas', limit: 200, period: 'weekly' },
];
assert.equal(
  findDuplicateBudgetCategory('gas', staleRows, { monthDate: AUGUST_2026 }),
  null,
  'deleted, archived, other-month and non-monthly rows must not block',
);
assert.equal(
  validateBudgetCategoryDraft({
    name: 'gas',
    limitInput: '100',
    existing: staleRows,
    monthDate: AUGUST_2026,
  }).ok,
  true,
);

// Same row, viewed from its own month: the collision is real.
assert.equal(
  findDuplicateBudgetCategory('gas', staleRows, { monthDate: JULY_2026 })?.id,
  'cat-gas-july',
);

// A row without a month key belongs to every month (current data model).
assert.equal(
  findDuplicateBudgetCategory('gas', [{ id: 'cat-gas', name: 'gas' }], {
    monthDate: AUGUST_2026,
  })?.id,
  'cat-gas',
);

// --- Guardrails, one specific message per field ----------------------------

assert.equal(
  validateBudgetCategoryDraft({ name: '   ', limitInput: '100' }).fieldErrors.name,
  'Indique un nom pour cette catégorie.',
);

assert.equal(
  validateBudgetCategoryDraft({
    name: 'x'.repeat(MAX_BUDGET_CATEGORY_NAME_LENGTH + 1),
    limitInput: '100',
  }).fieldErrors.name,
  'Nom trop long — garde-le sous 40 caractères.',
);

assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: '' }).fieldErrors.limit,
  'Indique une limite mensuelle, par exemple 100$.',
);
assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: 'abc' }).fieldErrors.limit,
  'Entre un montant en chiffres, par exemple 100.',
);
assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: '0' }).fieldErrors.limit,
  'La limite doit être supérieure à 0$.',
);
assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: '-40' }).fieldErrors.limit,
  'La limite doit être supérieure à 0$.',
);
assert.equal(
  validateBudgetCategoryDraft({
    name: 'gas',
    limitInput: String(MAX_BUDGET_CATEGORY_LIMIT + 1),
  }).fieldErrors.limit,
  limitTooLargeMessage(),
);
assert.match(limitTooLargeMessage(), /^Limite trop élevée — reste sous 1\s?000\s?000\$\.$/u);

assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: '100', periodLimitInput: '0' })
    .fieldErrors.period,
  'Laisse vide ou indique un montant supérieur à 0.',
);
assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: '100', periodLimitInput: '150' })
    .fieldErrors.period,
  PERIOD_ABOVE_MONTHLY_MESSAGE,
);
assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: '100', periodLimitInput: '  ' }).ok,
  true,
  'empty period stays optional',
);

// Several bad fields at once: each keeps its own message, name reported first.
const multi = validateBudgetCategoryDraft({ name: '', limitInput: 'abc', periodLimitInput: 'zz' });
assert.equal(multi.firstInvalidField, 'name');
assert.equal(Object.keys(multi.fieldErrors).length, 3);

// --- Capacity ceiling: blocking, but explained ------------------------------

const full: ExistingBudgetCategory[] = Array.from({ length: 10 }, (_, index) => ({
  id: `cat-${index}`,
  name: `Catégorie ${index}`,
  limit: 100,
}));
const atCapacity = validateBudgetCategoryDraft({
  name: 'gas',
  limitInput: '100',
  existing: full,
  monthDate: AUGUST_2026,
});
assert.equal(atCapacity.ok, false);
assert.deepEqual(atCapacity.fieldErrors, {}, 'the ceiling is not a field error');
assert.equal(atCapacity.blocked?.code, 'at-capacity');
assert.equal(
  atCapacity.blocked?.message,
  "Tu as déjà 10 catégories, c'est le maximum. Supprime ou fusionne une catégorie pour faire de la place.",
);
// Nine rows still leave room — the old form disabled its button far too eagerly.
assert.equal(
  validateBudgetCategoryDraft({ name: 'gas', limitInput: '100', existing: full.slice(0, 9) }).ok,
  true,
);
// Editing an existing row is never capacity-blocked.
assert.equal(
  validateBudgetCategoryDraft({
    name: 'Catégorie 0',
    limitInput: '100',
    existing: full,
    editingCategoryId: 'cat-0',
  }).ok,
  true,
);

// --- Amount parsing --------------------------------------------------------

assert.deepEqual(parseBudgetLimitInput('1 200'), { ok: true, value: 1200 });
assert.deepEqual(parseBudgetLimitInput('99,50'), { ok: true, value: 99.5 });
assert.deepEqual(parseBudgetLimitInput(''), { ok: false, reason: 'empty' });
assert.deepEqual(parseBudgetLimitInput('   '), { ok: false, reason: 'empty' });
assert.deepEqual(parseBudgetLimitInput('abc'), { ok: false, reason: 'not-a-number' });
assert.deepEqual(parseBudgetLimitInput('.'), { ok: false, reason: 'not-a-number' });
assert.deepEqual(parseBudgetLimitInput('0'), { ok: false, reason: 'not-positive' });
assert.deepEqual(parseBudgetLimitInput('1000001'), { ok: false, reason: 'too-large' });

// Disabled state and visible message can never disagree: `ok` is exactly
// "no field error and no hard block". Soft envelope notices never flip `ok`.
for (const draft of [
  { name: 'gas', limitInput: '100' },
  { name: '', limitInput: '100' },
  { name: 'gas', limitInput: '' },
  { name: 'gas', limitInput: '100', existing: full },
  { name: 'gas', limitInput: '100', existing: withGas },
  { name: 'gas', limitInput: '100', existing: REPORTED_CATEGORIES, monthlyIncome: 1954 },
]) {
  const result = validateBudgetCategoryDraft(draft);
  assert.equal(
    result.ok,
    Object.keys(result.fieldErrors).length === 0 && result.blocked == null,
  );
}

console.log('budgetCategoryValidation tests passed');
