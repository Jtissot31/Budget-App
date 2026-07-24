import { useId, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { buildCompactSparklinePaths } from '@/lib/chartStockLinePath';

export const CHECKING_SPARKLINE_HEIGHT = 60;
const SPARKLINE_STROKE_WIDTH = 2;
/** Soft wash under the Accueil sparkline — aligned with PortfolioChartCard area fill. */
const SPARKLINE_FILL_TOP_OPACITY = 0.18;

type Props = {
  values: number[];
  horizontalInset?: number;
};

export function CheckingBalanceSparkline({ values, horizontalInset = 8 }: Props) {
  const gradientId = `checking-spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [width, setWidth] = useState(0);
  const { accent, danger } = planFinanceKit.colors;

  const strokeColor = useMemo(() => {
    if (values.length < 2) return accent;
    return values[values.length - 1]! >= values[0]! ? accent : danger;
  }, [accent, danger, values]);

  const { linePath, fillPath } = useMemo(
    () => buildCompactSparklinePaths(values, width, CHECKING_SPARKLINE_HEIGHT, 8, horizontalInset),
    [horizontalInset, values, width],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0) {
      setWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    }
  };

  if (values.length < 2) return null;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {width > 0 ? (
        <Svg width={width} height={CHECKING_SPARKLINE_HEIGHT} style={styles.svg}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={strokeColor} stopOpacity={SPARKLINE_FILL_TOP_OPACITY} />
              <Stop offset="1" stopColor={strokeColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {fillPath ? <Path d={fillPath} fill={`url(#${gradientId})`} /> : null}
          {linePath ? (
            <Path
              d={linePath}
              stroke={strokeColor}
              strokeWidth={SPARKLINE_STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: CHECKING_SPARKLINE_HEIGHT,
    backgroundColor: 'transparent',
  },
  svg: {
    backgroundColor: 'transparent',
  },
});
