import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { ExploreMorePlansRow } from '@/components/plans/ExploreMorePlansRow';
import { FynChatEntryCard } from '@/components/plans/FynChatEntryCard';
import { WidgetGalleryShortcutRow } from '@/components/plans/WidgetGalleryShortcutRow';
import { HubLoansSection } from '@/components/plans/HubLoansSection';
import { HubSavingsGoalsSection } from '@/components/plans/HubSavingsGoalsSection';
import { HubSectionHeader } from '@/components/plans/HubSectionHeader';
import { PlanHubCardCarousel } from '@/components/plans/PlanHubCardCarousel';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_STYLE, spacing } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { dataEvents } from '@/lib/events';
import type { Plan, PlanActifOuTermine, PlanSuggere } from '@/lib/plans/Plan';
import { buildTemplateDetailParams } from '@/lib/plans/planCreateNavigation';
import {
  enrichPlanHubSuggestions,
  loadPlanHubStoredPlans,
  loadPlanHubSuggestions,
  selectPlansForMainHub,
} from '@/lib/plans/planHubData';

/** Active/paused only when any exist; otherwise suggestions only — never mixed. */
function plansForHubCarousel(activePlans: PlanActifOuTermine[], suggestions: PlanSuggere[]): Plan[] {
  if (activePlans.length > 0) return activePlans;
  return suggestions;
}

export function PlanFinancierHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [listPlans, setListPlans] = useState<PlanActifOuTermine[]>([]);
  const [suggestedPlans, setSuggestedPlans] = useState<PlanSuggere[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const enrichGenerationRef = useRef(0);

  const applyStoredPlans = useCallback((storedPlans: Plan[]) => {
    setListPlans(selectPlansForMainHub(storedPlans) as PlanActifOuTermine[]);
  }, []);

  const loadStoredPlans = useCallback(async () => {
    const storedPlans = await loadPlanHubStoredPlans();
    applyStoredPlans(storedPlans);
    return storedPlans;
  }, [applyStoredPlans]);

  const loadSuggestions = useCallback(async () => {
    const suggestions = await loadPlanHubSuggestions({ skipEnrichment: true });
    setSuggestedPlans(suggestions);

    if (suggestions.length === 0) return suggestions;

    const generation = enrichGenerationRef.current + 1;
    enrichGenerationRef.current = generation;

    void enrichPlanHubSuggestions(suggestions)
      .then((enriched) => {
        if (enrichGenerationRef.current !== generation) return;
        setSuggestedPlans(enriched);
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('[PlanFinancierHub] suggestion enrichment failed', error);
      });

    return suggestions;
  }, []);

  const reloadHub = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      await Promise.all([loadStoredPlans(), loadSuggestions()]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [loadStoredPlans, loadSuggestions]);

  const carouselPlans = useMemo(
    () => plansForHubCarousel(listPlans, suggestedPlans),
    [listPlans, suggestedPlans],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPlansLoading(true);
      try {
        await loadStoredPlans();
      } catch (error: unknown) {
        if (__DEV__) console.warn('[PlanFinancierHub] stored plans load failed', error);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStoredPlans]);

  useEffect(() => {
    void (async () => {
      setSuggestionsLoading(true);
      try {
        await loadSuggestions();
      } catch (error: unknown) {
        if (__DEV__) console.warn('[PlanFinancierHub] suggestions load failed', error);
      } finally {
        setSuggestionsLoading(false);
      }
    })();
    return () => {
      enrichGenerationRef.current += 1;
    };
  }, [loadSuggestions]);

  useEffect(() => dataEvents.subscribe(reloadHub), [reloadHub]);
  useRefreshOnFocus(reloadHub, { skipInitial: true });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadHub();
    } catch (error: unknown) {
      if (__DEV__) console.warn('[PlanFinancierHub] refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [reloadHub]);

  const handleOpenPlan = useCallback(
    (planId: string) => {
      const suggested = suggestedPlans.find((plan) => plan.id === planId);
      if (suggested) {
        router.push({
          pathname: '/plans/template/[subtype]',
          params: buildTemplateDetailParams(suggested.subtype, {
            raison: suggested.raison_recommandation,
            suggestedId: suggested.id,
          }),
        });
        return;
      }
      router.push({ pathname: '/plans/[id]', params: { id: planId } });
    },
    [router, suggestedPlans],
  );

  const handleOpenExplorer = useCallback(() => {
    router.push('/plans/explore');
  }, [router]);

  const handleOpenWidgetGallery = useCallback(() => {
    router.push('/widgets');
  }, [router]);

  const showCarouselSpinner =
    carouselPlans.length === 0 && (plansLoading || suggestionsLoading);
  const isEmpty = !plansLoading && !suggestionsLoading && carouselPlans.length === 0;
  const pf = planFinanceKit.colors;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: pf.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
          <Text style={[styles.title, PAGE_TITLE_STYLE, { color: pf.text }]}>Plan financier</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={pf.accent}
            />
          }
        >
          <View style={styles.plansSection}>
            <HubSectionHeader eyebrow="Stratégie" title="Plan financier" />

            {showCarouselSpinner ? (
              <View style={styles.carouselLoadingWrap}>
                <ActivityIndicator color={pf.accent} />
              </View>
            ) : isEmpty ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Aucun plan financier actif pour l&apos;instant.
                </Text>
                <ExploreMorePlansRow onPress={handleOpenExplorer} prominent />
              </View>
            ) : (
              <>
                <PlanHubCardCarousel plans={carouselPlans} onOpenPlan={handleOpenPlan} />
                <ExploreMorePlansRow onPress={handleOpenExplorer} />
              </>
            )}
          </View>

          <HubSavingsGoalsSection />

          <HubLoansSection />

          <FynChatEntryCard />

          <WidgetGalleryShortcutRow onPress={handleOpenWidgetGallery} />
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: planFinanceKit.layout.sectionGap,
  },
  plansSection: {
    gap: spacing.sm,
  },
  carouselLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingVertical: spacing.xl,
  },
  emptyState: {
    alignItems: 'stretch',
    gap: spacing.xl,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    color: planFinanceKit.colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
