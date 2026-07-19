import assert from 'node:assert/strict';
import { buildFynFinancialContextFromSource, type FynFinancialContextSource } from './fynFinancialContextCore';
import { sanitizeForAI } from './aiSanitization';

function source(): FynFinancialContextSource {
  return {
    snapshotAt: '2026-07-18T14:00:00.000Z',
    accounts: [{
      id: 'account-1', name: 'Visa', kind: 'credit', balance: -1200, creditLimit: 5000,
      interestRate: 19.99, last4: '4242', createdAt: '2026-01-01',
    }],
    transactions: [
      {
        id: 'tx-1', label: 'Netflix', amount: 24.99, type: 'expense',
        date: '2026-07-10T12:00:00.000Z', categoryId: 'cat-1',
        categoryName: 'Divertissement', note: 'forfait familial', syncStatus: 'synced',
      },
      {
        id: 'tx-2', label: 'Salaire', amount: 3000, type: 'income',
        date: '2026-07-01T12:00:00.000Z', categoryId: 'cat-2',
        categoryName: 'Revenus', syncStatus: 'synced',
      },
      {
        id: 'tx-3', label: 'Transfert épargne', amount: 500, type: 'transfer',
        date: '2026-07-02T12:00:00.000Z', categoryId: 'cat-2',
        categoryName: 'Transferts', syncStatus: 'synced',
      },
    ],
    budgets: [{
      categoryId: 'cat-1', categoryName: 'Divertissement', categoryIcon: 'film',
      categoryColor: '#000', limitAmount: 100, spent: 24.99,
    }],
    recurringPayments: [{
      id: 'rec-1', name: 'Netflix', amount: 24.99, kind: 'payment',
      accountId: 'account-1', accountLabel: 'Visa', frequency: 'monthly',
      nextDate: '2026-08-10', active: true, icon: 'film', color: '#000',
      createdAt: '2026-01-01',
    }],
    loans: [
      {
        id: 'loan-1', type: 'personal_loan', name: 'Prêt auto', lender: 'Banque',
        principal: 10000, balanceRemaining: 8000, interestRate: 7.5, monthlyPayment: 300,
        startDate: '2025-01-01', endDate: '2029-01-01', durationAmount: 4,
        durationUnit: 'years', paymentFrequency: 'monthly', paymentAccountId: 'account-1',
        nextPaymentDate: '2026-08-01', createdAt: '2025-01-01',
      },
      {
        id: 'loan-2', type: 'mortgage', name: 'Hypothèque', lender: 'Banque',
        principal: 300000, balanceRemaining: 275000, interestRate: 4.5, monthlyPayment: 1800,
        startDate: '2024-01-01', endDate: '2049-01-01', durationAmount: 25,
        durationUnit: 'years', paymentFrequency: 'monthly', paymentAccountId: 'account-1',
        nextPaymentDate: '2026-08-02', currentPropertyValue: 450000, createdAt: '2024-01-01',
      },
    ],
    goals: [],
    wealthAssets: [{
      id: 'asset-1', type: 'real_estate', name: 'Maison', purchaseCost: 400000,
      currentValue: 450000, valuationSource: 'estimate', linkedLoanId: 'loan-2',
      createdAt: '2024-01-01',
    }],
    merchantOverrides: [],
    categories: [],
    plans: [],
    alerts: [],
    cashflowAverage: { monthlyIncome: 3000, monthlyExpenses: 24.99, monthsUsed: 1 },
  };
}

const initial = source();
const subscriptions = buildFynFinancialContextFromSource(initial, 'quels sont mes abonnements');
assert.equal(subscriptions.recurringPayments.subscriptionCandidates[0]?.name, 'Netflix');
const merchant = buildFynFinancialContextFromSource(initial, 'combien chez Netflix');
assert.equal(merchant.transactions.relevantToQuestion[0]?.label, 'Netflix');

const agenda = buildFynFinancialContextFromSource(initial, 'prochaine échéance agenda');
assert.equal(agenda.agenda[0]?.name, 'Prêt auto');
assert.equal(agenda.cashflow.average.monthlySurplus, 2975.01);
assert.equal(agenda.cashflow.byMonth.at(-1)?.income, 3000);
assert.equal(agenda.cashflow.byMonth.at(-1)?.expenses, 24.99);

assert.equal(agenda.debts.acceleratedPlanEligible.length, 1);
assert.equal(agenda.debts.acceleratedPlanEligible[0]?.name, 'Prêt auto');
assert.equal(agenda.debts.mortgagesForWealthOnly[0]?.name, 'Hypothèque');
assert.equal(agenda.wealth.mortgageBalance, 275000);

const updated = source();
updated.loans[0]!.interestRate = 9.25;
const nextMessage = buildFynFinancialContextFromSource(updated, 'taux prêt auto');
assert.equal(nextMessage.debts.acceleratedPlanEligible[0]?.interestRate, 9.25);

const sanitized = sanitizeForAI({
  apiKey: 'secret-key',
  accountNumber: '1234567890123456',
  note: 'Carte 4111 1111 1111 4242',
  last4: '4242',
});
assert.equal('apiKey' in sanitized, false);
assert.equal('accountNumber' in sanitized, false);
assert.equal(sanitized.note, 'Carte •••• 4242');
assert.equal(sanitized.last4, '4242');

console.log('fynFinancialContextCore.test.ts: ok');
