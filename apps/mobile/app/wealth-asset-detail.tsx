import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { SurfaceCard } from '@/components/SurfaceCard';
import { WealthAssetValueSparkline } from '@/components/WealthAssetValueSparkline';
import { ghostCardShadow } from '@/constants/ghostUi';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { buildWealthSixMonthIndicativeSeries } from '@/lib/buildWealthSixMonthIndicativeSeries';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { deleteWealthAsset, getWealthAssetById } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatCompactGainDollars } from '@/lib/formatCompactGainDollars';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import {
  getWealthValuationAsOfDisplay,
  valuationSourceLabel,
  wealthAssetHeroSubtitle,
} from '@/lib/wealthAssetPresentation';
import type { WealthAsset } from '@/types';

/** Match `TransactionDetailSheet` / detail modals — unified sheet silhouette + backdrop. */
const DETAIL_SHEET_TOP_RADIUS = 22;

function formatMoney(value: number) {
  return `${Math.abs(value).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function WealthAssetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const assetId = typeof params.id === 'string' ? params.id.trim() : '';
  const insets = useSafeAreaInsets();
  const { colors, ghost, isLight } = useAppTheme();
  const [asset, setAsset] = useState<WealthAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  /** When `last_valuation_at` is absent, exposes an honest timestamp for captions. */
  const [openedAtByLoadId, setOpenedAtByLoadId] = useState<{ id: string; at: Date } | null>(null);

  const loadAsset = useCallback(async () => {
    if (!assetId) {
      setAsset(null);
      setOpenedAtByLoadId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await getWealthAssetById(assetId);
      setAsset(next);
      if (next) setOpenedAtByLoadId({ id: next.id, at: new Date() });
      else setOpenedAtByLoadId(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void loadAsset();
  }, [loadAsset]);

  useEffect(() => dataEvents.subscribe(loadAsset), [loadAsset]);

  useRefreshOnFocus(loadAsset);

  const gain = asset ? asset.currentValue - asset.purchaseCost : 0;
  const gainPercent =
    asset && asset.purchaseCost > 0 ? ((asset.currentValue - asset.purchaseCost) / asset.purchaseCost) * 100 : 0;

  const valuationAsOf = useMemo(
    () =>
      getWealthValuationAsOfDisplay(
        asset,
        openedAtByLoadId?.id === asset?.id ? (openedAtByLoadId?.at ?? null) : null,
      ),
    [asset, openedAtByLoadId],
  );

  const indicativeSeries = useMemo(() => (asset ? buildWealthSixMonthIndicativeSeries(asset) : []), [asset]);

  const chartAreaTint = useMemo(() => {
    return isLight ? 'rgba(0, 168, 112, 0.12)' : 'rgba(0, 245, 160, 0.10)';
  }, [isLight]);

  const stylesMemo = useMemo(() => createStyles(colors, isLight), [colors, isLight]);

  const navigateToEditModal = () => {
    if (!asset) return;
    tapHaptic();
    /** Replace stack screen — do not `push` + `back` (that can pop the tab stack to Accueil). */
    router.replace({ pathname: '/accounts', params: { editWealthAssetId: asset.id } });
  };

  const confirmDelete = () => {
    if (!asset) return;
    tapHaptic();
    setConfirmVisible(true);
  };

  const sheetVisible = true;

  /** Single horizontal gutter from safe area — avoids stacking with BottomSheet + body padding */
  const sheetHorizontalGutter = Math.max(insets.left, insets.right, spacing.md);

  return (
    <View style={[stylesMemo.screenRoot, { backgroundColor: 'transparent' }]}>
      <BottomSheet
        visible={sheetVisible}
        onClose={() => router.back()}
        scrollContentContainerStyle={{ paddingHorizontal: sheetHorizontalGutter }}
        sheetStyle={[
          stylesMemo.sheetSurface,
          {
            backgroundColor: colors.surfaceSolid,
            borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
            borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
          },
        ]}
      >
        <View style={[stylesMemo.sheetHeader, { paddingTop: Math.max(insets.top * 0.35, spacing.xs) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            style={({ pressed }) => [
              stylesMemo.headerIconBtn,
              { backgroundColor: colors.surfaceSolid, borderColor: colors.borderStrong },
              pressed && stylesMemo.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[stylesMemo.sheetTitle, { color: colors.text }]} numberOfLines={1}>
            Patrimoine
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modifier ce patrimoine"
            disabled={!asset || loading}
            hitSlop={12}
            style={({ pressed }) => [
              stylesMemo.headerIconBtn,
              {
                backgroundColor: colors.surfaceSolid,
                borderColor: colors.borderStrong,
                opacity: !asset || loading ? 0.45 : pressed ? 0.76 : 1,
              },
            ]}
            onPress={navigateToEditModal}
          >
            <Ionicons name="create-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={stylesMemo.sheetBody}>
          {loading ? (
            <Text style={[stylesMemo.mutedCenter, { color: colors.textMuted }]}>Chargement…</Text>
          ) : !assetId || !asset ? (
            <Text style={[stylesMemo.mutedCenter, { color: colors.textMuted }]}>Actif introuvable.</Text>
          ) : (
            <>
              <View
                style={[
                  stylesMemo.heroCard,
                  ghostCardShadow,
                  {
                    borderColor: colors.border,
                    backgroundColor: isLight ? colors.surfaceSolid : '#050505',
                  },
                ]}
              >
                <View style={[stylesMemo.heroIcon, { backgroundColor: ghost.obsidianSoft }]}>
                  {asset.type === 'precious_material' && asset.material ? (
                    <Ionicons
                      name={asset.material === 'diamond' ? 'diamond-outline' : 'disc-outline'}
                      size={34}
                      color={colors.primary}
                    />
                  ) : (
                    <Ionicons name="home-outline" size={30} color={colors.primaryAlt} />
                  )}
                </View>
                <View style={stylesMemo.heroCopy}>
                  <Text style={[stylesMemo.assetName, { color: colors.text }]} numberOfLines={3}>
                    {asset.name}
                  </Text>
                  <Text style={[stylesMemo.assetMeta, { color: colors.textMuted }]}>{wealthAssetHeroSubtitle(asset)}</Text>
                </View>
              </View>

              <SurfaceCard style={stylesMemo.amountCard}>
                <Text style={[stylesMemo.amountEyebrow, { color: colors.textMuted }]}>Valeur actuelle</Text>
                <Text style={[stylesMemo.amountHuge, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(asset.currentValue)}
                </Text>
                <View style={[stylesMemo.valuationPreface, { borderColor: colors.border }]}>
                  <Text style={[stylesMemo.valuationPrefaceLead, { color: colors.primary }]}>
                    Source · {valuationSourceLabel(asset)}
                  </Text>
                  <Text style={[stylesMemo.valuationPrefaceBody, { color: colors.textSecondary }]}>
                    {valuationAsOf.title}
                  </Text>
                  {valuationAsOf.subtitle ? (
                    <Text style={[stylesMemo.valuationPrefaceNote, { color: colors.textMuted }]}>
                      {valuationAsOf.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Text style={[stylesMemo.purchaseLine, { color: colors.textSecondary }]}>
                  Coût d’achat · {formatMoney(asset.purchaseCost)}
                </Text>
                <View style={stylesMemo.gainBlock}>
                  <Text style={[stylesMemo.statLabel, { color: colors.textMuted }]}>
                    {gain >= 0 ? 'Profit' : 'Perte'}
                  </Text>
                  <View style={stylesMemo.gainValueRow}>
                    <Text
                      style={[
                        stylesMemo.statAmount,
                        { color: gain >= 0 ? colors.success : colors.danger },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {formatCompactGainDollars(gain, { leadingPlusWhenPositive: true })}
                    </Text>
                    <View
                      style={[
                        stylesMemo.percentPill,
                        {
                          backgroundColor: isLight ? `${colors.surface}` : 'rgba(255,255,255,0.08)',
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: gain >= 0 ? `${colors.success}55` : `${colors.danger}55`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          stylesMemo.percentText,
                          { color: gain >= 0 ? colors.success : colors.danger },
                        ]}
                        numberOfLines={1}
                      >
                        {gain >= 0 ? '+' : '−'}
                        {Math.abs(gainPercent).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[stylesMemo.sparkDivider, { backgroundColor: colors.border }]} />
                <Text style={[stylesMemo.sparkHeading, { color: colors.textMuted }]}>Tendance indicative (6 mois)</Text>
                <WealthAssetValueSparkline
                  points={indicativeSeries}
                  stroke={colors.primary}
                  areaFill={chartAreaTint}
                  gridColor={colors.border}
                  labelColor={colors.textMuted}
                />
              </SurfaceCard>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voir l’historique des transactions de cet actif"
                hitSlop={12}
                style={({ pressed }) => [
                  stylesMemo.historyWide,
                  {
                    backgroundColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
                    borderColor: colors.border,
                  },
                  pressed && stylesMemo.pressed,
                ]}
                onPress={() => {
                  tapHaptic();
                  router.push({ pathname: '/wealth-asset-transactions', params: { id: asset.id } });
                }}
              >
                <Ionicons name="list-outline" size={18} color={colors.primary} />
                <Text style={[stylesMemo.historyWideText, { color: colors.text }]}>
                  Voir historique de transaction
                </Text>
              </Pressable>

              <View style={[stylesMemo.metaGrid, { borderColor: colors.border }]}>
                <MetaCell icon="calendar-outline" label="Achat" value={purchaseLabel(asset)} colors={colors} />
                {asset.type === 'real_estate' && asset.address?.trim() ? (
                  <MetaCell icon="location-outline" label="Adresse" value={asset.address.trim()} colors={colors} />
                ) : null}
                {asset.notes?.trim() ? (
                  <MetaCell icon="document-text-outline" label="Notes" value={asset.notes.trim()} colors={colors} />
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer ce patrimoine"
                style={({ pressed }) => [
                  stylesMemo.deleteWide,
                  { backgroundColor: colors.danger },
                  pressed && stylesMemo.pressed,
                ]}
                onPress={confirmDelete}
              >
                <Ionicons name="trash-outline" size={18} color={colors.background} />
                <Text style={[stylesMemo.deleteWideText, { color: colors.background }]}>
                  Supprimer ce patrimoine
                </Text>
              </Pressable>

              <View style={{ height: Math.max(insets.bottom + spacing.md, spacing.xl) }} />
            </>
          )}
        </View>
      </BottomSheet>
      <ConfirmDeleteModal
        visible={confirmVisible}
        title="Supprimer ce patrimoine ?"
        message={asset?.name}
        onConfirm={async () => {
          if (!asset) return;
          setConfirmVisible(false);
          try {
            await deleteWealthAsset(asset.id);
            successHaptic();
            router.back();
          } catch {
            // silently ignore
          }
        }}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

function purchaseLabel(asset: WealthAsset) {
  const d = asset.purchaseDate?.trim();
  if (!d) return formatMoney(asset.purchaseCost);
  return `${formatShortDate(d)} · ${formatMoney(asset.purchaseCost)}`;
}

function MetaCell({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: Pick<AppColors, 'text' | 'textMuted'>;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: spacing.md }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.55, color: colors.textMuted }}>
          {label}
        </Text>
        <Text style={{ marginTop: 4, fontSize: typography.body, fontWeight: '700', color: colors.text }}>{value}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors, isLight: boolean) {
  return StyleSheet.create({
    screenRoot: { flex: 1 },
    sheetSurface: { paddingBottom: 0 },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 0,
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    headerIconBtn: {
      width: 42,
      height: 42,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetTitle: { flex: 1, fontSize: typography.dashboardGreeting, fontWeight: '800', letterSpacing: -0.4 },
    sheetBody: {
      paddingHorizontal: 0,
      gap: spacing.lg,
    },
    mutedCenter: {
      textAlign: 'center',
      paddingVertical: spacing.xl,
      fontSize: typography.caption,
    },
    pressed: { opacity: 0.76 },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.lg,
    },
    heroIcon: {
      width: 58,
      height: 58,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    heroCopy: { flex: 1, gap: spacing.xs },
    assetName: { fontSize: typography.screenTitle, fontWeight: '900', letterSpacing: -0.6 },
    assetMeta: { fontSize: typography.caption, lineHeight: typography.caption + 5, fontWeight: '700' },
    amountCard: { gap: spacing.sm },
    amountEyebrow: {
      fontSize: typography.micro,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.58,
    },
    amountHuge: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
    valuationPreface: {
      marginTop: spacing.sm,
      gap: 4,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    valuationPrefaceLead: { fontSize: typography.caption, fontWeight: '900', letterSpacing: 0.2 },
    valuationPrefaceBody: { fontSize: typography.caption, fontWeight: '700', lineHeight: typography.caption + 4 },
    valuationPrefaceNote: { fontSize: typography.meta, fontWeight: '600', lineHeight: typography.meta + 4 },
    purchaseLine: { fontSize: typography.caption, fontWeight: '700' },
    gainBlock: { marginTop: spacing.md, gap: 4 },
    statLabel: {
      fontSize: typography.micro,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.52,
    },
    gainValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      minWidth: 0,
    },
    statAmount: { flexShrink: 1, fontSize: typography.dashboardGreeting, fontWeight: '900', letterSpacing: -0.4 },
    percentPill: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1 },
    percentText: { fontWeight: '900', fontSize: typography.meta },
    sparkDivider: { height: StyleSheet.hairlineWidth, marginTop: spacing.md, opacity: 0.85 },
    sparkHeading: {
      fontSize: typography.micro,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.52,
      marginTop: spacing.xs,
    },
    metaGrid: {
      borderRadius: radius.xxl,
      overflow: 'hidden',
      paddingHorizontal: spacing.md,
      backgroundColor: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.04)',
      borderWidth: StyleSheet.hairlineWidth,
    },
    historyWide: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 52,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
    },
    historyWideText: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    deleteWide: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 52,
      borderRadius: radius.xl,
    },
    deleteWideText: {
      fontSize: typography.body,
      fontWeight: '900',
    },
  });
}
