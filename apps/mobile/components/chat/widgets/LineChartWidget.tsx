import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import { SparklineChart } from '@/components/chat/SparklineChart';
import type { LineChartData } from '@/types/aiWidgets';
import { AI_WIDGET_RADIUS, aiWidgetFonts, useAIWidgetColors } from './theme';

type Props = {
  data: LineChartData;
};

export function LineChartWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const [chartWidth, setChartWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== chartWidth) {
      setChartWidth(nextWidth);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, padding: palette.padding }]}>
      <Text style={[styles.label, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
        {data.label.toUpperCase()}
      </Text>

      {data.value_label ? (
        <Text style={[styles.valueLabel, { color: palette.text, fontFamily: aiWidgetFonts.mono }]}>
          {data.value_label}
        </Text>
      ) : null}

      <View style={styles.chartWrap} onLayout={handleLayout}>
        {chartWidth > 0 ? (
          <SparklineChart
            data={data.data}
            width={chartWidth}
            height={72}
            positive={data.positive}
          />
        ) : null}
      </View>

      {data.caption ? (
        <Text style={[styles.caption, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}>
          {data.caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: AI_WIDGET_RADIUS,
    gap: spacing.sm,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  valueLabel: {
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  chartWrap: {
    width: '100%',
    minHeight: 72,
  },
  caption: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
