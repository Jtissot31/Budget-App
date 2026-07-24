import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import { filterRfaDebtsEligibleForAcceleratedPlan } from '@/lib/plans/debtPlanEligibility';
import type {
  AIWidgetData,
  AllocationChartData,
  BalanceSummaryCardData,
  BarChartData,
  CashflowComparisonData,
  DebtTableData,
  LineChartData,
  MessageBlock,
} from '@/types/aiWidgets';
import { buildCashflowResultCaption, normalizeCashflowComparisonData } from './normalizeCashflowWidget';
import type { FinancialSummaryAnonymous } from './types';
import type { FynFinancialContext } from './fynFinancialContextCore';

export type FynChartIntent =
  | 'category_spending'
  | 'cashflow_trend'
  | 'income_vs_expenses'
  | 'budget_vs_actual'
  | 'subscriptions'
  | 'debts'
  | 'merchant_spend'
  | 'balances'
  | 'account_balance';

type ContextAccount = FynFinancialContext['accounts'][number];

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isCreditAccount(account: ContextAccount): boolean {
  return account.type === 'credit';
}

function findMentionedAccount(question: string, accounts: readonly ContextAccount[]): ContextAccount | null {
  const normalized = normalizeQuestion(question);
  if (!normalized || accounts.length === 0) return null;

  let best: ContextAccount | null = null;
  let bestScore = 0;

  for (const account of accounts) {
    const name = normalizeQuestion(account.name);
    const institution = account.institution ? normalizeQuestion(account.institution) : '';
    let score = 0;
    if (name.length >= 3 && normalized.includes(name)) score = Math.max(score, name.length);
    if (institution.length >= 3 && normalized.includes(institution)) {
      score = Math.max(score, institution.length);
    }
    if (score > bestScore) {
      bestScore = score;
      best = account;
    }
  }

  return best;
}

export function detectFynChartIntents(question: string): FynChartIntent[] {
  const normalized = normalizeQuestion(question);
  const intents: FynChartIntent[] = [];

  if (/\b(abonnement|abonnements|recurrent|recurrents|netflix|spotify)\b/.test(normalized)) {
    intents.push('subscriptions');
  }
  if (/\b(agenda|echeance|echeances|prochain|prochaine)\b/.test(normalized)) {
    // Agenda stays textual — no chart intent.
  }
  if (/\b(budget|enveloppe|depasse|depassement)\b/.test(normalized)) {
    intents.push('budget_vs_actual');
  }
  if (/\b(categorie|categories|depense|depenses|depenser|magasin|restaurant)\b/.test(normalized)) {
    intents.push('category_spending');
  }
  if (/\b(cashflow|flux|surplus|revenu|revenus|depense|depenses)\b/.test(normalized)) {
    intents.push('cashflow_trend', 'income_vs_expenses');
  }
  if (/\b(dette|dettes|rembours|hypotheque)\b/.test(normalized)) {
    intents.push('debts');
  } else if (/\b(carte|credit)\b/.test(normalized) && !/\b(solde|soldes|balance|balances)\b/.test(normalized)) {
    intents.push('debts');
  }
  if (/\b(combien|total).*\bchez\b/.test(normalized)) {
    intents.push('merchant_spend');
  }
  if (
    /\b(mes soldes|mon solde|soldes?|balances?|liquidites?|liquidity|account balances?|my balances?|how much.*(have|got)|combien (j ai|jai|ai je|il me reste))\b/.test(
      normalized,
    ) ||
    /\b(montre|voir|affiche|show|display)\b.*\b(soldes?|balances?|comptes?|accounts?)\b/.test(normalized) ||
    /\b(soldes?|balances?|comptes?|accounts?)\b.*\b(montre|voir|affiche|show|display)\b/.test(normalized)
  ) {
    intents.push('balances');
  }

  return [...new Set(intents)];
}

function buildAccountBalanceCard(account: ContextAccount): BalanceSummaryCardData {
  const kind = account.type;
  return {
    type: 'balance_summary_card',
    variant: 'account',
    label: 'Solde',
    account_name: account.name,
    ...(account.institution ? { account_institution: account.institution } : {}),
    ...(account.last4 ? { account_last4: account.last4 } : {}),
    ...(kind ? { account_kind: kind } : {}),
    value_label: formatDisplayMoneyAbsoluteExact(account.balance),
    action: { label: 'Voir le compte' },
  };
}

function buildTotalBalanceCard(accounts: readonly ContextAccount[]): BalanceSummaryCardData | null {
  const liquid = accounts.filter((account) => !isCreditAccount(account));
  if (liquid.length === 0) return null;
  const total = liquid.reduce((sum, account) => sum + account.balance, 0);
  return {
    type: 'balance_summary_card',
    variant: 'total',
    label: 'Solde total',
    value_label: formatDisplayMoneyAbsoluteExact(total),
    action: { label: 'Voir les comptes' },
  };
}

function buildBalanceWidgets(question: string, context: FynFinancialContext): AIWidgetData[] {
  const accounts = context.accounts;
  if (accounts.length === 0) return [];

  const mentioned = findMentionedAccount(question, accounts);
  const normalized = normalizeQuestion(question);
  const asksSpecificAccount =
    Boolean(mentioned) &&
    (/\b(solde|balance|combien|sur mon|on my|de mon|of my)\b/.test(normalized) ||
      (mentioned != null && normalized.includes(normalizeQuestion(mentioned.name))));

  if (mentioned && asksSpecificAccount && !/\b(mes soldes|my balances|tous mes|all my)\b/.test(normalized)) {
    return [buildAccountBalanceCard(mentioned)];
  }

  const widgets: AIWidgetData[] = [];
  const total = buildTotalBalanceCard(accounts);
  if (total) widgets.push(total);

  const liquid = accounts.filter((account) => !isCreditAccount(account)).slice(0, 4);
  for (const account of liquid) {
    widgets.push(buildAccountBalanceCard(account));
  }

  return widgets;
}

function buildCategoryBarChart(context: FynFinancialContext): BarChartData | null {
  const items = context.transactions.expensesByCategory.slice(0, 6);
  if (items.length === 0) return null;

  const budgetByCategory = new Map(
    context.budgets.map((budget) => [budget.category, budget.monthlyLimit]),
  );
  const hasBudgetLimits = items.some((item) => {
    const limit = budgetByCategory.get(item.label);
    return limit != null && limit > 0;
  });

  return {
    type: 'bar_chart',
    label: 'Dépenses par catégorie',
    items: items.map((item) => {
      const limit = budgetByCategory.get(item.label);
      const hasLimit = limit != null && limit > 0;

      return {
        label: item.label,
        value: item.amount,
        value_label: formatDisplayMoneyAbsoluteExact(item.amount),
        ...(hasLimit
          ? {
              limit,
              limit_label: formatDisplayMoneyAbsoluteExact(limit),
            }
          : {}),
      };
    }),
    caption: hasBudgetLimits
      ? 'Mois en cours · barre = dépensé sur limite mensuelle'
      : `Basé sur ${context.periods.transactionTrend}.`,
    ...(hasBudgetLimits ? { action: { label: 'Voir toutes les catégories' } } : {}),
  };
}

function buildCashflowLineChart(context: FynFinancialContext): LineChartData | null {
  const series = context.cashflow.byMonth.map((month) => month.net);
  if (series.length < 2) return null;

  const latest = series[series.length - 1] ?? 0;
  return {
    type: 'line_chart',
    label: 'Tendance cashflow net',
    data: series,
    value_label: formatDisplayMoneyAbsoluteExact(latest),
    caption: context.periods.cashflowAverage,
    positive: latest >= 0,
  };
}

function buildIncomeVsExpensesComparison(context: FynFinancialContext): CashflowComparisonData {
  const income = context.cashflow.average.monthlyIncome;
  const expenses = context.cashflow.average.monthlyExpenses;
  const surplus = context.cashflow.average.monthlySurplus;

  const widget = normalizeCashflowComparisonData({
    type: 'cashflow_comparison',
    label: 'Revenus vs dépenses (moyenne mensuelle)',
    income,
    expenses,
    income_label: formatDisplayMoneyAbsoluteExact(income),
    expenses_label: formatDisplayMoneyAbsoluteExact(expenses),
    surplus,
    caption: buildCashflowResultCaption(surplus),
    period: context.periods.cashflowAverage,
  });

  return (
    widget ?? {
      type: 'cashflow_comparison',
      label: 'Revenus vs dépenses (moyenne mensuelle)',
      income: 0,
      expenses: 0,
      surplus: 0,
      caption: buildCashflowResultCaption(0),
      period: context.periods.cashflowAverage,
    }
  );
}

function buildBudgetAllocationChart(context: FynFinancialContext): AllocationChartData | null {
  const segments = context.budgets
    .filter((budget) => budget.monthlyLimit > 0)
    .slice(0, 6)
    .map((budget) => ({
      label: budget.category,
      value: budget.spentCurrentMonth,
    }));

  if (segments.length === 0) return null;

  return {
    type: 'allocation_chart',
    label: 'Budget consommé ce mois',
    segments,
    caption: `Mois ${context.periods.currentMonth}.`,
  };
}

function buildSubscriptionsAllocation(context: FynFinancialContext): AllocationChartData | null {
  const items = context.recurringPayments.subscriptionCandidates.slice(0, 8);
  if (items.length === 0) return null;

  return {
    type: 'allocation_chart',
    label: 'Abonnements et paiements récurrents',
    segments: items.map((item) => ({
      label: item.name,
      value: item.amount,
    })),
    caption: `${items.length} paiement${items.length > 1 ? 's' : ''} actif${items.length > 1 ? 's' : ''}.`,
  };
}

function buildDebtTableWidget(
  context: FynFinancialContext,
  rfa: FinancialSummaryAnonymous,
): DebtTableData | null {
  const dettes = filterRfaDebtsEligibleForAcceleratedPlan(rfa.dettes);
  if (dettes.length === 0) return null;

  return {
    type: 'debt_table',
    label: 'Dettes accélérables',
    rows: dettes.slice(0, 6).map((debt) => ({
      name: debt.institution,
      balance: formatDisplayMoneyAbsoluteExact(debt.solde),
      rate: `${debt.tauxInteret.toFixed(1)} %`,
      payment: formatDisplayMoneyAbsoluteExact(debt.paiementMinimum),
    })),
    total: {
      label: 'Total',
      balance: formatDisplayMoneyAbsoluteExact(
        dettes.reduce((sum, debt) => sum + debt.solde, 0),
      ),
      payment: formatDisplayMoneyAbsoluteExact(
        dettes.reduce((sum, debt) => sum + debt.paiementMinimum, 0),
      ),
    },
  };
}

function buildMerchantBarChart(context: FynFinancialContext): BarChartData | null {
  const relevant = context.transactions.relevantToQuestion.filter((tx) => tx.type === 'expense');
  if (relevant.length === 0) return null;

  const totals = new Map<string, number>();
  for (const tx of relevant) {
    totals.set(tx.label, (totals.get(tx.label) ?? 0) + tx.amount);
  }

  const items = [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (items.length === 0) return null;

  return {
    type: 'bar_chart',
    label: 'Dépenses correspondantes',
    items: items.map((item) => ({
      ...item,
      value_label: formatDisplayMoneyAbsoluteExact(item.value),
    })),
    caption: `${context.transactions.relevantMatchCount} transaction${context.transactions.relevantMatchCount > 1 ? 's' : ''} trouvée${context.transactions.relevantMatchCount > 1 ? 's' : ''}.`,
  };
}

export function buildContextChartWidgets(
  question: string,
  context: FynFinancialContext,
  rfa: FinancialSummaryAnonymous,
): AIWidgetData[] {
  const intents = detectFynChartIntents(question);
  const widgets: AIWidgetData[] = [];

  for (const intent of intents) {
    switch (intent) {
      case 'category_spending': {
        const widget = buildCategoryBarChart(context);
        if (widget) widgets.push(widget);
        break;
      }
      case 'cashflow_trend': {
        const widget = buildCashflowLineChart(context);
        if (widget) widgets.push(widget);
        break;
      }
      case 'income_vs_expenses':
        widgets.push(buildIncomeVsExpensesComparison(context));
        break;
      case 'budget_vs_actual': {
        const widget = buildBudgetAllocationChart(context);
        if (widget) widgets.push(widget);
        break;
      }
      case 'subscriptions': {
        const widget = buildSubscriptionsAllocation(context);
        if (widget) widgets.push(widget);
        break;
      }
      case 'debts': {
        const widget = buildDebtTableWidget(context, rfa);
        if (widget) widgets.push(widget);
        break;
      }
      case 'merchant_spend': {
        const widget = buildMerchantBarChart(context);
        if (widget) widgets.push(widget);
        break;
      }
      case 'balances':
      case 'account_balance': {
        widgets.push(...buildBalanceWidgets(question, context));
        break;
      }
      default:
        break;
    }
  }

  return widgets;
}

const CHART_WIDGET_TYPES = new Set([
  'line_chart',
  'bar_chart',
  'cashflow_comparison',
  'allocation_chart',
  'comparison_card',
  'debt_table',
]);

function widgetSignature(widget: AIWidgetData): string {
  if (widget.type === 'balance_summary_card') {
    const accountKey =
      ('account_name' in widget && typeof widget.account_name === 'string'
        ? widget.account_name
        : '') ||
      ('account_id' in widget && typeof widget.account_id === 'string' ? widget.account_id : '') ||
      widget.variant ||
      '';
    return `${widget.type}:${widget.label}:${accountKey}`;
  }
  return `${widget.type}:${'label' in widget && typeof widget.label === 'string' ? widget.label : ''}`;
}

export function enrichAssistantBlocksWithContextWidgets(
  blocks: MessageBlock[],
  question: string,
  context: FynFinancialContext,
  rfa: FinancialSummaryAnonymous,
): MessageBlock[] {
  const contextWidgets = buildContextChartWidgets(question, context, rfa);
  if (contextWidgets.length === 0) return blocks;

  const existing = new Set(
    blocks
      .filter((block): block is AIWidgetData => block.type !== 'text')
      .map((block) => widgetSignature(block)),
  );

  const hasBalanceWidget = blocks.some((block) => block.type === 'balance_summary_card');
  const hasChartWidget = blocks.some(
    (block) => block.type !== 'text' && CHART_WIDGET_TYPES.has(block.type),
  );

  const toAdd = contextWidgets.filter((widget) => {
    if (existing.has(widgetSignature(widget))) return false;
    // Model already shipped balance cards — do not append a second local set.
    if (widget.type === 'balance_summary_card' && hasBalanceWidget) return false;
    if (hasChartWidget && CHART_WIDGET_TYPES.has(widget.type) && widget.type !== 'debt_table') {
      return false;
    }
    return true;
  });

  if (toAdd.length === 0) return blocks;

  const textBlocks = blocks.filter((block) => block.type === 'text');
  const widgetBlocks = blocks.filter((block) => block.type !== 'text');
  return [...textBlocks, ...widgetBlocks, ...toAdd];
}
