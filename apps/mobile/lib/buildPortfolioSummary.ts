/**
 * Single source of truth for the « Placements » figure: stock holdings market value
 * **plus** patrimoine (biens matériels) display value, so no surface can show one side
 * of the portfolio while calling it the total.
 *
 * Wealth assets only carry a `currentValue` refreshed when a valuation runs — there is
 * no previous close for them, so a *combined* day change is not computable without
 * silently asserting the assets were flat today. The variation therefore stays scoped to
 * what it actually measures, and `scopedToStocks` tells the UI to say so whenever
 * non-quoted value also sits inside the headline total.
 */
import {
  mockStockPortfolioDayChangePercent,
  mockStockPortfolioTotalValue,
  formatStockDayChangePercent,
  type MockStockHolding,
} from '@/constants/mockStockPortfolio';
import {
  getWealthAssetDisplayValue,
  getWealthAssetValueGainPercent,
  sumWealthAssetsDisplayValue,
} from '@/lib/wealthAssetPresentation';
import type { Loan, WealthAsset } from '@/types';

export type PortfolioVariation =
  | {
      /** Value-weighted intraday move of the quoted (boursier) holdings. */
      basis: 'stocks_day';
      percent: number;
      /** True when unquoted wealth value is part of the total, so the label must scope it. */
      scopedToStocks: boolean;
    }
  | {
      /** Value-weighted appreciation vs purchase cost — the only history wealth assets have. */
      basis: 'wealth_since_purchase';
      percent: number;
    };

export type PortfolioSummary = {
  stocksTotal: number;
  wealthTotal: number;
  /** Headline figure — stocks + wealth. */
  total: number;
  hasStocks: boolean;
  hasWealth: boolean;
  isEmpty: boolean;
  /** Null when nothing measurable can be stated about the total's variation. */
  variation: PortfolioVariation | null;
};

export const EMPTY_PORTFOLIO_SUMMARY: PortfolioSummary = {
  stocksTotal: 0,
  wealthTotal: 0,
  total: 0,
  hasStocks: false,
  hasWealth: false,
  isEmpty: true,
  variation: null,
};

function finiteAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function finitePercent(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Value-weighted purchase → current appreciation across wealth assets.
 * Null when no asset has a usable purchase cost (nothing honest to report).
 */
export function wealthAssetsGainPercent(
  assets: readonly WealthAsset[],
  loansById: ReadonlyMap<string, Loan>,
): number | null {
  let weighted = 0;
  let weightSum = 0;
  for (const asset of assets) {
    const gain = getWealthAssetValueGainPercent(asset);
    if (gain == null || !Number.isFinite(gain)) continue;
    const loanId = asset.linkedLoanId?.trim();
    const linkedLoan = loanId ? loansById.get(loanId) ?? null : null;
    const value = finiteAmount(getWealthAssetDisplayValue(asset, linkedLoan));
    if (value <= 0) continue;
    weighted += gain * value;
    weightSum += value;
  }
  if (weightSum <= 0) return null;
  return weighted / weightSum;
}

export function buildPortfolioSummary(
  holdings: readonly MockStockHolding[],
  wealthAssets: readonly WealthAsset[],
  loansById: ReadonlyMap<string, Loan>,
): PortfolioSummary {
  const stocksTotal = finiteAmount(mockStockPortfolioTotalValue(holdings));
  const wealthTotal = finiteAmount(sumWealthAssetsDisplayValue(wealthAssets, loansById));
  const total = stocksTotal + wealthTotal;
  const hasStocks = stocksTotal > 0;
  const hasWealth = wealthTotal > 0;

  let variation: PortfolioVariation | null = null;
  if (hasStocks) {
    variation = {
      basis: 'stocks_day',
      percent: finitePercent(mockStockPortfolioDayChangePercent(holdings)),
      scopedToStocks: hasWealth,
    };
  } else if (hasWealth) {
    const gain = wealthAssetsGainPercent(wealthAssets, loansById);
    if (gain != null) variation = { basis: 'wealth_since_purchase', percent: gain };
  }

  return {
    stocksTotal,
    wealthTotal,
    total,
    hasStocks,
    hasWealth,
    isEmpty: total <= 0,
    variation,
  };
}

/**
 * Footer copy for the variation, always naming its scope and its timeframe.
 * Null when the summary has no variation — the caller shows a neutral caption instead.
 */
export function portfolioVariationLabel(variation: PortfolioVariation | null): string | null {
  if (!variation) return null;
  // One signed fr-CA percent format for both bases so the two footer states of the same
  // card never read as different kinds of number.
  const percent = formatStockDayChangePercent(variation.percent);
  if (variation.basis === 'wealth_since_purchase') return `${percent} depuis l'achat`;
  return variation.scopedToStocks ? `Actions ${percent} aujourd'hui` : `${percent} aujourd'hui`;
}
