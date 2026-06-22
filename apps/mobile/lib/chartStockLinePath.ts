/** Shared stock-style line paths — same rhythm as PortfolioChartCard / SparklineChart. */

export const CHART_Y_PADDING_RATIO = 0.08;

export type ChartPoint = { x: number; y: number };

/** Straight segments — matches PortfolioChartCard `buildStockLinePath`. */
export function buildStockLinePath(pts: ChartPoint[]): string {
  if (pts.length === 0) return '';
  return pts
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

export function computeYDomain(values: number[]): { yMin: number; yMax: number } {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = dataMax - dataMin;
  if (range === 0) {
    return { yMin: dataMin - 1, yMax: dataMax + 1 };
  }
  return { yMin: dataMin - range * CHART_Y_PADDING_RATIO, yMax: dataMax + range * CHART_Y_PADDING_RATIO };
}

export function buildCompactSparklinePaths(
  values: number[],
  chartWidth: number,
  chartHeight: number,
  verticalPadding = 8,
): { linePath: string; fillPath: string } {
  if (values.length < 2 || chartWidth <= 0 || chartHeight <= 0) {
    return { linePath: '', fillPath: '' };
  }

  const { yMin, yMax } = computeYDomain(values);
  const range = yMax - yMin;
  const innerHeight = chartHeight - verticalPadding * 2;
  const plotWidth = Math.max(chartWidth, 1);

  const pts: ChartPoint[] = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * plotWidth;
    const y = verticalPadding + (1 - (value - yMin) / range) * innerHeight;
    return { x, y };
  });

  const firstPt = pts[0]!;
  const lastPt = pts[pts.length - 1]!;
  const linePath = buildStockLinePath(pts);
  const fillPath = `${linePath} L ${lastPt.x.toFixed(2)} ${chartHeight} L ${firstPt.x.toFixed(2)} ${chartHeight} Z`;

  return { linePath, fillPath };
}
