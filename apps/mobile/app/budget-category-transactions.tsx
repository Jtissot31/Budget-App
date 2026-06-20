import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { PageTransition } from '@/components/PageTransition';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TransactionRow } from '@/components/TransactionRow';
import { ghostCardShadow } from '@/constants/ghostUi';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { getCategoryBudgets, getTransactionsForBudgetCategory, sortTransactionsNewestFirst } from '@/lib/db';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { heroStatAmount } from '@/lib/textLayout';
import type { CategoryBudget, SimulatedAccount, Transaction } from '@/types';

const DETAIL_SHEET_TOP_RADIUS = 22;

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

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function getReadableIconColor(backgroundColor: string): '#000000' | '#FFFFFF' {
  const hex = backgroundColor.replace('#', '').trim();
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#FFFFFF';

  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return contrastWithBlack > contrastWithWhite ? '#000000' : '#FFFFFF';
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
      const name =
        typeof (item as Record<string, unknown>).name === 'string'
          ? (item as Record<string, unknown>).name.trim()
          : '';
      return name ? [{ name }] : [];
    });
  } catch {
    return [];
  }
}

function getTransactionTitle(tx: Transaction) {
  const itemized = parseItemizedNote(tx.note);
  if (itemized.length === 0) return tx.label;

  const names = itemized.slice(0, 2).map((item) => item.name);
  const suffix = itemized.length > names.length ? ` + ${itemized.length - names.length}` : '';
  return `${names.join(', ')}${suffix}`;
}

export default function BudgetCategoryTransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const categoryId = typeof params.id === 'string' ? params.id.trim() : '';
  const fallbackName = typeof params.name === 'string' ? params.name : 'Catégorie';
  const insets = useSafeAreaInsets();
  const { colors, ghost, isLight } = useAppTheme();

  const [category, setCategory] = useState<CategoryBudget | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stylesMemo = useMemo(() => createShellStyles(colors), [colors]);

  const load = useCallback(async () => {
    if (!categoryId) {
      setCategory(null);
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [nextBudgets, nextTxs] = await Promise.all([
        getCategoryBudgets(),
        getTransactionsForBudgetCategory(categoryId),
      ]);
      setCategory(nextBudgets.find((item) => item.categoryId === categoryId) ?? null);
      setTransactions(sortTransactionsNewestFirst(nextTxs));
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(load);

  const total = useMemo(() => transactions.reduce((sum, tx) => sum + tx.amount, 0), [transactions]);
  const dateRange = useMemo(() => formatDateRange(transactions), [transactions]);
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach((tx) => {
      const key = getLocalDayKey(tx.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups)
      .map(([day, txs]) => [day, sortTransactionsNewestFirst(txs)] as [string, Transaction[]])
      .sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  const displayName = category?.categoryName ?? fallbackName;
  const categoryColor = category?.categoryColor ?? colors.primary;
  const categoryIcon = category?.categoryIcon ?? 'pricetag-outline';
  const sheetHorizontalGutter = Math.max(insets.left, insets.right, spacing.md);
  const listShowing = loading && transactions.length === 0 ? [] : groupedTransactions;

  return (
    <PageTransition>
    <View style={[stylesMemo.screenRoot, { backgroundColor: 'transparent' }]}>
      <BottomSheet
        visible
        scrollable={false}
        onClose={() => router.back()}
        scrollContentContainerStyle={{
          flex: 1,
          paddingHorizontal: sheetHorizontalGutter,
          paddingBottom: 0,
        }}
        sheetStyle={[
          stylesMemo.sheetSurface,
          {
            backgroundColor: colors.containerBackground,
            borderTopLeftRadius: DETAIL_SHEET_TOP_RADIUS,
            borderTopRightRadius: DETAIL_SHEET_TOP_RADIUS,
          },
        ]}
      >
        <View style={stylesMemo.sheetColumn}>
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
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[stylesMemo.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                Historique
              </Text>
              <Text style={[stylesMemo.sheetSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <View style={stylesMemo.headerTrailingSpacer} />
          </View>

          {loading && !category && categoryId ? (
            <Text style={[stylesMemo.mutedCenter, { color: colors.textMuted }]}>Chargement...</Text>
          ) : !categoryId ? (
            <Text style={[stylesMemo.mutedCenter, { color: colors.textMuted }]}>Identifiant de catégorie manquant.</Text>
          ) : (
            <>
              <View
                style={[
                  stylesMemo.heroCard,
                  ghostCardShadow,
                  {
                    borderColor: colors.border,
                    backgroundColor: isLight ? colors.surfaceSolid : colors.surfaceElevated,
                  },
                ]}
              >
                <View style={[stylesMemo.heroIcon, { backgroundColor: categoryColor, borderColor: categoryColor }]}>
                  <Ionicons
                    name={(categoryIcon in Ionicons.glyphMap ? categoryIcon : 'pricetag-outline') as keyof typeof Ionicons.glyphMap}
                    size={30}
                    color={getReadableIconColor(categoryColor)}
                  />
                </View>
                <View style={stylesMemo.heroCopy}>
                  <Text style={[stylesMemo.categoryName, { color: colors.text }]} numberOfLines={3}>
                    {displayName}
                  </Text>
                  <Text style={[stylesMemo.categoryMeta, { color: colors.textMuted }]}>
                    {loading ? 'Chargement du profil...' : category ? 'Transactions liées au budget' : 'Catégorie introuvable localement.'}
                  </Text>
                </View>
              </View>

              <SurfaceCard style={stylesMemo.summaryWrap}>
                <View>
                  <Text style={[stylesMemo.summaryEyebrow, { color: colors.textMuted }]}>Dépenses</Text>
                  <Text style={[stylesMemo.summaryAmount, { color: colors.text }]}>{formatMoney(total)}</Text>
                </View>
                <View style={stylesMemo.summaryMeta}>
                  <Text style={[stylesMemo.summaryCount, { color: colors.text }]}>
                    {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
                  </Text>
                  <Text style={[stylesMemo.summaryDates, { color: colors.textMuted }]} numberOfLines={1}>
                    {dateRange}
                  </Text>
                </View>
              </SurfaceCard>
            </>
          )}

          <FlatList
            style={stylesMemo.listFlex}
            data={listShowing}
            keyExtractor={([date]) => date}
            removeClippedSubviews
            contentContainerStyle={[
              stylesMemo.listPadding,
              { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) },
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
            ListEmptyComponent={
              <Text style={[stylesMemo.empty, { color: colors.textMuted }]}>
                {loading ? 'Chargement...' : transactions.length === 0 ? 'Aucune transaction pour cette catégorie.' : ''}
              </Text>
            }
            renderItem={({ item: [date, txs] }) => (
              <View style={stylesMemo.group}>
                <Text style={[stylesMemo.groupLabel, { color: colors.textMuted }]}>
                  {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </Text>
                <View style={stylesMemo.groupTransactions}>
                  {txs.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={{ ...tx, label: getTransactionTitle(tx) }}
                      onPress={() => { tapHaptic(); router.push({ pathname: '/transaction-detail', params: { transactionId: tx.id } }); }}
                    />
                  ))}
                </View>
              </View>
            )}
          />
        </View>
      </BottomSheet>

    </View>
    </PageTransition>
  );
}

function createShellStyles(colors: AppColors) {
  return StyleSheet.create({
    screenRoot: { flex: 1 },
    sheetSurface: { paddingBottom: 0 },
    sheetColumn: { flex: 1, gap: spacing.lg, minHeight: 0 },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 0,
      gap: spacing.md,
      marginBottom: spacing.xs,
    },
    sheetTitle: { fontSize: typography.dashboardGreeting, fontWeight: '800', letterSpacing: -0.4 },
    sheetSubtitle: { fontSize: typography.meta, fontWeight: '700', letterSpacing: 0.1 },
    headerIconBtn: {
      width: 42,
      height: 42,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTrailingSpacer: {
      width: 42,
      height: 42,
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
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: { flex: 1, gap: spacing.xs },
    categoryName: { fontSize: typography.screenTitle, fontWeight: '900', letterSpacing: -0.6 },
    categoryMeta: { fontSize: typography.caption, lineHeight: typography.caption + 5, fontWeight: '700' },
    summaryWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    summaryEyebrow: {
      fontSize: typography.micro,
      fontWeight: '700',
      letterSpacing: 0.25,
      textTransform: 'uppercase',
    },
    summaryAmount: {
      ...heroStatAmount,
      marginTop: 4,
    },
    summaryMeta: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      gap: 2,
    },
    summaryCount: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    summaryDates: {
      fontSize: typography.meta,
    },
    mutedCenter: {
      textAlign: 'center',
      paddingVertical: spacing.lg,
      fontSize: typography.caption,
    },
    listFlex: { flex: 1, backgroundColor: 'transparent' },
    listPadding: { paddingBottom: spacing.md },
    group: {
      marginBottom: spacing.lg,
    },
    groupLabel: {
      fontSize: typography.caption,
      marginBottom: spacing.xs,
      textTransform: 'capitalize',
    },
    groupTransactions: {
      gap: spacing.xs,
    },
    empty: {
      textAlign: 'center',
      marginTop: 32,
      fontSize: typography.caption,
      lineHeight: typography.caption + 6,
    },
  });
}
