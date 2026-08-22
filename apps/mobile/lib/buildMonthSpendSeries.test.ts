/**
 * Shared Y-scale for Analyse dépenses dual-series chart + the single month-to-date
 * spend total behind the Accueil card and the chart.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/buildMonthSpendSeries.test.ts
 */

import assert from 'node:assert/strict';
import {
  buildMonthSpendSummary,
  buildSpendTrendBundle,
  buildWeekSpendSummary,
  buildYearSpendSummary,
  maxSpendSeriesValue,
  monthSpendQueryLowerBound,
  sharedSpendChartYMax,
  startOfWeekMonday,
  startOfYear,
  type MonthSpendTx,
} from './buildMonthSpendSeries';

const current = [0, 120, 400, 904.28];
const prior = [0, 40, 120, 203.26];

assert.equal(maxSpendSeriesValue(current), 904.28);
assert.equal(maxSpendSeriesValue(prior), 203.26);

const yMax = sharedSpendChartYMax([current, prior]);
assert.ok(Math.abs(yMax - 904.28 * 1.08) < 1e-6);

// Heights from a shared domain — 904 must be ~4.45× taller than 203 (not equal peaks).
const innerH = 100;
const height = (v: number) => (Math.min(v, yMax) / yMax) * innerH;
const ratio = height(904.28) / height(203.26);
assert.ok(ratio > 4.3 && ratio < 4.6, `expected ~4.45 ratio, got ${ratio}`);

// Independent 0–1 normalization would force equal heights — shared max must not.
const independentRatio =
  height(maxSpendSeriesValue(current)) / height(maxSpendSeriesValue(current));
assert.equal(independentRatio, 1);
assert.notEqual(Math.round(ratio * 10) / 10, 1);

// Extras (period total) can extend the domain.
assert.ok(sharedSpendChartYMax([[100]], [500]) >= 500 * 1.08 - 1e-6);

// --- buildMonthSpendSummary: the one figure Transactions + Analyse dépenses both show ---

const august = new Date(2026, 7, 1);
const asOfAug10 = new Date(2026, 7, 10, 22, 0, 0);

const ledger: MonthSpendTx[] = [
  { date: '2026-08-01', amount: 400.28, type: 'expense' },
  { date: '2026-08-10T09:15:00', amount: 504, type: 'expense' },
  // Income, transfers and savings contributions are not spending.
  { date: '2026-08-05', amount: 3200, type: 'income' },
  { date: '2026-08-06', amount: 750, type: 'transfer' },
  { date: '2026-08-07', amount: 400, type: 'savings' },
  // Outside the selected month on both sides.
  { date: '2026-07-31', amount: 88, type: 'expense' },
  { date: '2026-09-01', amount: 99, type: 'expense' },
  // Later in August than as-of — must not count toward month-to-date.
  { date: '2026-08-20', amount: 260, type: 'expense' },
];

const summary = buildMonthSpendSummary(ledger, august, asOfAug10);

// Expenses only: 400.28 + 504 (transfers/savings/income excluded).
assert.equal(Math.round(summary.total * 100) / 100, 904.28);
assert.equal(summary.series.length, 31);
assert.equal(summary.activeIndex, 9);

// Month boundary: neither July 31 nor September 1 leaks in.
assert.equal(summary.series[0], 400.28);
assert.equal(summary.series[summary.series.length - 1], 904.28);

// Amounts are magnitudes — a negative-signed expense counts the same.
const signedSummary = buildMonthSpendSummary(
  [{ date: '2026-08-03', amount: -125.5, type: 'expense' }],
  august,
  asOfAug10,
);
assert.equal(signedSummary.total, 125.5);

// Card and chart call the same helper with the same month: totals must match, and the
// card's headline must be the spend — not budget minus spend, which is what drifted.
const cardTotal = buildMonthSpendSummary(ledger, august, asOfAug10).total;
const chartTotal = buildMonthSpendSummary(ledger, august, asOfAug10).total;
assert.equal(cardTotal, chartTotal);
const monthlyBudgetLimit = 2710;
assert.notEqual(monthlyBudgetLimit - cardTotal, chartTotal);

// Past month: as-of past month end includes the whole month.
const july = new Date(2026, 6, 1);
const julySummary = buildMonthSpendSummary(ledger, july, asOfAug10);
assert.equal(julySummary.total, 88);
assert.equal(julySummary.activeIndex, 30);

// Query lower bound is a bare YYYY-MM-DD that sorts before every August row shape.
const bound = monthSpendQueryLowerBound(august);
assert.equal(bound, '2026-07-31');
assert.ok('2026-08-01' >= bound);
assert.ok('2026-08-01T04:00:00.000Z' >= bound);
assert.ok('2026-07-31T22:00:00.000Z' >= bound);
assert.ok(!('2026-07-30' >= bound));

// --- Week / year trend bundles (Analyse dépenses 1S / 1A) ---

// 2026-08-10 is a Monday → week Mon 10 – Sun 16 Aug.
const weekStart = startOfWeekMonday(asOfAug10);
assert.equal(weekStart.getFullYear(), 2026);
assert.equal(weekStart.getMonth(), 7);
assert.equal(weekStart.getDate(), 10);

const weekSummary = buildWeekSpendSummary(ledger, weekStart, asOfAug10);
assert.equal(weekSummary.series.length, 7);
assert.equal(weekSummary.activeIndex, 0);
assert.equal(weekSummary.total, 504);

const weekBundle = buildSpendTrendBundle(ledger, 'week', weekStart, asOfAug10);
assert.equal(weekBundle.summary.total, 504);
assert.equal(weekBundle.comparisonSeries.length, 7);

const yearSummary = buildYearSpendSummary(ledger, startOfYear(asOfAug10), asOfAug10);
assert.equal(yearSummary.series.length, 12);
assert.equal(yearSummary.activeIndex, 7);
// July 88 + August MTD 904.28
assert.equal(Math.round(yearSummary.total * 100) / 100, 992.28);

const yearBundle = buildSpendTrendBundle(ledger, 'year', startOfYear(asOfAug10), asOfAug10);
assert.equal(yearBundle.comparisonSeries.length, 12);

const monthBundle = buildSpendTrendBundle(ledger, 'month', august, asOfAug10);
assert.equal(Math.round(monthBundle.summary.total * 100) / 100, 904.28);
assert.equal(monthBundle.comparisonSeries.length, 31);

console.log('buildMonthSpendSeries.test.ts: ok');
