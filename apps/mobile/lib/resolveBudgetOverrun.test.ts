/**
 * Budget-overrun alert diagnostics.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/resolveBudgetOverrun.test.ts
 */

import assert from 'node:assert/strict';
import {
  buildBudgetOverrunData,
  identifyOverspendTransactionIds,
  matchCategoryBudgetForAlert,
  parseBudgetOverDedupeKey,
} from './resolveBudgetOverrun';
import type { CategoryBudget, Transaction } from '@/types';

function tx(id: string, amount: number, date: string): Transaction {
  return {
    id,
    label: id,
    amount,
    type: 'expense',
    date,
    categoryId: 'cat-food',
    syncStatus: 'synced',
  };
}

assert.deepEqual(parseBudgetOverDedupeKey('budget_over:cat-food:2026-08'), {
  refSlug: 'cat-food',
  monthKey: '2026-08',
});
assert.equal(parseBudgetOverDedupeKey('aggregate:budget_over'), null);

const budgets: CategoryBudget[] = [
  {
    categoryId: 'cat-food',
    categoryName: 'Épicerie',
    categoryIcon: 'basket',
    categoryColor: '#34D399',
    limitAmount: 500,
    spent: 824.95,
  },
];

assert.equal(
  matchCategoryBudgetForAlert(
    budgets,
    { title: 'Budget Épicerie dépassé', message: '', dedupeKey: 'budget_over:cat-food:2026-08' },
    '2026-08',
  )?.categoryId,
  'cat-food',
);
assert.equal(
  matchCategoryBudgetForAlert(
    budgets,
    { title: 'Budget Épicerie dépassé', message: 'L’enveloppe Épicerie a été dépassée ce mois-ci.' },
    '2026-08',
  )?.categoryName,
  'Épicerie',
);

const rows = [
  tx('a', 80, '2026-08-02T12:00:00.000Z'),
  tx('b', 200, '2026-08-08T12:00:00.000Z'),
  tx('c', 250, '2026-08-14T12:00:00.000Z'),
  tx('d', 150, '2026-08-18T12:00:00.000Z'),
  tx('e', 144.95, '2026-08-20T12:00:00.000Z'),
];
const busting = identifyOverspendTransactionIds(rows, 500);
assert.deepEqual([...busting], ['c', 'd', 'e']);

const allBusting = identifyOverspendTransactionIds(rows, 0);
assert.equal(allBusting.size, 5);

const data = buildBudgetOverrunData({
  budget: budgets[0],
  transactions: rows,
  monthDate: new Date(2026, 7, 1),
});
assert.equal(data.allocated, 500);
assert.equal(data.spent, 824.95);
assert.equal(data.surplus, 324.95);
assert.equal(data.transactions[0].id, 'e');
assert.ok(data.overspendTransactionIds.has('c'));
assert.equal(data.overspendTransactionIds.has('a'), false);

console.log('resolveBudgetOverrun.test.ts ok');
