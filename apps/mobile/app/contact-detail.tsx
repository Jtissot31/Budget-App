import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Alert,
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
import { PremiumSwitch } from '@/components/PremiumSwitch';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionRow } from '@/components/TransactionRow';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  accountDetailHeroBlockStyle,
  accountDetailSectionDividerStyle,
  accountDetailStatementStatColStyle,
  accountDetailStatementStatsRowStyle,
  jakartaExtraBoldText,
  moneyAmountTypography,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { getContactByNormalizedName, getTransactions, sortTransactionsNewestFirst, updateContactEmployer, updateContactPhoto, upsertContactByName } from '@/lib/db';
import { isContactIncomeTx, parseRaisonFromNote } from '@/lib/accountTransactionFlow';
import { getContactTransactions } from '@/lib/contactHistory';
import { dataEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { openTransactionDetail } from '@/lib/openTransactionDetail';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useAppTheme } from '@/lib/themeContext';
import { EMPTY_DETAIL_VALUE } from '@/lib/detailDisplay';
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
  if (!first || !last) return EMPTY_DETAIL_VALUE;
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
      <Text
        style={[styles.detailValue, { color: valueColor ?? colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {value}
      </Text>
    </View>
  );
}

function EmployerToggleRow({
  isEmployer,
  onChange,
}: {
  isEmployer: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Employeur</Text>
      <PremiumSwitch
        accessibilityLabel="Marquer comme employeur"
        value={isEmployer}
        onValueChange={(enabled) => {
          tapHaptic();
          onChange(enabled);
        }}
      />
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
        style={[styles.statLabel, { color: colors.textMuted, textAlign }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          moneyAmountTypography(
            prominent
              ? { tier: 'hero', fontSize: 32, letterSpacing: -0.6 }
              : { tier: 'hero' },
          ),
          { color: valueColor ?? colors.text, textAlign },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {value}
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

function promptContactPhotoSource(
  onGallery: () => void,
  onCamera: () => void,
  onRemove?: () => void,
) {
  const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
    { text: 'Galerie', onPress: onGallery },
    { text: 'Caméra', onPress: onCamera },
  ];
  if (onRemove) {
    buttons.push({ text: 'Retirer la photo', onPress: onRemove, style: 'destructive' });
  }
  buttons.push({ text: 'Annuler', style: 'cancel' });
  Alert.alert('Photo du contact', 'Choisis une source.', buttons);
}

function ContactHeroIdentity({
  contactName,
  savedContact,
  onPhotoChange,
}: {
  contactName: string;
  savedContact: Contact | null;
  onPhotoChange: (photoUri: string | null) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const photoUri = savedContact?.photoUri?.trim() ?? '';

  const pickPhoto = async (fromGallery: boolean) => {
    try {
      const result = fromGallery ? await pickReceiptFromGallery() : await captureReceiptPhoto();
      if (!result.cancelled && result.uri) {
        await onPhotoChange(result.uri);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d’accéder à la photo.');
    }
  };

  const handleEditPhoto = () => {
    tapHaptic();
    promptContactPhotoSource(
      () => {
        void pickPhoto(true);
      },
      () => {
        void pickPhoto(false);
      },
      photoUri
        ? () => {
            void onPhotoChange(null);
          }
        : undefined,
    );
  };

  return (
    <View style={styles.heroIdentityColumn}>
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatarFrame,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.avatarImage}
              contentFit="cover"
              accessibilityLabel={`Photo de ${contactName}`}
            />
          ) : (
            <AppIcon family="ionicons" name="person" size={40} color={colors.textSecondary} />
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modifier la photo du contact"
          hitSlop={8}
          onPress={handleEditPhoto}
          style={({ pressed }) => [
            styles.avatarEditButton,
            { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
            pressed && styles.pressed,
          ]}
        >
          <AppIcon family="ionicons" name="pencil-outline" size={14} color={colors.text} />
        </Pressable>
      </View>
      <Text style={[styles.heroContactName, { color: colors.text }]} numberOfLines={2}>
        {contactName}
      </Text>
    </View>
  );
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

  const handleContactPhotoChange = useCallback(
    async (photoUri: string | null) => {
      let contact = savedContact;
      if (!contact) {
        contact = await upsertContactByName(contactName);
      }
      await updateContactPhoto(contact.id, photoUri);
      setSavedContact({ ...contact, photoUri });
    },
    [contactName, savedContact],
  );

  const handleEmployerChange = useCallback(
    async (enabled: boolean) => {
      if (!savedContact) return;
      await updateContactEmployer(savedContact.id, enabled);
      setSavedContact({ ...savedContact, isEmployer: enabled });
    },
    [savedContact],
  );

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
            <AppIcon family="ionicons" name="chevron-back" size={22} color={colors.text} />
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
            <ContactHeroIdentity
              contactName={contactName}
              savedContact={savedContact}
              onPhotoChange={handleContactPhotoChange}
            />
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
          <DetailRow label="Période" value={dateRange} isLast={!savedContact} />

          {savedContact ? (
            <EmployerToggleRow
              isEmployer={savedContact.isEmployer === true}
              onChange={(enabled) => {
                void handleEmployerChange(enabled);
              }}
            />
          ) : null}

          <FlowDivider />

          <View style={styles.transactionList}>
            <View
              style={[
                styles.searchRow,
                { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              ]}
            >
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
                        onPress={() => { tapHaptic(); openTransactionDetail(tx.id); }}
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
    fontSize: typography.caption,
    letterSpacing: -0.2,
  },
  topBarSpacer: { width: 38 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  heroIdentityColumn: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
    width: 104,
    height: 104,
  },
  avatarFrame: {
    width: 104,
    height: 104,
    borderRadius: 52,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEditButton: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContactName: {
    ...jakartaExtraBoldText,
    fontSize: typography.dashboardGreeting,
    letterSpacing: -0.4,
    textAlign: 'center',
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
    ...typographyKit.eyebrow,
    fontSize: 10,
    letterSpacing: 0.8,
    flexShrink: 0,
  },
  detailValue: {
    ...moneyAmountTypography({ tier: 'row' }),
    flex: 1,
    textAlign: 'right',
  },
  statLabel: {
    ...typographyKit.eyebrow,
    fontSize: 10,
    letterSpacing: 0.8,
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
