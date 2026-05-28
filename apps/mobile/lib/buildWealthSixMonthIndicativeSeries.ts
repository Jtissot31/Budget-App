import type { WealthAsset } from '@/types';

/** Six calendar-month anchors ending with the visible month (`now`). */
export const WEALTH_HINT_MONTH_COUNT = 6;

export type WealthSixMonthHintPoint = { tMs: number; value: number; label: string };

function monthStartUtcMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0).getTime();
}

function monthLabelFrench(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace(/\.$/, '');
}

/**
 * Builds a **smooth illustrative** trajectory with a mid-period wiggle (`sin π u` so endpoints stay anchored).
 *
 * Anchors month 1 to `purchaseCost` (fallback `≈currentValue×0.82`) and month 6 to `currentValue` exactly.
 * Amplitude scaled by coarse asset-type “volatility” (precious > real_estate).
 */
export function buildWealthSixMonthIndicativeSeries(
  asset: WealthAsset,
  nowInput: Date = new Date(),
): WealthSixMonthHintPoint[] {
  const current = Math.max(Number(asset.currentValue) || 0, 0);
  const eps = Math.max(current * 0.045, 30);
  const rawStart =
    typeof asset.purchaseCost === 'number' && asset.purchaseCost > 0 ? asset.purchaseCost : current * 0.82;
  const start = Math.max(rawStart, eps);
  const end = Math.max(current, eps);

  const vol =
    asset.type === 'precious_material'
      ? 0.058
      : asset.type === 'real_estate'
        ? 0.02
        : 0.034;

  const anchor = new Date(nowInput.getFullYear(), nowInput.getMonth(), 1);
  const out: WealthSixMonthHintPoint[] = [];

  for (let idx = -5; idx <= 0; idx++) {
    const m = new Date(anchor.getFullYear(), anchor.getMonth() + idx, 1);
    const u = (idx + 5) / 5;
    const blend = start + (end - start) * u;
    const wav = Math.max(end, start) * vol * Math.sin(Math.PI * u);
    let value = blend + wav;
    if (idx === 0) value = end;
    if (idx === -5) value = start;

    /** Never imply solvability at absolute zero unless values are negligible. */
    const floorVal = eps;
    value = Math.max(value, floorVal);
    out.push({ tMs: monthStartUtcMs(m), value, label: monthLabelFrench(m) });
  }

  /** Hard anchor ends for coherence with bookkeeping fields. */
  out[0]!.value = start;
  out[out.length - 1]!.value = end;

  return out;
}
