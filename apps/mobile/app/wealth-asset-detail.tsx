import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DetailSectionsCard } from '@/components/DetailSectionRows';
import { GlassContainer } from '@/components/GlassContainer';
import { OverflowMenuButton } from '@/components/OverflowMenuButton';
import { PageTransition } from '@/components/PageTransition';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TransactionRow } from '@/components/TransactionRow';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  detailProgressBarStyle,
  detailSectionLabelStyle,
  detailSectionsCardStyle,
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  deleteWealthAsset,
  getLoanById,
  getTransactionsForWealthAsset,
  getWealthAssetById,
  sortTransactionsNewestFirst,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic, successHaptic } from '@/lib/haptics';
import { parseItemizedNote } from '@/lib/itemizedNote';
import { formatLoanDisplayTitle } from '@/lib/loanPresentation';
import { useAppTheme } from '@/lib/themeContext';
import {
  formatTransactionGroupDateLabel,
  groupTransactionsByDay,
} from '@/lib/transactionListUtils';
import { buildWealthAssetDetailSections } from '@/lib/wealthAssetDetailSections';
import {
  computeRealEstateNetEquity,
  getWealthAssetDisplayValue,
} from '@/lib/wealthAssetPresentation';
import type { Loan, Transaction, WealthAsset } from '@/types';
import { Image } from 'expo-image';

function getTransactionTitle(tx: Transaction, fallbackTitle: string) {
  const itemized = parseItemizedNote(tx.note);
  if (itemized.length === 0) return fallbackTitle;

  const names = itemized.slice(0, 2).map((item) => item.name);
  const suffix = itemized.length > names.length ? ` + ${itemized.length - names.length}` : '';
  return `${names.join(', ')}${suffix}`;
}

export default function WealthAssetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const assetId = typeof params.id === 'string' ? params.id.trim() : '';
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, isLight } = useAppTheme();
  const [asset, setAsset] = useState<WealthAsset | null>(null);
  const [linkedLoan, setLinkedLoan] = useState<Loan | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [openedAt, setOpenedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!assetId) {
      setAsset(null);
      setLinkedLoan(null);
      setTransactions([]);
      setOpenedAt(null);
      return;
    }
    const [nextAsset, nextTxs] = await Promise.all([
      getWealthAssetById(assetId),
      getTransactionsForWealthAsset(assetId),
    ]);
    const loanId = nextAsset?.linkedLoanId?.trim();
    const nextLoan = loanId ? await getLoanById(loanId) : null;
    setAsset(nextAsset);
    setLinkedLoan(nextLoan);
    setTransactions(sortTransactionsNewestFirst(nextTxs));
    if (nextAsset) setOpenedAt(new Date());
    else setOpenedAt(null);
  }, [assetId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    void load();
  }, [assetId, load]);

  useRefreshOnFocus(load);
  useEffect(() => dataEvents.subscribe(load), [load]);

  const isRealEstate = asset?.type === 'real_estate';
  const displayTitle = asset?.name?.trim() || 'Patrimoine';
  const gain = asset ? asset.currentValue - asset.purchaseCost : 0;
  const gainTone = gain >= 0 ? colors.success : colors.danger;
  const trackColor = isLight ? '#E8EDF3' : '#08090B';

  const realEstateEquity = useMemo(
    () => (asset && isRealEstate ? computeRealEstateNetEquity(asset, linkedLoan) : null),
    [asset, isRealEstate, linkedLoan],
  );

  const detailSections = useMemo(
    () =>
      asset
        ? buildWealthAssetDetailSections(asset, linkedLoan, gain, gainTone, openedAt)
        : [],
    [asset, linkedLoan, gain, gainTone, openedAt],
  );

  const groupedTransactions = useMemo(
    () => groupTransactionsByDay(transactions),
    [transactions],
  );

  const gainPct = asset && asset.purchaseCost > 0
    ? ((asset.currentValue - asset.purchaseCost) / asset.purchaseCost) * 100
    : 0;
  const isGainLoss = !isRealEstate && gain < 0;

  const progressPct = useMemo(() => {
    if (!asset) return 0;
    if (isRealEstate && realEstateEquity && realEstateEquity.propertyValue > 0) {
      return (realEstateEquity.netEquity / realEstateEquity.propertyValue) * 100;
    }
    if (asset.purchaseCost > 0) {
      return Math.abs(gainPct);
    }
    return 0;
  }, [asset, isRealEstate, realEstateEquity, gainPct]);

  const showProgressCard =
    (isRealEstate && realEstateEquity && realEstateEquity.propertyValue > 0) ||
    (!isRealEstate && (asset?.purchaseCost ?? 0) > 0);

  const showValueHero = !showProgressCard && asset && asset.currentValue > 0;

  const progressPaidAmount = isRealEstate && realEstateEquity
    ? realEstateEquity.netEquity
    : Math.abs(gain);

  const progressTotalAmount = isRealEstate && realEstateEquity
    ? realEstateEquity.propertyValue
    : asset?.purchaseCost ?? 0;

  const navigateToEdit = () => {
    if (!asset) return;
    tapHaptic();
    router.replace({ pathname: '/accounts', params: { editWealthAssetId: asset.id } });
  };

  const confirmDelete = () => {
    tapHaptic();
    setConfirmDeleteVisible(true);
  };

  const openLinkedMortgage = () => {
    if (!linkedLoan) return;
    tapHaptic();
    router.push({ pathname: '/loan-detail', params: { loanId: linkedLoan.id } });
  };

  const progressBar = detailProgressBarStyle();

  const valueHeroCard = showValueHero ? (
    <GlassContainer
      style={styles.valueHeroShell}
      innerStyle={styles.valueHeroInner}
      padding={spacing.md}
      borderRadius={radius.lg}
    >
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Valeur actuelle</Text>
        <Text style={[styles.valueHeroAmount, { color: colors.primary }]}>
          {formatDisplayMoneyAbsolute(getWealthAssetDisplayValue(asset!, linkedLoan))}
        </Text>
      </View>
    </GlassContainer>
  ) : null;

  const progressCard = showProgressCard ? (
    <GlassContainer
      style={styles.progressCardShell}
      innerStyle={styles.progressCardInner}
      padding={spacing.md}
      borderRadius={radius.lg}
    >
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
          {isRealEstate ? 'Équité' : gain >= 0 ? 'Plus-value' : 'Perte'}
        </Text>
        <Text
          style={[styles.progressPct, { color: isGainLoss ? colors.danger : colors.primary }]}
        >
          {isGainLoss ? '−' : ''}{progressPct.toFixed(0)} %
        </Text>
      </View>
      <View style={[progressBar.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            progressBar.fill,
            {
              width: `${Math.max(Math.min(progressPct, 100), 3)}%`,
              backgroundColor: isGainLoss ? colors.danger : colors.primary,
            },
          ]}
        />
      </View>
      <View style={styles.progressFooter}>
        <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
          {isRealEstate ? 'Équité nette' : gain >= 0 ? 'Plus-value' : 'Perte'} ·{' '}
          {formatDisplayMoneyAbsolute(isRealEstate ? progressPaidAmount : Math.abs(gain))}
        </Text>
        <Text style={[styles.progressFootnote, { color: colors.textMuted }]}>
          {isRealEstate ? 'Valeur' : 'Achat'} · {formatDisplayMoneyAbsolute(progressTotalAmount)}
        </Text>
      </View>
    </GlassContainer>
  ) : null;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.lg + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {displayTitle}
          </Text>
          {asset ? (
            <OverflowMenuButton
              accessibilityLabel="Options du patrimoine"
              items={[
                {
                  key: 'edit',
                  label: 'Modifier',
                  onPress: navigateToEdit,
                },
                {
                  key: 'delete',
                  label: 'Supprimer',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: confirmDelete,
                },
              ]}
            />
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {asset ? (
            <>
              {progressCard ?? valueHeroCard}

              <DetailSectionsCard sections={detailSections} colors={colors} />

              {isRealEstate && linkedLoan ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Voir l'hypothèque liée"
                  android_ripple={null}
                  onPress={openLinkedMortgage}
                >
                  <GlassContainer
                    borderRadius={radius.lg}
                    padding={spacing.md}
                    innerStyle={styles.linkedCardInner}
                  >
                    <View style={styles.linkedCopy}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Hypothèque liée</Text>
                      <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
                        {formatLoanDisplayTitle(linkedLoan)} · Solde{' '}
                        {formatDisplayMoneyAbsolute(linkedLoan.balanceRemaining)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </GlassContainer>
                </Pressable>
              ) : null}

              <SurfaceCard style={detailSectionsCardStyle()}>
                <Text style={[detailSectionLabelStyle(), { color: colors.textMuted }]}>TRANSACTIONS</Text>
                {groupedTransactions.length > 0 ? (
                  <View style={styles.transactionGroups}>
                    {groupedTransactions.map(([date, txs]) => (
                      <View key={date} style={styles.transactionGroup}>
                        <Text style={[styles.transactionGroupLabel, { color: colors.textMuted }]}>
                          {formatTransactionGroupDateLabel(date)}
                        </Text>
                        <View style={styles.groupTransactions}>
                          {txs.map((tx) => (
                            <TransactionRow
                              key={tx.id}
                              transaction={{
                                ...tx,
                                label: getTransactionTitle(tx, tx.categoryName?.trim() || displayTitle),
                              }}
                              onPress={() => { tapHaptic(); router.push({ pathname: '/transaction-detail', params: { transactionId: tx.id } }); }}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyInline, { color: colors.textMuted }]}>
                    Aucune transaction liée à cet actif.
                  </Text>
                )}
              </SurfaceCard>

              {asset.photoUri?.trim() ? (
                <View style={styles.bannerWrap}>
                  <Image
                    source={{ uri: asset.photoUri.trim() }}
                    style={styles.bannerImage}
                    contentFit="cover"
                    accessibilityLabel="Photo du bien"
                  />
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {assetId ? 'Actif introuvable.' : 'Aucun actif sélectionné.'}
            </Text>
          )}
        </ScrollView>

        <ConfirmDeleteModal
          visible={confirmDeleteVisible}
          title="Supprimer ce patrimoine ?"
          message={asset ? `Supprimer ${displayTitle} ?` : undefined}
          onConfirm={async () => {
            if (!asset) return;
            setConfirmDeleteVisible(false);
            await deleteWealthAsset(asset.id);
            successHaptic();
            router.back();
          }}
          onCancel={() => setConfirmDeleteVisible(false)}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
  },
  topBarSpacer: { width: 38 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  bannerWrap: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    height: 168,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  valueHeroShell: {
    borderRadius: radius.lg,
  },
  valueHeroInner: {
    gap: spacing.sm,
  },
  valueHeroAmount: {
    ...jakartaBoldText,
    flexShrink: 0,
    textAlign: 'right',
    fontSize: typography.meta,
  },
  progressCardShell: {
    borderRadius: radius.lg,
  },
  progressCardInner: {
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressLabel: {
    ...jakartaBoldText,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  progressPct: {
    ...jakartaBoldText,
    flexShrink: 0,
    minWidth: 44,
    textAlign: 'right',
    fontSize: typography.meta,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressFootnote: {
    ...jakartaMediumText,
    fontSize: typography.meta,
  },
  linkedCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  linkedCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    ...jakartaExtraBoldText,
    fontSize: typography.caption,
  },
  sectionMeta: {
    ...jakartaBoldText,
    fontSize: typography.micro,
  },
  transactionGroups: {
    gap: spacing.md,
  },
  transactionGroup: {
    gap: spacing.sm,
  },
  transactionGroupLabel: {
    fontSize: typography.caption,
    textTransform: 'capitalize',
  },
  groupTransactions: {
    gap: spacing.md,
  },
  empty: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  emptyInline: {
    fontSize: typography.caption,
    lineHeight: 20,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.78 },
});
