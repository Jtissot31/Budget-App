import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

const ICON_TRACK_WIDTH = 52;
const ICON_TRACK_HEIGHT = 28;
const ICON_THUMB_SIZE = 22;
const ICON_THUMB_PADDING = 3;

type Props = {
  value: boolean;
  onValueChange: (enabled: boolean) => void;
  disabled?: boolean;
  /** Overrides theme `toggleTrackOn` (e.g. Accueil theme switch — no accent green). */
  trackOnColor?: string;
  /** Optional icon pinned to the left inside the track (classic theme switch). */
  leftIcon?: ReactNode;
  /** Optional icon pinned to the right inside the track. */
  rightIcon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { checked?: boolean; disabled?: boolean };
};

export function PremiumSwitch({
  value,
  onValueChange,
  disabled = false,
  trackOnColor,
  leftIcon,
  rightIcon,
  accessibilityLabel,
  accessibilityState,
}: Props) {
  const { colors } = useAppTheme();
  const onTrack = trackOnColor ?? colors.toggleTrackOn;
  const progress = useSharedValue(value ? 1 : 0);
  const hasTrackIcons = leftIcon != null || rightIcon != null;

  const trackWidth = hasTrackIcons ? ICON_TRACK_WIDTH : TRACK_WIDTH;
  const trackHeight = hasTrackIcons ? ICON_TRACK_HEIGHT : TRACK_HEIGHT;
  const thumbSize = hasTrackIcons ? ICON_THUMB_SIZE : THUMB_SIZE;
  const thumbPadding = hasTrackIcons ? ICON_THUMB_PADDING : THUMB_PADDING;
  const thumbTravel = trackWidth - thumbSize - thumbPadding * 2;

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, liquidSegmentedSettleSpring);
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.toggleTrackOff, onTrack],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * thumbTravel }],
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
          {
            width: trackWidth,
            height: trackHeight,
            borderRadius: trackHeight / 2,
            borderColor: colors.toggleBorder,
            padding: thumbPadding,
          },
          trackStyle,
          disabled && styles.disabled,
        ]}
      >
        {hasTrackIcons ? (
          <View pointerEvents="none" style={styles.iconsRow}>
            <View style={styles.iconSlot}>{leftIcon}</View>
            <View style={styles.iconSlot}>{rightIcon}</View>
          </View>
        ) : null}
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: colors.toggleThumb,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  iconsRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  iconSlot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    zIndex: 1,
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
