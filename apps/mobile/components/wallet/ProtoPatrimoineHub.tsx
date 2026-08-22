/**
 * Patrimoine explorer — placements summary + stock / physical holdings.
 * Opened from Accueil « Patrimoine · Explorer ».
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { HomeSpendInvestCards } from '@/components/dashboard/HomeSpendInvestCards';
import { PageTransition } from '@/components/PageTransition';
import { PatrimoineHoldingsSections } from '@/components/PatrimoineHoldingsSections';
import {
  SettingsPickerSheet,
  type SettingsPickerOption,
} from '@/components/SettingsPickerSheet';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  jakartaExtraBoldText,
  PAGE_PADDING_HORIZONTAL,
  spacing,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ensureDbReady } from '@/lib/init';
import { getLoans, getWealthAssets, upsertWealthAsset } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { filterPatrimoineWealthAssets } from '@/lib/wealthAssetPresentation';
import type { Loan, WealthAsset, WealthAssetType } from '@/types';

const WEALTH_TYPE_OPTIONS: SettingsPickerOption<WealthAssetType>[] = [
  {
    id: 'real_estate',
    label: 'Immobilier',
    description: 'Maison, condo, terrain',
    icon: 'home-outline',
  },
  {
    id: 'precious_material',
    label: 'Métaux précieux',
    description: 'Or, argent, diamant',
    icon: 'diamond-outline',
  },
];

function newWealthAssetId(): string {
  return `wealth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDraftWealthAsset(type: WealthAssetType): WealthAsset {
  const now = new Date().toISOString();
  const id = newWealthAssetId();
  if (type === 'real_estate') {
    return {
      id,
      type,
      name: 'Immobilier',
      purchaseCost: 0,
      currentValue: 0,
      valuationSource: 'manual',
      createdAt: now,
    };
  }
  return {
    id,
    type,
    name: 'Métal précieux',
    material: 'gold',
    purchaseCost: 0,
    currentValue: 0,
    valuationSource: 'estimate',
    createdAt: now,
  };
}

export function ProtoPatrimoineHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [wealthAssets, setWealthAssets] = useState<WealthAsset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [holdingsDragging, setHoldingsDragging] = useState(false);
  const [wealthTypePickerVisible, setWealthTypePickerVisible] = useState(false);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [nextAssets, nextLoans] = await Promise.all([getWealthAssets(), getLoans()]);
    setWealthAssets(nextAssets);
    setLoans(nextLoans);
  }, []);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => {
      void load();
    });
  }, [load]);

  useRefreshOnFocus(load, { minIntervalMs: 5_000 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const patrimoineAssets = useMemo(
    () => filterPatrimoineWealthAssets(wealthAssets),
    [wealthAssets],
  );

  const loansById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);

  const openNewWealthForm = useCallback(() => {
    tapHaptic();
    setWealthTypePickerVisible(true);
  }, []);

  const handleSelectWealthType = useCallback(
    (type: WealthAssetType) => {
      setWealthTypePickerVisible(false);
      void (async () => {
        const asset = createDraftWealthAsset(type);
        await upsertWealthAsset(asset);
        router.push({ pathname: '/wealth-asset-detail', params: { id: asset.id } });
      })();
    },
    [router],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }, jakartaExtraBoldText]}>
            Patrimoine
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom + spacing.xl, 56),
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            gap: spacing.xl,
          }}
          scrollEnabled={!holdingsDragging}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <HomeSpendInvestCards interactive={false} />

          <PatrimoineHoldingsSections
            wealthAssets={patrimoineAssets}
            loansById={loansById}
            flushTop
            onAddWealthAsset={openNewWealthForm}
            onOpenWealthAsset={(asset) => {
              tapHaptic();
              router.push({ pathname: '/wealth-asset-detail', params: { id: asset.id } });
            }}
            onDragStateChange={setHoldingsDragging}
          />
        </ScrollView>
      </View>

      <SettingsPickerSheet
        visible={wealthTypePickerVisible}
        title="Type de bien"
        options={WEALTH_TYPE_OPTIONS}
        selectedId={'' as WealthAssetType}
        onClose={() => setWealthTypePickerVisible(false)}
        onSelect={handleSelectWealthType}
      />
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
  backHit: { padding: spacing.xs },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerSpacer: { width: 30 },
  scroll: { flex: 1 },
  pressed: { opacity: 0.78 },
});
