import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MerchantEditModal, type MerchantEditTarget } from '@/components/MerchantEditModal';
import { MerchantLogo } from '@/components/MerchantLogo';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionDayGroup } from '@/components/transactions/TransactionDayGroups';
import { FixedScreenHeader } from '@/components/FixedScreenHeader';
import { PillButton, SummaryCard } from '@/components/kit';
import { PageTransition } from '@/components/PageTransition';
import {
  accountDetailSectionDividerStyle,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  MERCHANT_LOGO_SIZE,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { getMerchantOverrides, getTransactions, sortTransactionsNewestFirst } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { normalizeMerchantKey, resolveCanonicalMerchantOriginalName } from '@/lib/merchantLogo';
import { tapHaptic } from '@/lib/haptics';
import { parseItemizedNote } from '@/lib/itemizedNote';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import {
  filterTransactionsByType,
  groupTransactionsByDay,
  HISTORY_FILTER_OPTIONS,
  type HistoryTypeFilter,
  transactionMatchesSearch,
} from '@/lib/transactionListUtils';
import type { MerchantOverride, Transaction } from '@/types';
import { FitText } from '@/components/kit/FitText';

type ReceiptPreview = {
  id: string;
  articleName: string;
  receiptUri?: string | null;
  transaction: Transaction;
};

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function isPreviewableReceipt(uri?: string | null) {
  return Boolean(uri && !uri.startsWith('scan://'));
}

function getTransactionTitle(tx: Transaction, fallbackTitle: string) {
  const itemized = parseItemizedNote(tx.note);
  if (itemized.length === 0) return fallbackTitle;

  const names = itemized.slice(0, 2).map((item) => item.name);
  const suffix = itemized.length > names.length ? ` + ${itemized.length - names.length}` : '';
  return `${names.join(', ')}${suffix}`;
}

function buildReceiptPreviews(transactions: Transaction[]): ReceiptPreview[] {
  return transactions.flatMap((tx): ReceiptPreview[] => {
    const articles = parseItemizedNote(tx.note);
    if (articles.length === 0) {
      if (!tx.receiptUri && !tx.receiptStatus) return [];
      return [{
        id: `${tx.id}-receipt`,
        articleName: tx.label,
        receiptUri: tx.receiptUri,
        transaction: tx,
      }];
    }

    return articles.map((article, index) => ({
      id: `${tx.id}-${index}-${article.name}`,
      articleName: article.name,
      receiptUri: tx.receiptUri,
      transaction: tx,
    }));
  });
}

function FlowDivider() {
  const { isLight } = useAppTheme();
  return <View style={accountDetailSectionDividerStyle(isLight)} />;
}

export default function MerchantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ merchant?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const merchantKey = typeof params.merchant === 'string' ? params.merchant : '';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<MerchantOverride[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<MerchantEditTarget | null>(null);
  const [search, setSearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('all');
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);

  const load = useCallback(async () => {
    const [nextTransactions, nextOverrides] = await Promise.all([getTransactions(), getMerchantOverrides()]);
    setTransactions(nextTransactions);
    setOverrides(nextOverrides);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useRefreshOnFocus(load);

  const override = useMemo(
    () => overrides.find((item) => normalizeMerchantKey(item.originalName) === normalizeMerchantKey(merchantKey)),
    [merchantKey, overrides],
  );
  const merchantName = override?.displayName?.trim() || merchantKey || 'Marchand';
  const visibleTransactions = useMemo(() => {
    if (!merchantKey || override?.hidden) return [];
    const merchantNorm = normalizeMerchantKey(merchantKey);
    return sortTransactionsNewestFirst(
      transactions.filter((tx) => normalizeMerchantKey(tx.label) === merchantNorm),
    );
  }, [merchantKey, override?.hidden, transactions]);

  const expenseTransactions = useMemo(
    () => visibleTransactions.filter((tx) => tx.type === 'expense'),
    [visibleTransactions],
  );
  const totalSpent = useMemo(
    () => expenseTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [expenseTransactions],
  );
  const averageBasket = useMemo(() => {
    if (expenseTransactions.length === 0) return null;
    return totalSpent / expenseTransactions.length;
  }, [expenseTransactions.length, totalSpent]);

  const dominantCategory = useMemo(() => {
    const counts = new Map<string, number>();
    visibleTransactions.forEach((tx) => {
      const name = tx.categoryName?.trim();
      if (!name) return;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    let best = '';
    let bestCount = 0;
    counts.forEach((count, name) => {
      if (count > bestCount) {
        bestCount = count;
        best = name;
      }
    });
    return best || null;
  }, [visibleTransactions]);

  const spentThisMonth = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    return expenseTransactions
      .filter((tx) => tx.date.slice(0, 7) === monthKey)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [expenseTransactions]);

  const lastVisitLabel = useMemo(() => {
    const last = expenseTransactions[0]?.date;
    if (!last) return null;
    return new Date(`${last.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  }, [expenseTransactions]);

  const receiptPreviews = useMemo(
    () => buildReceiptPreviews(visibleTransactions),
    [visibleTransactions],
  );
  const receiptCount = receiptPreviews.length;

  const filteredTransactions = useMemo(() => {
    const searched = visibleTransactions.filter((tx) => transactionMatchesSearch(tx, search));
    return filterTransactionsByType(searched, historyTypeFilter);
  }, [historyTypeFilter, search, visibleTransactions]);
  const groupedTransactions = useMemo(
    () => groupTransactionsByDay(filteredTransactions),
    [filteredTransactions],
  );
  const historyHasActiveFilters = search.trim().length > 0 || historyTypeFilter !== 'all';

  const openEditor = () => {
    if (!merchantKey) return;
    tapHaptic();
    setEditTarget({
      originalName: merchantKey,
      displayName: merchantName,
      override,
    });
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader
          title={merchantName}
          onBack={() => router.back()}
          trailing={<PillButton label="Modifier" onPress={openEditor} accessibilityLabel="Modifier le marchand" />}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) },
          ]}
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
          <View style={styles.heroIdentityRow}>
            <MerchantLogo
              name={merchantName}
              logoUrl={override?.logoUrl}
              icon={override?.icon}
              useAutoLogo={override?.useAutoLogo !== false}
              size={MERCHANT_LOGO_SIZE}
            />
            <View style={styles.heroIdentityCopy}>
              <Text style={[styles.heroMerchantName, { color: colors.text }]} numberOfLines={2}>
                {merchantName}
              </Text>
              {dominantCategory ? (
                <FitText style={[styles.heroCategory, { color: colors.textMuted }]}>
                  {dominantCategory}
                </FitText>
              ) : null}
            </View>
          </View>

          <SummaryCard
            label="Dépensé au total"
            amount={formatMoney(totalSpent)}
            amountValue={totalSpent}
            formatAmount={formatMoney}
            badge={{
              label: `${expenseTransactions.length} achat${expenseTransactions.length > 1 ? 's' : ''}`,
              color: colors.textMuted,
            }}
            stats={[
              { label: 'Panier moyen', value: averageBasket != null ? formatMoney(averageBasket) : '—' },
              { label: 'Ce mois', value: formatMoney(spentThisMonth) },
              { label: 'Dernier achat', value: lastVisitLabel ?? '—' },
            ]}
          />

          <FlowDivider />

          <View style={styles.receiptSection}>
            <View
              style={[
                styles.receiptLibraryHeader,
                { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              ]}
            >
              <View style={styles.receiptSectionTitleRow}>
                <AppIcon family="ionicons" name="receipt-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.receiptSectionTitle, { color: colors.text }]}>
                  Bibliothèque de reçus
                </Text>
              </View>
              <View style={styles.receiptSectionMeta}>
                <View
                  style={[
                    styles.receiptCountBadge,
                    { backgroundColor: colors.borderSubtle, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.receiptCountBadgeText, { color: colors.textMuted }]}>
                    {receiptCount}
                  </Text>
                </View>
              </View>
            </View>

            {receiptPreviews.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.receiptThumbnailRow}
              >
                {receiptPreviews.slice(0, 12).map((entry, index) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.receiptThumbnailWrap,
                      index > 0 && [
                        styles.receiptThumbnailDivider,
                        { borderLeftColor: colors.border },
                      ],
                    ]}
                  >
                    {isPreviewableReceipt(entry.receiptUri) ? (
                      <Image
                        source={{ uri: entry.receiptUri ?? '' }}
                        style={styles.receiptThumbnail}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.receiptThumbnailFallback, { backgroundColor: colors.surfaceElevated }]}>
                        <AppIcon family="ionicons" name="receipt-outline" size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <FitText style={[styles.receiptThumbnailLabel, { color: colors.textMuted }]}>
                      {entry.articleName}
                    </FitText>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.receiptEmptyHint, { color: colors.textMuted }]}>
                Aucun reçu ou article enregistré pour ce marchand.
              </Text>
            )}
          </View>

          <FlowDivider />

          <View style={styles.transactionList}>
            <View style={[styles.searchRow, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder }]}>
              <AppIcon family="ionicons" name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Rechercher"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              {search.trim().length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Effacer la recherche"
                  hitSlop={8}
                  onPress={() => setSearch('')}
                  style={styles.clearSearchBtn}
                >
                  <AppIcon family="ionicons" name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filtres"
                accessibilityState={{ expanded: historyFiltersExpanded }}
                hitSlop={8}
                onPress={() => {
                  tapHaptic();
                  setHistoryFiltersExpanded((expanded) => !expanded);
                }}
                style={styles.filterIconBtn}
              >
                <AppIcon family="ionicons" 
                  name={historyFiltersExpanded ? 'filter' : 'filter-outline'}
                  size={20}
                  color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}
                />
              </Pressable>
            </View>

            {historyFiltersExpanded ? (
              <View style={styles.historyFilterWrap}>
                <SegmentedTabs
                  tabs={HISTORY_FILTER_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
                  active={historyTypeFilter}
                  onChange={(id) => {
                    tapHaptic();
                    setHistoryTypeFilter(id);
                  }}
                  showDivider={false}
                  trackBgColor="transparent"
                  activeBgColor="rgba(255,255,255,0.07)"
                  activeLabelColor="rgba(255,255,255,0.85)"
                  inactiveLabelColor="rgba(255,255,255,0.28)"
                />
              </View>
            ) : null}

            {groupedTransactions.length > 0 ? (
              groupedTransactions.map(([date, txs]) => (
                <TransactionDayGroup key={date} date={date} txs={txs.map((tx) => ({ ...tx, label: getTransactionTitle(tx, merchantName) }))} />
              ))
            ) : (
              <Text style={[styles.emptyInline, { color: colors.textMuted }]}>
                {override?.hidden
                  ? 'Ce marchand est masqué.'
                  : historyHasActiveFilters
                    ? 'Aucun résultat. Essaie un autre filtre ou une autre recherche.'
                    : 'Aucune transaction'}
              </Text>
            )}
          </View>
        </ScrollView>

        <MerchantEditModal
          visible={Boolean(editTarget)}
          merchant={editTarget}
          showDelete={false}
          resolveOriginalName={(displayName) =>
            resolveCanonicalMerchantOriginalName(displayName, transactions.map((tx) => tx.label))
          }
          transactionMerchantNames={transactions.map((tx) => tx.label)}
          onClose={() => setEditTarget(null)}
          onSaved={load}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  heroIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIdentityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroMerchantName: {
    ...jakartaExtraBoldText,
    fontSize: typography.dashboardGreeting,
    letterSpacing: -0.4,
  },
  heroCategory: {
    fontSize: typography.meta,
    fontWeight: '700',
  },
  receiptSection: {
    gap: spacing.sm,
  },
  receiptLibraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  receiptSectionTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  receiptSectionTitle: {
    ...jakartaSemiboldText,
    fontSize: typography.body,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  receiptSectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  receiptCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCountBadgeText: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    fontVariant: ['tabular-nums'],
  },
  receiptThumbnailRow: {
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  receiptThumbnailWrap: {
    width: 88,
    gap: spacing.xs,
    paddingLeft: spacing.sm,
  },
  receiptThumbnailDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.sm,
  },
  receiptThumbnail: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  receiptThumbnailFallback: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptThumbnailLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  receiptEmptyHint: {
    fontSize: typography.caption,
    lineHeight: 20,
    paddingTop: spacing.xs,
  },
  transactionList: {
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    padding: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterIconBtn: {
    padding: 4,
    marginLeft: spacing.xs,
  },
  historyFilterWrap: {
    marginBottom: spacing.sm,
  },
  transactionGroup: {
    marginBottom: spacing.xxl,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: UNIFORM_SECTION_HEADER_MIN_HEIGHT,
    marginBottom: spacing.md,
  },
  transactionGroupLabel: {
    fontSize: typography.caption,
    textTransform: 'capitalize',
    flex: 1,
    minWidth: 0,
  },
  groupTransactions: {
    gap: spacing.lg,
  },
  emptyInline: {
    fontSize: typography.caption,
    lineHeight: 20,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.78 },
});
