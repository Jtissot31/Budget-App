import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { liquidSegmentedSettleSpring } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 22;
const THUMB_SIZE = 18;
const THUMB_PADDING = 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_PADDING * 2;

type Props = {
  value: boolean;
  onValueChange: (enabled: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean; disabled?: boolean };
};

export function PremiumSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const { colors } = useAppTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, liquidSegmentedSettleSpring);
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.toggleTrackOff, colors.toggleTrackOn],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        checked: value,
        disabled,
        ...accessibilityState,
      }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}
    >
      <Animated.View
        style={[
          styles.track,
          { borderColor: colors.toggleBorder },
          trackStyle,
          disabled && styles.disabled,
        ]}
      >
        <Animated.View
          style={[styles.thumb, { backgroundColor: colors.toggleThumb }, thumbStyle]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: THUMB_PADDING,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.45,
  },
});
