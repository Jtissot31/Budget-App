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
import { ComponentLibraryShortcutRow } from '@/components/plans/ComponentLibraryShortcutRow';
import { HubLoansSection } from '@/components/plans/HubLoansSection';
import { HubSavingsGoalsSection } from '@/components/plans/HubSavingsGoalsSection';
import { HubSectionHeader, HUB_SECTION_INNER_GAP } from '@/components/plans/HubSectionHeader';
import { PlanHubCardCarousel } from '@/components/plans/PlanHubCardCarousel';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { SPACING } from '@/constants/design-tokens';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  spacing,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { dataEvents } from '@/lib/events';
import type { Plan, PlanActifOuTermine, PlanSuggere } from '@/lib/plans/Plan';
import { buildPrefilledSubtypeEntryParams } from '@/lib/plans/planCreateNavigation';
import {
  enrichPlanHubSuggestions,
  loadPlanHubStoredPlans,
  loadPlanHubSuggestions,
  selectPlansForMainHub,
} from '@/lib/plans/planHubData';
import { PLAN_HOME_ROW } from '@/lib/plans/planCardPresentation';

/** Hub carousel: at most 3 suggested plans (explore/catalog can show more). */
const HUB_SUGGESTED_PLANS_LIMIT = 3;

/** Active/paused only when any exist; otherwise suggestions only — never mixed. */
function plansForHubCarousel(activePlans: PlanActifOuTermine[], suggestions: PlanSuggere[]): Plan[] {
  if (activePlans.length > 0) return activePlans;
  return suggestions.slice(0, HUB_SUGGESTED_PLANS_LIMIT);
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
  const scrollRef = useRef<ScrollView>(null);

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
  useRefreshOnFocus(reloadHub, { skipInitial: true, minIntervalMs: 8_000 });

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
          pathname: '/plans/create',
          params: buildPrefilledSubtypeEntryParams(suggested.subtype, suggested.category),
        });
        return;
      }
      router.push({ pathname: '/plans/[id]', params: { id: planId } });
    },
    [router, suggestedPlans],
  );

  const handleOpenComponentLibrary = useCallback(() => {
    router.push('/fyn-ui-lab');
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
          ref={scrollRef}
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
            <HubSectionHeader eyebrow="Plans" title="Tes plans" />

            {showCarouselSpinner ? (
              <View style={styles.carouselLoadingWrap}>
                <ActivityIndicator color={pf.accent} />
              </View>
            ) : isEmpty ? (
              <Text style={{ color: pf.textMuted }}>Aucun plan pour l’instant</Text>
            ) : (
              <PlanHubCardCarousel plans={carouselPlans} onOpenPlan={handleOpenPlan} />
            )}
          </View>

          <HubSavingsGoalsSection />

          <HubLoansSection />

          <View style={styles.footerBlock}>
            <ComponentLibraryShortcutRow onPress={handleOpenComponentLibrary} />
          </View>
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
    paddingHorizontal: SPACING.pagePaddingHorizontal,
    paddingBottom: PAGE_TITLE_CONTENT_GAP,
    gap: SPACING.md,
  },
  title: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.pagePaddingHorizontal,
    gap: SPACING.planSectionGap, // = planFinanceKit.layout.sectionGap (32)
  },
  plansSection: {
    gap: HUB_SECTION_INNER_GAP,
  },
  carouselLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: PLAN_HOME_ROW.iconWellSize + PLAN_HOME_ROW.paddingVertical * 2,
    paddingVertical: SPACING.xl,
  },
  emptyState: {
    alignItems: 'stretch',
    paddingVertical: SPACING.xs,
  },
  footerBlock: {
    gap: SPACING.md,
    paddingTop: SPACING.xs,
  },
});
