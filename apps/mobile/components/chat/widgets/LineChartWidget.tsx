import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { SparklineChart } from '@/components/chat/SparklineChart';
import type { LineChartData } from '@/types/aiWidgets';
import { aiWidgetHeroAmountTextProps, aiWidgetTypography, useAIWidgetColors } from './theme';
import { WidgetCardShell } from './WidgetCardShell';

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
    <WidgetCardShell label={data.label} caption={data.caption}>
      {data.value_label ? (
        <Text
          style={[
            aiWidgetTypography.value,
            styles.valueLabel,
            { color: palette.text },
          ]}
          {...aiWidgetHeroAmountTextProps}
        >
          {data.value_label}
        </Text>
      ) : null}

      <View style={[styles.chartWrap, { backgroundColor: palette.track }]} onLayout={handleLayout}>
        {chartWidth > 0 ? (
          <SparklineChart
            data={data.data}
            width={chartWidth}
            height={72}
            positive={data.positive}
            backgroundColor={palette.track}
          />
        ) : null}
      </View>
    </WidgetCardShell>
  );
}

const styles = StyleSheet.create({
  valueLabel: {
    minWidth: 0,
    width: '100%',
  },
  chartWrap: {
    width: '100%',
    minHeight: 72,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
