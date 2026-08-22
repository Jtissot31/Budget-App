import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { PlanCard } from '@/components/plans/PlanCard';
import { PlanCatalogCard } from '@/components/plans/PlanCatalogCard';
import { StrategyLibrarySectionChips } from '@/components/plans/StrategyLibrarySectionChips';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { planFinanceFonts, planFinanceKit } from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  interSemiboldText,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { type PlanSuggere, type PlanSubtype } from '@/lib/plans/Plan';
import { PLAN_CARD_LIST_GAP } from '@/lib/plans/planCardPresentation';
import { buildTemplateDetailParams } from '@/lib/plans/planCreateNavigation';
import { loadExplorerSnapshot } from '@/lib/plans/planHubData';
import {
  STRATEGY_LIBRARY_SECTIONS,
  catalogEntriesForSection,
  catalogEntryMatchesSearch,
  suggestedPlanMatchesSearch,
  type StrategyLibraryFilterId,
} from '@/lib/plans/planStrategyLibrary';
import { useAppTheme } from '@/lib/themeContext';

export function ExplorerPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [suggestedPlans, setSuggestedPlans] = useState<PlanSuggere[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<StrategyLibraryFilterId>('all');

  const load = useCallback(async () => {
    const snapshot = await loadExplorerSnapshot({ skipEnrichment: true });
    setSuggestedPlans(snapshot.suggestedPlans);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await load();
      } catch (error: unknown) {
        if (__DEV__) console.warn('[ExplorerPlansScreen] load failed', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
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
        }) as { subtype: string; raison?: string; suggestedId?: string },
      });
    },
    [router],
  );

  const handleOpenTemplate = useCallback(
    (subtype: PlanSubtype) => {
      router.push({
        pathname: '/plans/template/[subtype]',
        params: buildTemplateDetailParams(subtype) as { subtype: string },
      });
    },
    [router],
  );

  const filteredSuggested = useMemo(() => {
    if (sectionFilter !== 'all' && sectionFilter !== 'suggested') return [];
    return suggestedPlans.filter((plan) => suggestedPlanMatchesSearch(plan, searchQuery));
  }, [searchQuery, sectionFilter, suggestedPlans]);

  const visibleSections = useMemo(() => {
    if (sectionFilter === 'suggested') return [];
    return STRATEGY_LIBRARY_SECTIONS.map((section) => {
      if (sectionFilter !== 'all' && sectionFilter !== section.id) {
        return { section, entries: [] as ReturnType<typeof catalogEntriesForSection> };
      }
      const entries = catalogEntriesForSection(section).filter((entry) =>
        catalogEntryMatchesSearch(entry, searchQuery),
      );
      return { section, entries };
    }).filter((item) => item.entries.length > 0);
  }, [searchQuery, sectionFilter]);

  const showSuggestedBlock =
    (sectionFilter === 'all' || sectionFilter === 'suggested') && filteredSuggested.length > 0;
  const hasResults = showSuggestedBlock || visibleSections.length > 0;
  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.iconButton,
              {
                borderColor: colors.border,
                backgroundColor: colors.containerBackground,
              },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, planFinanceFonts.sectionTitle, { color: colors.text }]}>
            Stratégies financières
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={colors.primary}
              />
            }
          >
            <View style={styles.intro}>
              <Text style={[styles.introTitle, interSemiboldText, { color: colors.text }]}>
                Bibliothèque
              </Text>
              <Text style={[styles.introBody, { color: colors.textMuted }]}>
                Filtre par type ou cherche une stratégie.
              </Text>
            </View>

            <View
              style={[
                styles.searchPill,
                { backgroundColor: colors.input, borderColor: colors.border },
              ]}
            >
              <AppIcon family="ionicons" name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Rechercher une stratégie…"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                accessibilityLabel="Rechercher une stratégie"
              />
              {hasActiveSearch ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Effacer la recherche"
                  hitSlop={8}
                  onPress={() => {
                    tapHaptic();
                    setSearchQuery('');
                  }}
                  style={({ pressed }) => [styles.clearSearchBtn, pressed && styles.pressed]}
                >
                  <AppIcon family="ionicons" name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <StrategyLibrarySectionChips
              value={sectionFilter}
              onChange={setSectionFilter}
              showSuggested={suggestedPlans.length > 0}
            />

            {!hasResults ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyTitle, interSemiboldText, { color: colors.text }]}>
                  Aucune stratégie
                </Text>
                <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                  Essaie un autre mot-clé ou change de section.
                </Text>
              </View>
            ) : null}

            {showSuggestedBlock ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AppIcon family="material" name="auto-awesome" size={16} color={colors.primary} />
                  <Text style={[styles.sectionEyebrow, interSemiboldText, { color: colors.primary }]}>
                    SUGGÉRÉ POUR TOI
                  </Text>
                </View>
                <Text style={[styles.sectionTitle, typographyKit.sectionTitle, { color: colors.text }]}>
                  Personnalisé
                </Text>
                <View style={styles.cardList}>
                  {filteredSuggested.map((plan) => (
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

            {visibleSections.map(({ section, entries }) => (
              <View key={section.id} style={styles.section}>
                <Text style={[styles.sectionEyebrowMuted, interSemiboldText, { color: colors.textMuted }]}>
                  {section.eyebrow.toUpperCase()}
                </Text>
                <Text style={[styles.sectionTitle, typographyKit.sectionTitle, { color: colors.text }]}>
                  {section.title}
                </Text>
                <View style={styles.cardList}>
                  {entries.map((entry) => (
                    <PlanCatalogCard
                      key={entry.subtype}
                      entry={entry}
                      onPress={() => handleOpenTemplate(entry.subtype)}
                    />
                  ))}
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
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: planFinanceKit.radius.iconButton,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  intro: {
    gap: spacing.xs,
  },
  introTitle: {
    fontSize: typography.title,
    lineHeight: typography.title + 4,
    letterSpacing: -0.3,
  },
  introBody: {
    ...typographyKit.metaMedium,
    lineHeight: 18,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    paddingVertical: 10,
  },
  clearSearchBtn: {
    padding: 4,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionEyebrow: {
    fontSize: typography.micro,
    letterSpacing: 0.8,
  },
  sectionEyebrowMuted: {
    fontSize: typography.micro,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    letterSpacing: -0.4,
  },
  cardList: {
    gap: PLAN_CARD_LIST_GAP,
  },
  emptyWrap: {
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.caption,
    textAlign: 'center',
  },
  emptyBody: {
    ...typographyKit.metaMedium,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.82 },
});
