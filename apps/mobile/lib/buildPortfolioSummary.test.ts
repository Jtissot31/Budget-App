/**
 * « Placements » total = stock holdings + biens matériels, and the variation shown under
 * that total must name the scope it was actually measured on.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/buildPortfolioSummary.test.ts
 */

import assert from 'node:assert/strict';
import {
  buildPortfolioSummary,
  portfolioVariationLabel,
  wealthAssetsGainPercent,
} from './buildPortfolioSummary';
import type { MockStockHolding } from '@/constants/mockStockPortfolio';
import type { Loan, WealthAsset } from '@/types';

function holding(
  ticker: string,
  shares: number,
  pricePerShare: number,
  dayChangePercent: number,
): MockStockHolding {
  return { id: `h-${ticker}`, ticker, companyName: ticker, shares, pricePerShare, dayChangePercent };
}

function asset(overrides: Partial<WealthAsset> & { id: string; currentValue: number }): WealthAsset {
  return {
    type: 'precious_material',
    name: overrides.name ?? overrides.id,
    purchaseCost: 0,
    valuationSource: 'manual',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function mortgage(id: string, balanceRemaining: number): Loan {
  return {
    id,
    type: 'mortgage',
    name: 'Hypothèque',
    lender: 'Banque',
    principal: balanceRemaining,
    balanceRemaining,
    interestRate: 4.5,
    monthlyPayment: 1800,
    startDate: '2020-01-01',
    endDate: '2045-01-01',
    durationAmount: 25,
    durationUnit: 'years',
    paymentFrequency: 'monthly',
    paymentAccountId: 'acct-1',
    nextPaymentDate: '2026-09-01',
    createdAt: '2020-01-01',
  };
}

const noLoans: ReadonlyMap<string, Loan> = new Map();

const stocks = [holding('AAPL', 10, 200, 1.5), holding('XEQT', 100, 30, -0.5)];
// 10 × 200 = 2000 @ +1.5 %, 100 × 30 = 3000 @ −0.5 % → 5000 total, weighted +0.30 %.
const stocksTotal = 5000;
const stocksDayPct = 0.3;

const wealth = [
  asset({ id: 'gold', currentValue: 12_000, purchaseCost: 10_000 }),
  asset({ id: 'condo', type: 'real_estate', currentValue: 400_000, purchaseCost: 400_000 }),
];
const wealthTotal = 412_000;

// --- Case 1: stocks only ---
const stocksOnly = buildPortfolioSummary(stocks, [], noLoans);
assert.equal(stocksOnly.stocksTotal, stocksTotal);
assert.equal(stocksOnly.wealthTotal, 0);
assert.equal(stocksOnly.total, stocksTotal);
assert.equal(stocksOnly.hasStocks, true);
assert.equal(stocksOnly.hasWealth, false);
assert.equal(stocksOnly.isEmpty, false);
assert.equal(stocksOnly.variation?.basis, 'stocks_day');
assert.ok(Math.abs((stocksOnly.variation?.percent ?? 0) - stocksDayPct) < 1e-9);
// Nothing unquoted in the total → no need to scope the day change.
assert.equal(
  stocksOnly.variation?.basis === 'stocks_day' && stocksOnly.variation.scopedToStocks,
  false,
);
assert.equal(portfolioVariationLabel(stocksOnly.variation), "+0,30 % aujourd'hui");

// --- Case 2: wealth assets only ---
const wealthOnly = buildPortfolioSummary([], wealth, noLoans);
assert.equal(wealthOnly.stocksTotal, 0);
assert.equal(wealthOnly.wealthTotal, wealthTotal);
assert.equal(wealthOnly.total, wealthTotal);
assert.equal(wealthOnly.hasStocks, false);
assert.equal(wealthOnly.hasWealth, true);
assert.equal(wealthOnly.isEmpty, false);
// No daily quote exists for biens matériels — the only honest history is vs purchase cost.
assert.equal(wealthOnly.variation?.basis, 'wealth_since_purchase');
// Gold +20 % on 12 000 alongside a flat 400 000 condo → value-weighted +0,58 %.
assert.equal(portfolioVariationLabel(wealthOnly.variation), "+0,58 % depuis l'achat");

// --- Case 3: both sides — the bug this helper exists for ---
const both = buildPortfolioSummary(stocks, wealth, noLoans);
assert.equal(both.total, stocksTotal + wealthTotal);
// The old either-or behaviour under-reported by the whole other side.
assert.notEqual(both.total, stocksTotal);
assert.notEqual(both.total, wealthTotal);
assert.equal(both.hasStocks, true);
assert.equal(both.hasWealth, true);
// Day change is still measured on stocks only, so the label must say so.
assert.equal(both.variation?.basis, 'stocks_day');
assert.ok(Math.abs((both.variation?.percent ?? 0) - stocksDayPct) < 1e-9);
assert.equal(both.variation?.basis === 'stocks_day' && both.variation.scopedToStocks, true);
assert.equal(portfolioVariationLabel(both.variation), "Actions +0,30 % aujourd'hui");
// The day change is NOT diluted across the combined total: 0.30 % of 5000 spread over
// 417 000 would read ~0.004 %, an invented figure about assets that were never quoted.
assert.notEqual(
  Math.round((both.variation?.percent ?? 0) * 1e4) / 1e4,
  Math.round(((stocksDayPct * stocksTotal) / both.total) * 1e4) / 1e4,
);

// --- Case 4: neither ---
const empty = buildPortfolioSummary([], [], noLoans);
assert.equal(empty.total, 0);
assert.equal(empty.isEmpty, true);
assert.equal(empty.variation, null);
assert.equal(portfolioVariationLabel(empty.variation), null);

// --- Non-finite / zero-value inputs must not leak NaN into the headline ---
const dirty = buildPortfolioSummary(
  [holding('BAD', Number.NaN, 100, 2)],
  [asset({ id: 'unknown', currentValue: Number.NaN })],
  noLoans,
);
assert.equal(dirty.total, 0);
assert.equal(dirty.isEmpty, true);
assert.equal(dirty.variation, null);

// Holdings that exist but are worth nothing count as no stocks (no meaningful day change).
const worthless = buildPortfolioSummary([holding('ZERO', 0, 100, 5)], wealth, noLoans);
assert.equal(worthless.hasStocks, false);
assert.equal(worthless.total, wealthTotal);
assert.equal(worthless.variation?.basis, 'wealth_since_purchase');

// --- Mortgaged real estate contributes net equity, matching Patrimoine tiles ---
const loans = new Map<string, Loan>([['loan-1', mortgage('loan-1', 250_000)]]);
const mortgaged = buildPortfolioSummary(
  stocks,
  [asset({ id: 'house', type: 'real_estate', currentValue: 400_000, linkedLoanId: 'loan-1' })],
  loans,
);
assert.equal(mortgaged.wealthTotal, 150_000);
assert.equal(mortgaged.total, stocksTotal + 150_000);

// --- Variation is null, not a fabricated 0 %, when nothing is measurable ---
const noHistory = buildPortfolioSummary([], [asset({ id: 'ring', currentValue: 8000 })], noLoans);
assert.equal(noHistory.total, 8000);
assert.equal(noHistory.isEmpty, false);
assert.equal(noHistory.variation, null);
assert.equal(portfolioVariationLabel(noHistory.variation), null);

// --- Weighted wealth gain favours the larger asset ---
const weighted = wealthAssetsGainPercent(
  [
    asset({ id: 'small', currentValue: 1000, purchaseCost: 500 }), // +100 %
    asset({ id: 'large', currentValue: 9000, purchaseCost: 9000 }), // 0 %
  ],
  noLoans,
);
assert.ok(weighted != null && Math.abs(weighted - 10) < 1e-9);

// A negative day change stays negative through the label (Unicode minus).
const losing = buildPortfolioSummary([holding('DOWN', 10, 100, -1.25)], wealth, noLoans);
assert.equal(portfolioVariationLabel(losing.variation), "Actions −1,25 % aujourd'hui");

// Footer copy stays short enough for the half-width card's single line.
for (const label of [
  portfolioVariationLabel(stocksOnly.variation),
  portfolioVariationLabel(wealthOnly.variation),
  portfolioVariationLabel(both.variation),
]) {
  assert.ok(label != null && label.length <= 28, `footer too long: ${label}`);
}

console.log('buildPortfolioSummary.test.ts: ok');
