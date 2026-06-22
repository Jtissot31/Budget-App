import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { spacing } from '@/constants/theme';
import type { PlanFinancier } from '@/lib/dashboardPlansMock';
import { planActiveStepIndex } from '@/lib/dashboardPlanPresentation';
import { PLAN_DETAIL, planDetailFonts } from './planDetailTheme';

type Props = {
  plan: PlanFinancier;
};

export function PlanStepsTimeline({ plan }: Props) {
  const activeIndex = planActiveStepIndex(plan);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, planDetailFonts.sectionCaps, { color: PLAN_DETAIL.textMuted }]}>
        ÉTAPES
      </Text>
      <View style={styles.stepsBlock}>
        {plan.steps.map((step, index) => {
          const isActive = !step.completed && index === activeIndex;
          const isLast = index === plan.steps.length - 1;

          return (
            <View key={step.id} style={styles.stepItem}>
              <View style={styles.stepTimeline}>
                <View
                  style={[
                    styles.stepIconRing,
                    isActive && { borderColor: PLAN_DETAIL.accent, backgroundColor: PLAN_DETAIL.accentMuted },
                  ]}
                >
                  <MaterialIcons
                    name={step.completed ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color={step.completed ? PLAN_DETAIL.accent : isActive ? PLAN_DETAIL.accent : PLAN_DETAIL.textMuted}
                  />
                </View>
                {!isLast ? (
                  <View
                    style={[
                      styles.stepConnector,
                      { backgroundColor: step.completed ? PLAN_DETAIL.accent : PLAN_DETAIL.border },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.stepCopy}>
                <Text
                  style={[
                    planDetailFonts.stepLabel,
                    { color: step.completed ? PLAN_DETAIL.textMuted : PLAN_DETAIL.text },
                    step.completed && styles.stepLabelDone,
                  ]}
                >
                  {step.label}
                </Text>
                {step.description ? (
                  <Text style={[planDetailFonts.stepMeta, { color: PLAN_DETAIL.textMuted }]}>{step.description}</Text>
                ) : null}
                {isActive ? (
                  <Text style={[planDetailFonts.bodyMedium, { color: PLAN_DETAIL.text }]}>
                    {plan.nextAction.description}
                  </Text>
                ) : null}
                {step.dueLabel ? (
                  <Text style={[planDetailFonts.stepMeta, { color: PLAN_DETAIL.textMuted }]}>{step.dueLabel}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionLabel: {},
  stepsBlock: {
    gap: 0,
  },
  stepItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepTimeline: {
    alignItems: 'center',
    width: 28,
  },
  stepIconRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 1,
  },
  stepCopy: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  stepLabelDone: {
    textDecorationLine: 'line-through',
  },
});
