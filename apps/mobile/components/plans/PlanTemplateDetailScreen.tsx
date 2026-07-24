import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { AvalancheStrategyContent } from '@/components/plans/AvalancheStrategyContent';
import { PlanTimeline } from '@/components/plans/PlanTimeline';
import { PlanWhyCard } from '@/components/plans/PlanWhyCard';
import { SnowballStrategyContent } from '@/components/plans/SnowballStrategyContent';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  planFinanceCardStyle,
  planFinanceContainerPressedStyle,
  planFinanceFonts,
  planFinanceIconButtonStyle,
  planFinanceKit,
  planFinancePrimaryButtonStyle,
} from '@/constants/planFinanceKit';
import { interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { tapHaptic } from '@/lib/haptics';
import { enrichPlanTemplateWhy } from '@/lib/ai/planAdaptationService';
import { PLAN_SUBTYPE_LABELS, planCategoryForSubtype, type PlanSubtype } from '@/lib/plans/Plan';
import { getCategoryIcon } from '@/lib/plans/planCardPresentation';
import { buildPrefilledSubtypeEntryParams } from '@/lib/plans/planCreateNavigation';
import { getPlanSubtypeConfig } from '@/lib/plans/planSubtypeConfig';
import { timelineStepsForTemplate } from '@/lib/plans/planTimelineModel';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  subtype: PlanSubtype;
  /** Raison personnalisée si ouvert depuis une suggestion IA. */
  raison?: string;
};

export function PlanTemplateDetailScreen({ subtype, raison }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const config = getPlanSubtypeConfig(subtype);
  const category = planCategoryForSubtype(subtype);
  const pf = planFinanceKit.colors;
  const hasStrategyTemplate = subtype === 'snowball' || subtype === 'avalanche';
  const staticWhy = config.fullDescription;
  const [whyText, setWhyText] = useState(raison?.trim() || staticWhy);
  const strategyText = config.strategy;

  const roadmapSteps = useMemo(
    () =>
      timelineStepsForTemplate(subtype, {
        whyDetail: whyText,
        strategyDetail: strategyText,
      }),
    [subtype, whyText, strategyText],
  );

  useEffect(() => {
    if (raison?.trim()) {
      setWhyText(raison.trim());
      return;
    }
    if (subtype === 'snowball' || subtype === 'avalanche') return;

    let cancelled = false;
    setWhyText(staticWhy);

    async function loadWhy() {
      const enriched = await enrichPlanTemplateWhy(
        subtype,
        PLAN_SUBTYPE_LABELS[subtype],
        staticWhy,
      );
      if (!cancelled) setWhyText(enriched);
    }

    void loadWhy();
    return () => {
      cancelled = true;
    };
  }, [raison, staticWhy, subtype]);

  const handleBack = () => {
    tapHaptic();
    router.back();
  };

  const handleCreate = () => {
    tapHaptic();
    router.push({
      pathname: '/plans/create',
      params: {
        ...buildPrefilledSubtypeEntryParams(subtype, category),
        ...(whyText !== staticWhy || raison ? { raison: whyText } : {}),
      },
    });
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.screenCanvas || pf.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={handleBack}
            style={({ pressed }) => [
              planFinanceIconButtonStyle(),
              pressed && planFinanceContainerPressedStyle(),
            ]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          {hasStrategyTemplate ? (
            <Text style={[styles.inlineTitle, { color: colors.text }]} numberOfLines={2}>
              {subtype === 'snowball' ? 'Stratégie Boule de neige' : 'Stratégie Avalanche'}
            </Text>
          ) : null}
          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl + 88 },
          ]}
        >
          {subtype === 'snowball' ? (
            <SnowballStrategyContent whyOverride={raison} />
          ) : subtype === 'avalanche' ? (
            <AvalancheStrategyContent whyOverride={raison} />
          ) : (
            <>
              <View style={styles.titleBlock}>
                <AppIcon
                  family="material-community"
                  name={getCategoryIcon(category)}
                  size={28}
                  color={colors.textMuted}
                />
                <Text style={[styles.planTitle, planFinanceFonts.heroTitle, { color: colors.text }]}>
                  {PLAN_SUBTYPE_LABELS[subtype]}
                </Text>
                <Text style={[styles.modelBadge, interMediumText, { color: colors.textMuted }]}>Modèle</Text>
                <Text style={[styles.planSummary, planFinanceFonts.body, { color: colors.textMuted }]}>
                  {config.fullDescription}
                </Text>
              </View>

              <PlanTimeline steps={roadmapSteps} sectionLabel="FEUILLE DE ROUTE" />

              <PlanWhyCard rationale={whyText} bullets={config.impactBullets} />

              <View style={[planFinanceCardStyle(), styles.block]}>
                <Text style={[planFinanceFonts.sectionCaps, { color: colors.accentGreen || colors.primary }]}>
                  STRATÉGIE
                </Text>
                <Text style={[planFinanceFonts.body, styles.blockBody, { color: colors.text }]}>
                  {strategyText}
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              backgroundColor: colors.screenCanvas || pf.background,
              borderTopColor: colors.containerBorder,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Créer ce plan"
            onPress={handleCreate}
            style={({ pressed }) => [
              planFinancePrimaryButtonStyle(),
              pressed && planFinanceContainerPressedStyle(),
            ]}
          >
            <Text style={[styles.ctaLabel, interSemiboldText]}>Créer ce plan</Text>
          </Pressable>
        </View>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  topBarSpacer: { flex: 1 },
  inlineTitle: {
    ...typographyKit.sectionTitle,
    flexShrink: 1,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: planFinanceKit.layout.sectionGap,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  planTitle: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  modelBadge: {
    fontSize: 13,
  },
  planSummary: {
    marginTop: spacing.xs,
  },
  block: {
    gap: spacing.md,
  },
  blockBody: {
    marginTop: spacing.xs,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaLabel: {
    color: planFinanceKit.colors.textOnAccent,
    fontSize: 16,
    letterSpacing: -0.1,
  },
});
