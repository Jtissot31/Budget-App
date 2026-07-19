/**
 * Cashflow widget edge cases (zero income/expenses, NaN, bar fractions).
 * Run: npx --yes tsx --tsconfig tsconfig.json components/chat/widgets/cashflowWidgetUtils.test.ts
 */
import assert from 'node:assert/strict';
import type { BarChartData, CashflowComparisonData } from '@/types/aiWidgets';
import {
  buildCashflowFootnote,
  buildCashflowGapChipLabel,
  buildCashflowHeroLabel,
  buildCashflowInsightMessage,
  buildCashflowOverflowCapLabel,
  buildCashflowPeriodLabel,
  buildCashflowResultCaption,
  buildCashflowShellLabel,
  formatCashflowBarAmountLabel,
  formatCashflowHeroAmount,
  parseCashflowMoneyLabel,
  withCashflowBarSignedLabel,
  cashflowBarFlexWeights,
  cashflowBarRank,
  cashflowBarWidthPercent,
  cashflowCompareBarFraction,
  cashflowComparisonColumnHeights,
  cashflowHonestBarFraction,
  cashflowHonestOverflowHeight,
  cashflowOverflowCapHeight,
  cashflowSharedBaseHeight,
  cashflowStackedBarFlexWeights,
  cashflowVerticalBarHeight,
  normalizeBarChartToCashflowComparison,
  normalizeCashflowComparisonData,
  sanitizeCashflowAmount,
  sanitizeCashflowSurplus,
} from './cashflowWidgetUtils';

assert.equal(sanitizeCashflowAmount(Number.NaN), 0);
assert.equal(sanitizeCashflowAmount(-500), 0);
assert.equal(sanitizeCashflowAmount(2037), 2037);

assert.equal(sanitizeCashflowSurplus(Number.NaN, 3000, 2200), 800);
assert.equal(sanitizeCashflowSurplus(-12, 2037, 2049), -12);

assert.equal(cashflowCompareBarFraction(0, 0, 0), 0.08);
assert.equal(cashflowCompareBarFraction(100, 100, 100), 1);
assert.ok(cashflowCompareBarFraction(2037, 2037, 2049) >= 0.15);
assert.ok(cashflowCompareBarFraction(2049, 2037, 2049) <= 1);
assert.equal(Number.isFinite(cashflowCompareBarFraction(Number.NaN, 100, 200)), true);

assert.equal(cashflowHonestBarFraction(0, 0, 0), 0);
assert.equal(cashflowHonestBarFraction(2049, 2037, 2049), 1);
assert.ok(Math.abs(cashflowHonestBarFraction(2037, 2037, 2049) - 2037 / 2049) < 0.001);
assert.equal(Number.isFinite(cashflowHonestBarFraction(Number.NaN, 100, 200)), true);

const zeroIncomeWeights = cashflowBarFlexWeights(cashflowCompareBarFraction(0, 0, 0));
assert.ok(zeroIncomeWeights.fill > 0 && zeroIncomeWeights.empty > 0);
assert.ok(Math.abs(zeroIncomeWeights.fill + zeroIncomeWeights.empty - 1) < 0.001);

assert.equal(cashflowBarWidthPercent(Number.NaN), 15);
assert.equal(cashflowBarWidthPercent(0.5), 50);

assert.match(buildCashflowResultCaption(800), /Surplus moyen/);
assert.match(buildCashflowResultCaption(-12), /Déficit moyen/);
assert.match(buildCashflowResultCaption(Number.NaN), /Surplus moyen/);

assert.match(buildCashflowInsightMessage(2037, 2049, -12), /un peu plus/);
assert.match(buildCashflowGapChipLabel(2037, 2049), /12\$ de dépenses en plus/);
assert.match(buildCashflowOverflowCapLabel(2037, 2049), /^\+12\$/);
assert.equal(buildCashflowOverflowCapLabel(2000, 2000), null);
assert.match(buildCashflowGapChipLabel(3000, 2200), /revenus en plus/);
assert.match(buildCashflowGapChipLabel(2000, 2000), /égalité/);
assert.match(buildCashflowInsightMessage(3000, 2200, 800), /gagnes plus/);
assert.match(buildCashflowInsightMessage(2000, 2000, 0), /équilibrent/);
assert.match(buildCashflowInsightMessage(0, 0, 0), /Pas encore/);

assert.match(buildCashflowFootnote(2037, 2049, -12), /Moyenne mensuelle/);
assert.doesNotMatch(buildCashflowFootnote(2037, 2049, -12), /écart brut/);
assert.match(buildCashflowFootnote(2037, 2049, -11.4), /écart brut 12\$/);
assert.match(buildCashflowFootnote(2037, 2049, -11.4, 'Jan–Mar 2026'), /Jan–Mar 2026 · écart brut 12\$/);
assert.doesNotMatch(buildCashflowFootnote(2037, 2049, -11.4), /Déficit/);

assert.match(formatCashflowHeroAmount(-12), /^−12 \$?$/);
assert.match(formatCashflowHeroAmount(-11.4), /^−11,40 \$?$/);
assert.match(formatCashflowHeroAmount(800), /^\+800 \$?$/);
assert.match(formatCashflowBarAmountLabel(2037, 'income'), /^\+2[\s\u00A0]037 \$?$/);
assert.match(formatCashflowBarAmountLabel(2037.38, 'income'), /^\+2[\s\u00A0]037 \$?$/);
assert.match(formatCashflowBarAmountLabel(2049, 'expense'), /^−2[\s\u00A0]049 \$?$/);
assert.match(formatCashflowBarAmountLabel(2048.78, 'expense'), /^−2[\s\u00A0]049 \$?$/);
assert.match(withCashflowBarSignedLabel('2 037,00 $', 'income'), /^\+2[\s\u00A0]037 \$?$/);
assert.match(withCashflowBarSignedLabel('2 037,38 $', 'income'), /^\+2[\s\u00A0]037 \$?$/);
assert.equal(parseCashflowMoneyLabel('2 048,78 $'), 2048.78);
assert.equal(buildCashflowPeriodLabel('moyenne 3 mois'), 'Moyenne 3 mois');
assert.equal(buildCashflowPeriodLabel(), 'Moyenne mensuelle');

const stackedDeficit = cashflowStackedBarFlexWeights(2037, 2049);
assert.equal(stackedDeficit.incomeGreen, 2037);
assert.equal(stackedDeficit.overflowRed, 12);
assert.equal(stackedDeficit.surplusGreen, 0);
assert.ok(
  stackedDeficit.overflowRed / (stackedDeficit.incomeGreen + stackedDeficit.overflowRed) < 0.01,
  'overflow slice stays honest for near-parity pairs',
);

const stackedSurplus = cashflowStackedBarFlexWeights(3000, 2200);
assert.equal(stackedSurplus.incomeGreen, 2200);
assert.equal(stackedSurplus.surplusGreen, 800);
assert.equal(stackedSurplus.overflowRed, 0);

const stackedBalanced = cashflowStackedBarFlexWeights(2000, 2000);
assert.equal(stackedBalanced.incomeGreen, 2000);
assert.equal(stackedBalanced.overflowRed, 0);
assert.equal(stackedBalanced.surplusGreen, 0);

assert.equal(buildCashflowShellLabel('Revenus vs dépenses (moyenne mensuelle)'), 'Revenus vs dépenses');
assert.equal(buildCashflowShellLabel('  Budget personnel (Q1)  '), 'Budget personnel');

assert.equal(buildCashflowHeroLabel(-12), 'Déficit mensuel moyen');
assert.equal(buildCashflowHeroLabel(800), 'Surplus mensuel moyen');
assert.equal(buildCashflowHeroLabel(0), 'Équilibre mensuel moyen');
assert.equal(buildCashflowHeroLabel(0.5), 'Équilibre mensuel moyen');

assert.equal(cashflowBarRank(2049, 2037), 'higher');
assert.equal(cashflowBarRank(2037, 2049), 'lower');
assert.equal(cashflowBarRank(2000, 2000), 'equal');

const incomeHeight = cashflowVerticalBarHeight(2037, 2037, 2049, 120);
const expenseHeight = cashflowVerticalBarHeight(2049, 2037, 2049, 120);
const sharedBase = cashflowSharedBaseHeight(2037, 2049, 120);
const honestOverflow = cashflowHonestOverflowHeight(2037, 2049, 120);
const overflowCap = cashflowOverflowCapHeight(2037, 2049, 120);
const columns2037 = cashflowComparisonColumnHeights(2037, 2049, 120);
assert.ok(expenseHeight > incomeHeight);
assert.ok(incomeHeight >= 119 && expenseHeight === 120);
assert.ok(expenseHeight - incomeHeight < 2, 'near-parity bars stay almost equal height');
assert.equal(sharedBase, incomeHeight);
assert.ok(honestOverflow < 2, 'honest overflow slice stays tiny for near-parity pairs');
assert.equal(overflowCap, 22, 'overflow cap uses readable minimum without distorting base scale');
assert.ok(columns2037.isDeficit);
assert.ok(columns2037.expenseTotal > columns2037.incomeTotal, 'deficit column extends above income');
assert.equal(columns2037.incomeTotal, sharedBase);
assert.equal(
  columns2037.expenseTotal,
  sharedBase + columns2037.stackGap + overflowCap,
  'expense total includes stack gap and overflow cap',
);
assert.ok(columns2037.expenseTotal > expenseHeight, 'split column beats honest-only expense bar');
assert.equal(cashflowVerticalBarHeight(Number.NaN, 100, 200, 120), 0);
assert.equal(cashflowVerticalBarHeight(0, 0, 0, 120), 0);

const negativeSurplus: CashflowComparisonData = {
  type: 'cashflow_comparison',
  label: 'Revenus vs dépenses',
  income: 2037,
  expenses: 2049,
  surplus: -12,
};
const normalizedNegative = normalizeCashflowComparisonData(negativeSurplus);
assert.ok(normalizedNegative);
assert.equal(normalizedNegative!.surplus, -12);

const mismatchedSurplus: CashflowComparisonData = {
  type: 'cashflow_comparison',
  label: 'Revenus vs dépenses',
  income: 2037,
  expenses: 2049,
  surplus: -11.4,
};
const normalizedMismatched = normalizeCashflowComparisonData(mismatchedSurplus);
assert.ok(normalizedMismatched);
assert.equal(normalizedMismatched!.surplus, -11.4);
assert.match(buildCashflowGapChipLabel(2037, 2049), /12\$ de dépenses en plus/);
assert.match(normalizedNegative!.caption ?? '', /Déficit moyen/);

const zeroBoth: CashflowComparisonData = {
  type: 'cashflow_comparison',
  label: 'Revenus vs dépenses',
  income: 0,
  expenses: 0,
  surplus: 0,
};
const normalizedZero = normalizeCashflowComparisonData(zeroBoth);
assert.ok(normalizedZero);
assert.equal(normalizedZero!.income, 0);
assert.equal(normalizedZero!.expenses, 0);
assert.equal(normalizedZero!.surplus, 0);

assert.equal(normalizeCashflowComparisonData({ ...zeroBoth, label: '   ' }), null);

const barChart: BarChartData = {
  type: 'bar_chart',
  label: 'Revenus vs dépenses (moyenne mensuelle)',
  items: [
    { label: 'Revenus', value: 3000, value_label: '3 000,00$' },
    { label: 'Dépenses', value: 2200, value_label: '2 200,00$' },
  ],
};
const fromBar = normalizeBarChartToCashflowComparison(barChart);
assert.ok(fromBar);
assert.equal(fromBar!.type, 'cashflow_comparison');
assert.equal(fromBar!.surplus, 800);

const barChartMissingLabels: BarChartData = {
  type: 'bar_chart',
  label: 'Comparaison',
  items: [
    { label: 'Foo', value: 100 },
    { label: 'Bar', value: 50 },
  ],
};
assert.equal(normalizeBarChartToCashflowComparison(barChartMissingLabels), null);

const barChartNaN: BarChartData = {
  type: 'bar_chart',
  label: 'Revenus vs dépenses',
  items: [
    { label: 'Revenus', value: Number.NaN },
    { label: 'Dépenses', value: 2049 },
  ],
};
const fromNaN = normalizeBarChartToCashflowComparison(barChartNaN);
assert.ok(fromNaN);
assert.equal(fromNaN!.income, 0);
assert.equal(fromNaN!.expenses, 2049);
assert.equal(fromNaN!.surplus, -2049);

console.log('cashflowWidgetUtils.test.ts: ok');
