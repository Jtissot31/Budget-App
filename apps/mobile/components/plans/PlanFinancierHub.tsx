import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { ExploreMorePlansRow } from '@/components/plans/ExploreMorePlansRow';
import { PlanCard } from '@/components/plans/PlanCard';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { planFinanceKit, planFinanceIconButtonStyle } from '@/constants/planFinanceKit';
import { FLOATING_NAV_CONTENT_PADDING, PAGE_TITLE_STYLE, spacing } from '@/constants/theme';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import type { PlanActifOuTermine } from '@/lib/plans/Plan';
import { PLAN_CARD_LIST_GAP } from '@/lib/plans/planCardPresentation';
import { buildManualPlanCreateEntryParams } from '@/lib/plans/planCreateNavigation';
import { loadPlanHubSnapshot, selectPlansForMainHub } from '@/lib/plans/planHubData';

export function PlanFinancierHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [listPlans, setListPlans] = useState<PlanActifOuTermine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const snapshot = await loadPlanHubSnapshot();
    setListPlans(selectPlansForMainHub(snapshot.listPlans) as PlanActifOuTermine[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
          <Text style={[styles.title, PAGE_TITLE_STYLE, { color: pf.text }]}>Plans financiers</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Créer un plan financier"
            hitSlop={10}
            onPress={handleOpenCreate}
            style={({ pressed }) => [planFinanceIconButtonStyle(), pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="plus" size={22} color={pf.text} />
          </Pressable>
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
            {isEmpty ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Aucun plan financier actif pour l&apos;instant.
                </Text>
                <ExploreMorePlansRow onPress={handleOpenExplorer} prominent />
              </View>
            ) : (
              <View style={styles.cardList}>
                {listPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} onPress={() => handleOpenPlan(plan.id)} />
                ))}
                <ExploreMorePlansRow onPress={handleOpenExplorer} />
              </View>
            )}
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
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: planFinanceKit.layout.sectionGap,
  },
  cardList: {
    gap: PLAN_CARD_LIST_GAP,
  },
  emptyState: {
    alignItems: 'stretch',
    gap: spacing.xl,
    paddingVertical: spacing.xxl,
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
