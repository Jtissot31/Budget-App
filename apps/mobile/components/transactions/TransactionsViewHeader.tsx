/**
 * Budget Proto — Transactions chrome.
 * Large title + green + FAB → add-transaction. Type pills: Tout / Dépenses / Revenus.
 */
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  PAGE_TITLE_CONTENT_GAP,
  PAGE_TITLE_STYLE,
  screenHorizontalGutter,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type HistoryTypeFilter = 'all' | 'expense' | 'income';

const TYPE_FILTERS: { id: HistoryTypeFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'expense', label: 'Dépenses' },
  { id: 'income', label: 'Revenus' },
];

const TITLE_ROW_HEIGHT = 40;
const FAB_SIZE = 36;

type ChromeProps = {
  topInset: number;
  titleColor: string;
};

/** Page title + green + → `/add-transaction`. */
export function TransactionsViewHeader({ topInset, titleColor }: ChromeProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const router = useRouter();
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouvelle transaction"
          onPress={() => {
            tapHaptic();
            router.push({ pathname: '/add-transaction', params: { type: 'expense' } });
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.accentGreen },
            pressed && { opacity: 0.85 },
          ]}
        >
          <AppIcon family="ionicons" name="add" size={22} color={colors.background} />
        </Pressable>
      </View>
    </View>
  );
}

type TypeFilterProps = {
  value: HistoryTypeFilter;
  onChange: (filter: HistoryTypeFilter) => void;
};

/** Figma chips — Tout / Dépenses / Revenus. */
export function TransactionsTypeFilter({ value, onChange }: TypeFilterProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.filterRow}>
      {TYPE_FILTERS.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tapHaptic();
              onChange(option.id);
            }}
            style={[
              styles.filterChip,
              { backgroundColor: active ? colors.surfaceElevated : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.filterLabel,
                { color: active ? colors.text : colors.textMuted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chrome: { flexShrink: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: PAGE_TITLE_CONTENT_GAP,
    height: TITLE_ROW_HEIGHT,
  },
  title: {
    ...PAGE_TITLE_STYLE,
    flex: 1,
  },
  addBtn: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md,
    paddingHorizontal: 0,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterLabel: {
    ...typographyKit.metaSemibold,
    fontSize: 13,
  },
});
