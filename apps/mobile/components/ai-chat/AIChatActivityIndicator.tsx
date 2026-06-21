import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { jakartaMediumText } from '@/constants/theme';
import {
  type ActivityPhase,
  getActivityPhaseLabel,
} from '@/lib/ai/activityPhases';
import { useAIChatColors } from './theme';

type Props = {
  currentPhase: ActivityPhase | null;
  completedPhases: ActivityPhase[];
};

const VISIBLE_PHASES: ActivityPhase[] = [
  'analyse_finances',
  'reflexion',
  'analyse',
  'redaction',
];

function ActiveStepLabel({ label, color }: { label: string; color: string }) {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.stepLabel, { color }, jakartaMediumText, animatedStyle]}>
      {label}
    </Animated.Text>
  );
}

export function AIChatActivityIndicator({ currentPhase }: Props) {
  const palette = useAIChatColors();
  const label =
    currentPhase && VISIBLE_PHASES.includes(currentPhase)
      ? getActivityPhaseLabel(currentPhase, false)
      : 'Réflexion…';

  return (
    <View style={styles.wrapper}>
      <ActiveStepLabel label={label} color={palette.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  stepLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
});
