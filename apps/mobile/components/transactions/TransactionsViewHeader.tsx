/**
 * Budget Proto — Transactions chrome.
 * Large title. Type segmented control: Tout / Dépenses / Revenus.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  screenHorizontalGutter,
  spacing,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';

export type HistoryTypeFilter = 'all' | 'expense' | 'income';

const TYPE_FILTERS: { id: HistoryTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'expense', label: 'Dépenses' },
  { id: 'income', label: 'Revenus' },
];

type ChromeProps = {
  topInset: number;
  titleColor: string;
};

/** Page title for the Transactions screen. */
export function TransactionsViewHeader({ topInset, titleColor }: ChromeProps) {
  const insets = useSafeAreaInsets();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);

  return (
    <View
      style={[
        styles.chrome,
        {
          paddingTop: topInset + SCREEN_TOP_GUTTER,
          paddingHorizontal: contentGutter,
        },
      ]}
    >
      <View style={styles.topBar}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          Transactions
        </Text>
      </View>
    </View>
  );
}

type TypeFilterProps = {
  value: HistoryTypeFilter;
  onChange: (filter: HistoryTypeFilter) => void;
};

/** Segmented control — Tout / Dépenses / Revenus (same shell as documents library tabs). */
export function TransactionsTypeFilter({ value, onChange }: TypeFilterProps) {
  return (
    <View style={styles.filterRow}>
      <SegmentedTabs
        tabs={TYPE_FILTERS}
        active={value}
        onChange={(id) => {
          tapHaptic();
          onChange(id);
        }}
        size="section"
        variant="section"
        showDivider={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chrome: { flexShrink: 0, overflow: 'visible' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: PAGE_TITLE_CONTENT_GAP,
    overflow: 'visible',
  },
  title: {
    ...PAGE_TITLE_STYLE,
    // ExtraBold 32px needs room for glyph metrics — fixed 40px row clipped on S25.
    lineHeight: 40,
    paddingVertical: 2,
  },
  filterRow: {
    marginBottom: spacing.md,
  },
});
