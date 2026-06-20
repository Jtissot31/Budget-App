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

export type AIWidgetData =
  | ProgressCardData
  | DebtTableData
  | ComparisonCardData
  | AlertCardData;

export type TextBlock = { type: 'text'; content: string };

export type MessageBlock = TextBlock | AIWidgetData;

export const AI_WIDGET_TYPES = [
  'progress_card',
  'debt_table',
  'comparison_card',
  'alert_card',
] as const;

export type AIWidgetType = (typeof AI_WIDGET_TYPES)[number];
