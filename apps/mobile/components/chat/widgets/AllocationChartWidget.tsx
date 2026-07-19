import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { AllocationChartData } from '@/types/aiWidgets';
import { aiWidgetAmountTypography, aiWidgetFonts, aiWidgetTypography, fynChartSeriesColor, useAIWidgetColors } from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: AllocationChartData;
};

function resolvePercent(value: number, total: number, explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit)) {
    return Math.max(0, explicit);
  }
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export function AllocationChartWidget({ data }: Props) {
  const palette = useAIWidgetColors();

  const { total, segments } = useMemo(() => {
    const sum = data.segments.reduce((acc, segment) => acc + segment.value, 0);
    return {
      total: sum,
      segments: data.segments.map((segment, index) => ({
        ...segment,
        percent: resolvePercent(segment.value, sum, segment.percent),
        color: fynChartSeriesColor(index),
      })),
    };
  }, [data.segments]);

  return (
    <WidgetCardShell
      label={data.label}
      caption={
        total <= 0
          ? 'Données insuffisantes pour afficher la répartition.'
          : data.caption
      }
    >
      <View style={[styles.stackBar, { backgroundColor: palette.track }]}>
        {segments.map((segment) =>
          segment.percent > 0 ? (
            <View
              key={segment.label}
              style={[styles.stackSegment, { backgroundColor: segment.color, flex: segment.percent }]}
            />
          ) : null,
        )}
      </View>

      <View style={styles.legend}>
        {segments.map((segment) => (
          <View key={segment.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text
              style={[
                aiWidgetTypography.legend,
                { color: palette.text, fontFamily: aiWidgetFonts.labelRegular },
              ]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
            <Text
              style={[
                aiWidgetTypography.legend,
                styles.legendPercent,
                aiWidgetAmountTypography('caption'),
                { color: palette.textMuted },
              ]}
            >
              {Math.round(segment.percent)} %
            </Text>
          </View>
        ))}
      </View>
    </WidgetCardShell>
  );
}

const styles = StyleSheet.create({
  stackBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    width: '100%',
  },
  stackSegment: {
    height: '100%',
  },
  legend: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendPercent: {
    fontVariant: ['tabular-nums'],
  },
  legendLabel: {
    flex: 1,
    minWidth: 0,
  },
});
