import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import type { WealthAsset } from '@/types';

/** Enough daily samples for 10A window (3650) with headroom. */
export const WEALTH_ASSET_MOCK_DAILY_POINT_COUNT = 3700;

const DAY_LABELS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

/** Coarse daily volatility by asset type — precious metals zigzag more than real estate. */
function assetDailyVol(asset: WealthAsset): number {
  if (asset.type === 'precious_material') return 0.012;
  if (asset.type === 'real_estate') return 0.0035;
  return 0.006;
}

function hashNoise(seed: string, index: number): number {
  let hash = 2166136261;
  const input = `${seed}:${index}`;
  for (let charIndex = 0; charIndex < input.length; charIndex += 1) {
    hash ^= input.charCodeAt(charIndex);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

function dayLabelFr(date: Date, isToday: boolean): string {
  if (isToday) return 'AUJ';
  return DAY_LABELS_FR[date.getDay()] ?? '???';
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseAssetDate(iso: string | null | undefined): Date | null {
  const trimmed = iso?.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? startOfDay(parsed) : null;
}

/**
 * Holding start date for the mock series — purchase date, else createdAt,
 * else ~2 years before `now` so period tabs still have a curve.
 */
function resolveSeriesStartDate(asset: WealthAsset, now: Date): Date {
  const purchase = parseAssetDate(asset.purchaseDate);
  if (purchase) return purchase;
  const created = parseAssetDate(asset.createdAt);
  if (created) return created;
  const fallback = startOfDay(now);
  fallback.setFullYear(fallback.getFullYear() - 2);
  return fallback;
}

function resolveStartValue(asset: WealthAsset): number {
  const current = Math.max(Number(asset.currentValue) || 0, 0);
  const eps = Math.max(current * 0.045, 30);
  if (typeof asset.purchaseCost === 'number' && asset.purchaseCost > 0) {
    return Math.max(asset.purchaseCost, eps);
  }
  return Math.max(current * 0.82, eps);
}

/**
 * Deterministic daily mock walk from purchase cost → current value.
 * Intermediate noise is type-scaled; endpoints stay anchored to bookkeeping fields.
 */
function buildDailyValues(
  asset: WealthAsset,
  dayCount: number,
  startValue: number,
  endValue: number,
): number[] {
  if (dayCount <= 1) return [endValue];

  const vol = assetDailyVol(asset);
  const seed = `wealth:${asset.id}:${asset.type}:${asset.material ?? ''}`;
  const walk = new Array<number>(dayCount);
  walk[0] = 0;

  for (let index = 1; index < dayCount; index += 1) {
    const primary = hashNoise(seed, index) * vol;
    const secondary = hashNoise(`${seed}:micro`, index) * vol * 0.55;
    const spike =
      Math.abs(hashNoise(`${seed}:spike`, index)) > 0.9
        ? hashNoise(`${seed}:spike-dir`, index) * vol * 1.8
        : 0;
    walk[index] = walk[index - 1] + primary + secondary + spike;
  }

  const walkStart = walk[0];
  const walkEnd = walk[dayCount - 1];
  const walkSpan = walkEnd - walkStart || 1;
  const priceSpan = endValue - startValue;
  const floor = Math.max(Math.min(startValue, endValue) * 0.15, 1);

  return walk.map((value, index) => {
    if (index === 0) return startValue;
    if (index === dayCount - 1) return endValue;
    const t = (value - walkStart) / walkSpan;
    return Math.max(startValue + t * priceSpan, floor);
  });
}

/**
 * Dense daily value series for one wealth asset (gold, property, …).
 * Compatible with PortfolioChartCard period slicing (same windows as patrimoine).
 */
export function buildWealthAssetTrendSeries(
  asset: WealthAsset,
  now: Date = new Date(),
  maxDayCount: number = WEALTH_ASSET_MOCK_DAILY_POINT_COUNT,
): NetWorthTrendPoint[] {
  const today = startOfDay(now);
  const seriesStart = resolveSeriesStartDate(asset, now);
  const msPerDay = 86_400_000;
  const spanDays = Math.max(
    2,
    Math.floor((today.getTime() - seriesStart.getTime()) / msPerDay) + 1,
  );
  const dayCount = Math.min(spanDays, Math.max(maxDayCount, 2));

  const startValue = resolveStartValue(asset);
  const endValue = Math.max(Number(asset.currentValue) || 0, Math.max(startValue * 0.05, 1));
  const values = buildDailyValues(asset, dayCount, startValue, endValue);

  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - (dayCount - 1));

  return values.map((value, dayIndex) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + dayIndex);
    const isToday = dayIndex === dayCount - 1;
    return {
      label: dayLabelFr(date, isToday),
      value,
    };
  });
}
