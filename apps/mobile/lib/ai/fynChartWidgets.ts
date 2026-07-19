import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import { filterRfaDebtsEligibleForAcceleratedPlan } from '@/lib/plans/debtPlanEligibility';
import type {
  AIWidgetData,
  AllocationChartData,
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
  | 'merchant_spend';


function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
  if (/\b(dette|dettes|rembours|hypotheque|carte|credit)\b/.test(normalized)) {
    intents.push('debts');
  }
  if (/\b(combien|total).*\bchez\b/.test(normalized)) {
    intents.push('merchant_spend');
  }

  return [...new Set(intents)];
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

  const hasChartWidget = blocks.some(
    (block) => block.type !== 'text' && CHART_WIDGET_TYPES.has(block.type),
  );

  const toAdd = contextWidgets.filter((widget) => {
    if (existing.has(widgetSignature(widget))) return false;
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
