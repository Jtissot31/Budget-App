/**
 * Reçus d'un marchand — transactions de ce marchand qui ont un reçu enregistré.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PageTransition } from '@/components/PageTransition';
import {
  ProtoActiveFilterChip,
  ProtoSearchField,
  ProtoToolbarIconButton,
} from '@/components/proto/ProtoSearchToolbar';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_TITLE_STYLE,
  moneyAmountTypography,
  screenHorizontalGutter,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { getMerchantOverrides, getTransactions, sortTransactionsNewestFirst } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { isPreviewableDocumentUri, transactionHasRegisteredReceipt } from '@/lib/documentsLibrary';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { ensureDbReady } from '@/lib/init';
import { normalizeArticleSearch, parseItemizedNote } from '@/lib/itemizedNote';
import { normalizeMerchantKey } from '@/lib/merchantLogo';
import {
  dateWithinMonthRange,
  formatMonthRangeLabel,
  type MonthRangeFilter,
} from '@/lib/monthRangeFilter';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { rowTitleTextProps } from '@/lib/textLayout';
import {
  resolveUserPickedIconWellBackground,
  userPickedIconCornerRadius,
} from '@/lib/userPickedIcon';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import type { Transaction } from '@/types';

type ReceiptRow = {
  id: string;
  transaction: Transaction;
  articleNames: string[];
};

const THUMB_SIZE = 44;
const EMPTY_ICON_WELL = 44;
/** Sized against the 28px page title + subtitle block. */
const HEADER_LOGO_SIZE = 40;

function formatDate(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** First article name plus a compact overflow count; receipt status when nothing is itemized. */
function receiptArticleTitle(row: ReceiptRow): string {
  const [firstName, ...rest] = row.articleNames;
  if (firstName) {
    if (rest.length === 0) return firstName;
    return `${firstName} +${rest.length} article${rest.length > 1 ? 's' : ''}`;
  }
  return row.transaction.receiptStatus === 'scan_pending' ? 'Reçu en attente' : 'Reçu joint';
}

export default function MerchantReceiptsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ merchant?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const iconWellBg = resolveUserPickedIconWellBackground(isLight);

  const merchantParam = typeof params.merchant === 'string' ? params.merchant : '';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<Awaited<ReturnType<typeof getMerchantOverrides>>>([]);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<MonthRangeFilter | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await ensureDbReady();
    const [nextTransactions, nextOverrides] = await Promise.all([
      getTransactions(),
      getMerchantOverrides(),
    ]);
    setTransactions(nextTransactions);
    setOverrides(nextOverrides);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);
  useRefreshOnFocus(load);

  const override = useMemo(
    () =>
      overrides.find(
        (item) => normalizeMerchantKey(item.originalName) === normalizeMerchantKey(merchantParam),
      ),
    [merchantParam, overrides],
  );
  const merchantName = override?.displayName?.trim() || merchantParam || 'Marchand';

  const receiptRows = useMemo<ReceiptRow[]>(() => {
    if (!merchantParam) return [];
    const merchantNorm = normalizeMerchantKey(merchantParam);
    const merchantTransactions = sortTransactionsNewestFirst(
      transactions.filter(
        (tx) =>
          normalizeMerchantKey(tx.label) === merchantNorm && transactionHasRegisteredReceipt(tx),
      ),
    );

    return merchantTransactions.map((tx) => ({
      id: tx.id,
      transaction: tx,
      articleNames: parseItemizedNote(tx.note).map((article) => article.name),
    }));
  }, [merchantParam, transactions]);

  const filteredRows = useMemo(() => {
    const monthScoped = monthFilter
      ? receiptRows.filter((row) => dateWithinMonthRange(row.transaction.date, monthFilter))
      : receiptRows;
    const normalized = normalizeArticleSearch(search);
    if (!normalized) return monthScoped;
    return monthScoped.filter((row) => {
      if (row.articleNames.some((name) => normalizeArticleSearch(name).includes(normalized))) {
        return true;
      }
      return normalizeArticleSearch(receiptArticleTitle(row)).includes(normalized);
    });
  }, [monthFilter, receiptRows, search]);

  /** Newest transaction of this merchant — feeds the header logo, receipt or not. */
  const headerTransaction = useMemo(() => {
    if (receiptRows.length > 0) return receiptRows[0].transaction;
    if (!merchantParam) return null;
    const merchantNorm = normalizeMerchantKey(merchantParam);
    return (
      sortTransactionsNewestFirst(
        transactions.filter((tx) => normalizeMerchantKey(tx.label) === merchantNorm),
      )[0] ?? null
    );
  }, [merchantParam, receiptRows, transactions]);

  const countLabel = receiptRows.length === 1 ? '1 reçu' : `${receiptRows.length} reçus`;
  const searching = search.trim().length > 0;
  const hasActiveFilter = searching || monthFilter !== null;

  const openMonthPicker = useCallback(() => {
    tapHaptic();
    setMonthPickerOpen(true);
  }, []);

  const clearMonthFilter = useCallback(() => {
    tapHaptic();
    setMonthFilter(null);
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: ReceiptRow }) => {
      const title = receiptArticleTitle(item);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reçu ${title} — ${formatDate(item.transaction.date)}`}
          onPress={() => {
            tapHaptic();
            openTransactionDetail(item.transaction.id);
          }}
          style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
        >
          <OnyxContainer style={onyxContainerRowLayoutStyle()}>
            {isPreviewableDocumentUri(item.transaction.receiptUri) ? (
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: iconWellBg,
                    borderColor: colors.containerBorder,
                    borderRadius: userPickedIconCornerRadius(THUMB_SIZE),
                  },
                ]}
              >
                <Image
                  source={{ uri: item.transaction.receiptUri ?? '' }}
                  style={styles.thumbImage}
                  contentFit="cover"
                />
              </View>
            ) : (
              <TransactionAvatar transaction={item.transaction} size={THUMB_SIZE} />
            )}
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.text }]} {...rowTitleTextProps}>
                {title}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {formatDate(item.transaction.date)}
              </Text>
            </View>
            <Text
              style={[
                moneyAmountTypography({ tier: 'row' }),
                styles.rowAmount,
                { color: colors.text },
              ]}
            >
              {formatDisplayMoneyAbsolute(item.transaction.amount)}
            </Text>
          </OnyxContainer>
        </Pressable>
      );
    },
    [colors.containerBorder, colors.text, colors.textMuted, iconWellBg],
  );

  const emptyHint = hasActiveFilter
    ? searching && monthFilter
      ? 'Aucun reçu ne correspond à tes filtres.'
      : searching
        ? 'Aucun article ne correspond à ta recherche.'
        : 'Aucun reçu pour cette période.'
    : `Aucune transaction chez ${merchantName} n’a de reçu enregistré pour l’instant.`;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + SCREEN_TOP_GUTTER, paddingHorizontal: contentGutter },
          ]}
        >
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
            <AppIcon family="ionicons" name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerIdentity}>
            {headerTransaction ? (
              <TransactionAvatar
                transaction={headerTransaction}
                size={HEADER_LOGO_SIZE}
                style={styles.headerLogo}
              />
            ) : null}
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {merchantName}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {countLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.toolbar, { paddingHorizontal: contentGutter }]}>
          <View style={styles.toolbarRow}>
            <ProtoSearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un article"
              accessibilityLabel="Rechercher un article"
            />
            <ProtoToolbarIconButton
              icon={monthFilter ? 'calendar' : 'calendar-outline'}
              active={monthFilter !== null}
              onPress={openMonthPicker}
              accessibilityLabel="Filtrer par mois"
            />
          </View>
          {monthFilter ? (
            <ProtoActiveFilterChip
              icon="calendar"
              label={formatMonthRangeLabel(monthFilter)}
              onPress={openMonthPicker}
              onClear={clearMonthFilter}
              accessibilityLabel={`Mois filtré : ${formatMonthRangeLabel(monthFilter)}. Modifier`}
              clearAccessibilityLabel="Effacer le filtre de mois"
            />
          ) : null}
        </View>

        <FlatList
          data={filteredRows}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: contentGutter,
              paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING,
            },
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
            <OnyxContainer style={styles.emptyCard}>
              <View style={styles.emptyInner}>
                <View
                  style={[
                    styles.emptyIcon,
                    {
                      backgroundColor: iconWellBg,
                      borderRadius: userPickedIconCornerRadius(EMPTY_ICON_WELL),
                    },
                  ]}
                >
                  <AppIcon
                    family="ionicons"
                    name={hasActiveFilter ? 'search-outline' : 'receipt-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {hasActiveFilter ? 'Aucun résultat' : 'Aucun reçu'}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{emptyHint}</Text>
              </View>
            </OnyxContainer>
          }
          renderItem={renderRow}
        />

        <MonthRangePicker
          visible={monthPickerOpen}
          value={monthFilter}
          onCancel={() => setMonthPickerOpen(false)}
          onConfirm={(value) => {
            setMonthFilter(value);
            setMonthPickerOpen(false);
          }}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backHit: {
    padding: spacing.xs,
    flexShrink: 0,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLogo: {
    flexShrink: 0,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...PAGE_TITLE_STYLE,
    fontSize: 28,
    lineHeight: 36,
  },
  subtitle: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  toolbar: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listContent: {
    gap: ONYX_CONTAINER.listGap,
    flexGrow: 1,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 18,
  },
  rowMeta: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  rowAmount: {
    flexShrink: 0,
  },
  emptyCard: {
    marginTop: spacing.xxl,
    padding: ONYX_CONTAINER.padding.card,
  },
  emptyInner: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  emptyIcon: {
    width: EMPTY_ICON_WELL,
    height: EMPTY_ICON_WELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typographyKit.metaSemibold,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    ...typographyKit.metaMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: { opacity: 0.82 },
});
