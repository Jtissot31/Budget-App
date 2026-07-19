import { formatDisplayMoneyAbsolute, formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import type { BarChartData, CashflowComparisonData } from '@/types/aiWidgets';

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isIncomeLabel(label: string): boolean {
  const normalized = normalizeLabel(label);
  return /\b(revenu|revenus|income|salaire|net)\b/.test(normalized);
}

function isExpenseLabel(label: string): boolean {
  const normalized = normalizeLabel(label);
  return /\b(depense|depenses|expense|expenses|sortie|sorties)\b/.test(normalized);
}

function isCashflowComparisonLabel(label: string): boolean {
  const normalized = normalizeLabel(label);
  return /\b(revenu|depense|cashflow|flux)\b/.test(normalized);
}

/** Coerce income/expense amounts to a finite non-negative number (native-safe). */
export function sanitizeCashflowAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** Surplus may be negative (deficit); recompute when missing or invalid. */
export function sanitizeCashflowSurplus(value: unknown, income: number, expenses: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return income - expenses;
}

export function buildCashflowResultCaption(surplus: number): string {
  const safeSurplus = Number.isFinite(surplus) ? surplus : 0;
  const amount = formatDisplayMoneyAbsoluteExact(Math.abs(safeSurplus));
  if (safeSurplus >= 0) {
    return `Surplus moyen de ${amount} par mois`;
  }
  return `Déficit moyen de ${amount} par mois`;
}

/** Plain-language headline — no jargon, no repeated dollar amount. */
export function buildCashflowInsightMessage(income: number, expenses: number, surplus: number): string {
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  const safeSurplus = Number.isFinite(surplus) ? surplus : safeIncome - safeExpenses;

  if (safeIncome === 0 && safeExpenses === 0) {
    return 'Pas encore assez de données pour comparer';
  }
  if (Math.abs(safeSurplus) < 1) {
    return 'Tes revenus et tes dépenses s\u2019équilibrent';
  }
  if (safeSurplus > 0) {
    const relativeGap = safeIncome > 0 ? safeSurplus / safeIncome : 1;
    if (relativeGap < 0.05) {
      return 'Tu gardes un peu plus que tu dépenses';
    }
    return 'Tu gagnes plus que tu dépenses';
  }

  const gap = Math.abs(safeSurplus);
  const relativeGap = safeIncome > 0 ? gap / safeIncome : 1;
  if (relativeGap < 0.05 || gap < 50) {
    return 'Tu dépenses un peu plus que tu gagnes';
  }
  return 'Tes dépenses dépassent tes revenus';
}

/** Discrete hero label above the signed surplus/deficit amount. */
export function buildCashflowHeroLabel(surplus: number): string {
  const safeSurplus = Number.isFinite(surplus) ? surplus : 0;
  if (Math.abs(safeSurplus) < 1) {
    return 'Équilibre mensuel moyen';
  }
  if (safeSurplus > 0) {
    return 'Surplus mensuel moyen';
  }
  return 'Déficit mensuel moyen';
}

/** Card eyebrow — single title line without parenthetical qualifiers. */
export function buildCashflowShellLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Revenus vs dépenses';
  if (isCashflowComparisonLabel(trimmed)) {
    return 'Revenus vs dépenses';
  }
  return trimmed.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || trimmed;
}

/**
 * Footer caption — period context; when gross gap ≠ displayed surplus, note the brut écart
 * (ex. moyenne −11,40 $ vs 2 037 $ − 2 049 $ = 12 $).
 */
export function buildCashflowFootnote(
  income: number,
  expenses: number,
  surplus: number,
  period?: string,
): string {
  const trimmedPeriod = period?.trim() || 'Moyenne mensuelle';
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  const safeSurplus = Number.isFinite(surplus) ? surplus : safeIncome - safeExpenses;
  const grossGap = safeExpenses - safeIncome;

  if (Math.abs(grossGap) >= 1) {
    const magnitudeDelta = Math.abs(Math.abs(grossGap) - Math.abs(safeSurplus));
    if (magnitudeDelta >= 0.5) {
      const grossLabel = formatDisplayMoneyAbsoluteExact(Math.abs(grossGap));
      return `${trimmedPeriod} · écart brut ${grossLabel}`;
    }
  }

  return trimmedPeriod;
}

/** Flex weights for the stacked income / overflow / surplus bar (Android-safe). */
export type CashflowStackedBarWeights = {
  incomeGreen: number;
  overflowRed: number;
  surplusGreen: number;
};

export function cashflowStackedBarFlexWeights(
  income: number,
  expenses: number,
): CashflowStackedBarWeights {
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);

  if (safeIncome === 0 && safeExpenses === 0) {
    return { incomeGreen: 0, overflowRed: 0, surplusGreen: 0 };
  }

  if (safeExpenses > safeIncome + 0.5) {
    return {
      incomeGreen: safeIncome,
      overflowRed: safeExpenses - safeIncome,
      surplusGreen: 0,
    };
  }

  if (safeIncome > safeExpenses + 0.5) {
    return {
      incomeGreen: safeExpenses,
      overflowRed: 0,
      surplusGreen: safeIncome - safeExpenses,
    };
  }

  return {
    incomeGreen: Math.max(safeIncome, safeExpenses),
    overflowRed: 0,
    surplusGreen: 0,
  };
}

/**
 * Honest bar scale: value / max(income, expenses).
 * Keeps near-parity pairs (ex. 2037 vs 2049) visually aligned — no gap zoom.
 */
export function cashflowHonestBarFraction(value: number, income: number, expenses: number): number {
  const safeValue = sanitizeCashflowAmount(value);
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  const max = Math.max(safeIncome, safeExpenses);
  if (max <= 0) return 0;
  const fraction = safeValue / max;
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
}

/** Vertical bar height from {@link cashflowHonestBarFraction}. */
export function cashflowVerticalBarHeight(
  value: number,
  income: number,
  expenses: number,
  chartHeight: number,
): number {
  const safeChartHeight = Number.isFinite(chartHeight) && chartHeight > 0 ? chartHeight : 120;
  if (!Number.isFinite(value)) return 0;
  const fraction = cashflowHonestBarFraction(value, income, expenses);
  if (fraction <= 0) return 0;
  const height = fraction * safeChartHeight;
  return Math.max(0, Math.min(safeChartHeight, height));
}

/** Min overflow cap height — visual affordance for near-parity gaps; amount label stays honest. */
export const CASHFLOW_OVERFLOW_CAP_MIN_PX = 22;

/** Gap between overflow cap and shared base bar in split columns. */
export const CASHFLOW_BAR_STACK_GAP_PX = 2;

export type CashflowComparisonColumnHeights = {
  incomeTotal: number;
  expenseTotal: number;
  sharedBase: number;
  overflowCap: number;
  stackGap: number;
  isDeficit: boolean;
  isSurplus: boolean;
};

/**
 * Column heights for the vertical bar pair.
 * Deficit/surplus modes split at sharedBase and add a readable overflow cap so the taller
 * side wins visually even when honest scale makes near-parity pairs almost equal (2037 vs 2049).
 */
export function cashflowComparisonColumnHeights(
  income: number,
  expenses: number,
  chartHeight: number,
): CashflowComparisonColumnHeights {
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  const isDeficit = safeExpenses > safeIncome + 0.5;
  const isSurplus = safeIncome > safeExpenses + 0.5;
  const sharedBase = cashflowSharedBaseHeight(safeIncome, safeExpenses, chartHeight);
  const overflowCap =
    isDeficit || isSurplus
      ? cashflowOverflowCapHeight(safeIncome, safeExpenses, chartHeight)
      : 0;
  const stackGap = overflowCap > 0 ? CASHFLOW_BAR_STACK_GAP_PX : 0;

  if (isDeficit) {
    return {
      incomeTotal: sharedBase,
      expenseTotal: sharedBase + stackGap + overflowCap,
      sharedBase,
      overflowCap,
      stackGap,
      isDeficit,
      isSurplus,
    };
  }

  if (isSurplus) {
    return {
      incomeTotal: sharedBase + stackGap + overflowCap,
      expenseTotal: sharedBase,
      sharedBase,
      overflowCap,
      stackGap,
      isDeficit,
      isSurplus,
    };
  }

  return {
    incomeTotal: cashflowVerticalBarHeight(safeIncome, safeIncome, safeExpenses, chartHeight),
    expenseTotal: cashflowVerticalBarHeight(safeExpenses, safeIncome, safeExpenses, chartHeight),
    sharedBase,
    overflowCap: 0,
    stackGap: 0,
    isDeficit,
    isSurplus,
  };
}

/** Honest overflow slice height (|expenses − income| on max scale). */
export function cashflowHonestOverflowHeight(
  income: number,
  expenses: number,
  chartHeight: number,
): number {
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  const gap = Math.abs(safeExpenses - safeIncome);
  if (gap < 1) return 0;
  return cashflowVerticalBarHeight(gap, safeIncome, safeExpenses, chartHeight);
}

/**
 * Overflow cap height — honest scale with a readable minimum when gap ≥ 1$.
 * Makes near-parity deficits (ex. 12$ on 2 049$) visible without distorting base bars.
 */
export function cashflowOverflowCapHeight(
  income: number,
  expenses: number,
  chartHeight: number,
  minCapPx = CASHFLOW_OVERFLOW_CAP_MIN_PX,
): number {
  const honest = cashflowHonestOverflowHeight(income, expenses, chartHeight);
  if (honest <= 0) return 0;
  return Math.max(honest, minCapPx);
}

/** Shared baseline height = min(income, expenses) on honest max scale. */
export function cashflowSharedBaseHeight(
  income: number,
  expenses: number,
  chartHeight: number,
): number {
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  return cashflowVerticalBarHeight(
    Math.min(safeIncome, safeExpenses),
    safeIncome,
    safeExpenses,
    chartHeight,
  );
}

/** fr-CA amount with a space before `$` — matches cashflow mockups (`2 037 $`). */
export function formatCashflowSpacedAmount(absValue: number): string {
  return formatDisplayMoneyAbsoluteExact(absValue).replace(/\$$/, ' $');
}

/** Whole-dollar bar label — no cents (`2 037 $`). */
export function formatCashflowWholeSpacedAmount(absValue: number): string {
  const abs = Math.abs(Number.isFinite(absValue) ? absValue : 0);
  return formatDisplayMoneyAbsolute(Math.round(abs)).replace(/\$$/, ' $');
}

/** Parse a fr-CA money label (`2 037,38 $`) into a number. */
export function parseCashflowMoneyLabel(label: string): number | null {
  const stripped = label.replace(/^[+−-]\s*/, '').replace(/\s*\$/g, '').trim();
  if (!stripped) return null;
  const normalized = stripped.replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Hero surplus/deficit — signed, spaced `$` (ex. `−12 $`, `−11,40 $`, `+800 $`). */
export function formatCashflowHeroAmount(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const hasFractionalCents = Math.abs(abs - Math.round(abs)) > 0.004;
  const magnitude =
    hasFractionalCents && abs < 100
      ? formatCashflowSpacedAmount(abs)
      : formatCashflowWholeSpacedAmount(abs);
  if (Math.abs(safe) < 1) return magnitude;
  if (safe > 0) return `+${magnitude}`;
  return `−${magnitude}`;
}

/** Bar amount above columns — income `+`, expenses `−`, whole dollars only. */
export function formatCashflowBarAmountLabel(amount: number, kind: 'income' | 'expense'): string {
  const magnitude = formatCashflowWholeSpacedAmount(sanitizeCashflowAmount(amount));
  return kind === 'income' ? `+${magnitude}` : `−${magnitude}`;
}

/** Period line under the chart — capitalizes first letter when provided. */
export function buildCashflowPeriodLabel(period?: string): string {
  const trimmed = period?.trim() || 'Moyenne mensuelle';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Apply signed bar prefix — normalizes API labels to whole-dollar bar format. */
export function withCashflowBarSignedLabel(label: string, kind: 'income' | 'expense'): string {
  const parsed = parseCashflowMoneyLabel(label);
  if (parsed !== null) {
    return formatCashflowBarAmountLabel(parsed, kind);
  }
  const stripped = label.replace(/^[+−-]\s*/, '').trim();
  return kind === 'income' ? `+${stripped}` : `−${stripped}`;
}

/** Compact cap label for overflow zone — ex. « +12,00$ ». */
export function buildCashflowOverflowCapLabel(income: number, expenses: number): string | null {
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  const barGap = safeExpenses - safeIncome;
  if (Math.abs(barGap) < 1) return null;
  const amount = formatDisplayMoneyAbsoluteExact(Math.abs(barGap));
  return `+${amount}`;
}

/**
 * Inline gap copy below the bar pair — always derived from displayed income vs expenses
 * (expenses − income), not from a separately supplied surplus field.
 */
export function buildCashflowGapChipLabel(income: number, expenses: number): string {
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);
  const barGap = safeExpenses - safeIncome;

  if (safeIncome === 0 && safeExpenses === 0) {
    return 'Pas encore de montants à comparer';
  }
  if (Math.abs(barGap) < 1) {
    return 'Revenus et dépenses à égalité';
  }

  const gap = formatDisplayMoneyAbsoluteExact(Math.abs(barGap));
  if (barGap > 0) {
    return `${gap} de dépenses en plus`;
  }
  return `${gap} de revenus en plus`;
}

export type CashflowBarRank = 'higher' | 'lower' | 'equal';

export function cashflowBarRank(value: number, other: number): CashflowBarRank {
  const safeValue = sanitizeCashflowAmount(value);
  const safeOther = sanitizeCashflowAmount(other);
  if (Math.abs(safeValue - safeOther) < 1) return 'equal';
  return safeValue > safeOther ? 'higher' : 'lower';
}

/**
 * Bar width 0–1; zooms to [min,max] so small gaps stay visible.
 * @deprecated Prefer {@link cashflowHonestBarFraction} for user-facing comparisons.
 */
export function cashflowCompareBarFraction(value: number, income: number, expenses: number): number {
  const safeValue = sanitizeCashflowAmount(value);
  const safeIncome = sanitizeCashflowAmount(income);
  const safeExpenses = sanitizeCashflowAmount(expenses);

  const lo = Math.min(safeIncome, safeExpenses);
  const hi = Math.max(safeIncome, safeExpenses);
  if (hi <= 0) return 0.08;
  if (Math.abs(hi - lo) < 1e-6) return 1;

  const span = hi - lo;
  const normalized = (safeValue - lo) / span;
  if (safeValue <= lo) return 0.15;

  const fraction = Math.min(1, Math.max(0.15, normalized));
  return Number.isFinite(fraction) ? fraction : 0.15;
}

/** Flex weights for horizontal bars — avoids percentage width strings on Android Yoga. */
export function cashflowBarFlexWeights(fraction: number): { fill: number; empty: number } {
  const safe = Number.isFinite(fraction) ? Math.min(1, Math.max(0.01, fraction)) : 0.15;
  return { fill: safe, empty: Math.max(0.01, 1 - safe) };
}

/** Percent width 0–100 — clamped for safe layout (legacy helper / tests). */
export function cashflowBarWidthPercent(fraction: number): number {
  if (!Number.isFinite(fraction)) return 15;
  return Math.round(Math.min(100, Math.max(0, fraction * 100)) * 10) / 10;
}

export function normalizeCashflowComparisonData(
  data: CashflowComparisonData,
): CashflowComparisonData | null {
  if (typeof data.label !== 'string' || !data.label.trim()) return null;

  const income = sanitizeCashflowAmount(data.income);
  const expenses = sanitizeCashflowAmount(data.expenses);
  /** Preserve API net surplus when supplied; bars still use gross income/expense amounts. */
  const surplus = sanitizeCashflowSurplus(data.surplus, income, expenses);

  return {
    ...data,
    income,
    expenses,
    surplus,
    caption: data.caption ?? buildCashflowResultCaption(surplus),
  };
}

/** Detect AI-generated bar_chart payloads for revenus vs dépenses and upgrade them. */
export function normalizeBarChartToCashflowComparison(data: BarChartData): CashflowComparisonData | null {
  if (!Array.isArray(data.items) || data.items.length !== 2) return null;

  const labelLooksLikeCashflow =
    isCashflowComparisonLabel(data.label) ||
    data.items.some((item) => isIncomeLabel(item.label) || isExpenseLabel(item.label));

  if (!labelLooksLikeCashflow) return null;

  let incomeItem: BarChartData['items'][number] | null = null;
  let expenseItem: BarChartData['items'][number] | null = null;

  for (const item of data.items) {
    if (isIncomeLabel(item.label)) incomeItem = item;
    if (isExpenseLabel(item.label)) expenseItem = item;
  }

  if (!incomeItem || !expenseItem) return null;

  const income = sanitizeCashflowAmount(incomeItem.value);
  const expenses = sanitizeCashflowAmount(expenseItem.value);
  const surplus = income - expenses;

  return normalizeCashflowComparisonData({
    type: 'cashflow_comparison',
    label: data.label,
    income,
    expenses,
    income_label: incomeItem.value_label,
    expenses_label: expenseItem.value_label,
    surplus,
    caption: data.caption ?? buildCashflowResultCaption(surplus),
  });
}
