/**
 * Goal projection cashflow (dedupe + impact).
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/goalProjection.test.ts
 */

import assert from 'node:assert/strict';
import {
  computeGoalCashflowProjection,
  formatGoalDurationAtPace,
  resolveMonthlyIncome,
  sumMonthlyRecurringExpensesOutsideBudget,
} from './goalProjection';
import type { CategoryBudget, DashboardSummary, RecurringPayment } from '../types';

function budget(partial: Partial<CategoryBudget> & Pick<CategoryBudget, 'categoryId' | 'limitAmount'>): CategoryBudget {
  return {
    categoryName: partial.categoryName ?? 'Cat',
    categoryIcon: 'wallet',
    categoryColor: '#fff',
    spent: 0,
    ...partial,
  };
}

function payment(
  partial: Partial<RecurringPayment> & Pick<RecurringPayment, 'id' | 'amount' | 'frequency'>,
): RecurringPayment {
  return {
    name: partial.name ?? partial.id,
    kind: partial.kind ?? 'payment',
    accountId: 'acc',
    accountLabel: 'Compte',
    active: partial.active ?? true,
    icon: 'card',
    color: '#fff',
    createdAt: '2026-01-01',
    ...partial,
  };
}

const dashboard: DashboardSummary = {
  balance: 0,
  monthlyIncome: 4000,
  monthlyExpenses: 0,
  monthlyBudgetLimit: 0,
  recentTransactions: [],
  topBudgets: [],
};

const categoryBudgets = [
  budget({ categoryId: 'cat-fun', limitAmount: 800, categoryName: 'Loisirs' }),
  budget({ categoryId: 'cat-home', limitAmount: 1200, categoryName: 'Maison' }),
];

const recurringPayments = [
  payment({ id: 'netflix', amount: 20, frequency: 'monthly', categoryId: 'cat-fun' }),
  payment({ id: 'loyer', amount: 1200, frequency: 'monthly', categoryId: 'cat-home' }),
  payment({ id: 'gym-unlinked', amount: 40, frequency: 'monthly', categoryId: null }),
  payment({ id: 'salary', amount: 4000, frequency: 'monthly', kind: 'income' }),
];

assert.equal(
  sumMonthlyRecurringExpensesOutsideBudget(recurringPayments, categoryBudgets),
  40,
  'only unlinked recurring expenses count outside budget',
);

assert.equal(resolveMonthlyIncome(dashboard, recurringPayments), 4000);

const cashflow = computeGoalCashflowProjection({
  weeklyContribution: 50,
  requiredWeekly: null,
  dashboard,
  categoryBudgets,
  recurringPayments,
});

// budgets 2000 + outside 40 = 2040 / 4 = 510 + goal 50 = 560
assert.equal(cashflow.weeklyObligationsTotal, 560);

// income 4000/4 = 1000 − 560 = 440
assert.equal(cashflow.cashflowImpactWeekly, 440);

const withoutIncome = computeGoalCashflowProjection({
  weeklyContribution: 50,
  requiredWeekly: null,
  dashboard: { ...dashboard, monthlyIncome: 0 },
  categoryBudgets,
  recurringPayments: recurringPayments.filter((p) => p.kind !== 'income'),
});
assert.equal(withoutIncome.cashflowImpactWeekly, null);

assert.equal(formatGoalDurationAtPace(5), '5 jours');
assert.equal(formatGoalDurationAtPace(1), '1 jour');
assert.equal(formatGoalDurationAtPace(14), '2 semaines');
assert.equal(formatGoalDurationAtPace(21), '3 semaines');
assert.equal(formatGoalDurationAtPace(182), '6 mois');
assert.equal(formatGoalDurationAtPace(28), '1 mois');

console.log('goalProjection tests passed');
