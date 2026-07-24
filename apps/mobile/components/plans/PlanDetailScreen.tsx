import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { PlanDetailsCollapsible } from '@/components/plans/PlanDetailsCollapsible';
import { PlanOptionsSheet, type PlanOptionId } from '@/components/plans/PlanOptionsSheet';
import { PlanStepsTimeline } from '@/components/plans/PlanStepsTimeline';
import { PlanWhyCard } from '@/components/plans/PlanWhyCard';
import {
  PLAN_DETAIL_LAYOUT,
  planDetailCardStyleFromTheme,
  planDetailFonts,
  usePlanDetailTheme,
} from '@/components/plans/planDetailTheme';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { interExtraBoldText, interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { planHeroAmountLine, planHeroSecondaryLine } from '@/lib/dashboardPlanPresentation';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import {
  archiveUserPlan,
  buildPlanEditParams,
  isPlanPaused,
  togglePlanPause,
} from '@/lib/plans/planDetailActions';
import { resolveDashboardPlanById } from '@/lib/plans/planDashboardAdapter';

type Props = {
  planId: string;
};

export function PlanDetailScreen({ planId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = usePlanDetailTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(() => resolveDashboardPlanById(planId));

  const refreshPlan = useCallback(() => {
    setPlan(resolveDashboardPlanById(planId));
  }, [planId]);

  useEffect(() => {
    refreshPlan();
    return dataEvents.subscribe(refreshPlan);
  }, [refreshPlan]);

  const paused = useMemo(() => isPlanPaused(plan), [plan]);
  const whyBullets = plan?.impactBullets?.slice(0, 2) ?? [];
  const cardStyle = planDetailCardStyleFromTheme(theme);
  const statusColor = plan?.statusTone === 'positive' ? theme.accent : theme.warning;

  const handleBack = () => {
    tapHaptic();
    router.back();
  };

  const handleMenu = () => {
    tapHaptic();
    setMenuOpen(true);
  };

  const handleOption = async (id: PlanOptionId) => {
    if (!plan || busy) return;
    setMenuOpen(false);

    if (id === 'edit') {
      setBusy(true);
      try {
        const params = await buildPlanEditParams(planId, plan);
        router.push({ pathname: '/plans/create', params });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (id === 'archive') {
      setArchiveConfirmOpen(true);
      return;
    }

    setBusy(true);
    try {
      await togglePlanPause(planId);
      refreshPlan();
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await archiveUserPlan(planId);
      setArchiveConfirmOpen(false);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.topBarSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Options du plan"
            hitSlop={12}
            onPress={handleMenu}
            disabled={!plan}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed,
              !plan && styles.disabled,
            ]}
          >
            <AppIcon family="material" name="more-horiz" size={22} color={theme.text} />
          </Pressable>
        </View>

        {!plan ? (
          <View style={[styles.emptyState, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Text style={[styles.emptyText, { color: theme.textMuted }, interMediumText]}>
              Plan introuvable.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
          >
            <View style={styles.titleBlock}>
              <AppIcon family="material-community" name={plan.icon} size={28} color={theme.textMuted} />
              <Text style={[styles.planTitle, { color: theme.text }, interExtraBoldText]}>{plan.name}</Text>
              <Text style={[styles.planSummary, { color: theme.textMuted }, interMediumText]}>
                {plan.summary}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }, interSemiboldText]}>{plan.status}</Text>
                <Text style={[styles.categoryPill, { color: theme.textMuted }, interMediumText]}>
                  · {plan.category}
                </Text>
              </View>
            </View>

            <View style={cardStyle}>
              <Text style={[planDetailFonts.heroAmount, { color: theme.text }]}>
                {plan.heroPrimary ?? planHeroAmountLine(plan)}
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: plan.progressPositive ? theme.accent : theme.danger,
                      width: `${Math.min(100, Math.max(0, plan.progress))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[planDetailFonts.heroMeta, { color: theme.textMuted }]}>
                {plan.heroSecondary ?? planHeroSecondaryLine(plan)}
              </Text>
            </View>

            {plan.metrics.length ? (
              <View style={styles.metricsGrid}>
                {plan.metrics.map((metric) => (
                  <View key={metric.id} style={[cardStyle, styles.metricCard]}>
                    <Text style={[planDetailFonts.detailLabel, { color: theme.textMuted }]}>
                      {metric.label}
                    </Text>
                    <Text
                      style={[
                        planDetailFonts.stepLabel,
                        {
                          color: metricToneColor(
                            metric.tone,
                            theme.accent,
                            theme.warning,
                            theme.danger,
                            theme.text,
                          ),
                        },
                      ]}
                    >
                      {metric.value}
                    </Text>
                    {metric.hint ? (
                      <Text style={[planDetailFonts.stepMeta, { color: theme.textMuted }]}>
                        {metric.hint}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <PlanStepsTimeline plan={plan} />

            <PlanWhyCard rationale={plan.rationale} bullets={whyBullets} />

            <PlanDetailsCollapsible plan={plan} />
          </ScrollView>
        )}
      </View>

      <PlanOptionsSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        isPaused={paused}
        onSelect={(id) => {
          void handleOption(id);
        }}
      />

      <ThemedConfirmModal
        visible={archiveConfirmOpen}
        title="Archiver ce plan ?"
        message="Le plan disparaîtra de Tes plans. Tu pourras en créer un nouveau plus tard."
        confirmLabel="Archiver"
        cancelLabel="Annuler"
        variant="warning"
        icon="archive-outline"
        onConfirm={() => {
          void handleArchiveConfirm();
        }}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </PageTransition>
  );
}

function metricToneColor(
  tone: 'default' | 'positive' | 'warning' | 'danger' | undefined,
  accent: string,
  warning: string,
  danger: string,
  text: string,
): string {
  switch (tone) {
    case 'positive':
      return accent;
    case 'warning':
      return warning;
    case 'danger':
      return danger;
    default:
      return text;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: spacing.xs,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: PLAN_DETAIL_LAYOUT.radiusSmall,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: PLAN_DETAIL_LAYOUT.sectionGap,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  planTitle: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  planSummary: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
  },
  categoryPill: {
    fontSize: 13,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.45,
  },
});
