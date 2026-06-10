import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionRow } from '@/components/TransactionRow';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  accountDetailHeroBlockStyle,
  accountDetailSectionDividerStyle,
  accountDetailStatementStatColStyle,
  accountDetailStatementStatLabelStyle,
  accountDetailStatementStatsRowStyle,
  accountDetailStatementStatValueStyle,
  interExtraBoldText,
  interMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { getContactByNormalizedName, getTransactions, sortTransactionsNewestFirst, updateContactEmployer } from '@/lib/db';
import { isContactIncomeTx, parseRaisonFromNote } from '@/lib/accountTransactionFlow';
import { getContactTransactions } from '@/lib/contactHistory';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { UNIFORM_SECTION_HEADER_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import {
  formatTransactionGroupDateLabel,
  groupTransactionsByDay,
  transactionMatchesSearch,
} from '@/lib/transactionListUtils';
import type { Contact, Transaction } from '@/types';

type ContactHistoryTypeFilter = 'all' | 'sent' | 'received';

const CONTACT_HISTORY_FILTER_OPTIONS: { id: ContactHistoryTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'sent', label: 'Envoyés' },
  { id: 'received', label: 'Reçus' },
];

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function formatSignedMoney(value: number) {
  return formatSignedDisplayMoney(value);
}

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

function getTransactionTitle(tx: Transaction, contactName: string) {
  const reason = parseRaisonFromNote(tx.note);
  if (reason) return reason;
  return contactName;
}

function filterContactTransactionsByType(
  transactions: Transaction[],
  filter: ContactHistoryTypeFilter,
): Transaction[] {
  if (filter === 'all') return transactions;
  if (filter === 'sent') return transactions.filter((tx) => !isContactIncomeTx(tx));
  return transactions.filter((tx) => isContactIncomeTx(tx));
}

function DetailRow({
  label,
  value,
  valueColor,
  isLast,
}: {
  label: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.detailRow,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: valueColor ?? colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatementStatColumn({
  label,
  value,
  valueColor,
  align = 'center',
  prominent,
}: {
  label: string;
  value: string;
  valueColor?: string;
  align?: 'left' | 'center' | 'right';
  prominent?: boolean;
}) {
  const { colors } = useAppTheme();
  const textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';

  return (
    <View style={accountDetailStatementStatColStyle({ align, prominent })}>
      <Text
        style={[
          accountDetailStatementStatValueStyle(prominent),
          { color: valueColor ?? colors.text, textAlign },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        style={[
          accountDetailStatementStatLabelStyle(),
          { color: colors.textMuted, textAlign },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function ContactTransferStatsRow({
  totalReceived,
  totalSent,
  net,
}: {
  totalReceived: number;
  totalSent: number;
  net: number;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={accountDetailStatementStatsRowStyle()}>
      <StatementStatColumn
        label="Reçu"
        value={`+${formatMoney(totalReceived)}`}
        align="left"
      />
      <StatementStatColumn
        label="Net"
        value={formatSignedMoney(net)}
        valueColor={net >= 0 ? colors.success : colors.danger}
        align="center"
        prominent
      />
      <StatementStatColumn
        label="Envoyé"
        value={`−${formatMoney(totalSent)}`}
        align="right"
      />
    </View>
  );
}

function FlowDivider() {
  const { isLight } = useAppTheme();
  return <View style={accountDetailSectionDividerStyle(isLight)} />;
}

export default function ContactDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contact?: string; name?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const contactKey = typeof params.contact === 'string' ? params.contact : '';
  const contactName = typeof params.name === 'string' && params.name.trim() ? params.name.trim() : contactKey;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savedContact, setSavedContact] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<ContactHistoryTypeFilter>('all');
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);

  const load = useCallback(async () => {
    const [nextTransactions, contact] = await Promise.all([
      getTransactions(),
      contactKey ? getContactByNormalizedName(contactKey) : Promise.resolve(null),
    ]);
    setTransactions(nextTransactions);
    setSavedContact(contact);
  }, [contactKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => dataEvents.subscribe(load), [load]);

  useRefreshOnFocus(load);

  const visibleTransactions = useMemo(() => {
    if (!contactKey) return [];
    return sortTransactionsNewestFirst(getContactTransactions(transactions, contactKey));
  }, [contactKey, transactions]);

  const totalSent = useMemo(
    () =>
      visibleTransactions
        .filter((tx) => !isContactIncomeTx(tx))
        .reduce((sum, tx) => sum + tx.amount, 0),
    [visibleTransactions],
  );
  const totalReceived = useMemo(
    () =>
      visibleTransactions
        .filter((tx) => isContactIncomeTx(tx))
        .reduce((sum, tx) => sum + tx.amount, 0),
    [visibleTransactions],
  );
  const net = totalReceived - totalSent;
  const dateRange = useMemo(() => formatDateRange(visibleTransactions), [visibleTransactions]);

  const filteredTransactions = useMemo(() => {
    const searched = visibleTransactions.filter((tx) => transactionMatchesSearch(tx, search));
    return filterContactTransactionsByType(searched, historyTypeFilter);
  }, [historyTypeFilter, search, visibleTransactions]);
  const groupedTransactions = useMemo(
    () => groupTransactionsByDay(filteredTransactions),
    [filteredTransactions],
  );
  const historyHasActiveFilters = search.trim().length > 0 || historyTypeFilter !== 'all';

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
            {contactName}
          </Text>
          <View style={styles.topBarSpacer} />
        </View>

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
          <View style={accountDetailHeroBlockStyle()}>
            <View style={styles.heroIdentityRow}>
              <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="person" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.heroIdentityCopy}>
                <Text style={[styles.heroContactName, { color: colors.text }]} numberOfLines={2}>
                  {contactName}
                </Text>
                {savedContact?.isEmployer ? (
                  <View
                    style={[
                      styles.employerBadge,
                      { backgroundColor: colors.successMuted, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.employerBadgeText, { color: colors.primary }]}>Employeur</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <ContactTransferStatsRow
            totalReceived={totalReceived}
            totalSent={totalSent}
            net={net}
          />

          <FlowDivider />

          <DetailRow
            label="Opérations"
            value={`${visibleTransactions.length} opération${visibleTransactions.length > 1 ? 's' : ''}`}
          />
          <DetailRow label="Période" value={dateRange} isLast />

          {savedContact ? (
            <>
              <FlowDivider />
              <View style={styles.employerToggleRow}>
                <View style={styles.employerToggleCopy}>
                  <Text style={[styles.employerToggleLabel, { color: colors.text }]}>
                    Marquer comme employeur
                  </Text>
                  <Text style={[styles.employerToggleHint, { color: colors.textMuted }]}>
                    Suggéré en priorité lors de la saisie d'un revenu.
                  </Text>
                </View>
                <Switch
                  value={savedContact.isEmployer === true}
                  onValueChange={(enabled) => {
                    tapHaptic();
                    void updateContactEmployer(savedContact.id, enabled).then(() => {
                      setSavedContact((current) => (current ? { ...current, isEmployer: enabled } : current));
                    });
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.primary }}
                  thumbColor={savedContact.isEmployer ? colors.surfaceSolid : undefined}
                  ios_backgroundColor={colors.borderStrong}
                />
              </View>
            </>
          ) : null}

          <FlowDivider />

          <View style={styles.transactionList}>
            <View
              style={[
                styles.searchRow,
                { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
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
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
                <Ionicons
                  name={historyFiltersExpanded ? 'filter' : 'filter-outline'}
                  size={20}
                  color={historyTypeFilter !== 'all' ? colors.primary : colors.textMuted}
                />
              </Pressable>
            </View>

            {historyFiltersExpanded ? (
              <View style={styles.historyFilterWrap}>
                <SegmentedTabs
                  tabs={CONTACT_HISTORY_FILTER_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
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
                <View key={date} style={styles.transactionGroup}>
                  <View style={styles.groupHeaderRow}>
                    <Text style={[styles.transactionGroupLabel, { color: colors.textMuted }]}>
                      {formatTransactionGroupDateLabel(date)}
                    </Text>
                  </View>
                  <View style={styles.groupTransactions}>
                    {txs.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={{ ...tx, label: getTransactionTitle(tx, contactName) }}
                        onPress={() => {
                          tapHaptic();
                          setSelected(tx);
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyInline, { color: colors.textMuted }]}>
                {historyHasActiveFilters
                  ? 'Aucun résultat. Essaie un autre filtre ou une autre recherche.'
                  : 'Aucune opération'}
              </Text>
            )}
          </View>
        </ScrollView>

        <TransactionDetailSheet
          transaction={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            void load();
          }}
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
    ...interExtraBoldText,
    fontSize: typography.caption,
    letterSpacing: -0.2,
  },
  topBarSpacer: { width: 38 },
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
    gap: spacing.xs,
  },
  heroContactName: {
    ...interExtraBoldText,
    fontSize: typography.dashboardGreeting,
    letterSpacing: -0.4,
  },
  employerBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  employerBadgeText: {
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  detailLabel: {
    ...interMediumText,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  detailValue: {
    ...interExtraBoldText,
    fontSize: typography.meta,
    fontVariant: ['tabular-nums'],
    flex: 1,
    textAlign: 'right',
  },
  employerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 56,
  },
  employerToggleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  employerToggleLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
  employerToggleHint: {
    fontSize: typography.micro,
    lineHeight: 15,
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
