import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MerchantLogo } from '@/components/MerchantLogo';
import { GlassContainer } from '@/components/GlassContainer';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { getMerchantOverrides, getTransactions, sortTransactionsNewestFirst } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
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

type ItemizedNote = {
  name: string;
};

function parseItemizedNote(note?: string): ItemizedNote[] {
  const line = note?.split('\n').find((part) => part.startsWith('articles:'));
  if (!line) return [];

  try {
    const parsed = JSON.parse(line.slice('articles:'.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): ItemizedNote[] => {
      if (!item || typeof item !== 'object') return [];
      const name = typeof (item as Record<string, unknown>).name === 'string'
        ? (item as Record<string, unknown>).name.trim()
        : '';
      return name ? [{ name }] : [];
    });
  } catch {
    return [];
  }
}

function getTransactionTitle(tx: Transaction, fallbackTitle: string) {
  const itemized = parseItemizedNote(tx.note);
  if (itemized.length === 0) return fallbackTitle;

  const names = itemized.slice(0, 2).map((item) => item.name);
  const suffix = itemized.length > names.length ? ` + ${itemized.length - names.length}` : '';
  return `${names.join(', ')}${suffix}`;
}

function MerchantTransactionRow({
  transaction: tx,
  merchantName,
  logoUrl,
  onPress,
}: {
  transaction: Transaction;
  merchantName: string;
  logoUrl?: string | null;
  onPress: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer';
  const amountColor = isIncome ? colors.success : isTransfer ? colors.textMuted : colors.text;
  const hasReceipt = Boolean(tx.receiptUri || tx.receiptStatus);
  const title = getTransactionTitle(tx, merchantName);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir la transaction ${title}`}
      style={({ pressed }) => [
        styles.transactionRow,
        {
          backgroundColor: pressed ? colors.surface : colors.surfaceSolid,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
    >
      <MerchantLogo name={merchantName} logoUrl={logoUrl} size={34} />
      <View style={styles.transactionBody}>
        <View style={styles.transactionTitleRow}>
          <Text style={[styles.transactionTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {hasReceipt ? (
            <View style={[styles.receiptBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={13} color={colors.textMuted} />
            </View>
          ) : null}
        </View>
      </View>
      <Text style={[styles.transactionAmount, { color: amountColor }]} numberOfLines={1}>
        {isTransfer ? '' : isIncome ? '+' : '−'}
        {tx.amount.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
      </Text>
    </Pressable>
  );
}

export default function MerchantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ merchant?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const merchantKey = typeof params.merchant === 'string' ? params.merchant : '';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<MerchantOverride[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
  const logoUrl = override?.logoUrl ?? null;
  const visibleTransactions = useMemo(() => {
    if (!merchantKey || override?.hidden) return [];
    return sortTransactionsNewestFirst(transactions.filter((tx) => tx.label === merchantKey));
  }, [merchantKey, override?.hidden, transactions]);
  const total = useMemo(
    () => visibleTransactions.reduce((sum, tx) => sum + (tx.type === 'expense' ? tx.amount : 0), 0),
    [visibleTransactions],
  );
  const dateRange = useMemo(() => formatDateRange(visibleTransactions), [visibleTransactions]);
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
        <View style={styles.topBarSpacer} />
      </View>

      <GlassContainer
        style={styles.identityCardWrap}
        innerStyle={styles.identityCard}
        padding={spacing.md}
        borderRadius={radius.xl}
      >
        <MerchantLogo name={merchantName} logoUrl={logoUrl} size={52} />
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
            {total.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
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
                <MerchantTransactionRow
                  key={tx.id}
                  transaction={tx}
                  merchantName={merchantName}
                  logoUrl={logoUrl}
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
  title: {
    color: colors.text,
    fontSize: typography.screenTitle,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  topBarSpacer: { width: 38 },
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
    marginBottom: spacing.lg,
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
    color: colors.text,
    fontSize: typography.heroStat,
    fontWeight: '800',
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
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  transactionBody: {
    flex: 1,
    minWidth: 0,
  },
  transactionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  transactionTitle: {
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: typography.body + 3,
  },
  receiptBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  transactionAmount: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    flexShrink: 0,
    textAlign: 'right',
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 48,
    fontSize: typography.caption,
  },
  pressed: { opacity: 0.78 },
});
