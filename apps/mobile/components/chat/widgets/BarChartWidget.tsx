import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { BarChartData } from '@/types/aiWidgets';
import { AI_WIDGET_RADIUS, aiWidgetFonts, useAIWidgetColors } from './theme';

type Props = {
  data: BarChartData;
};

const CHART_HEIGHT = 120;

export function BarChartWidget({ data }: Props) {
  const palette = useAIWidgetColors();

  const maxValue = useMemo(
    () => Math.max(...data.items.map((item) => item.value), 1),
    [data.items],
  );

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, padding: palette.padding }]}>
      <Text style={[styles.label, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
        {data.label.toUpperCase()}
      </Text>

      <View style={styles.chartArea}>
        {data.items.map((item) => {
          const barHeight = Math.max(6, (item.value / maxValue) * CHART_HEIGHT);
          const displayValue = item.value_label ?? String(item.value);

          return (
            <View key={`${item.label}-${item.value}`} style={styles.barColumn}>
              <Text
                style={[styles.barValue, { color: palette.text, fontFamily: aiWidgetFonts.mono }]}
                numberOfLines={1}
              >
                {displayValue}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: palette.track, height: CHART_HEIGHT }]}>
                <View
                  style={[
                    styles.barFill,
                    { backgroundColor: palette.green, height: barHeight },
                  ]}
                />
              </View>
              <Text
                style={[styles.barLabel, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}
                numberOfLines={2}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
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
    gap: spacing.md,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  barValue: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    maxWidth: 48,
    borderRadius: AI_WIDGET_RADIUS,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: AI_WIDGET_RADIUS,
  },
  barLabel: {
    fontSize: 10,
    textAlign: 'center',
    width: '100%',
  },
  caption: {
    fontSize: 12,
  },
});
