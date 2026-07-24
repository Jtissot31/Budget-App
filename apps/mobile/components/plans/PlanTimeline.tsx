import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { planDetailFonts, usePlanDetailTheme } from '@/components/plans/planDetailTheme';
import { spacing } from '@/constants/theme';
import type { PlanTimelineStep } from '@/lib/plans/planTimelineModel';

type Props = {
  steps: readonly PlanTimelineStep[];
  /** Section label above the timeline. Default: ÉTAPES */
  sectionLabel?: string;
  /** Hide the uppercase section label (e.g. when embedded under another heading). */
  hideSectionLabel?: boolean;
};

const NODE = 22;
const OUTER = 30;

/**
 * Canonical vertical plan timeline — shared by in-progress detail and explanatory templates.
 * Node states: completed (solid + check), active (double ring), upcoming (hollow).
 */
export function PlanTimeline({ steps, sectionLabel = 'ÉTAPES', hideSectionLabel }: Props) {
  const theme = usePlanDetailTheme();

  return (
    <View style={styles.section}>
      {!hideSectionLabel ? (
        <Text style={[styles.sectionLabel, planDetailFonts.sectionCaps, { color: theme.textMuted }]}>
          {sectionLabel}
        </Text>
      ) : null}
      <View style={styles.stepsBlock}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'active';
          const connectorColor = isCompleted ? theme.accent : theme.border;

          return (
            <View key={step.id} style={styles.stepItem}>
              <View style={styles.stepTimeline}>
                <TimelineNode status={step.status} accent={theme.accent} muted={theme.textMuted} />
                {!isLast ? (
                  <View style={[styles.stepConnector, { backgroundColor: connectorColor }]} />
                ) : null}
              </View>

              <View style={[styles.stepCopy, isActive && styles.stepCopyActive]}>
                <Text
                  style={[
                    planDetailFonts.stepLabel,
                    { color: isCompleted ? theme.textMuted : theme.text },
                    isCompleted && styles.stepLabelDone,
                  ]}
                >
                  {step.title}
                </Text>

                {isCompleted && step.dateLabel ? (
                  <Text style={[planDetailFonts.stepMeta, { color: theme.textMuted }]}>
                    {step.dateLabel}
                  </Text>
                ) : null}

                {isActive ? (
                  <>
                    {step.summary ? (
                      <Text style={[planDetailFonts.bodyMedium, { color: theme.textMuted }]}>
                        {step.summary}
                      </Text>
                    ) : null}
                    {step.detail ? (
                      <Text style={[planDetailFonts.body, { color: theme.text }]}>{step.detail}</Text>
                    ) : null}
                    {step.dateLabel ? (
                      <Text style={[planDetailFonts.stepMeta, { color: theme.accent }]}>
                        {step.dateLabel}
                      </Text>
                    ) : null}
                  </>
                ) : null}

                {step.status === 'upcoming' ? (
                  <>
                    {step.summary ? (
                      <Text style={[planDetailFonts.stepMeta, { color: theme.textMuted }]}>
                        {step.summary}
                      </Text>
                    ) : null}
                    {step.dateLabel ? (
                      <Text style={[planDetailFonts.stepMeta, { color: theme.textMuted }]}>
                        {step.dateLabel}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TimelineNode({
  status,
  accent,
  muted,
}: {
  status: PlanTimelineStep['status'];
  accent: string;
  muted: string;
}) {
  if (status === 'completed') {
    return (
      <View style={[styles.nodeSolid, { backgroundColor: accent }]}>
        <AppIcon family="material" name="check" size={14} color="#FFFFFF" />
      </View>
    );
  }

  if (status === 'active') {
    return (
      <View style={[styles.nodeOuter, { borderColor: accent }]}>
        <View style={[styles.nodeInner, { backgroundColor: accent }]} />
      </View>
    );
  }

  return <View style={[styles.nodeHollow, { borderColor: muted }]} />;
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
    gap: spacing.md,
  },
  stepTimeline: {
    alignItems: 'center',
    width: OUTER,
  },
  nodeSolid: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: (OUTER - NODE) / 2,
  },
  nodeOuter: {
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nodeHollow: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    backgroundColor: 'transparent',
    marginTop: (OUTER - NODE) / 2,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: spacing.lg,
    marginVertical: spacing.xs,
    borderRadius: 1,
  },
  stepCopy: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
    paddingTop: (OUTER - NODE) / 2 + 1,
  },
  stepCopyActive: {
    gap: spacing.sm,
  },
  stepLabelDone: {
    textDecorationLine: 'line-through',
  },
});
