import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { interMediumText, interRegularText } from '@/constants/theme';
import {
  type ActivityPhase,
  getActivityPhaseLabel,
} from '@/lib/ai/activityPhases';
import { useAIChatColors } from './theme';

type ActivityStep = {
  phase: ActivityPhase;
  status: 'active' | 'completed';
};

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

function buildSteps(currentPhase: ActivityPhase | null, completedPhases: ActivityPhase[]): ActivityStep[] {
  const steps: ActivityStep[] = completedPhases
    .filter((phase) => VISIBLE_PHASES.includes(phase))
    .map((phase) => ({
      phase,
      status: 'completed' as const,
    }));

  if (currentPhase && VISIBLE_PHASES.includes(currentPhase)) {
    steps.push({ phase: currentPhase, status: 'active' });
  }

  return steps;
}

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
    <Animated.Text style={[styles.stepLabel, styles.activeStepLabel, { color }, interMediumText, animatedStyle]}>
      {label}
    </Animated.Text>
  );
}

function ActivityStepRow({ step, index }: { step: ActivityStep; index: number }) {
  const palette = useAIChatColors();
  const isActive = step.status === 'active';
  const label = getActivityPhaseLabel(step.phase, !isActive);

  return (
    <Animated.View entering={FadeIn.duration(280).delay(index * 60)} style={styles.stepRow}>
      {isActive ? (
        <ActiveStepLabel label={label} color={palette.text} />
      ) : (
        <Text style={[styles.stepLabel, { color: palette.textMuted }, interRegularText]}>
          {label}
        </Text>
      )}
      {!isActive ? (
        <Text style={[styles.checkmark, { color: palette.textMuted }]} accessibilityElementsHidden>
          ✓
        </Text>
      ) : null}
    </Animated.View>
  );
}

export function AIChatActivityIndicator({ currentPhase, completedPhases }: Props) {
  const palette = useAIChatColors();
  const steps = buildSteps(currentPhase, completedPhases);

  if (steps.length === 0) {
    return (
      <View style={styles.wrapper}>
        <ActiveStepLabel label="Réflexion…" color={palette.text} />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {steps.map((step, index) => (
        <ActivityStepRow key={step.phase} step={step} index={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 20,
  },
  stepLabel: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  activeStepLabel: {
    flex: 1,
  },
  checkmark: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.7,
  },
});
