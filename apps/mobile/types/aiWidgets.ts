export type WidgetAction = {
  label: string;
};

export type ProgressCardData = {
  type: 'progress_card';
  label: string;
  /** MaterialCommunityIcons name, e.g. "trending-up" */
  icon?: string;
  value_label: string;
  percent: number;
  percent_label: string;
  status_line?: string;
  actions?: WidgetAction[];
};

export type DebtTableRow = {
  name: string;
  balance: string;
  rate?: string;
  payment?: string;
};

export type DebtTableData = {
  type: 'debt_table';
  label?: string;
  columns?: {
    name?: string;
    balance?: string;
    rate?: string;
    payment?: string;
  };
  rows: DebtTableRow[];
  total: {
    label: string;
    balance: string;
    rate?: string;
    payment?: string;
  };
};

export type ComparisonItem = {
  label: string;
  value: string;
  /** Primary row gets accent highlight when true or when index matches `primary_index`. */
  highlight?: boolean;
};

export type ComparisonCardData = {
  type: 'comparison_card';
  label: string;
  items: ComparisonItem[];
  primary_index?: number;
  footer?: string;
};

export type AlertSeverity = 'info' | 'warning' | 'danger' | 'success';

export type AlertCardData = {
  type: 'alert_card';
  severity: AlertSeverity;
  title: string;
  message: string;
  action?: WidgetAction;
};

export type LineChartData = {
  type: 'line_chart';
  label: string;
  /** Numeric series (min 2 points) — e.g. monthly net worth or spending. */
  data: number[];
  /** Optional formatted value for the latest point. */
  value_label?: string;
  caption?: string;
  /** When false, trend colors treat decrease as positive. */
  positive?: boolean;
};

export type BarChartItem = {
  label: string;
  value: number;
  /** Pre-formatted display value (e.g. "420 $"). Falls back to value.toString(). */
  value_label?: string;
  /** Optional monthly budget limit — enables spent/limit row and utilization bar. */
  limit?: number;
  /** Pre-formatted limit (e.g. "700 $"). Falls back to limit when set. */
  limit_label?: string;
};

export type BarChartData = {
  type: 'bar_chart';
  label: string;
  items: BarChartItem[];
  caption?: string;
  action?: WidgetAction;
};

export type CashflowComparisonData = {
  type: 'cashflow_comparison';
  label: string;
  income: number;
  expenses: number;
  income_label?: string;
  expenses_label?: string;
  /** Net monthly surplus (income − expenses); negative = deficit. */
  surplus: number;
  surplus_label?: string;
  period?: string;
  caption?: string;
};

export type AllocationSegment = {
  label: string;
  value: number;
  percent?: number;
};

export type AllocationChartData = {
  type: 'allocation_chart';
  label: string;
  segments: AllocationSegment[];
  caption?: string;
};

/** Hero balance card — Clean Financial Dashboard « Solde total » pattern. */
export type BalanceSummaryCardData = {
  type: 'balance_summary_card';
  label: string;
  value_label: string;
  /** e.g. « +10 % par rapport au mois dernier » */
  trend_label?: string;
  /** Trend badge color; defaults from trend_label sign when omitted. */
  positive?: boolean;
  action?: WidgetAction;
};

export type AIWidgetData =
  | ProgressCardData
  | DebtTableData
  | ComparisonCardData
  | AlertCardData
  | LineChartData
  | BarChartData
  | CashflowComparisonData
  | AllocationChartData
  | BalanceSummaryCardData;

export type TextBlock = { type: 'text'; content: string };

export type MessageBlock = TextBlock | AIWidgetData;

export const AI_WIDGET_TYPES = [
  'progress_card',
  'debt_table',
  'comparison_card',
  'alert_card',
  'line_chart',
  'bar_chart',
  'cashflow_comparison',
  'allocation_chart',
  'balance_summary_card',
] as const;

export type AIWidgetType = (typeof AI_WIDGET_TYPES)[number];
