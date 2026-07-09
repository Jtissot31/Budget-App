import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import {
  NET_WORTH_FUTURE_MONTH_COUNT,
  NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
} from '@/lib/buildNetWorthTrendSeries';
import { getWealthAssetDisplayValue, sumWealthAssetsDisplayValue } from '@/lib/wealthAssetPresentation';
import type { Loan, WealthAsset } from '@/types';

const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

function monthLabelFr(date: Date): string {
  return MONTH_LABELS_FR[date.getMonth()] ?? '???';
}

function monthAnchorDates(historicalMonthCount: number, futureMonthCount: number, now: Date): Date[] {
  const historical = Array.from({ length: historicalMonthCount }, (_, index) => {
    return new Date(now.getFullYear(), now.getMonth() - (historicalMonthCount - 1 - index), 1);
  });
  const future = Array.from({ length: futureMonthCount }, (_, index) => {
    return new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
  });
  return [...historical, ...future];
}

function parseDateMs(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assetVolatility(asset: WealthAsset): number {
  if (asset.type === 'precious_material') return 0.058;
  if (asset.type === 'real_estate') return 0.02;
  return 0.034;
}

/** Increase visible jaggedness while keeping monthly direction stable. */
const PATRIMOINE_VOLATILITY_MULTIPLIER = 3.4;

function hashNoise(seed: string, index: number): number {
  let hash = 2166136261;
  const input = `${seed}:${index}`;
  for (let charIndex = 0; charIndex < input.length; charIndex += 1) {
    hash ^= input.charCodeAt(charIndex);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * Indicative patrimoine value for one asset at a historical month anchor.
 * Anchors to purchase cost (or ~82% of current) at series start and display value at the current month.
 */
function assetValueAtMonthAnchor(
  asset: WealthAsset,
  linkedLoan: Loan | null,
  anchorIndex: number,
  currentMonthIndex: number,
  anchorEndMs: number,
): number {
  const currentDisplay = getWealthAssetDisplayValue(asset, linkedLoan);
  if (anchorIndex === currentMonthIndex) {
    return currentDisplay;
  }

  const purchaseMs = parseDateMs(asset.purchaseDate);
  if (purchaseMs != null && purchaseMs > anchorEndMs) {
    return 0;
  }

  const current = Math.max(currentDisplay, 0);
  const eps = Math.max(current * 0.045, 30);
  const rawStart =
    typeof asset.purchaseCost === 'number' && asset.purchaseCost > 0 ? asset.purchaseCost : current * 0.82;
  const start = Math.max(rawStart, eps);
  const end = Math.max(current, eps);

  const u = anchorIndex / Math.max(currentMonthIndex, 1);
  const blend = start + (end - start) * u;
  const carrier = Math.sin(Math.PI * u);
  const phaseSeed = hashNoise(asset.id || asset.name || 'asset', currentMonthIndex);
  const highFreq =
    Math.sin(Math.PI * 6 * u + phaseSeed * Math.PI) * 0.78 +
    Math.sin(Math.PI * 12 * u + phaseSeed * Math.PI * 0.35) * 0.46 +
    hashNoise(asset.name || asset.id || 'asset', anchorIndex) * 0.56;
  const amplitude =
    Math.max(end, start) * assetVolatility(asset) * PATRIMOINE_VOLATILITY_MULTIPLIER * carrier;
  const rawWav = amplitude * highFreq;
  const maxDeviation = Math.max(
    Math.max(end, start) * 0.3,
    Math.abs(end - start) * 0.95,
  );
  const wav = Math.max(-maxDeviation, Math.min(maxDeviation, rawWav));
  let value = blend + wav;
  if (anchorIndex === 0) value = start;

  return Math.max(value, eps);
}

/**
 * Builds monthly patrimoine points from off-account wealth assets only (immobilier, métaux précieux).
 * Excludes bank/cash account balances — those belong to the Comptes cash-flow chart.
 */
export function buildPatrimoineTrendFromWealthAssets(
  assets: readonly WealthAsset[],
  loansById: ReadonlyMap<string, Loan>,
  now: Date = new Date(),
  historicalMonthCount: number = NET_WORTH_TREND_HISTORICAL_MONTH_COUNT,
  futureMonthCount: number = NET_WORTH_FUTURE_MONTH_COUNT,
): NetWorthTrendPoint[] {
  const anchors = monthAnchorDates(historicalMonthCount, futureMonthCount, now);
  const currentMonthIndex = historicalMonthCount - 1;
  const nowMs = now.getTime();

  return anchors.map((anchor, index) => {
    if (index > currentMonthIndex) {
      return { label: monthLabelFr(anchor), value: 0 };
    }

    const isCurrentMonth = index === currentMonthIndex;
    const anchorEndMs = isCurrentMonth
      ? nowMs
      : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    let total = 0;
    for (const asset of assets) {
      const loanId = asset.linkedLoanId?.trim();
      const linkedLoan = loanId ? loansById.get(loanId) ?? null : null;
      total += assetValueAtMonthAnchor(asset, linkedLoan, index, currentMonthIndex, anchorEndMs);
    }

    return { label: monthLabelFr(anchor), value: total };
  });
}

/** Current patrimoine total — sum of display values for off-account wealth assets. */
export function getCurrentPatrimoineTotal(
  assets: readonly WealthAsset[],
  loansById: ReadonlyMap<string, Loan>,
): number {
  return sumWealthAssetsDisplayValue(assets, loansById);
}
