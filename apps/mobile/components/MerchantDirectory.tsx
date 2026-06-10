import { useMemo, useState, type RefObject } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardCard } from '@/components/DashboardCard';
import { ContactRow, filterContacts, type ContactDirectoryRow } from '@/components/ContactDirectory';
import { GlassContainer } from '@/components/GlassContainer';
import { MerchantLogo } from '@/components/MerchantLogo';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { floatingGlassButtonPressed } from '@/constants/floatingGlassButton';
import {
  MERCHANT_LOGO_SIZE,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
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
  isEditing: boolean;
  listRef?: MerchantFlatListRef | null;
  contentPaddingBottom: number;
  refreshing: boolean;
  onRefresh: () => void;
  onToggleEdit: () => void;
  onPressMerchant: (merchant: MerchantDirectoryRow) => void;
  onPressContact?: (contact: ContactDirectoryRow) => void;
  onAddContact?: () => void;
};

const EDIT_OUTLINE = ['rgba(0,245,160,0.55)', 'rgba(0,245,160,0.18)', 'rgba(0,245,160,0.42)'] as const;

function filterMerchants(merchants: MerchantDirectoryRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return merchants;
  return merchants.filter(
    (m) =>
      m.name.toLowerCase().includes(needle) ||
      m.originalName.toLowerCase().includes(needle),
  );
}

function MerchantRow({
  merchant,
  isEditing,
  onPress,
}: {
  merchant: MerchantDirectoryRow;
  isEditing: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isEditing ? `Modifier ${merchant.name}` : `Voir l'historique de ${merchant.name}`
      }
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <GlassContainer
        borderRadius={radius.card}
        padding={spacing.md}
        outlineColors={isEditing ? EDIT_OUTLINE : undefined}
      >
        <View style={styles.rowInner}>
          <MerchantLogo
            name={merchant.name}
            logoUrl={merchant.logoUrl}
            icon={merchant.icon}
            useAutoLogo={merchant.useAutoLogo}
            size={MERCHANT_LOGO_SIZE}
          />
          <View style={styles.rowCopy}>
            <Text
              style={[styles.merchantRowName, { color: colors.text }]}
              {...rowTitleTextProps}
            >
              {merchant.name}
            </Text>
            {isEditing ? (
              <Text style={[styles.editHint, { color: colors.textMuted }]}>Touchez pour modifier</Text>
            ) : null}
          </View>
          <View style={styles.chevronSlot}>
            <Ionicons
              name={isEditing ? 'pencil-outline' : 'chevron-forward'}
              size={14}
              color={isEditing ? colors.primary : colors.textMuted}
            />
          </View>
        </View>
      </GlassContainer>
    </Pressable>
  );
}

export function MerchantDirectory({
  merchants,
  contacts = [],
  isEditing,
  listRef,
  contentPaddingBottom,
  refreshing,
  onRefresh,
  onToggleEdit,
  onPressMerchant,
  onPressContact,
  onAddContact,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const [search, setSearch] = useState('');
  const [directoryMode, setDirectoryMode] = useState<DirectoryMode>('merchants');

  const showContactsTab = Boolean(onPressContact);
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

  const handleModeChange = (mode: DirectoryMode) => {
    tapHaptic();
    setDirectoryMode(mode);
    if (mode === 'contacts' && isEditing) {
      onToggleEdit();
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      {showContactsTab ? (
        <SegmentedTabs
          tabs={[
            { id: 'merchants', label: 'Marchands' },
            { id: 'contacts', label: 'Contacts' },
          ]}
          active={directoryMode}
          onChange={handleModeChange}
          showDivider={false}
        />
      ) : null}

      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={isMerchantsMode ? 'Rechercher un marchand' : 'Rechercher un contact'}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            hitSlop={8}
            onPress={() => setSearch('')}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <Text style={[styles.toolbarHint, { color: colors.textMuted }]} numberOfLines={2}>
          {isMerchantsMode
            ? isEditing
              ? 'Touchez un marchand pour le modifier ou le retirer.'
              : `${merchants.length} marchand${merchants.length > 1 ? 's' : ''}`
            : `${contacts.length} contact${contacts.length > 1 ? 's' : ''}`}
        </Text>
        {isMerchantsMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? "Terminer l'édition des marchands" : 'Modifier les marchands'}
            style={({ pressed }) => [
              styles.editButton,
              {
                backgroundColor: isEditing ? colors.text : colors.surfaceSolid,
                borderColor: isEditing ? colors.text : colors.borderStrong,
              },
              pressed && styles.pressed,
            ]}
            onPress={() => {
              tapHaptic();
              onToggleEdit();
            }}
          >
            <Ionicons
              name={isEditing ? 'checkmark-outline' : 'pencil-outline'}
              size={14}
              color={isEditing ? colors.background : colors.textSecondary}
            />
            <Text
              style={[
                styles.editButtonText,
                { color: isEditing ? colors.background : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {isEditing ? 'Terminer' : 'Modifier'}
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
            <Ionicons name="add" size={18} color={colors.textSecondary} />
            <Text style={[styles.addContactButtonText, { color: colors.text }]}>Ajouter un contact</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      ref={listRef}
      style={[styles.listViewport, { backgroundColor: colors.background }]}
      data={listData}
      keyExtractor={(item) =>
        'originalName' in item ? item.originalName : item.key
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
      ItemSeparatorComponent={() => <View style={styles.itemGap} />}
      ListEmptyComponent={
        <DashboardCard padding={spacing.lg} innerStyle={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons
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
      }
      renderItem={({ item }) => {
        if (isMerchantsMode) {
          const merchant = item as MerchantDirectoryRow;
          return (
            <MerchantRow
              merchant={merchant}
              isEditing={isEditing}
              onPress={() => onPressMerchant(merchant)}
            />
          );
        }

        const contact = item as ContactDirectoryRow;
        return (
          <ContactRow
            contact={contact}
            onPress={() => onPressContact?.(contact)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listViewport: { flex: 1 },
  listContent: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerBlock: {
    gap: spacing.md,
    marginBottom: spacing.md,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    padding: 0,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MERCHANT_LOGO_SIZE,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 2,
  },
  merchantRowName: {
    ...listRowTitle,
    flex: 0,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    alignSelf: 'center',
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
  editHint: {
    fontSize: typography.micro,
    lineHeight: 16,
  },
  chevronSlot: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
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
    opacity: 0.82,
  },
});
