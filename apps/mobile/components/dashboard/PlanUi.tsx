import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { interMediumText, interSemiboldText, radius, spacing, typography } from '@/constants/theme';
import type { DashboardPlanDetail, DashboardPlanMetricTone } from '@/lib/dashboardPlansMock';
import { useAppTheme } from '@/lib/themeContext';

function metricToneColor(tone: DashboardPlanMetricTone | undefined, colors: ReturnType<typeof useAppTheme>['colors']) {
  if (tone === 'positive') return colors.accentGreen;
  if (tone === 'warning') return colors.warning;
  if (tone === 'danger') return colors.danger;
  return colors.text;
}

export function PlanMetricsGrid({ metrics }: { metrics: DashboardPlanDetail['metrics'] }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.metricsGrid}>
      {metrics.map((metric) => (
        <View
          key={metric.id}
          style={[styles.metricCell, { backgroundColor: colors.containerBackground }]}
        >
          <Text style={[styles.metricLabel, { color: colors.textMuted }, interMediumText]} numberOfLines={2}>
            {metric.label}
          </Text>
          <Text
            style={[styles.metricValue, { color: metricToneColor(metric.tone, colors) }, interSemiboldText]}
            numberOfLines={1}
          >
            {metric.value}
          </Text>
          {metric.hint ? (
            <Text style={[styles.metricHint, { color: colors.textMuted }, interMediumText]} numberOfLines={1}>
              {metric.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function PlanNextActionCard({ plan }: { plan: DashboardPlanDetail }) {
  const { colors } = useAppTheme();
  const accent = plan.progressPositive ? colors.accentGreen : colors.warning;

  return (
    <View
      style={[
        styles.nextActionCard,
        { backgroundColor: colors.containerBackground, borderColor: `${accent}33` },
      ]}
    >
      <View style={styles.nextActionHeader}>
        <MaterialIcons name="flag" size={16} color={accent} />
        <Text style={[styles.nextActionBadge, { color: accent }, interSemiboldText]}>PROCHAINE ACTION</Text>
      </View>
      <Text style={[styles.nextActionTitle, { color: colors.text }, interSemiboldText]}>{plan.nextAction.title}</Text>
      <Text style={[styles.nextActionBody, { color: colors.textMuted }, interMediumText]}>
        {plan.nextAction.description}
      </Text>
    </View>
  );
}

export function PlanStepList({ steps }: { steps: DashboardPlanDetail['steps'] }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.stepsBlock}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.stepItem}>
          <View style={styles.stepTimeline}>
            <MaterialIcons
              name={step.completed ? 'check-circle' : 'radio-button-unchecked'}
              size={20}
              color={step.completed ? colors.accentGreen : colors.textMuted}
            />
            {index < steps.length - 1 ? (
              <View
                style={[
                  styles.stepConnector,
                  { backgroundColor: step.completed ? colors.accentGreen : colors.border },
                ]}
              />
            ) : null}
          </View>
          <View style={styles.stepCopy}>
            <Text
              style={[
                styles.stepLabel,
                { color: step.completed ? colors.textMuted : colors.text },
                interSemiboldText,
                step.completed && styles.stepLabelDone,
              ]}
            >
              {step.label}
            </Text>
            {step.description ? (
              <Text style={[styles.stepDescription, { color: colors.textMuted }, interMediumText]}>
                {step.description}
              </Text>
            ) : null}
            {step.dueLabel ? (
              <Text style={[styles.stepDue, { color: colors.textMuted }, interMediumText]}>{step.dueLabel}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCell: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
    minWidth: 140,
  },
  metricLabel: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 3,
  },
  metricValue: {
    fontSize: typography.caption,
  },
  metricHint: {
    fontSize: 11,
  },
  nextActionCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  nextActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nextActionBadge: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  nextActionTitle: {
    fontSize: typography.caption,
  },
  nextActionBody: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 5,
  },
  stepsBlock: {
    gap: 0,
  },
  stepItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepTimeline: {
    alignItems: 'center',
    width: 22,
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
  stepLabel: {
    fontSize: typography.caption,
  },
  stepLabelDone: {
    textDecorationLine: 'line-through',
  },
  stepDescription: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 5,
  },
  stepDue: {
    fontSize: 11,
  },
});
