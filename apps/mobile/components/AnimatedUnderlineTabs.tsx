import { useCallback, useEffect, useRef } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { fontFamilies, spacing } from '@/constants/theme';

/** Snappier than SegmentedTabs pill — same liquid feel, faster settle. */
const liquidUnderlineSpring = {
  damping: 15,
  stiffness: 380,
  mass: 0.5,
  overshootClamping: false,
} as const;

const liquidUnderlineSettleSpring = {
  damping: 18,
  stiffness: 520,
  mass: 0.45,
} as const;

type Tab<T extends string> = { id: T; label: string };

type TabLayoutMode = 'inline' | 'edgeCenterEdge';

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  style?: StyleProp<ViewStyle>;
  /** Historique flush left, center tab on screen, last tab flush right (3 tabs). */
  layout?: TabLayoutMode;
};

const INDICATOR_COLOR = '#4ADE80';

export function AnimatedUnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  style,
  layout = 'inline',
}: Props<T>) {
  const activeIndex = tabs.findIndex((tab) => tab.id === active);
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const useEdgeCenterEdgeLayout = layout === 'edgeCenterEdge' && tabs.length === 3;

  const tabLayouts = useRef<({ x: number; width: number } | null)[]>(
    Array.from({ length: tabs.length }, () => null),
  );
  const columnLayouts = useRef<(number | null)[]>(Array.from({ length: tabs.length }, () => null));
  const tabLocalLayouts = useRef<({ x: number; width: number } | null)[]>(
    Array.from({ length: tabs.length }, () => null),
  );
  const prevActiveIndex = useRef(resolvedActiveIndex);
  const hasAnimatedOnce = useRef(false);

  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorScaleX = useSharedValue(1);
  const indicatorScaleY = useSharedValue(1);
  const indicatorOpacity = useSharedValue(0);

  const moveIndicatorToIndex = useCallback(
    (index: number, withMotion: boolean) => {
      const layout = tabLayouts.current[index];
      if (!layout) return;

      if (withMotion) {
        indicatorX.value = withSpring(layout.x, liquidUnderlineSpring);
        indicatorWidth.value = withSpring(layout.width, liquidUnderlineSpring);
      } else {
        indicatorX.value = layout.x;
        indicatorWidth.value = layout.width;
      }

      indicatorOpacity.value = 1;
    },
    [indicatorOpacity, indicatorWidth, indicatorX],
  );

  const runLiquidMorph = useCallback(() => {
    indicatorScaleX.value = withSequence(
      withTiming(1.12, {
        duration: 45,
        easing: Easing.out(Easing.cubic),
      }),
      withSpring(1, liquidUnderlineSettleSpring),
    );
    indicatorScaleY.value = withSequence(
      withTiming(0.88, {
        duration: 35,
        easing: Easing.out(Easing.quad),
      }),
      withSpring(1, liquidUnderlineSettleSpring),
    );
  }, [indicatorScaleX, indicatorScaleY]);

  useEffect(() => {
    tabLayouts.current = Array.from({ length: tabs.length }, () => null);
    columnLayouts.current = Array.from({ length: tabs.length }, () => null);
    tabLocalLayouts.current = Array.from({ length: tabs.length }, () => null);
    hasAnimatedOnce.current = false;
    indicatorOpacity.value = 0;
  }, [tabs.length, indicatorOpacity]);

  useEffect(() => {
    const shouldAnimate = hasAnimatedOnce.current;
    if (shouldAnimate && prevActiveIndex.current !== resolvedActiveIndex) {
      runLiquidMorph();
    }

    moveIndicatorToIndex(resolvedActiveIndex, shouldAnimate);
    prevActiveIndex.current = resolvedActiveIndex;
    hasAnimatedOnce.current = true;
  }, [moveIndicatorToIndex, resolvedActiveIndex, runLiquidMorph]);

  const commitTabLayout = useCallback(
    (index: number) => {
      if (useEdgeCenterEdgeLayout) {
        const local = tabLocalLayouts.current[index];
        const columnX = columnLayouts.current[index];
        if (!local || columnX == null) return;
        tabLayouts.current[index] = { x: columnX + local.x, width: local.width };
      } else {
        const local = tabLocalLayouts.current[index];
        if (!local) return;
        tabLayouts.current[index] = local;
      }

      if (index === resolvedActiveIndex) {
        moveIndicatorToIndex(resolvedActiveIndex, false);
      }
    },
    [moveIndicatorToIndex, resolvedActiveIndex, useEdgeCenterEdgeLayout],
  );

  const handleColumnLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      columnLayouts.current[index] = event.nativeEvent.layout.x;
      commitTabLayout(index);
    },
    [commitTabLayout],
  );

  const handleTabLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      tabLocalLayouts.current[index] = { x, width };

      if (useEdgeCenterEdgeLayout) {
        commitTabLayout(index);
        return;
      }

      tabLayouts.current[index] = { x, width };

      if (index === resolvedActiveIndex) {
        moveIndicatorToIndex(resolvedActiveIndex, false);
      }
    },
    [commitTabLayout, moveIndicatorToIndex, resolvedActiveIndex, useEdgeCenterEdgeLayout],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorX.value },
      { scaleX: indicatorScaleX.value },
      { scaleY: indicatorScaleY.value },
    ],
    width: indicatorWidth.value,
  }));

  return (
    <View style={[styles.row, style]}>
      <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />

      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        const tabButton = (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            onLayout={(event) => handleTabLayout(index, event)}
            style={useEdgeCenterEdgeLayout ? styles.tabSpread : styles.tab}
          >
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );

        if (!useEdgeCenterEdgeLayout) {
          return (
            <View key={tab.id} collapsable={false}>
              {tabButton}
            </View>
          );
        }

        const columnStyle =
          index === 0
            ? styles.columnStart
            : index === tabs.length - 1
              ? styles.columnEnd
              : styles.columnCenter;

        return (
          <View
            key={tab.id}
            collapsable={false}
            style={columnStyle}
            onLayout={(event) => handleColumnLayout(index, event)}
          >
            {tabButton}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginTop: spacing.md,
    marginBottom: 16,
    position: 'relative',
  },
  columnStart: {
    flex: 1,
    alignItems: 'flex-start',
  },
  columnCenter: {
    alignItems: 'center',
  },
  columnEnd: {
    flex: 1,
    alignItems: 'flex-end',
  },
  indicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    height: 2,
    backgroundColor: INDICATOR_COLOR,
    borderRadius: 2,
    transformOrigin: 'left center',
  },
  tab: {
    marginRight: 20,
    paddingBottom: 10,
  },
  tabSpread: {
    paddingBottom: 10,
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    fontWeight: 'normal',
    color: '#444',
    includeFontPadding: false,
  },
  labelActive: {
    color: '#fff',
  },
});
