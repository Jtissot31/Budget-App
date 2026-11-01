/**
 * Voice orb — a living mic: soft rings breathe with the live input level, a thin ring fills
 * during the end-of-speech silence (auto-stop countdown), and it pulses slowly while thinking.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon } from '@/components/icons/AppIcon';
import { RingGauge } from '@/components/kit';
import { useAppTheme } from '@/lib/themeContext';

const SIZE = 132;
const CORE = 76;
const RINGS = [0, 1, 2];

type Props = {
  mode: 'listening' | 'thinking' | 'idle';
  /** 0..1 live mic level. */
  level: number;
  /** 0..1 silence countdown before auto-stop. */
  silenceProgress: number;
};

export function VoiceOrb({ mode, level, silenceProgress }: Props) {
  const { colors } = useAppTheme();
  const smooth = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    smooth.value = withTiming(mode === 'listening' ? level : 0, { duration: 140, easing: Easing.out(Easing.quad) });
  }, [level, mode, smooth]);

  useEffect(() => {
    if (mode === 'thinking') {
      pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [mode, pulse]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + smooth.value * 0.06 - pulse.value * 0.05 }],
    opacity: 1 - pulse.value * 0.25,
  }));

  return (
    <View style={styles.orb}>
      {RINGS.map((index) => (
        <Ring key={index} index={index} level={smooth} color={colors.accentGreen} />
      ))}
      {mode === 'listening' && silenceProgress > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>
            <RingGauge progress={silenceProgress} color={colors.accentGreen} size={CORE + 16} stroke={3} />
          </View>
        </View>
      ) : null}
      <Animated.View style={[styles.core, { backgroundColor: colors.text }, coreStyle]}>
        <AppIcon family="ionicons" name={mode === 'thinking' ? 'sparkles' : 'mic'} size={30} color={colors.background} />
      </Animated.View>
    </View>
  );
}

function Ring({ index, level, color }: { index: number; level: { value: number }; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + level.value * (0.28 + index * 0.18) }],
    opacity: (0.22 - index * 0.06) * (0.35 + level.value * 0.65),
  }));
  return <Animated.View style={[styles.ring, { borderColor: color, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  orb: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: CORE, height: CORE, borderRadius: CORE / 2, borderWidth: 1 },
  core: { width: CORE, height: CORE, borderRadius: CORE / 2, alignItems: 'center', justifyContent: 'center' },
});
