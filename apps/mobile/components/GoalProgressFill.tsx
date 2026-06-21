import { memo, useEffect } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { GOAL_PROGRESS_FILL, radius } from '@/constants/theme';

const SHIMMER_DURATION_MS = 2600;
const SHIMMER_BAND_WIDTH = 30;

type Props = {
  pct: number;
  fillStyle?: StyleProp<ViewStyle>;
  /** Shimmer animation — disable in long lists for smoother scrolling. */
  animated?: boolean;
};

/** Unified savings-goal fill with a subtle in-progress shimmer sweep. */
export const GoalProgressFill = memo(function GoalProgressFill({ pct, fillStyle, animated = true }: Props) {
  const fillWidth = Math.min(100, pct > 0 ? Math.max(pct, 3) : 0);
  const inProgress = animated && pct > 0 && pct < 100;
  const shimmer = useSharedValue(0);
  const fillWidthPx = useSharedValue(0);

  useEffect(() => {
    if (inProgress) {
      shimmer.value = withRepeat(
        withTiming(1, {
          duration: SHIMMER_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        false,
      );
    } else {
      cancelAnimation(shimmer);
      shimmer.value = 0;
    }

    return () => cancelAnimation(shimmer);
    // shimmer is a stable Reanimated shared value — only restart when inProgress toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress]);

  const handleLayout = (event: LayoutChangeEvent) => {
    fillWidthPx.value = event.nativeEvent.layout.width;
  };

  const shimmerStyle = useAnimatedStyle(() => {
    const travel = Math.max(fillWidthPx.value, 1) + SHIMMER_BAND_WIDTH;

    return {
      transform: [
        {
          translateX: interpolate(shimmer.value, [0, 1], [-SHIMMER_BAND_WIDTH, travel]),
        },
      ],
      opacity: interpolate(shimmer.value, [0, 0.14, 0.86, 1], [0, 0.5, 0.5, 0]),
    };
  });

  const capStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.28, 0.4, 0.28]),
  }));

  return (
    <View
      style={[
        styles.fill,
        { width: `${fillWidth}%`, backgroundColor: GOAL_PROGRESS_FILL },
        fillStyle,
      ]}
      onLayout={handleLayout}
    >
      {inProgress ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.shimmerBand, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.34)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.cap, capStyle]} />
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  shimmerBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SHIMMER_BAND_WIDTH,
  },
  cap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
});
