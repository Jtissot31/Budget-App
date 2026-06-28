import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  containerSurfaceStyle,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  buildDonutSegmentArcs,
  touchPointToSegment,
  type DonutSegmentInput,
} from '@/lib/donutGeometry';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CHART_HORIZONTAL_INSET = 20;
const CHART_MAX_WIDTH = 280;
const CHART_ASPECT = 1;

type Props = {
  segments: readonly DonutSegmentInput[];
  totalAllocated: number;
  totalSpent: number;
  selectedId?: string | null;
  onSelectSegment?: (id: string | null) => void;
};

export function BudgetDonutChart({
  segments,
  totalAllocated,
  totalSpent,
  selectedId = null,
  onSelectSegment,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  const trackColor = isLight ? colors.border : colors.scopeTrack;

  const chartSize = Math.min(windowWidth - CHART_HORIZONTAL_INSET * 2, CHART_MAX_WIDTH);
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const outerRadius = chartSize * 0.47;
  const innerRadius = chartSize * 0.355;
  const hubSize = innerRadius * 1.68;
  const layout = useMemo(
    () => ({ cx, cy, innerRadius, outerRadius }),
    [cx, cy, innerRadius, outerRadius],
  );

  const arcs = useMemo(
    () => buildDonutSegmentArcs(segments, layout),
    [layout, segments],
  );

  const spentPercent =
    totalAllocated > 0 ? Math.min(Math.round((totalSpent / totalAllocated) * 100), 999) : 0;

  const segmentLabel =
    segments.length === 0
      ? 'Aucune catégorie allouée'
      : segments.length === 1
        ? '1 catégorie allouée'
        : `${segments.length} catégories allouées`;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.chartBox, { width: chartSize, height: chartSize * CHART_ASPECT }]}
        onPress={(event) => {
          if (!onSelectSegment) return;
          const id = touchPointToSegment(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
            arcs,
            layout,
          );
          if (id) {
            tapHaptic();
            onSelectSegment(id);
            return;
          }
          if (selectedId != null) {
            tapHaptic();
            onSelectSegment(null);
          }
        }}
      >
        <Svg width={chartSize} height={chartSize} pointerEvents="none">
          <Circle
            cx={cx}
            cy={cy}
            r={(innerRadius + outerRadius) / 2}
            fill="none"
            stroke={trackColor}
            strokeWidth={outerRadius - innerRadius + 2}
          />

          {arcs.length === 0 ? null : (
            arcs.map((arc) => {
              const isSelected = selectedId === arc.id;
              const dimmed = selectedId != null && !isSelected;
              return (
                <Path
                  key={arc.id}
                  d={arc.path}
                  fill={arc.color}
                  opacity={dimmed ? 0.32 : 1}
                  stroke={isSelected ? colors.accentGreen : 'transparent'}
                  strokeWidth={isSelected ? 2.5 : 0}
                  strokeLinejoin="round"
                />
              );
            })
          )}
        </Svg>

        <View
          style={[
            styles.hubDisc,
            surface,
            {
              width: hubSize,
              height: hubSize,
              borderRadius: hubSize / 2,
            },
          ]}
          pointerEvents="none"
        >
          {totalAllocated > 0 ? (
            <>
              <Text
                style={[
                  styles.hubPercent,
                  moneyAmountTypography({ tier: 'stat' }),
                  { color: colors.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {spentPercent} %
              </Text>
              <Text style={[styles.hubCaption, typographyKit.caption, { color: colors.textMuted }]}>
                du budget utilisé
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.hubCaption, typographyKit.eyebrow, { color: colors.textMuted }]}>
                Répartition
              </Text>
              <Text style={[styles.hubEmpty, typographyKit.caption, { color: colors.textMuted }]}>
                Aucun budget alloué
              </Text>
            </>
          )}
        </View>
      </Pressable>

      <Text style={[styles.segmentCaption, typographyKit.caption, { color: colors.textMuted }]}>
        {segmentLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chartBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubDisc: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  hubPercent: {
    textAlign: 'center',
  },
  hubCaption: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  hubEmpty: {
    textAlign: 'center',
    marginTop: 2,
  },
  segmentCaption: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
});
