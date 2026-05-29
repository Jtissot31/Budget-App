import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { chartTokens, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
};

export function SparklineChart({ data, width = 220, height = 56, positive = true }: Props) {
  const { isLight } = useAppTheme();

  const { linePath, fillPath, strokeColor } = useMemo(() => {
    if (data.length < 2) {
      return { linePath: '', fillPath: '', strokeColor: chartTokens.line };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * innerW;
      const y = padding + innerH - ((value - min) / range) * innerH;
      return { x, y };
    });

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const fill = `${line} L ${points[points.length - 1].x.toFixed(2)} ${height - padding} L ${points[0].x.toFixed(2)} ${height - padding} Z`;

    const isUp = data[data.length - 1] >= data[0];
    const color = isUp
      ? isLight
        ? chartTokens.lineLight
        : chartTokens.line
      : isLight
        ? chartTokens.negativeLight
        : chartTokens.negative;

    return { linePath: line, fillPath: fill, strokeColor: positive !== false ? color : chartTokens.negative };
  }, [data, height, isLight, positive, width]);

  if (data.length < 2) return null;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={strokeColor} stopOpacity={0.35} />
            <Stop offset="1" stopColor={strokeColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill="url(#sparkFill)" />
        <Path d={linePath} stroke={strokeColor} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
