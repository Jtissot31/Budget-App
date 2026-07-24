import assert from 'node:assert/strict';
import { buildContextChartWidgets, detectFynChartIntents, enrichAssistantBlocksWithContextWidgets } from './fynChartWidgets';
import type { FynFinancialContext } from './fynFinancialContextCore';
import type { FinancialSummaryAnonymous } from './types';

function sampleContext(): FynFinancialContext {
  return {
    schemaVersion: 1,
    snapshotAt: '2026-07-18T14:00:00.000Z',
    periods: {
      currentMonth: '2026-07',
      cashflowAverage: 'moyenne 3 mois',
      transactionTrend: '6 mois',
    },
    availability: {
      accounts: true,
      transactions: true,
      budgets: true,
      recurringPayments: true,
      debtsAndLoans: true,
      agenda: true,
      goals: true,
      plans: true,
      wealthAssets: true,
      investments: false,
      alerts: true,
      notes: true,
    },
    calculationRules: {
      transfersExcludedFromIncomeAndExpenses: true,
      recurringNotAddedToPostedTransactions: true,
      acceleratedDebtExcludesMortgages: true,
      amountsUseStoredCurrency: true,
    },
    accounts: [],
    cashflow: {
      average: { monthlyIncome: 3000, monthlyExpenses: 2200, monthsUsed: 3, monthlySurplus: 800 },
      byMonth: [
        { month: '2026-02', income: 2800, expenses: 2100, net: 700 },
        { month: '2026-03', income: 2900, expenses: 2150, net: 750 },
        { month: '2026-04', income: 3000, expenses: 2200, net: 800 },
        { month: '2026-05', income: 3100, expenses: 2250, net: 850 },
        { month: '2026-06', income: 3000, expenses: 2300, net: 700 },
        { month: '2026-07', income: 3000, expenses: 2200, net: 800 },
      ],
    },
    transactions: {
      totalCount: 10,
      currentMonthCount: 3,
      expensesByCategory: [{ label: 'Épicerie', amount: 420, count: 4 }],
      expensesByMerchant: [{ label: 'IGA', amount: 180, count: 2 }],
      recent: [],
      relevantToQuestion: [{ date: '2026-07-10', label: 'Netflix', amount: 24.99, type: 'expense', category: 'Divertissement', note: null }],
      relevantMatchCount: 1,
    },
    budgets: [{ category: 'Restaurants', monthlyLimit: 400, weeklyLimit: null, spentCurrentMonth: 450, remaining: -50 }],
    recurringPayments: {
      activeCount: 1,
      monthlyPaymentsTotal: 24.99,
      monthlyIncomeTotal: 0,
      items: [],
      subscriptionCandidates: [{ name: 'Netflix', amount: 24.99, frequency: 'monthly', nextDate: '2026-08-10' }],
    },
    debts: {
      acceleratedPlanEligible: [{ name: 'Visa', type: 'personal_loan', lender: 'Banque', balance: 4200, interestRate: 19.9, monthlyPayment: 125, nextPaymentDate: '2026-08-01' }],
      mortgagesForWealthOnly: [{ name: 'Hypothèque', lender: 'Banque', balance: 275000, interestRate: 4.5, monthlyPayment: 1800, nextPaymentDate: '2026-08-02', renewalDate: null, propertyValue: 450000 }],
      creditAccounts: [],
    },
    agenda: [],
    goals: [],
    plans: [],
    alerts: [],
    wealth: {
      assets: [],
      totalAssets: 0,
      mortgageBalance: 275000,
      investments: { available: false, reason: 'N/A' },
    },
    metadata: { categories: [], merchantOverrides: [] },
  };
}

function sampleRfa(): FinancialSummaryAnonymous {
  return {
    generatedAt: '2026-07-18T14:00:00.000Z',
    dataMode: 'manual',
    langue: 'fr',
    profil: {
      typeDetecte: 'jeune_travailleur',
      revenuMensuelNet: 3000,
      depensesMensuellesMoyennes: 2200,
      tauxEpargneActuel: 26,
      situationGlobale: 'saine',
    },
    comptes: [],
    dettes: [
      { type: 'autre', institution: 'Visa', solde: 4200, tauxInteret: 19.9, paiementMinimum: 125, prioriteRemboursement: 1 },
      { type: 'hypotheque', institution: 'Banque', solde: 275000, tauxInteret: 4.5, paiementMinimum: 1800, prioriteRemboursement: 2 },
    ],
    abonnementsDetectes: [],
    objectifsActifs: [],
    plansFinanciersActifs: [],
    alertesActives: [],
    analyse: 'Test',
  };
}

assert.deepEqual(detectFynChartIntents('quels sont mes abonnements'), ['subscriptions']);
assert.ok(detectFynChartIntents('cashflow ce mois').includes('cashflow_trend'));
assert.ok(detectFynChartIntents('mes soldes').includes('balances'));
assert.ok(detectFynChartIntents('montre mes soldes').includes('balances'));
assert.ok(detectFynChartIntents('show my balances').includes('balances'));

const context = sampleContext();
context.accounts = [
  {
    name: 'Tangerine Chèque',
    institution: 'Tangerine',
    type: 'checking',
    balance: 3412.5,
    last4: '4521',
    creditLimit: null,
    interestRate: null,
    dueDay: null,
  },
  {
    name: 'Épargne',
    institution: 'Desjardins',
    type: 'savings',
    balance: 1800,
    last4: null,
    creditLimit: null,
    interestRate: null,
    dueDay: null,
  },
  {
    name: 'Visa',
    institution: 'Banque',
    type: 'credit',
    balance: -4200,
    last4: '1111',
    creditLimit: 8000,
    interestRate: 19.9,
    dueDay: 12,
  },
];
const rfa = sampleRfa();
const subscriptionWidgets = buildContextChartWidgets('quels abonnements', context, rfa);
assert.equal(subscriptionWidgets[0]?.type, 'allocation_chart');
assert.equal(subscriptionWidgets[0]?.label, 'Abonnements et paiements récurrents');

const debtWidgets = buildContextChartWidgets('mes dettes actives', context, rfa);
assert.equal(debtWidgets[0]?.type, 'debt_table');
assert.equal(debtWidgets[0]?.rows.length, 1);
assert.equal(debtWidgets[0]?.rows[0]?.name, 'Visa');

const cashflowWidgets = buildContextChartWidgets('mon cashflow ce mois', context, rfa);
assert.ok(cashflowWidgets.some((widget) => widget.type === 'cashflow_comparison'));

const incomeWidget = cashflowWidgets.find((widget) => widget.type === 'cashflow_comparison');
assert.equal(incomeWidget?.label, 'Revenus vs dépenses (moyenne mensuelle)');
if (incomeWidget?.type === 'cashflow_comparison') {
  assert.equal(incomeWidget.income, 3000);
  assert.equal(incomeWidget.expenses, 2200);
  assert.equal(incomeWidget.surplus, 800);
  assert.match(incomeWidget.caption ?? '', /Surplus moyen/);
}

const balanceWidgets = buildContextChartWidgets('mes soldes', context, rfa);
assert.ok(balanceWidgets.some((widget) => widget.type === 'balance_summary_card'));
const totalBalance = balanceWidgets.find(
  (widget) => widget.type === 'balance_summary_card' && widget.variant === 'total',
);
assert.ok(totalBalance);
if (totalBalance?.type === 'balance_summary_card') {
  // 3412.50 + 1800 = 5212.50 — credit excluded from liquid total
  assert.match(totalBalance.value_label.replace(/\u00a0/g, ' '), /5\s*212/);
}
assert.ok(
  balanceWidgets.some(
    (widget) =>
      widget.type === 'balance_summary_card' &&
      widget.variant === 'account' &&
      widget.account_name === 'Tangerine Chèque',
  ),
);

const enrichedBalances = enrichAssistantBlocksWithContextWidgets(
  [{ type: 'text', content: 'Voici tes soldes.' }],
  'mes soldes',
  context,
  rfa,
);
assert.ok(enrichedBalances.some((block) => block.type === 'balance_summary_card'));

const enriched = enrichAssistantBlocksWithContextWidgets(
  [{ type: 'text', content: 'Voici tes abonnements.' }],
  'quels abonnements',
  context,
  rfa,
);
assert.ok(enriched.some((block) => block.type === 'allocation_chart'));

console.log('fynChartWidgets.test.ts: ok');
