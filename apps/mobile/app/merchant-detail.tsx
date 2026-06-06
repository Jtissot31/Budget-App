import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { GlassContainer } from '@/components/GlassContainer';
import { MerchantEditModal, type MerchantEditTarget } from '@/components/MerchantEditModal';
import { MerchantLogo } from '@/components/MerchantLogo';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { getMerchantOverrides, getTransactions, sortTransactionsNewestFirst } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { parseItemizedNote } from '@/lib/itemizedNote';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { heroStatAmount } from '@/lib/textLayout';
import type { MerchantOverride, Transaction } from '@/types';

function getLocalDayKey(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(isoDay: string) {
  return new Date(`${isoDay}T12:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(transactions: Transaction[]) {
  const days = transactions.map((tx) => getLocalDayKey(tx.date)).sort();
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return 'Aucune date';
  if (first === last) return formatDate(first);
  return `${formatDate(first)} - ${formatDate(last)}`;
}

function getTransactionTitle(tx: Transaction, fallbackTitle: string) {
  const itemized = parseItemizedNote(tx.note);
  if (itemized.length === 0) return fallbackTitle;

  const names = itemized.slice(0, 2).map((item) => item.name);
  const suffix = itemized.length > names.length ? ` + ${itemized.length - names.length}` : '';
  return `${names.join(', ')}${suffix}`;
}

export default function MerchantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ merchant?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const merchantKey = typeof params.merchant === 'string' ? params.merchant : '';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<MerchantOverride[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<MerchantEditTarget | null>(null);

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
    () => overrides.find((item) => item.originalName === merchantKey),
    [merchantKey, overrides],
  );
  const merchantName = override?.displayName?.trim() || merchantKey || 'Marchand';
  const visibleTransactions = useMemo(() => {
    if (!merchantKey || override?.hidden) return [];
    return sortTransactionsNewestFirst(transactions.filter((tx) => tx.label === merchantKey));
  }, [merchantKey, override?.hidden, transactions]);
  const total = useMemo(
    () => visibleTransactions.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0),
    [visibleTransactions],
  );
  const dateRange = useMemo(() => formatDateRange(visibleTransactions), [visibleTransactions]);
  const receiptCount = useMemo(() => {
    return visibleTransactions.reduce((count, tx) => {
      const hasArticles = parseItemizedNote(tx.note).length > 0;
      const hasReceipt = Boolean(tx.receiptUri || tx.receiptStatus);
      return count + (hasArticles || hasReceipt ? 1 : 0);
    }, 0);
  }, [visibleTransactions]);
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    visibleTransactions.forEach((tx) => {
      const key = getLocalDayKey(tx.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups)
      .map(([day, txs]) => [day, sortTransactionsNewestFirst(txs)] as [string, Transaction[]])
      .sort(([a], [b]) => b.localeCompare(a));
  }, [visibleTransactions]);

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
    <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surfaceSolid, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Historique</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modifier le marchand"
          hitSlop={12}
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: colors.surfaceSolid, borderColor: colors.borderStrong },
            pressed && styles.pressed,
          ]}
          onPress={openEditor}
        >
          <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.editButtonText, { color: colors.textSecondary }]}>Modifier</Text>
        </Pressable>
      </View>

      <GlassContainer
        style={styles.identityCardWrap}
        innerStyle={styles.identityCard}
        padding={spacing.md}
        borderRadius={radius.xl}
      >
        <MerchantLogo
          name={merchantName}
          logoUrl={override?.logoUrl}
          icon={override?.icon}
          useAutoLogo={override?.useAutoLogo !== false}
          size={52}
        />
        <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={2}>
          {merchantName}
        </Text>
      </GlassContainer>

      <GlassContainer
        style={styles.summaryCardWrap}
        innerStyle={styles.summaryCard}
        padding={spacing.md}
        borderRadius={radius.lg}
      >
        <View>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total</Text>
          <Text style={[styles.summaryAmount, { color: colors.text }]}>
            {formatDisplayMoneyAbsolute(total)}
          </Text>
        </View>
        <View style={styles.summaryMeta}>
          <Text style={[styles.summaryCount, { color: colors.text }]}>
            {visibleTransactions.length} transaction{visibleTransactions.length > 1 ? 's' : ''}
          </Text>
          <Text style={[styles.summaryDates, { color: colors.textMuted }]} numberOfLines={1}>
            {dateRange}
          </Text>
        </View>
      </GlassContainer>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir la bibliothèque de reçus"
        onPress={() => {
          tapHaptic();
          router.push({ pathname: '/merchant-receipts', params: { merchant: merchantKey } });
        }}
        style={({ pressed }) => [styles.receiptSectionWrap, pressed && styles.pressed]}
      >
        <GlassContainer
          padding={spacing.md}
          borderRadius={radius.lg}
          innerStyle={styles.receiptSectionInner}
        >
          <View style={styles.receiptSectionCopy}>
            <DashboardSectionLabel>Bibliothèque de reçus</DashboardSectionLabel>
            <Text style={[styles.receiptSectionHint, { color: colors.textMuted }]}>
              {receiptCount > 0
                ? `${receiptCount} reçu${receiptCount > 1 ? 's' : ''} ou article${receiptCount > 1 ? 's' : ''}`
                : 'Articles et reçus de ce marchand'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </GlassContainer>
      </Pressable>

      <FlatList
        style={styles.listFlex}
        data={groupedTransactions}
        keyExtractor={([date]) => date}
        removeClippedSubviews
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) }]}
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
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {override?.hidden ? 'Ce marchand est masqué.' : 'Aucune transaction'}
          </Text>
        }
        renderItem={({ item: [date, txs] }) => (
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
              {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </Text>
            <View style={styles.groupTransactions}>
              {txs.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={{ ...tx, label: getTransactionTitle(tx, merchantName) }}
                  onPress={() => {
                    tapHaptic();
                    setSelected(tx);
                  }}
                />
              ))}
            </View>
          </View>
        )}
      />

      <TransactionDetailSheet transaction={selected} onClose={() => setSelected(null)} onDeleted={() => { void load(); }} />
      <MerchantEditModal
        visible={Boolean(editTarget)}
        merchant={editTarget}
        showDelete={false}
        onClose={() => setEditTarget(null)}
        onSaved={load}
      />
    </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  listFlex: { flex: 1, backgroundColor: 'transparent' },
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minHeight: 38,
  },
  editButtonText: {
    fontSize: typography.meta,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  identityCardWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  merchantName: {
    flex: 1,
    color: colors.text,
    fontSize: typography.dashboardGreeting,
    fontWeight: '800',
  },
  summaryCardWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  summaryAmount: {
    ...heroStatAmount,
    color: colors.text,
    marginTop: 2,
  },
  summaryMeta: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  summaryCount: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  summaryDates: {
    color: colors.textMuted,
    fontSize: typography.meta,
    marginTop: 2,
  },
  receiptSectionWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  receiptSectionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  receiptSectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  receiptSectionHint: {
    fontSize: typography.meta,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginBottom: spacing.sm,
    textTransform: 'capitalize',
  },
  groupTransactions: {
    gap: spacing.md,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 48,
    fontSize: typography.caption,
  },
  pressed: { opacity: 0.78 },
});
