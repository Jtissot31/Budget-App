import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassContainer } from '@/components/GlassContainer';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { radius, spacing, typography } from '@/constants/theme';
import { getMerchantOverrides, getTransactions, sortTransactionsNewestFirst } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { normalizeArticleSearch, parseItemizedNote } from '@/lib/itemizedNote';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import { rowTitleTextProps } from '@/lib/textLayout';
import type { Transaction } from '@/types';

type ReceiptEntry = {
  id: string;
  transactionId: string;
  articleName: string;
  price: number;
  date: string;
  receiptUri?: string | null;
  transaction: Transaction;
};

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isPreviewableReceipt(uri?: string | null) {
  return Boolean(uri && !uri.startsWith('scan://'));
}

export default function MerchantReceiptsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ merchant?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const merchantKey = typeof params.merchant === 'string' ? params.merchant : '';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<Awaited<ReturnType<typeof getMerchantOverrides>>>([]);
  const [search, setSearch] = useState('');
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

  const receiptEntries = useMemo(() => {
    if (!merchantKey || override?.hidden) return [];
    const merchantTransactions = sortTransactionsNewestFirst(
      transactions.filter((tx) => tx.label === merchantKey),
    );

    return merchantTransactions.flatMap((tx): ReceiptEntry[] => {
      const articles = parseItemizedNote(tx.note);
      if (articles.length === 0) {
        if (!tx.receiptUri && !tx.receiptStatus) return [];
        return [{
          id: `${tx.id}-receipt`,
          transactionId: tx.id,
          articleName: tx.label,
          price: tx.amount,
          date: tx.date,
          receiptUri: tx.receiptUri,
          transaction: tx,
        }];
      }

      return articles.map((article, index) => ({
        id: `${tx.id}-${index}-${article.name}`,
        transactionId: tx.id,
        articleName: article.name,
        price: article.price,
        date: tx.date,
        receiptUri: tx.receiptUri,
        transaction: tx,
      }));
    });
  }, [merchantKey, override?.hidden, transactions]);

  const filteredEntries = useMemo(() => {
    const normalized = normalizeArticleSearch(search);
    if (!normalized) return receiptEntries;
    return receiptEntries.filter((entry) =>
      normalizeArticleSearch(entry.articleName).includes(normalized),
    );
  }, [receiptEntries, search]);

  return (
    <PageTransition>
      <View style={styles.screen}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER }]}>
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
            Bibliothèque de reçus
          </Text>
          <View style={styles.topBarSpacer} />
        </View>

        <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {merchantName}
        </Text>

        <View style={[styles.searchRow, { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder, borderWidth: 1 }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher un article"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <FlatList
          style={styles.listFlex}
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) },
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
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {search.trim() ? 'Aucun article trouvé' : 'Aucun reçu ou article enregistré'}
            </Text>
          }
          renderItem={({ item }) => (
            <View>
              <GlassContainer borderRadius={radius.lg} padding={spacing.md} innerStyle={styles.rowInner}>
                {isPreviewableReceipt(item.receiptUri) ? (
                  <Image source={{ uri: item.receiptUri ?? '' }} style={styles.thumbnail} contentFit="cover" />
                ) : (
                  <View style={[styles.thumbnailFallback, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name="receipt-outline" size={18} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={[styles.articleName, { color: colors.text }]} {...rowTitleTextProps}>
                    {item.articleName}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                    {formatDate(item.date)}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, { color: colors.text }]}>
                  {formatDisplayMoneyAbsolute(item.price)}
                </Text>
              </GlassContainer>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
    paddingBottom: spacing.sm,
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
    fontSize: typography.screenTitle,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  topBarSpacer: { width: 38 },
  subtitle: {
    textAlign: 'center',
    fontSize: typography.caption,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    borderRadius: radius.card,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
  },
  listFlex: { flex: 1 },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
  },
  thumbnailFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  articleName: { fontSize: typography.body, fontWeight: '800' },
  rowMeta: { fontSize: typography.meta, marginTop: 2 },
  rowAmount: { fontSize: typography.body, fontWeight: '700' },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: typography.caption,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.78 },
});
