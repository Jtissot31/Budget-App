import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { loadPlanHubSnapshot, selectPlansForMainHub } from '@/lib/plans/planHubData';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlans = useCallback(async () => {
    const snapshot = await loadPlanHubSnapshot();
    setListPlans(selectPlansForMainHub(snapshot.listPlans) as PlanActifOuTermine[]);
    setSuggestedPlans(snapshot.suggestedPlans);
  }, []);

  const carouselPlans = useMemo(
    () => plansForHubCarousel(listPlans, suggestedPlans),
    [listPlans, suggestedPlans],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadPlans();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPlans]);

  useEffect(() => dataEvents.subscribe(loadPlans), [loadPlans]);
  useRefreshOnFocus(loadPlans, { skipInitial: true });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlans();
    setRefreshing(false);
  }, [loadPlans]);

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

  const isEmpty = carouselPlans.length === 0;
  const pf = planFinanceKit.colors;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: pf.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
          <Text style={[styles.title, PAGE_TITLE_STYLE, { color: pf.text }]}>Plan financier</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={pf.accent} />
          </View>
        ) : (
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

              {isEmpty ? (
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
          </ScrollView>
        )}
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
