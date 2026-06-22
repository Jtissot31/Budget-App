import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { AllocationChartData } from '@/types/aiWidgets';
import { AI_WIDGET_RADIUS, aiWidgetFonts, useAIWidgetColors } from './theme';

type Props = {
  data: AllocationChartData;
};

const SEGMENT_COLORS = ['#3DDC97', '#5B8DEF', '#F5A623', '#E85D75', '#9B59B6', '#1ABC9C'];

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
        color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
      })),
    };
  }, [data.segments]);

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, padding: palette.padding }]}>
      <Text style={[styles.label, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
        {data.label.toUpperCase()}
      </Text>

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
              style={[styles.legendLabel, { color: palette.text, fontFamily: aiWidgetFonts.labelRegular }]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
            <Text style={[styles.legendValue, { color: palette.textMuted, fontFamily: aiWidgetFonts.mono }]}>
              {Math.round(segment.percent)} %
            </Text>
          </View>
        ))}
      </View>

      {data.caption ? (
        <Text style={[styles.caption, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}>
          {data.caption}
        </Text>
      ) : null}

      {total <= 0 ? (
        <Text style={[styles.caption, { color: palette.textMuted, fontFamily: aiWidgetFonts.labelRegular }]}>
          Données insuffisantes pour afficher la répartition.
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
  stackBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: AI_WIDGET_RADIUS,
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
    borderRadius: AI_WIDGET_RADIUS,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    minWidth: 0,
  },
  legendValue: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 12,
  },
});
