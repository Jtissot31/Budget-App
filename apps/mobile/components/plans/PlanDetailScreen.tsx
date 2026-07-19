import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { PlanDetailsCollapsible } from '@/components/plans/PlanDetailsCollapsible';
import { PlanStepsTimeline } from '@/components/plans/PlanStepsTimeline';
import { PLAN_DETAIL, planDetailCardStyle, planDetailFonts } from '@/components/plans/planDetailTheme';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { interExtraBoldText, interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { planHeroAmountLine, planHeroSecondaryLine } from '@/lib/dashboardPlanPresentation';
import { resolveDashboardPlanById } from '@/lib/plans/planDashboardAdapter';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  planId: string;
};

export function PlanDetailScreen({ planId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const plan = resolveDashboardPlanById(planId);

  const handleBack = () => {
    tapHaptic();
    router.back();
  };

  const handleMenu = () => {
    tapHaptic();
    // TODO: menu plan (pause, modifier, archiver)
  };

  const statusColor = plan?.statusTone === 'positive' ? PLAN_DETAIL.accent : '#E6A000';
  const whyBullets = plan?.impactBullets?.slice(0, 2) ?? [];

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: PLAN_DETAIL.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: PLAN_DETAIL.surface, borderColor: PLAN_DETAIL.border },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={PLAN_DETAIL.text} />
          </Pressable>
          <View style={styles.topBarSpacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Options du plan"
            hitSlop={12}
            onPress={handleMenu}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: PLAN_DETAIL.surface, borderColor: PLAN_DETAIL.border },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="material" name="more-horiz" size={22} color={PLAN_DETAIL.text} />
          </Pressable>
        </View>

        {!plan ? (
          <View style={[styles.emptyState, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Text style={[styles.emptyText, { color: PLAN_DETAIL.textMuted }, interMediumText]}>
              Plan introuvable.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
          >
            {/* 1 — Header (inchangé) */}
            <View style={styles.titleBlock}>
              <AppIcon family="material-community" name={plan.icon} size={28} color={PLAN_DETAIL.textMuted} />
              <Text style={[styles.planTitle, { color: PLAN_DETAIL.text }, interExtraBoldText]}>{plan.name}</Text>
              <Text style={[styles.planSummary, { color: PLAN_DETAIL.textMuted }, interMediumText]}>
                {plan.summary}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }, interSemiboldText]}>{plan.status}</Text>
                <Text style={[styles.categoryPill, { color: PLAN_DETAIL.textMuted }, interMediumText]}>
                  · {plan.category}
                </Text>
              </View>
            </View>

            {/* 2 — Hero progression (seule source de vérité chiffrée) */}
            <View style={planDetailCardStyle.card}>
              <Text style={[planDetailFonts.heroAmount, { color: PLAN_DETAIL.text }]}>
                {plan.heroPrimary ?? planHeroAmountLine(plan)}
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: PLAN_DETAIL.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: plan.progressPositive ? PLAN_DETAIL.accent : '#F87171',
                      width: `${Math.min(100, Math.max(0, plan.progress))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[planDetailFonts.heroMeta, { color: PLAN_DETAIL.textMuted }]}>
                {plan.heroSecondary ?? planHeroSecondaryLine(plan)}
              </Text>
            </View>

            {/* 3 — Métriques spécifiques au type de plan */}
            {plan.metrics.length ? (
              <View style={styles.metricsGrid}>
                {plan.metrics.map((metric) => (
                  <View key={metric.id} style={[planDetailCardStyle.card, styles.metricCard]}>
                    <Text style={[planDetailFonts.detailLabel, { color: PLAN_DETAIL.textMuted }]}>
                      {metric.label}
                    </Text>
                    <Text style={[planDetailFonts.stepLabel, { color: metricToneColor(metric.tone) }]}>
                      {metric.value}
                    </Text>
                    {metric.hint ? (
                      <Text style={[planDetailFonts.stepMeta, { color: PLAN_DETAIL.textMuted }]}>{metric.hint}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* 4 — Étapes (timeline + prochaine action fusionnée) */}
            <PlanStepsTimeline plan={plan} />

            {/* 4 — Pourquoi ce plan */}
            <View style={[planDetailCardStyle.card, styles.whyCard]}>
              <Text style={[planDetailFonts.sectionCaps, { color: PLAN_DETAIL.accent }]}>POURQUOI CE PLAN</Text>
              <Text style={[planDetailFonts.body, { color: PLAN_DETAIL.text }]}>{plan.rationale}</Text>
              {whyBullets.length ? (
                <View style={styles.bullets}>
                  {whyBullets.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <View style={[styles.bulletDot, { backgroundColor: PLAN_DETAIL.textMuted }]} />
                      <Text style={[planDetailFonts.body, { color: PLAN_DETAIL.text, flex: 1 }]}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* 5 — Détails repliables */}
            <PlanDetailsCollapsible plan={plan} />
          </ScrollView>
        )}
      </View>
    </PageTransition>
  );
}

function metricToneColor(tone?: 'default' | 'positive' | 'warning' | 'danger'): string {
  switch (tone) {
    case 'positive':
      return PLAN_DETAIL.accent;
    case 'warning':
      return '#E6A000';
    case 'danger':
      return '#F87171';
    default:
      return PLAN_DETAIL.text;
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
    borderRadius: PLAN_DETAIL.radiusSmall,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: PLAN_DETAIL.sectionGap,
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
  whyCard: {
    gap: spacing.md,
  },
  bullets: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
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
});
