import type {
  Category,
  CategoryBudget,
  Loan,
  MerchantOverride,
  RecurringPayment,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
  WealthAsset,
} from '@/types';
import type { PlanActifOuTermine } from '@/lib/plans/Plan';
import type { AIAlert } from './types';

export type FynCashflowMetrics = {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthsUsed: number;
};

export type FynFinancialContextSource = {
  snapshotAt: string;
  accounts: SimulatedAccount[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  recurringPayments: RecurringPayment[];
  loans: Loan[];
  goals: SavingsGoal[];
  wealthAssets: WealthAsset[];
  merchantOverrides: MerchantOverride[];
  categories: Category[];
  plans: PlanActifOuTermine[];
  alerts: AIAlert[];
  cashflowAverage: FynCashflowMetrics;
};

export type FynFinancialContext = ReturnType<typeof buildFynFinancialContextFromSource>;

const STOP_WORDS = new Set([
  'avec', 'chez', 'combien', 'dans', 'depense', 'depenses', 'depensé', 'depensé',
  'faire', 'financier', 'financiere', 'pour', 'quelle', 'quelles', 'quels', 'quoi',
  'sont', 'tout', 'tous', 'transaction', 'transactions', 'une', 'mes', 'mon', 'the',
]);

function normalized(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function questionTokens(question: string): string[] {
  return normalized(question)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthlyTransactionSummary(transactions: readonly Transaction[], now: Date) {
  const result = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { month: monthKey(date), income: 0, expenses: 0, net: 0 };
  });
  const byMonth = new Map(result.map((item) => [item.month, item]));
  for (const transaction of transactions) {
    if (transaction.type === 'transfer') continue;
    const date = new Date(transaction.date);
    if (Number.isNaN(date.getTime())) continue;
    const item = byMonth.get(monthKey(date));
    if (!item) continue;
    const amount = Math.max(0, Number(transaction.amount) || 0);
    if (transaction.type === 'income') item.income += amount;
    if (transaction.type === 'expense') item.expenses += amount;
  }
  return result.map((item) => ({ ...item, net: item.income - item.expenses }));
}

function aggregateExpenses(
  transactions: readonly Transaction[],
  selector: (transaction: Transaction) => string,
  limit: number,
) {
  const totals = new Map<string, { amount: number; count: number }>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const label = selector(transaction).trim() || 'Non classé';
    const current = totals.get(label) ?? { amount: 0, count: 0 };
    current.amount += Math.max(0, Number(transaction.amount) || 0);
    current.count += 1;
    totals.set(label, current);
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function transactionDetail(transaction: Transaction) {
  return {
    date: transaction.date,
    label: transaction.label,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.categoryName ?? null,
    note: transaction.note?.trim() || null,
  };
}

function monthlyEquivalent(payment: RecurringPayment): number {
  switch (payment.frequency) {
    case 'weekly':
      return payment.amount * 52 / 12;
    case 'biweekly':
      return payment.amount * 26 / 12;
    case 'yearly':
      return payment.amount / 12;
    default:
      return payment.amount;
  }
}

export function buildFynFinancialContextFromSource(
  source: FynFinancialContextSource,
  question = '',
) {
  const now = new Date(source.snapshotAt);
  const tokens = questionTokens(question);
  const matchingTransactions = tokens.length
    ? source.transactions.filter((transaction) => {
        const haystack = normalized(
          `${transaction.label} ${transaction.categoryName ?? ''} ${transaction.note ?? ''}`,
        );
        return tokens.some((token) => haystack.includes(token));
      })
    : [];
  const currentMonth = monthKey(now);
  const currentMonthTransactions = source.transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return !Number.isNaN(date.getTime()) && monthKey(date) === currentMonth;
  });
  const loanRecurringIds = new Set(
    source.loans.map((loan) => loan.recurringPaymentId).filter((id): id is string => Boolean(id)),
  );
  const activeRecurring = source.recurringPayments.filter((payment) => payment.active);
  const acceleratedLoans = source.loans.filter((loan) => loan.type !== 'mortgage');
  const mortgageLoans = source.loans.filter((loan) => loan.type === 'mortgage');
  const agenda = [
    ...activeRecurring.map((payment) => ({
      type: payment.kind === 'income' ? 'revenu_recurrent' : 'paiement_recurrent',
      name: payment.name,
      date: payment.nextDate ?? null,
      amount: payment.amount,
      account: payment.accountLabel,
    })),
    ...source.loans.map((loan) => ({
      type: 'echeance_pret',
      name: loan.name,
      date: loan.nextPaymentDate || null,
      amount: loan.monthlyPayment,
      account: source.accounts.find((account) => account.id === loan.paymentAccountId)?.name ?? null,
    })),
    ...source.goals.filter((goal) => goal.dueDate).map((goal) => ({
      type: 'objectif',
      name: goal.name,
      date: goal.dueDate ?? null,
      amount: Math.max(0, goal.targetAmount - goal.currentAmount),
      account: null,
    })),
    ...source.plans.flatMap((plan) =>
      plan.etapes.filter((step) => step.date && step.statut !== 'complete').map((step) => ({
        type: 'etape_plan',
        name: `${plan.titre} — ${step.titre}`,
        date: step.date ?? null,
        amount: 0,
        account: plan.compte_lie ?? null,
      })),
    ),
  ]
    .filter((item) => item.date)
    .sort((a, b) => Date.parse(a.date ?? '') - Date.parse(b.date ?? ''))
    .slice(0, 80);

  return {
    schemaVersion: 1,
    snapshotAt: source.snapshotAt,
    periods: {
      currentMonth,
      cashflowAverage: `moyenne des ${source.cashflowAverage.monthsUsed} mois ayant des opérations, maximum 3 mois`,
      transactionTrend: '6 mois civils incluant le mois courant',
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
      alerts: true,
      wealthAssets: true,
      investments: false,
      notes: true,
    },
    calculationRules: {
      transfersExcludedFromIncomeAndExpenses: true,
      recurringNotAddedToPostedTransactions: true,
      acceleratedDebtExcludesMortgages: true,
      amountsUseStoredCurrency: true,
    },
    accounts: source.accounts.filter((account) => !account.hidden).map((account) => ({
      name: account.name,
      institution: account.institution ?? null,
      type: account.kind,
      balance: account.balance,
      last4: account.last4 || null,
      creditLimit: account.creditLimit ?? null,
      interestRate: account.interestRate ?? null,
      dueDay: account.dueDay ?? null,
    })),
    cashflow: {
      average: {
        ...source.cashflowAverage,
        monthlySurplus:
          source.cashflowAverage.monthlyIncome - source.cashflowAverage.monthlyExpenses,
      },
      byMonth: monthlyTransactionSummary(source.transactions, now),
    },
    transactions: {
      totalCount: source.transactions.length,
      currentMonthCount: currentMonthTransactions.length,
      expensesByCategory: aggregateExpenses(
        source.transactions,
        (transaction) => transaction.categoryName ?? 'Non classé',
        20,
      ),
      expensesByMerchant: aggregateExpenses(source.transactions, (transaction) => transaction.label, 25),
      recent: source.transactions.slice(0, 30).map(transactionDetail),
      relevantToQuestion: matchingTransactions.slice(0, 80).map(transactionDetail),
      relevantMatchCount: matchingTransactions.length,
    },
    budgets: source.budgets.map((budget) => ({
      category: budget.categoryName,
      monthlyLimit: budget.limitAmount,
      weeklyLimit: budget.weeklyLimitAmount ?? null,
      spentCurrentMonth: budget.spent,
      remaining: budget.limitAmount - budget.spent,
    })),
    recurringPayments: {
      activeCount: activeRecurring.length,
      monthlyPaymentsTotal: activeRecurring
        .filter((payment) => payment.kind !== 'income')
        .reduce((sum, payment) => sum + monthlyEquivalent(payment), 0),
      monthlyIncomeTotal: activeRecurring
        .filter((payment) => payment.kind === 'income')
        .reduce((sum, payment) => sum + monthlyEquivalent(payment), 0),
      items: activeRecurring.slice(0, 100).map((payment) => ({
        name: payment.name,
        kind: payment.kind ?? 'payment',
        amount: payment.amount,
        monthlyEquivalent: monthlyEquivalent(payment),
        frequency: payment.frequency,
        nextDate: payment.nextDate ?? null,
        endDate: payment.endDate ?? null,
        account: payment.accountLabel,
        category: payment.categoryName ?? null,
        linkedToLoan: loanRecurringIds.has(payment.id),
      })),
      subscriptionCandidates: activeRecurring
        .filter((payment) => payment.kind !== 'income' && !loanRecurringIds.has(payment.id))
        .slice(0, 100)
        .map((payment) => ({
          name: payment.name,
          amount: payment.amount,
          frequency: payment.frequency,
          nextDate: payment.nextDate ?? null,
        })),
    },
    debts: {
      acceleratedPlanEligible: acceleratedLoans.map((loan) => ({
        name: loan.name,
        type: loan.type,
        lender: loan.lender,
        balance: loan.balanceRemaining,
        interestRate: loan.interestRate,
        monthlyPayment: loan.monthlyPayment,
        nextPaymentDate: loan.nextPaymentDate,
      })),
      mortgagesForWealthOnly: mortgageLoans.map((loan) => ({
        name: loan.name,
        lender: loan.lender,
        balance: loan.balanceRemaining,
        interestRate: loan.interestRate,
        monthlyPayment: loan.monthlyPayment,
        nextPaymentDate: loan.nextPaymentDate,
        renewalDate: loan.renewalDate ?? null,
        propertyValue: loan.currentPropertyValue ?? null,
      })),
      creditAccounts: source.accounts
        .filter((account) => !account.hidden && account.kind === 'credit')
        .map((account) => ({
          name: account.name,
          balance: Math.max(0, -account.balance),
          interestRate: account.interestRate ?? null,
          creditLimit: account.creditLimit ?? null,
          dueDay: account.dueDay ?? null,
        })),
    },
    agenda,
    goals: source.goals.map((goal) => ({
      name: goal.name,
      target: goal.targetAmount,
      current: goal.currentAmount,
      remaining: Math.max(0, goal.targetAmount - goal.currentAmount),
      progressPercent:
        goal.targetAmount > 0 ? Math.min(100, Math.round(goal.currentAmount / goal.targetAmount * 100)) : 0,
      weeklyContribution: goal.weeklyContribution ?? null,
      dueDate: goal.dueDate ?? null,
    })),
    plans: source.plans.map((plan) => ({
      title: plan.titre,
      category: plan.category,
      subtype: plan.subtype,
      status: plan.statut,
      current: plan.montant_actuel,
      target: plan.montant_cible,
      targetDate: plan.date_cible ?? null,
      completedSteps: plan.etapes.filter((step) => step.statut === 'complete').length,
      totalSteps: plan.etapes.length,
    })),
    alerts: source.alerts
      .filter((alert) => !alert.lu)
      .slice(0, 50)
      .map((alert) => ({
        severity: alert.type,
        category: alert.categorie,
        title: alert.titre,
        message: alert.message,
        amount: alert.montant,
        dueDate: alert.dateEcheance,
      })),
    wealth: {
      assets: source.wealthAssets.map((asset) => ({
        name: asset.name,
        type: asset.type,
        purchaseCost: asset.purchaseCost,
        currentValue: asset.currentValue,
        valuationDate: asset.lastValuationAt ?? null,
        valuationSource: asset.valuationSource,
        notes: asset.notes?.trim() || null,
        linkedMortgage: Boolean(asset.linkedLoanId),
      })),
      totalAssets: source.wealthAssets.reduce((sum, asset) => sum + asset.currentValue, 0),
      mortgageBalance: mortgageLoans.reduce((sum, loan) => sum + loan.balanceRemaining, 0),
      investments: { available: false, reason: 'Aucune source de placements structurée dans la base actuelle.' },
    },
    metadata: {
      categories: source.categories.map((category) => category.name),
      merchantOverrides: source.merchantOverrides
        .filter((merchant) => !merchant.hidden)
        .map((merchant) => ({
          originalName: merchant.originalName,
          displayName: merchant.displayName ?? null,
        })),
    },
  };
}
