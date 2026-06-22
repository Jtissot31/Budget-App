import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import { loadLucideIconCatalog, resolveLucideIcon, type LucideCatalogEntry } from '@/lib/lucideIconCatalog';
import {
  clearSelectedLucideIcons,
  exportSelectedLucideIconsToProject,
  getSelectedLucideIconNames,
  toggleSelectedLucideIcon,
} from '@/lib/lucideIconSelection';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const GRID_COLUMNS = 4;
const GRID_GAP = spacing.sm;
const AVAILABLE_GREEN = '#4ADE80';

function CatalogLucideIcon({
  icon,
  size,
  color,
}: {
  icon: LucideCatalogEntry['Icon'];
  size: number;
  color: string;
}) {
  const Resolved = resolveLucideIcon(icon);
  if (!Resolved) {
    return <View style={{ width: size, height: size }} />;
  }
  return <Resolved size={size} color={color} strokeWidth={2} />;
}

export function LucideIconPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [catalog, setCatalog] = useState<LucideCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [lastToggled, setLastToggled] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadLucideIconCatalog()
      .then((entries) => {
        if (!cancelled) setCatalog(entries);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSelection = useCallback(() => {
    void getSelectedLucideIconNames().then(setSelectedNames);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSelection();
    }, [refreshSelection]),
  );

  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);

  const catalogByName = useMemo(() => {
    const map = new Map<string, LucideCatalogEntry>();
    for (const entry of catalog) {
      map.set(entry.name, entry);
    }
    return map;
  }, [catalog]);

  const selectedEntries = useMemo(
    () =>
      selectedNames
        .map((name) => catalogByName.get(name))
        .filter((entry): entry is LucideCatalogEntry => entry != null),
    [catalogByName, selectedNames],
  );

  const cellWidth = useMemo(() => {
    const horizontalPadding = spacing.lg * 2;
    const gaps = GRID_GAP * (GRID_COLUMNS - 1);
    return Math.floor((windowWidth - horizontalPadding - gaps) / GRID_COLUMNS);
  }, [windowWidth]);

  const filteredIcons = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog;
    return catalog.filter((entry) => entry.name.toLowerCase().includes(normalized));
  }, [catalog, query]);

  const handleToggle = (entry: LucideCatalogEntry) => {
    tapHaptic();
    void toggleSelectedLucideIcon(entry.name).then((next) => {
      setSelectedNames(next);
      setLastToggled(entry.name);
      if (next.includes(entry.name)) {
        successHaptic();
      }
    });
  };

  const handleClear = () => {
    tapHaptic();
    void clearSelectedLucideIcons().then(() => {
      setSelectedNames([]);
      setLastToggled(null);
    });
  };

  const handleExport = () => {
    tapHaptic();
    void exportSelectedLucideIconsToProject().then((count) => {
      if (count > 0) successHaptic();
    });
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }, jakartaExtraBoldText]} numberOfLines={1}>
            Icônes Lucide
          </Text>
          {selectedNames.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer la sélection"
              onPress={handleClear}
              hitSlop={8}
              style={({ pressed }) => [styles.clearHit, pressed && styles.pressed]}
            >
              <Text style={[styles.clearLabel, { color: colors.textMuted }, jakartaMediumText]}>Effacer</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <View style={styles.toolbar}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher une icône…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[
              styles.searchInput,
              {
                color: colors.text,
                backgroundColor: colors.input,
                borderColor: colors.containerBorder,
              },
            ]}
          />
          <Text style={[styles.countLabel, { color: colors.textMuted }, jakartaMediumText]}>
            {loading
              ? 'Chargement…'
              : `${filteredIcons.length} affichées · ${selectedNames.length} sélectionnée${selectedNames.length > 1 ? 's' : ''}`}
          </Text>
          {selectedNames.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exporter la sélection vers le projet"
              onPress={handleExport}
              hitSlop={8}
              style={({ pressed }) => [styles.exportHit, pressed && styles.pressed]}
            >
              <Text style={[styles.exportLabel, { color: AVAILABLE_GREEN }, jakartaMediumText]}>
                Exporter vers le projet
              </Text>
            </Pressable>
          ) : null}
        </View>

        {selectedNames.length > 0 ? (
          <View style={styles.selectedSection}>
            <Text style={[styles.selectedTitle, { color: colors.text }, jakartaSemiboldText]}>
              Ta sélection design system
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedStrip}
            >
              {selectedEntries.map((entry) => {
                const isLast = lastToggled === entry.name;
                return (
                  <Pressable
                    key={entry.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${entry.name}`}
                    onPress={() => handleToggle(entry)}
                    style={({ pressed }) => [
                      styles.selectedChip,
                      {
                        backgroundColor: colors.containerBackground,
                        borderColor: isLast ? AVAILABLE_GREEN : colors.containerBorder,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <CatalogLucideIcon icon={entry.Icon} size={18} color={colors.text} />
                    <Text
                      style={[styles.selectedChipLabel, { color: colors.text }, jakartaMediumText]}
                      numberOfLines={1}
                    >
                      {entry.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.textMuted }, jakartaMediumText]}>
            Touche les icônes pour les ajouter à ta librairie. Tu peux quitter et revenir sans perdre ta sélection.
          </Text>
        )}

        <FlatList
          data={filteredIcons}
          keyExtractor={(item) => item.name}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[
            styles.gridContent,
            { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selectedSet.has(item.name);

            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={item.name}
                onPress={() => handleToggle(item)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    width: cellWidth,
                    backgroundColor: colors.containerBackground,
                    borderColor: isSelected ? AVAILABLE_GREEN : colors.containerBorder,
                  },
                  pressed && styles.pressed,
                ]}
              >
                {isSelected ? (
                  <View style={[styles.checkBadge, { backgroundColor: 'rgba(74,222,128,0.15)' }]}>
                    <Ionicons name="checkmark" size={12} color={AVAILABLE_GREEN} />
                  </View>
                ) : null}
                <CatalogLucideIcon icon={item.Icon} size={22} color={colors.text} />
                <Text
                  style={[
                    styles.cellLabel,
                    { color: isSelected ? colors.text : colors.textMuted },
                    jakartaMediumText,
                  ]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 52 },
  clearHit: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  clearLabel: {
    fontSize: typography.micro,
  },
  toolbar: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.caption,
    ...jakartaMediumText,
  },
  countLabel: {
    fontSize: typography.micro,
    paddingLeft: spacing.xs,
  },
  exportHit: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  exportLabel: {
    fontSize: typography.micro,
  },
  selectedSection: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  selectedTitle: {
    fontSize: typography.micro,
    paddingHorizontal: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectedStrip: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: 180,
  },
  selectedChipLabel: {
    fontSize: typography.micro,
    flexShrink: 1,
  },
  hint: {
    fontSize: typography.micro,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    lineHeight: typography.micro + 4,
  },
  gridContent: {
    paddingHorizontal: spacing.lg,
    gap: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  cell: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 84,
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
  pressed: { opacity: 0.78 },
});
