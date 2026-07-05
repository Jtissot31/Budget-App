import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { AnimatedUnderlineTabs } from '@/components/AnimatedUnderlineTabs';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TransactionsShortcutCards } from '@/components/transactions/TransactionsShortcutCards';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { fontFamilies, PAGE_PADDING_HORIZONTAL, PAGE_TITLE_STYLE, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import SearchMod from 'lucide-react-native/dist/cjs/icons/search.js';
import SlidersHorizontalMod from 'lucide-react-native/dist/cjs/icons/sliders-horizontal.js';

const SearchIcon = resolveLucideIcon(SearchMod)!;
const SlidersHorizontalIcon = resolveLucideIcon(SlidersHorizontalMod)!;

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
  mutedColor: string;
  activeView: TransactionsViewTab;
  onChangeView: (view: TransactionsViewTab) => void;
  onPressScan: () => void;
  showHistoryToolbar: boolean;
  search: string;
  onSearchChange: (text: string) => void;
  historyFiltersExpanded: boolean;
  onToggleHistoryFilters: () => void;
  historyTypeFilter: HistoryTypeFilter;
  onHistoryTypeFilterChange: (filter: HistoryTypeFilter) => void;
  pendingValidationCount: number;
  onPressInsights: () => void;
  onPressReview: () => void;
};

export function TransactionsViewHeader({
  topInset,
  titleColor,
  mutedColor,
  activeView,
  onChangeView,
  onPressScan,
  showHistoryToolbar,
  search,
  onSearchChange,
  historyFiltersExpanded,
  onToggleHistoryFilters,
  historyTypeFilter,
  onHistoryTypeFilterChange,
  pendingValidationCount,
  onPressInsights,
  onPressReview,
}: Props) {
  return (
    <>
      <View style={{ paddingTop: topInset + SCREEN_TOP_GUTTER }}>
        <View style={styles.topBar}>
          <Text style={[styles.title, { color: titleColor }]}>Transactions</Text>
          <Pressable onPress={onPressScan} hitSlop={12} style={styles.scanIcon}>
            <AppIcon family="ionicons" name="scan-outline" size={22} color={mutedColor} />
          </Pressable>
        </View>
        <AnimatedUnderlineTabs
          tabs={VIEW_TABS}
          active={activeView}
          layout="edgeCenterEdge"
          onChange={(id) => {
            tapHaptic();
            onChangeView(id);
          }}
          style={[styles.viewTabs, showHistoryToolbar && styles.viewTabsHistory]}
        />
      </View>
      {showHistoryToolbar ? (
        <View style={styles.historyToolbar}>
          <View style={styles.searchFilterRow}>
            <View style={styles.searchPill}>
              <SearchIcon size={14} color="#444" strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher"
                placeholderTextColor="#3A3A3C"
                value={search}
                onChangeText={onSearchChange}
              />
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
              style={[styles.filterBtn, historyTypeFilter !== 'all' && styles.filterBtnActive]}
            >
              <SlidersHorizontalIcon
                size={14}
                color={historyTypeFilter !== 'all' ? '#4ADE80' : '#777'}
                strokeWidth={2}
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
          <TransactionsShortcutCards
            embedded
            pendingCount={pendingValidationCount}
            onPressInsights={onPressInsights}
            onPressReview={onPressReview}
          />
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
    marginBottom: 18,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  title: {
    ...PAGE_TITLE_STYLE,
    flex: 1,
  },
  scanIcon: { padding: 4 },
  viewTabs: {
    marginTop: 0,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  viewTabsHistory: {
    marginBottom: 12,
  },
  historyToolbar: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: 44,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#2A2A2C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    padding: 0,
    includeFontPadding: false,
  },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181A',
    borderWidth: 1,
    borderColor: '#2A2A2C',
    borderRadius: 10,
  },
  filterBtnActive: {
    borderColor: '#4ADE8040',
  },
  historyFilterWrap: {
    marginBottom: 0,
  },
});
