import { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, Stop } from 'react-native-svg';
import { chartTokens, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const STOCK_ENDPOINT_DOT_R = 2.5;
const STOCK_VERTICAL_PADDING = 2;
const STOCK_HORIZONTAL_PADDING = 0;
/** Stipple fill fades within this fraction of chart height below the line. */
const STOCK_FILL_DEPTH_RATIO = 0.22;

type Props = {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  /** Line-only, miter joins — Apple Stocks–style intraday chart. */
  variant?: 'default' | 'stock';
  showFill?: boolean;
  strokeWidth?: number;
  /** Solid dot at the latest point (stock detail charts). */
  showEndpointDot?: boolean;
  /** Optional chart area background (e.g. pure black on stock detail). Defaults to transparent. */
  backgroundColor?: string;
};

function stockStrokeColor(positive: boolean, isLight: boolean): string {
  if (positive) {
    return isLight ? chartTokens.lineLight : chartTokens.stockPositive;
  }
  return isLight ? chartTokens.negativeLight : chartTokens.stockNegative;
}

export function SparklineChart({
  data = [],
  width = 220,
  height = 56,
  positive = true,
  variant = 'default',
  showFill,
  strokeWidth,
  showEndpointDot = false,
  backgroundColor,
}: Props) {
  const { isLight } = useAppTheme();
  const safeData = data ?? [];
  const gradientId = useId().replace(/:/g, '');
  const stippleId = `${gradientId}-stipple`;
  const fillGradId = `${gradientId}-fill`;

  const { linePath, fillPath, strokeColor, lastPoint } = useMemo(() => {
    if (safeData.length < 2) {
      return { linePath: '', fillPath: '', strokeColor: chartTokens.line, lastPoint: null };
    }

    const isStock = variant === 'stock';
    const paddingX = isStock ? STOCK_HORIZONTAL_PADDING : 4;
    const paddingY = isStock ? STOCK_VERTICAL_PADDING : 4;
    const endpointInset = showEndpointDot ? STOCK_ENDPOINT_DOT_R + 0.5 : 0;
    const min = Math.min(...safeData);
    const max = Math.max(...safeData);
    const range = max - min || 1;
    const innerW = width - paddingX * 2 - endpointInset;
    const innerH = height - paddingY * 2;

    const points = safeData.map((value, index) => {
      const x = paddingX + (index / (safeData.length - 1)) * innerW;
      const y = paddingY + innerH - ((value - min) / range) * innerH;
      return { x, y };
    });

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

    let fill = `${line} L ${points[points.length - 1].x.toFixed(2)} ${height - paddingY} L ${points[0].x.toFixed(2)} ${height - paddingY} Z`;
    if (isStock) {
      const lowestY = Math.max(...points.map((p) => p.y));
      const fillBottom = Math.min(lowestY + innerH * STOCK_FILL_DEPTH_RATIO, height - paddingY);
      fill = `${line} L ${points[points.length - 1].x.toFixed(2)} ${fillBottom.toFixed(2)} L ${points[0].x.toFixed(2)} ${fillBottom.toFixed(2)} Z`;
    }

    const isUp = safeData[safeData.length - 1] >= safeData[0];
    const defaultColor = isUp
      ? isLight
        ? chartTokens.lineLight
        : chartTokens.line
      : isLight
        ? chartTokens.negativeLight
        : chartTokens.negative;

    const color = isStock
      ? stockStrokeColor(positive, isLight)
      : positive !== false
        ? defaultColor
        : chartTokens.negative;

    return {
      linePath: line,
      fillPath: fill,
      strokeColor: color,
      lastPoint: points[points.length - 1],
    };
  }, [positive, safeData, showEndpointDot, variant, height, isLight, width]);

  if (safeData.length < 2) return null;

  const isStock = variant === 'stock';
  const fillVisible = showFill ?? !isStock;
  const lineStrokeWidth = strokeWidth ?? (isStock ? 1 : 2);

  return (
    <View
      style={[
        styles.container,
        isStock && styles.containerStock,
        backgroundColor != null && { backgroundColor },
      ]}
    >
      <Svg width={width} height={height}>
        {fillVisible ? (
          <Defs>
            {isStock ? (
              <>
                <LinearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={strokeColor} stopOpacity={0.06} />
                  <Stop offset="0.35" stopColor={strokeColor} stopOpacity={0.015} />
                  <Stop offset="1" stopColor={chartTokens.stockChartBg} stopOpacity={0} />
                </LinearGradient>
                <Pattern id={stippleId} patternUnits="userSpaceOnUse" width="4" height="4">
                  <Circle cx="2" cy="2" r="0.4" fill={strokeColor} opacity={0.08} />
                </Pattern>
              </>
            ) : (
              <LinearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={strokeColor} stopOpacity={0.35} />
                <Stop offset="1" stopColor={strokeColor} stopOpacity={0} />
              </LinearGradient>
            )}
          </Defs>
        ) : null}
        {fillVisible ? (
          isStock ? (
            <>
              <Path d={fillPath} fill={`url(#${fillGradId})`} />
              <Path d={fillPath} fill={`url(#${stippleId})`} opacity={0.28} />
            </>
          ) : (
            <Path d={fillPath} fill={`url(#${fillGradId})`} />
          )
        ) : null}
        <Path
          d={linePath}
          stroke={strokeColor}
          strokeWidth={lineStrokeWidth}
          fill="none"
          strokeLinecap={isStock ? 'butt' : 'round'}
          strokeLinejoin={isStock ? 'miter' : 'round'}
          strokeMiterlimit={isStock ? 2 : undefined}
        />
        {showEndpointDot && lastPoint ? (
          <Circle cx={lastPoint.x} cy={lastPoint.y} r={STOCK_ENDPOINT_DOT_R} fill={strokeColor} />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  containerStock: {
    borderRadius: 0,
  },
});
