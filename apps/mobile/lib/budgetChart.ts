export type BudgetChartSegment = {
  id: string;
  name: string;
  color: string;
  amount: number;
  fraction: number;
};

const MIN_SWEEP_DEGREES = 6;

export function colorWithAlpha(color: string, alpha: number) {
  const hex = color.replace('#', '').trim();
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(0,230,100,${alpha})`;

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function lightenHex(color: string, amount = 0.22) {
  const hex = color.replace('#', '').trim();
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return color;

  const mix = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * amount));
  const red = mix(parseInt(normalized.slice(0, 2), 16));
  const green = mix(parseInt(normalized.slice(2, 4), 16));
  const blue = mix(parseInt(normalized.slice(4, 6), 16));
  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

export function getDonutVisualFractions(segments: BudgetChartSegment[]): number[] {
  return segments.map((seg) => Math.max(0, seg.fraction));
}
