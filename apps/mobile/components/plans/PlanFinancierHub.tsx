import { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  ActivityIndicator,
  Pressable,
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
import { planFinanceKit, planFinanceIconButtonStyle } from '@/constants/planFinanceKit';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_STYLE, spacing } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import type { PlanActifOuTermine } from '@/lib/plans/Plan';
import { buildManualPlanCreateEntryParams } from '@/lib/plans/planCreateNavigation';
import { loadPlanHubSnapshot, selectPlansForMainHub } from '@/lib/plans/planHubData';

export function PlanFinancierHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [listPlans, setListPlans] = useState<PlanActifOuTermine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlans = useCallback(async () => {
    const snapshot = await loadPlanHubSnapshot();
    setListPlans(selectPlansForMainHub(snapshot.listPlans) as PlanActifOuTermine[]);
  }, []);

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

  const handleOpenCreate = useCallback(() => {
    tapHaptic();
    router.push({ pathname: '/plans/create', params: buildManualPlanCreateEntryParams() });
  }, [router]);

  const handleOpenPlan = useCallback(
    (planId: string) => {
      router.push({ pathname: '/plans/[id]', params: { id: planId } });
    },
    [router],
  );

  const handleOpenExplorer = useCallback(() => {
    router.push('/plans/explore');
  }, [router]);

  const isEmpty = listPlans.length === 0;
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
              <HubSectionHeader
                eyebrow="Stratégie"
                title="Plan financier"
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Créer un plan financier"
                    hitSlop={10}
                    onPress={handleOpenCreate}
                    style={({ pressed }) => [planFinanceIconButtonStyle(), pressed && styles.pressed]}
                  >
                    <AppIcon family="material-community" name="plus" size={22} color={pf.text} />
                  </Pressable>
                }
              />

              {isEmpty ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    Aucun plan financier actif pour l&apos;instant.
                  </Text>
                  <ExploreMorePlansRow onPress={handleOpenExplorer} prominent />
                </View>
              ) : (
                <>
                  <PlanHubCardCarousel plans={listPlans} onOpenPlan={handleOpenPlan} />
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
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});
