import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import {
  MOCK_STOCK_HOLDINGS,
  type MockStockHolding,
  mockStockPortfolioTotalValue,
} from '@/constants/mockStockPortfolio';
import { generateIntradaySparkline } from '@/lib/intradayStockSparkline';

/** Enough daily samples for 10A window (3650) with headroom. */
export const PATRIMOINE_MOCK_DAILY_POINT_COUNT = 3700;

const DAY_LABELS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

/** Amplified daily volatility per ticker — stock-like zigzag, not smooth real-estate drift. */
const TICKER_DAILY_VOL: Record<string, number> = {
  'NVDA': 0.048,
  'SHOP': 0.042,
  'AAPL': 0.034,
  'MSFT': 0.03,
  'VFV.TO': 0.024,
  'XEQT': 0.02,
};

const DEFAULT_DAILY_VOL = 0.028;
/** Shared market factor — correlates holdings on the same day. */
const MARKET_DAILY_VOL = 0.018;

function hashNoise(seed: string, index: number): number {
  let hash = 2166136261;
  const input = `${seed}:${index}`;
  for (let charIndex = 0; charIndex < input.length; charIndex += 1) {
    hash ^= input.charCodeAt(charIndex);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

function holdingDailyVol(holding: MockStockHolding): number {
  return TICKER_DAILY_VOL[holding.ticker] ?? DEFAULT_DAILY_VOL;
}

function dayLabelFr(date: Date, isToday: boolean): string {
  if (isToday) return 'AUJ';
  return DAY_LABELS_FR[date.getDay()] ?? '???';
}

/**
 * Reconstructs daily share prices backward from today.
 * Recent window follows intraday sparkline ratios; older days compound volatile daily returns.
 */
function buildHoldingDailyPrices(holding: MockStockHolding, dayCount: number, now: Date): number[] {
  const prices = new Array<number>(dayCount);
  const spark = generateIntradaySparkline(holding, { now });
  const sparkLen = spark.length;
  const endPrice = holding.pricePerShare;

  prices[dayCount - 1] = endPrice;

  for (let dayIndex = dayCount - 2; dayIndex >= 0; dayIndex -= 1) {
    const daysBeforeEnd = dayCount - 1 - dayIndex;

    if (daysBeforeEnd < sparkLen) {
      const sparkIndex = sparkLen - 1 - daysBeforeEnd;
      const prevSparkIndex = sparkIndex - 1;
      const sparkPrice = spark[sparkIndex];
      if (prevSparkIndex >= 0 && sparkPrice > 0) {
        prices[dayIndex] = prices[dayIndex + 1] * (spark[prevSparkIndex] / sparkPrice);
        continue;
      }
    }

    const vol = holdingDailyVol(holding);
    const marketMove = hashNoise('__market__', dayIndex) * MARKET_DAILY_VOL;
    const idioMove = hashNoise(holding.ticker, dayIndex) * vol;
    const spike =
      Math.abs(hashNoise(`${holding.ticker}:spike`, dayIndex)) > 0.86
        ? hashNoise(`${holding.ticker}:spike-dir`, dayIndex) * vol * 2.1
        : 0;
    const trendBias = (holding.dayChangePercent / 100) * 0.22;
    const dailyReturn = marketMove + idioMove + spike + trendBias;
    prices[dayIndex] = prices[dayIndex + 1] / (1 + dailyReturn);
  }

  return prices;
}

/**
 * Builds a dense daily patrimoine series from the mock stock portfolio.
 * Each point is the sum of (shares × reconstructed price) across all holdings.
 */
export function buildPatrimoineTrendFromMockStocks(
  holdings: readonly MockStockHolding[] = MOCK_STOCK_HOLDINGS,
  dayCount: number = PATRIMOINE_MOCK_DAILY_POINT_COUNT,
  now: Date = new Date(),
): NetWorthTrendPoint[] {
  if (holdings.length === 0 || dayCount <= 0) {
    return [];
  }

  const holdingPrices = holdings.map((holding) => buildHoldingDailyPrices(holding, dayCount, now));
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const date = new Date(todayMs);
    date.setDate(date.getDate() - (dayCount - 1 - dayIndex));

    let total = 0;
    for (let holdingIndex = 0; holdingIndex < holdings.length; holdingIndex += 1) {
      total += holdings[holdingIndex].shares * holdingPrices[holdingIndex][dayIndex];
    }

    const isToday = dayIndex === dayCount - 1;
    return {
      label: dayLabelFr(date, isToday),
      value: total,
    };
  });
}

/** Current patrimoine hero total — mock portfolio mark-to-market. */
export function getCurrentPatrimoineTotalFromMockStocks(
  holdings: readonly MockStockHolding[] = MOCK_STOCK_HOLDINGS,
): number {
  return mockStockPortfolioTotalValue(holdings);
}
