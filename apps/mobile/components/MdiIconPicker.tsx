import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MdiIconGlyph } from '@/components/MdiIconGlyph';
import { ICON_WELL_SIZE, radius, spacing, typography } from '@/constants/theme';
import { searchMdiIcons, type MdiIconName } from '@/lib/mdiIconCatalog';
import { tapHaptic } from '@/lib/haptics';
import { userPickedIconWellStyle } from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  selectedIcon?: string | null;
  onSelect: (icon: MdiIconName) => void;
  maxHeight?: number;
};

export function MdiIconPicker({ selectedIcon, onSelect, maxHeight = 220 }: Props) {
  const { colors, isLight } = useAppTheme();
  const [query, setQuery] = useState('');
  const icons = useMemo(() => searchMdiIcons(query), [query]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher une icône"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            hitSlop={8}
            onPress={() => setQuery('')}
          >
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={icons}
        extraData={selectedIcon}
        keyExtractor={(item) => item.name}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight }}
        numColumns={5}
        columnWrapperStyle={styles.iconRow}
        contentContainerStyle={styles.iconGrid}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>Aucune icône trouvée</Text>
        }
        renderItem={({ item }) => {
          const selected = selectedIcon === item.name;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choisir l'icône ${item.label}`}
              onPress={() => {
                tapHaptic();
                onSelect(item.name);
              }}
              style={[
                userPickedIconWellStyle(ICON_WELL_SIZE, isLight),
                styles.iconCell,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.successMuted : undefined,
                },
              ]}
            >
              <MdiIconGlyph name={item.name} size={18} color={colors.text} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.caption,
    paddingVertical: spacing.sm,
  },
  iconGrid: { gap: spacing.sm, paddingBottom: spacing.xs },
  iconRow: { gap: spacing.sm, justifyContent: 'flex-start' },
  iconCell: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    textAlign: 'center',
    fontSize: typography.meta,
    paddingVertical: spacing.lg,
  },
});
