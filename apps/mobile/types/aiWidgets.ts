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

/**
 * Hero balance card — aggregate « Solde total » or a specific account’s solde
 * when the user asks for one of their accounts.
 */
export type BalanceSummaryCardData = {
  type: 'balance_summary_card';
  /**
   * Eyebrow label.
   * - total: typically « Solde total »
   * - account: typically « Solde » (account name is shown separately)
   */
  label: string;
  value_label: string;
  /** e.g. « +10 % par rapport au mois dernier » — omit when not available for that account. */
  trend_label?: string;
  /** Trend badge color; defaults from trend_label sign when omitted. */
  positive?: boolean;
  action?: WidgetAction;
  /**
   * `account` when answering a single-account balance ask.
   * Inferred as `account` when `account_id` or `account_name` is present.
   */
  variant?: 'total' | 'account';
  /** Deep-link target for account detail (preferred when known). */
  account_id?: string;
  /** Account display name — primary identity for the account variant. */
  account_name?: string;
  account_institution?: string;
  account_last4?: string;
  /** cheque | epargne | credit | cash | checking | savings */
  account_kind?: string;
  /**
   * Optional institution logo URL. When omitted, resolved from
   * `account_institution` / `account_name` via `getAccountLogoUrl`.
   */
  account_logo_url?: string;
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
