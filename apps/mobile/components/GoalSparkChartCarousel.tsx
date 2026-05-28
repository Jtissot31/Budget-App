import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { typography } from '@/constants/theme';
import type { SavingsGoal } from '@/types';
import { GoalSparkChart, GOAL_SPARK_TOTAL_H, sortGoalsForChartCarousel } from '@/components/GoalSparkChart';

export type GoalSparkChartCarouselProps = {
  goals: SavingsGoal[];
  /** Goal whose page is shown first (hub selection or `form.id`). */
  focusGoalId: string;
  stroke: string;
  areaFill: string;
  gridColor: string;
  labelColor: string;
  captionColor: string;
  /** Optional caption above the chart; `%s` replaced by goal name. */
  captionTemplate?: string;
};

export function GoalSparkChartCarousel({
  goals,
  focusGoalId,
  stroke,
  areaFill,
  gridColor,
  labelColor,
  captionColor,
  captionTemplate,
}: GoalSparkChartCarouselProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const sortedGoals = useMemo(() => sortGoalsForChartCarousel(goals), [goals]);
  const orderKey = useMemo(() => sortedGoals.map((g) => g.id).join('|'), [sortedGoals]);

  const [captionIndex, setCaptionIndex] = useState(0);
  const lastSyncedKey = useRef<string>('');

  useLayoutEffect(() => {
    if (pageWidth <= 0 || sortedGoals.length === 0) return;
    const key = `${focusGoalId}|${orderKey}|${pageWidth}`;
    if (lastSyncedKey.current === key) return;
    lastSyncedKey.current = key;
    const idx = sortedGoals.findIndex((g) => g.id === focusGoalId);
    const initial = idx >= 0 ? idx : 0;
    setCaptionIndex(initial);
    scrollRef.current?.scrollTo({ x: initial * pageWidth, animated: false });
  }, [focusGoalId, orderKey, pageWidth, sortedGoals]);

  const onCarouselLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setPageWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    }
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const x = e.nativeEvent.contentOffset.x;
      const page = Math.round(x / pageWidth);
      const clamped = Math.min(Math.max(0, page), sortedGoals.length - 1);
      setCaptionIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [pageWidth, sortedGoals.length],
  );

  const focusGoal = sortedGoals.find((g) => g.id === focusGoalId) ?? sortedGoals[0];
  const activeGoal = sortedGoals[captionIndex] ?? sortedGoals[0];
  const captionGoal = pageWidth > 0 ? activeGoal : focusGoal;

  const caption =
    captionTemplate && captionGoal != null ? captionTemplate.replace('%s', captionGoal.name) : (captionGoal?.name ?? '');

  if (sortedGoals.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap} onLayout={onCarouselLayout}>
      {captionGoal != null ? (
        <Text style={[styles.caption, { color: captionColor }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      {pageWidth > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEventThrottle={16}
        >
          {sortedGoals.map((g) => (
            <View key={g.id} style={{ width: pageWidth }}>
              <GoalSparkChart goal={g} stroke={stroke} areaFill={areaFill} gridColor={gridColor} labelColor={labelColor} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ height: GOAL_SPARK_TOTAL_H + 8 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  caption: {
    fontSize: typography.micro,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
});
