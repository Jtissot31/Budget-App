/** Shared donut arc geometry — single source for SVG render and tap hit-testing. */

export type DonutSegmentInput = {
  id: string;
  value: number;
  color: string;
};

export type DonutSegmentArc = {
  id: string;
  color: string;
  value: number;
  fraction: number;
  startAngle: number;
  endAngle: number;
  path: string;
};

export type DonutLayout = {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
};

const START_ANGLE = -Math.PI / 2;
const TWO_PI = Math.PI * 2;

/** Arc-length gap between segments (px at mid-radius); 0 = continuous ring. */
export const SEGMENT_GAP = 3;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function describeDonutSegmentPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const span = endAngle - startAngle;
  if (span >= TWO_PI - 1e-6) {
    const mid = startAngle + Math.PI;
    const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
    const outerMid = polarToCartesian(cx, cy, outerRadius, mid);
    const innerMid = polarToCartesian(cx, cy, innerRadius, mid);
    const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerMid.x} ${outerMid.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerStart.x} ${outerStart.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerMid.x} ${innerMid.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  }

  const largeArc = span > Math.PI ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function isAngleInSegment(angle: number, startAngle: number, endAngle: number): boolean {
  const a = normalizeAngle(angle);
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  if (Math.abs(endAngle - startAngle) >= TWO_PI - 1e-6) return true;
  if (start <= end) return a >= start && a <= end;
  return a >= start || a <= end;
}

/** Build proportional wedge arcs from segment values (typically budget limits). */
export function buildDonutSegmentArcs(
  segments: readonly DonutSegmentInput[],
  layout: DonutLayout,
): DonutSegmentArc[] {
  const active = segments.filter((segment) => segment.value > 0);
  const total = active.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0 || active.length === 0) return [];

  const { cx, cy, innerRadius, outerRadius } = layout;
  const midRadius = (innerRadius + outerRadius) / 2;
  const gapAngle =
    SEGMENT_GAP > 0 && active.length > 1 ? SEGMENT_GAP / midRadius : 0;
  const totalGap = gapAngle * active.length;
  const availableSpan = TWO_PI - totalGap;
  let cursor = START_ANGLE;

  return active.map((segment) => {
    const fraction = segment.value / total;
    const span = fraction * availableSpan;
    const startAngle = cursor;
    const endAngle = startAngle + span;
    cursor = endAngle + gapAngle;

    return {
      id: segment.id,
      color: segment.color,
      value: segment.value,
      fraction,
      startAngle,
      endAngle,
      path: describeDonutSegmentPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle),
    };
  });
}

/** Resolve which segment was tapped from local coordinates within the chart box. */
export function touchPointToSegment(
  x: number,
  y: number,
  arcs: readonly DonutSegmentArc[],
  layout: DonutLayout,
): string | null {
  if (arcs.length === 0) return null;

  const { cx, cy, innerRadius, outerRadius } = layout;
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < innerRadius || distance > outerRadius) return null;

  const angle = Math.atan2(dy, dx);
  for (const arc of arcs) {
    if (isAngleInSegment(angle, arc.startAngle, arc.endAngle)) {
      return arc.id;
    }
  }
  return null;
}
