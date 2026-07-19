import {
  getCategories,
  getCategoryBudgets,
  getDashboard,
  getLoans,
  getMerchantOverrides,
  getRecurringPayments,
  getSavingsGoals,
  getSimulatedAccounts,
  getTransactions,
  getWealthAssets,
} from '@/lib/db';
import { averageMonthlyCashflow } from '@/lib/plans/monthlyCashflowAverage';
import { loadUserPlans } from '@/lib/plans/plansStore';
import { getDisplayLanguage } from '@/lib/settings';
import type { RfaInputBundle } from './sanitizeForAI';
import { buildHeuristicRFA, resolveDataMode, sanitizeForAI } from './sanitizeForAI';
import { loadAlerts } from './alertService';
import type { FinancialSummaryAnonymous, RfaGoal, RfaSubscription, SupportedAiLanguage } from './types';
import {
  buildFynFinancialContextFromSource,
  type FynFinancialContext,
  type FynFinancialContextSource,
} from './fynFinancialContextCore';

export type FynFinancialSnapshot = {
  context: FynFinancialContext;
  rfa: FinancialSummaryAnonymous;
  rfaInput: RfaInputBundle;
};

function aiLanguage(language: string): SupportedAiLanguage {
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('es')) return 'es';
  return 'fr';
}

function goalsForRfa(goals: FynFinancialContextSource['goals']): RfaGoal[] {
  return goals.map((goal) => ({
    nom: goal.name,
    cible: goal.targetAmount,
    progression: goal.currentAmount,
    progressionPourcent:
      goal.targetAmount > 0
        ? Math.min(100, Math.round(goal.currentAmount / goal.targetAmount * 100))
        : 0,
    contributionHebdo: goal.weeklyContribution,
  }));
}

function subscriptionsForRfa(
  recurringPayments: FynFinancialContextSource['recurringPayments'],
): RfaSubscription[] {
  return recurringPayments
    .filter((payment) => payment.active && payment.kind !== 'income' && payment.amount > 0)
    .map((payment) => ({
      marchand: payment.name.trim() || 'Paiement récurrent',
      montant: payment.amount,
      frequence: payment.frequency === 'yearly' ? 'annuel' : 'mensuel',
    }));
}

export async function buildFreshFynFinancialSnapshot(
  question = '',
  now = new Date(),
): Promise<FynFinancialSnapshot> {
  const [
    dataMode,
    displayLanguage,
    dashboard,
    accounts,
    transactions,
    budgets,
    recurringPayments,
    loans,
    goals,
    wealthAssets,
    merchantOverrides,
    categories,
    plans,
    alerts,
  ] = await Promise.all([
    resolveDataMode(),
    getDisplayLanguage(),
    getDashboard(),
    getSimulatedAccounts(),
    getTransactions(),
    getCategoryBudgets(),
    getRecurringPayments(),
    getLoans(),
    getSavingsGoals(),
    getWealthAssets(),
    getMerchantOverrides(),
    getCategories(),
    loadUserPlans(),
    loadAlerts(),
  ]);

  const visibleAccounts = accounts.filter((account) => !account.hidden);
  const language = aiLanguage(displayLanguage);
  const cashflowAverage = averageMonthlyCashflow(transactions, now, 3);
  const cashflowDashboard = cashflowAverage.monthsUsed > 0
    ? {
        ...dashboard,
        monthlyIncome: cashflowAverage.monthlyIncome,
        monthlyExpenses: cashflowAverage.monthlyExpenses,
      }
    : dashboard;
  const rfaInput: RfaInputBundle = {
    dataMode,
    langue: language,
    dashboard: cashflowDashboard,
    accounts: visibleAccounts,
    loans,
    goals: goalsForRfa(goals),
    budgets,
    subscriptions: subscriptionsForRfa(recurringPayments),
  };
  const source: FynFinancialContextSource = {
    snapshotAt: now.toISOString(),
    accounts: visibleAccounts,
    transactions,
    budgets,
    recurringPayments,
    loans,
    goals,
    wealthAssets,
    merchantOverrides,
    categories,
    plans,
    alerts,
    cashflowAverage,
  };
  const rfa = buildHeuristicRFA(rfaInput);
  rfa.dettes.push(
    ...visibleAccounts
      .filter((account) => account.kind === 'credit' && account.balance < 0)
      .map((account, index) => ({
        type: 'carte_credit' as const,
        institution: account.institution?.trim() || 'Institution',
        solde: Math.max(0, -account.balance),
        tauxInteret: account.interestRate ?? 0,
        paiementMinimum: 0,
        prioriteRemboursement: rfa.dettes.length + index + 1,
      })),
  );

  return {
    context: sanitizeForAI(buildFynFinancialContextFromSource(source, question)),
    rfa,
    rfaInput,
  };
}

export function serializeFynFinancialContext(context: FynFinancialContext): string {
  return JSON.stringify(sanitizeForAI(context));
}

export async function buildFreshFynContextDigest(question = ''): Promise<string> {
  const { context } = await buildFreshFynFinancialSnapshot(question);
  return JSON.stringify(sanitizeForAI({
    snapshotAt: context.snapshotAt,
    periods: context.periods,
    cashflow: context.cashflow,
    relevantTransactions: context.transactions.relevantToQuestion,
    budgets: context.budgets,
    recurringPayments: context.recurringPayments,
    debts: context.debts,
    nextAgendaItems: context.agenda.slice(0, 12),
    goals: context.goals,
    plans: context.plans,
    wealth: {
      totalAssets: context.wealth.totalAssets,
      mortgageBalance: context.wealth.mortgageBalance,
      investments: context.wealth.investments,
    },
  }));
}
