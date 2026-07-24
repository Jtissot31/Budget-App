import { memo, useCallback, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardCard } from '@/components/DashboardCard';
import { ContactRow, filterContacts, type ContactDirectoryRow } from '@/components/ContactDirectory';
import { GlassContainer } from '@/components/GlassContainer';
import { MerchantLogo } from '@/components/MerchantLogo';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import {
  MERCHANT_LOGO_SIZE,
  fontFamilies,
  screenHorizontalGutter,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { normalizeMerchantKey } from '@/lib/merchantLogo';
import { listRowTitle, rowTitleTextProps } from '@/lib/textLayout';
import { UNIFORM_CHIP_FONT_SIZE, UNIFORM_SEGMENT_INNER_HEIGHT } from '@/lib/uniformGroupStyles';
import { useAppTheme } from '@/lib/themeContext';

export type MerchantDirectoryRow = {
  originalName: string;
  name: string;
  logoUrl?: string | null;
  icon?: string | null;
  useAutoLogo?: boolean;
  count: number;
  total: number;
  lastVisit: string | null;
};

type DirectoryMode = 'merchants' | 'contacts';

type MerchantFlatListRef = RefObject<FlatList<MerchantDirectoryRow | ContactDirectoryRow> | null>;

type Props = {
  merchants: MerchantDirectoryRow[];
  contacts?: ContactDirectoryRow[];
  headerComponent?: ReactNode;
  listRef?: MerchantFlatListRef | null;
  contentPaddingBottom: number;
  refreshing: boolean;
  onRefresh: () => void;
  onAddMerchant?: () => void;
  onPressMerchant: (merchant: MerchantDirectoryRow) => void;
  onPressContact?: (contact: ContactDirectoryRow) => void;
  onAddContact?: () => void;
};

function filterMerchants(merchants: MerchantDirectoryRow[], query: string) {
  const needle = normalizeMerchantKey(query);
  if (!needle) return merchants;
  return merchants.filter(
    (m) =>
      normalizeMerchantKey(m.name).includes(needle) ||
      normalizeMerchantKey(m.originalName).includes(needle),
  );
}

const MerchantTile = memo(function MerchantTile({
  merchant,
  onPressMerchant,
}: {
  merchant: MerchantDirectoryRow;
  onPressMerchant: (merchant: MerchantDirectoryRow) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir l'historique de ${merchant.name}`}
      onPress={() => onPressMerchant(merchant)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <GlassContainer borderRadius={radius.card} padding={spacing.md} style={styles.tileCard}>
        <View style={styles.tileInner}>
          <MerchantLogo
            name={merchant.name}
            logoUrl={merchant.logoUrl}
            icon={merchant.icon}
            useAutoLogo={merchant.useAutoLogo}
            size={MERCHANT_LOGO_SIZE}
          />
          <Text
            style={[styles.merchantTileName, { color: colors.text }]}
            {...rowTitleTextProps}
          >
            {merchant.name}
          </Text>
        </View>
      </GlassContainer>
    </Pressable>
  );
});

export function MerchantDirectory({
  merchants,
  contacts = [],
  headerComponent,
  listRef,
  contentPaddingBottom,
  refreshing,
  onRefresh,
  onAddMerchant,
  onPressMerchant,
  onPressContact,
  onAddContact,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const [search, setSearch] = useState('');
  const [directoryMode, setDirectoryMode] = useState<DirectoryMode>('merchants');

  const showContactsEntry = Boolean(onPressContact);
  const isMerchantsMode = directoryMode === 'merchants';

  const filteredMerchants = useMemo(() => {
    const filtered = filterMerchants(merchants, search);
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [merchants, search]);

  const filteredContacts = useMemo(
    () => [...filterContacts(contacts, search)].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [contacts, search],
  );

  const listData = isMerchantsMode ? filteredMerchants : filteredContacts;
  const hasActiveSearch = search.trim().length > 0;

  const openContacts = () => {
    tapHaptic();
    setSearch('');
    setDirectoryMode('contacts');
  };

  const backToMerchants = () => {
    tapHaptic();
    setSearch('');
    setDirectoryMode('merchants');
  };

  const handlePressContact = useCallback(
    (contact: ContactDirectoryRow) => {
      onPressContact?.(contact);
    },
    [onPressContact],
  );

  const renderDirectoryItem = useCallback(
    ({ item }: { item: MerchantDirectoryRow | ContactDirectoryRow }) => {
      if (isMerchantsMode) {
        const merchant = item as MerchantDirectoryRow;
        return (
          <MerchantTile
            merchant={merchant}
            onPressMerchant={onPressMerchant}
          />
        );
      }

      const contact = item as ContactDirectoryRow;
      return (
        <View style={{ paddingHorizontal: contentGutter }}>
          <ContactRow
            contact={contact}
            onPress={() => handlePressContact(contact)}
          />
        </View>
      );
    },
    [contentGutter, handlePressContact, isMerchantsMode, onPressMerchant],
  );

  const listHeader = (
    <>
      {headerComponent ?? null}
      <View style={[styles.headerBlock, { paddingHorizontal: contentGutter }]}>
      <View style={[styles.searchToolbarRow, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.searchPill,
            { backgroundColor: colors.background, borderColor: colors.borderSubtle },
          ]}
        >
          <AppIcon family="ionicons" name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            accessibilityLabel="Rechercher"
          />
          {hasActiveSearch ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              hitSlop={8}
              onPress={() => {
                tapHaptic();
                setSearch('');
              }}
              style={({ pressed }) => [styles.clearSearchBtn, pressed && styles.pressed]}
            >
              <AppIcon family="ionicons" name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {showContactsEntry ? (
          isMerchantsMode ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voir les contacts"
              hitSlop={8}
              style={({ pressed }) => [
                styles.directoryNavButton,
                { backgroundColor: colors.background, borderColor: colors.borderSubtle },
                pressed && styles.pressed,
              ]}
              onPress={openContacts}
            >
              <AppIcon family="ionicons" name="people-outline" size={20} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour aux marchands"
              accessibilityState={{ expanded: true }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.directoryNavButton,
                { backgroundColor: colors.background, borderColor: colors.borderSubtle },
                pressed && styles.pressed,
              ]}
              onPress={backToMerchants}
            >
              <AppIcon family="ionicons" name="people" size={20} color={colors.primary} />
            </Pressable>
          )
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <Text style={[styles.toolbarHint, { color: colors.textMuted }]} numberOfLines={2}>
          {isMerchantsMode
            ? `${merchants.length} marchand${merchants.length > 1 ? 's' : ''}`
            : `${contacts.length} contact${contacts.length > 1 ? 's' : ''}`}
        </Text>
        {isMerchantsMode && onAddMerchant ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un marchand"
            style={({ pressed }) => [
              styles.editButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.primary,
              },
              pressed && styles.pressed,
            ]}
            onPress={() => {
              tapHaptic();
              onAddMerchant();
            }}
          >
            <AppIcon family="ionicons" name="add-outline" size={14} color={colors.primary} />
            <Text
              style={[styles.editButtonText, { color: colors.primary }]}
              numberOfLines={1}
            >
              Ajouter
            </Text>
          </Pressable>
        ) : onAddContact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un contact"
            onPress={() => {
              tapHaptic();
              onAddContact();
            }}
            style={({ pressed }) => [
              styles.addContactButton,
              {
                backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 18, 18, 0.92)',
                borderColor: colors.borderStrong,
              },
              pressed && floatingGlassButtonPressed,
            ]}
          >
            <AppIcon family="ionicons" name="add" size={18} color={colors.textSecondary} />
            <Text style={[styles.addContactButtonText, { color: colors.text }]}>Ajouter un contact</Text>
          </Pressable>
        ) : null}
      </View>
      </View>
    </>
  );

  return (
    <FlatList
      key={isMerchantsMode ? 'merchants-grid' : 'contacts-list'}
      ref={listRef}
      style={[styles.listViewport, { backgroundColor: colors.background }]}
      data={listData}
      keyExtractor={(item) =>
        'originalName' in item ? item.originalName : item.key
      }
      numColumns={isMerchantsMode ? 2 : 1}
      columnWrapperStyle={
        isMerchantsMode
          ? [styles.gridRow, { paddingHorizontal: contentGutter }]
          : undefined
      }
      removeClippedSubviews
      ListHeaderComponent={listHeader}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: contentPaddingBottom },
        listData.length === 0 && styles.listContentEmpty,
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ItemSeparatorComponent={
        isMerchantsMode ? undefined : () => <View style={styles.itemGap} />
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: contentGutter }}>
        <DashboardCard padding={spacing.lg} innerStyle={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
            <AppIcon family="ionicons" 
              name={isMerchantsMode ? 'storefront-outline' : 'person-outline'}
              size={22}
              color={colors.textMuted}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {hasActiveSearch
              ? 'Aucun résultat'
              : isMerchantsMode
                ? 'Aucun marchand'
                : 'Aucun contact'}
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            {hasActiveSearch
              ? 'Essaie un autre nom ou retire le filtre.'
              : isMerchantsMode
                ? 'Les marchands apparaîtront après tes premières dépenses.'
                : 'Les contacts apparaîtront après tes premiers transferts.'}
          </Text>
        </DashboardCard>
        </View>
      }
      renderItem={renderDirectoryItem}
    />
  );
}

const styles = StyleSheet.create({
  listViewport: { flex: 1 },
  listContent: {
    paddingTop: spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerBlock: {
    // Match Historique: spacing.md between SegmentedTabs and toolbar
    marginTop: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  searchToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toolbarHint: {
    flex: 1,
    fontSize: typography.meta,
    lineHeight: 17,
  },
  editButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    minHeight: UNIFORM_SEGMENT_INNER_HEIGHT,
  },
  editButtonText: {
    fontSize: UNIFORM_CHIP_FONT_SIZE,
    fontWeight: '800',
  },
  directoryNavButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: typography.body,
    padding: 0,
    includeFontPadding: false,
  },
  clearSearchBtn: {
    padding: 4,
  },
  gridRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tile: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: '50%',
  },
  tileCard: {
    flex: 1,
  },
  tileInner: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
    minHeight: MERCHANT_LOGO_SIZE + 36,
  },
  merchantTileName: {
    ...listRowTitle,
    width: '100%',
    flex: 0,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  addContactButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addContactButtonText: {
    fontSize: typography.meta,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  itemGap: {
    height: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: typography.body,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: typography.caption,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
