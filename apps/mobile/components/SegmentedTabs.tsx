import { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  liquidSegmentedSettleSpring,
  liquidSegmentedSpring,
  radius,
} from '@/constants/theme';
import {
  UNIFORM_CHIP_FONT_SIZE,
  UNIFORM_SEGMENT_HEIGHT,
  UNIFORM_SEGMENT_INNER_HEIGHT,
} from '@/lib/uniformGroupStyles';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

type Tab<T extends string> = { id: T; label: string; icon?: keyof typeof Ionicons.glyphMap };

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  showDivider?: boolean;
  /** 'sm' = compact; 'section' = in-section control; 'md' (default) = standard; 'lg' = hero scope */
  size?: 'sm' | 'section' | 'md' | 'lg';
  /** Override track background color */
  trackBgColor?: string;
  /** Override active pill background color */
  activeBgColor?: string;
  /** Override active label color */
  activeLabelColor?: string;
  /** Override inactive label color */
  inactiveLabelColor?: string;
  /** 'primary' = hero glass track; 'section' = softer in-section track (same pill pattern) */
  variant?: 'primary' | 'section';
  /** Animate the sliding selection pill (liquid spring). Default true. */
  animated?: boolean;
};

const SIZE_CONFIGS = {
  sm: {
    trackMinHeight: 38,
    tabMinHeight: 32,
    tabPaddingVertical: 6,
    fontSize: 11.5,
    iconSize: 13,
    trackPadding: 3,
    tabRadius: radius.card - 3,
  },
  section: {
    trackMinHeight: 42,
    tabMinHeight: 34,
    tabPaddingVertical: 7,
    fontSize: 13,
    iconSize: 14,
    trackPadding: 4,
    tabRadius: radius.card - 3,
  },
  md: {
    trackMinHeight: UNIFORM_SEGMENT_HEIGHT,
    tabMinHeight: UNIFORM_SEGMENT_INNER_HEIGHT,
    tabPaddingVertical: 8,
    fontSize: UNIFORM_CHIP_FONT_SIZE,
    iconSize: 14,
    trackPadding: 4,
    tabRadius: radius.xxl - 4,
  },
  lg: {
    trackMinHeight: 52,
    tabMinHeight: 44,
    tabPaddingVertical: 11,
    fontSize: 13.5,
    iconSize: 15,
    trackPadding: 4,
    tabRadius: radius.xxl - 4,
  },
} as const;

const TRACK_GAP = 4;

/** Matches Portefeuille Comptes / Patrimoine scope track styling. */
export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  showDivider = true,
  size = 'md',
  trackBgColor,
  activeBgColor,
  activeLabelColor,
  inactiveLabelColor,
  variant = 'primary',
  animated = true,
}: Props<T>) {
  const { colors, isLight } = useAppTheme();
  const isSection = variant === 'section';

  const trackBg =
    trackBgColor ?? (isSection ? colors.scopeTrack : colors.segmentedTabTrack);
  const activeBg =
    activeBgColor ?? (isSection ? colors.scopeActive : colors.segmentedTabActivePill);
  const activeColor =
    activeLabelColor ?? (isSection ? colors.text : colors.segmentedTabActiveText);
  const inactiveColor =
    inactiveLabelColor ??
    (isSection
      ? isLight
        ? colors.textSecondary
        : colors.text
      : colors.segmentedTabInactiveText);
  const sc = SIZE_CONFIGS[size];

  const activeIndex = tabs.findIndex((tab) => tab.id === active);
  const resolvedActiveIndex = activeIndex >= 0 ? activeIndex : 0;

  const tabLayouts = useRef<({ x: number; width: number } | null)[]>(
    Array.from({ length: tabs.length }, () => null),
  );
  const prevActiveIndex = useRef(resolvedActiveIndex);
  const hasAnimatedOnce = useRef(false);

  /** Non-animated geometry — Reanimated `width` from 0 often fails to paint on Android. */
  const [pillBox, setPillBox] = useState<{ x: number; width: number } | null>(null);
  const [pillReady, setPillReady] = useState(false);

  const pillX = useSharedValue(0);
  const pillScaleX = useSharedValue(1);
  const pillScaleY = useSharedValue(1);
  const pillOpacity = useSharedValue(0);

  const movePillToIndex = useCallback(
    (index: number, withMotion: boolean) => {
      const layout = tabLayouts.current[index];
      if (!layout || layout.width <= 0) return;

      setPillBox({ x: layout.x, width: layout.width });
      setPillReady(true);

      if (withMotion && animated) {
        pillX.value = withSpring(layout.x, liquidSegmentedSpring);
      } else {
        pillX.value = layout.x;
      }

      pillOpacity.value = 1;
    },
    [animated, pillOpacity, pillX],
  );

  const runLiquidMorph = useCallback(() => {
    if (!animated) return;

    pillScaleX.value = withSequence(
      withTiming(1.07, {
        duration: 70,
        easing: Easing.out(Easing.cubic),
      }),
      withSpring(1, liquidSegmentedSettleSpring),
    );
    pillScaleY.value = withSequence(
      withTiming(0.94, {
        duration: 55,
        easing: Easing.out(Easing.quad),
      }),
      withSpring(1, liquidSegmentedSettleSpring),
    );
  }, [animated, pillScaleX, pillScaleY]);

  useEffect(() => {
    tabLayouts.current = Array.from({ length: tabs.length }, () => null);
    hasAnimatedOnce.current = false;
    pillOpacity.value = 0;
    setPillReady(false);
    setPillBox(null);
  }, [tabs.length, pillOpacity]);

  useEffect(() => {
    const shouldAnimate = animated && hasAnimatedOnce.current;
    if (shouldAnimate && prevActiveIndex.current !== resolvedActiveIndex) {
      runLiquidMorph();
    }

    movePillToIndex(resolvedActiveIndex, shouldAnimate);
    prevActiveIndex.current = resolvedActiveIndex;
    hasAnimatedOnce.current = true;
  }, [animated, movePillToIndex, resolvedActiveIndex, runLiquidMorph]);

  const handleTabLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      if (width <= 0) return;

      tabLayouts.current[index] = { x, width };

      if (index === resolvedActiveIndex) {
        movePillToIndex(resolvedActiveIndex, false);
      }
    },
    [movePillToIndex, resolvedActiveIndex],
  );

  /** Deterministic equal-width geometry from the track — avoids Android ScrollView onLayout races. */
  const handleTrackLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const trackWidth = event.nativeEvent.layout.width;
      if (trackWidth <= 0 || tabs.length === 0) return;

      const inner = trackWidth - sc.trackPadding * 2;
      const tabWidth = (inner - TRACK_GAP * (tabs.length - 1)) / tabs.length;
      if (tabWidth <= 0) return;

      for (let i = 0; i < tabs.length; i += 1) {
        tabLayouts.current[i] = {
          x: sc.trackPadding + i * (tabWidth + TRACK_GAP),
          width: tabWidth,
        };
      }

      movePillToIndex(resolvedActiveIndex, false);
    },
    [movePillToIndex, resolvedActiveIndex, sc.trackPadding, tabs.length],
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ translateX: pillX.value }, { scaleX: pillScaleX.value }, { scaleY: pillScaleY.value }],
  }));

  return (
    <View style={[styles.wrap, showDivider && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View
        collapsable={false}
        onLayout={handleTrackLayout}
        style={[
          styles.track,
          {
            backgroundColor: trackBg,
            minHeight: sc.trackMinHeight,
            padding: sc.trackPadding,
            borderRadius: isSection ? radius.card : radius.xxl,
          },
        ]}
      >
        {Platform.OS === 'android' ? null : (
          <Animated.View
            pointerEvents="none"
            collapsable={false}
            style={[
              styles.pill,
              {
                top: sc.trackPadding,
                height: sc.tabMinHeight,
                width: pillBox?.width ?? 0,
                borderRadius: sc.tabRadius,
                backgroundColor: activeBg,
              },
              pillStyle,
            ]}
          />
        )}

        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          /**
           * Android: selected grey is painted on the Pressable (Reanimated absolute
           * width/opacity pills are unreliable in Expo Go / ScrollView).
           * iOS/web: sliding pill is primary; static fill only until first layout.
           */
          const showStaticSelectedFill =
            selected && (Platform.OS === 'android' || !pillReady);
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.id)}
              onLayout={(event) => handleTabLayout(index, event)}
              style={[
                styles.tab,
                {
                  paddingVertical: sc.tabPaddingVertical,
                  minHeight: sc.tabMinHeight,
                  borderRadius: sc.tabRadius,
                  backgroundColor: showStaticSelectedFill ? activeBg : 'transparent',
                },
              ]}
            >
              <View style={styles.labelRow}>
                {tab.icon ? (
                  <AppIcon family="ionicons" name={tab.icon} size={sc.iconSize} color={selected ? activeColor : inactiveColor} />
                ) : null}
                <Text
                  style={[
                    styles.label,
                    singleLineLabelStyle,
                    { color: selected ? activeColor : inactiveColor, fontSize: sc.fontSize, lineHeight: sc.fontSize + 4 },
                    selected && styles.labelActive,
                  ]}
                  {...chipLabelTextProps({ minScale: 0.72 })}
                >
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  track: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    gap: TRACK_GAP,
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    left: 0,
    zIndex: 0,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  labelRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 0,
  },
  label: {
    ...jakartaBoldText,
    textAlign: 'center',
    lineHeight: UNIFORM_CHIP_FONT_SIZE + 4,
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  labelActive: {
    ...jakartaExtraBoldText,
  },
});
