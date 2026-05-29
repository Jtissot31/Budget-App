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
import { radius, spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const DOT_SIZE = 6;
const ANIM_DURATION = 420;

function AnimatedDot({ delay }: { delay: number }) {
  const { colors } = useAppTheme();
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
    transform: [{ translateY: -progress.value * 3 }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: colors.primary },
        animatedStyle,
      ]}
    />
  );
}

export function TypingIndicator() {
  const { colors, isLight } = useAppTheme();

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isLight ? colors.surfaceSolid : colors.surfaceSolid,
            borderColor: isLight ? colors.border : colors.glassBorder,
          },
        ]}
      >
        <View style={styles.dots}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={140} />
          <AnimatedDot delay={280} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingBottom: spacing.sm,
  },
  bubble: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 36,
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
