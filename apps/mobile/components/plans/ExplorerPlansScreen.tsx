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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { PlanCard } from '@/components/plans/PlanCard';
import { PlanCatalogCard } from '@/components/plans/PlanCatalogCard';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  planFinanceKit,
  planFinanceFonts,
  planFinanceIconButtonStyle,
} from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  interSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { PLAN_SUBTYPE_LABELS, planCategoryForSubtype, type PlanSuggere, type PlanSubtype } from '@/lib/plans/Plan';
import { PLAN_CARD_LIST_GAP } from '@/lib/plans/planCardPresentation';
import { buildTemplateDetailParams } from '@/lib/plans/planCreateNavigation';
import { getPlanSubtypeConfig, PLAN_SITUATIONS } from '@/lib/plans/planSubtypeConfig';
import { loadExplorerSnapshot } from '@/lib/plans/planHubData';

export function ExplorerPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [suggestedPlans, setSuggestedPlans] = useState<PlanSuggere[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pf = planFinanceKit.colors;

  const load = useCallback(async () => {
    const snapshot = await loadExplorerSnapshot();
    setSuggestedPlans(snapshot.suggestedPlans);
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

  const handleBack = useCallback(() => {
    tapHaptic();
    router.back();
  }, [router]);

  const handleOpenSuggested = useCallback(
    (plan: PlanSuggere) => {
      router.push({
        pathname: '/plans/template/[subtype]',
        params: buildTemplateDetailParams(plan.subtype, {
          raison: plan.raison_recommandation,
          suggestedId: plan.id,
        }),
      });
    },
    [router],
  );

  const handleOpenTemplate = useCallback(
    (subtype: PlanSubtype) => {
      router.push({
        pathname: '/plans/template/[subtype]',
        params: buildTemplateDetailParams(subtype),
      });
    },
    [router],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: pf.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={handleBack}
            style={({ pressed }) => [planFinanceIconButtonStyle(), pressed && styles.pressed]}
          >
            <MaterialIcons name="arrow-back" size={22} color={pf.text} />
          </Pressable>
          <Text style={[styles.headerTitle, planFinanceFonts.sectionTitle]}>Explorer les plans</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={pf.accent} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
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
            {suggestedPlans.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="auto-awesome" size={16} color={pf.accent} />
                  <Text style={[styles.sectionLabel, interSemiboldText]}>SUGGÉRÉ POUR TOI</Text>
                </View>
                <View style={styles.cardList}>
                  {suggestedPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      suggested
                      onPress={() => handleOpenSuggested(plan)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {PLAN_SITUATIONS.map((situation) => (
              <View key={situation.id} style={styles.section}>
                <Text style={[styles.situationTitle, interSemiboldText]}>{situation.label}</Text>
                <View style={styles.cardList}>
                  {situation.subtypes.map((subtype) => {
                    const config = getPlanSubtypeConfig(subtype);
                    return (
                      <PlanCatalogCard
                        key={subtype}
                        entry={{
                          category: planCategoryForSubtype(subtype),
                          subtype,
                          label: PLAN_SUBTYPE_LABELS[subtype],
                          description: config.shortDescription,
                        }}
                        onPress={() => handleOpenTemplate(subtype)}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: planFinanceKit.layout.sectionGap,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionLabel: {
    color: planFinanceKit.colors.accent,
    fontSize: typography.micro,
    letterSpacing: 0.8,
  },
  situationTitle: {
    color: planFinanceKit.colors.text,
    fontSize: typography.caption,
    lineHeight: typography.caption + 4,
  },
  cardList: {
    gap: PLAN_CARD_LIST_GAP,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.82 },
});
