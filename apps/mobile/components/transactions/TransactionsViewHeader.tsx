import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  fontFamilies,
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  radius,
  screenHorizontalGutter,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type TransactionsViewTab = 'history' | 'agenda' | 'merchants';
export type HistoryTypeFilter = 'all' | 'expense' | 'income';

const VIEW_TABS: { id: TransactionsViewTab; label: string }[] = [
  { id: 'history', label: 'Historique' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'merchants', label: 'Marchands' },
];

const HISTORY_FILTER_OPTIONS: { id: HistoryTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'expense', label: 'Dépenses' },
  { id: 'income', label: 'Revenus' },
];

type Props = {
  topInset: number;
  titleColor: string;
  activeView: TransactionsViewTab;
  onChangeView: (view: TransactionsViewTab) => void;
  showHistoryToolbar: boolean;
  search: string;
  onSearchChange: (text: string) => void;
  historyFiltersExpanded: boolean;
  onToggleHistoryFilters: () => void;
  historyTypeFilter: HistoryTypeFilter;
  onHistoryTypeFilterChange: (filter: HistoryTypeFilter) => void;
};

export function TransactionsViewHeader({
  topInset,
  titleColor,
  activeView,
  onChangeView,
  showHistoryToolbar,
  search,
  onSearchChange,
  historyFiltersExpanded,
  onToggleHistoryFilters,
  historyTypeFilter,
  onHistoryTypeFilterChange,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const filterActive = historyTypeFilter !== 'all';
  const searchInputRef = useRef<TextInput>(null);
  const hasQuery = search.trim().length > 0;

  return (
    <>
      <View style={{ paddingTop: topInset + SCREEN_TOP_GUTTER, paddingHorizontal: contentGutter }}>
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: titleColor }]}>Transactions</Text>
        </View>
        <View style={showHistoryToolbar ? styles.viewTabsHistory : undefined}>
          <SegmentedTabs
            tabs={VIEW_TABS}
            active={activeView}
            onChange={(id) => {
              tapHaptic();
              onChangeView(id);
            }}
            activeLabelColor="rgba(255,255,255,0.85)"
            showDivider={false}
          />
        </View>
      </View>
      {showHistoryToolbar ? (
        <View
          style={[
            styles.historyToolbar,
            { paddingHorizontal: contentGutter, backgroundColor: colors.background },
          ]}
        >
          <View style={[styles.searchFilterBlock, { backgroundColor: colors.background }]}>
            <View
              style={[
                styles.searchPill,
                { backgroundColor: colors.background, borderColor: colors.borderSubtle },
              ]}
            >
              <AppIcon family="ionicons" name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Rechercher"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={onSearchChange}
                returnKeyType="search"
                accessibilityLabel="Rechercher"
              />
              {hasQuery ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Effacer la recherche"
                  hitSlop={8}
                  onPress={() => {
                    tapHaptic();
                    onSearchChange('');
                  }}
                  style={({ pressed }) => [styles.clearSearchBtn, pressed && styles.pressed]}
                >
                  <AppIcon family="ionicons" name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filtres"
              accessibilityState={{ expanded: historyFiltersExpanded }}
              hitSlop={8}
              onPress={() => {
                tapHaptic();
                onToggleHistoryFilters();
              }}
              style={({ pressed }) => [
                styles.filterBtn,
                {
                  backgroundColor: filterActive ? colors.containerBackground : colors.background,
                  borderColor: filterActive ? colors.containerBorder : colors.borderSubtle,
                },
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                family="ionicons"
                name={historyFiltersExpanded ? 'filter' : 'filter-outline'}
                size={20}
                color={filterActive ? colors.text : colors.textMuted}
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
                  onHistoryTypeFilterChange(id);
                }}
                showDivider={false}
                trackBgColor="transparent"
                activeBgColor="rgba(255,255,255,0.07)"
                activeLabelColor="rgba(255,255,255,0.85)"
                inactiveLabelColor="rgba(255,255,255,0.28)"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: PAGE_TITLE_CONTENT_GAP,
  },
  title: {
    ...PAGE_TITLE_STYLE,
    flex: 1,
  },
  viewTabsHistory: {
    marginBottom: spacing.md,
  },
  historyToolbar: {
    marginBottom: spacing.xl,
  },
  searchFilterBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
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
  filterBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  historyFilterWrap: {
    marginBottom: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
