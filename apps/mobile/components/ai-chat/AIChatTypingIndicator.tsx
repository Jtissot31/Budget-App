import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAIChatColors } from './theme';

const DOT_SIZE = 7;
const ANIM_DURATION = 420;

function AnimatedDot({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: ANIM_DURATION, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: ANIM_DURATION, easing: Easing.in(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
    transform: [{ translateY: -progress.value * 3.5 }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

export function AIChatTypingIndicator() {
  const palette = useAIChatColors();

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: palette.aiBubble,
            borderColor: palette.border,
            shadowColor: palette.aiBubbleShadow,
            shadowOpacity: palette.aiBubbleShadowOpacity,
          },
        ]}
      >
        <View style={styles.dots}>
          <AnimatedDot delay={0} color={palette.primary} />
          <AnimatedDot delay={140} color={palette.primary} />
          <AnimatedDot delay={280} color={palette.primary} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 48,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 44,
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
