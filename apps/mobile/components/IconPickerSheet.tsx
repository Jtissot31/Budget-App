import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MdiIcon } from '@/components/MdiIcon';
import { UserPickedIconBadge } from '@/components/UserPickedIconBadge';
import { ICON_WELL_SIZE, radius, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import {
  isMdiIconName,
  resolveMdiOrLegacyIcon,
  searchMdiIcons,
  WELL_GLYPH_WHITE,
  type MdiIconName,
} from '@/lib/mdiIconCatalog';
import { resolveUserPickedIconWellBackground } from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  selectedIcon?: string | null;
  title?: string;
  onClose: () => void;
  onSelect: (icon: MdiIconName) => void;
};

export function IconPickerSheet({
  visible,
  selectedIcon,
  title = 'Choisir une icône',
  onClose,
  onSelect,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.88);
  const [query, setQuery] = useState('');

  const resolvedSelected = useMemo(
    () => (selectedIcon ? resolveMdiOrLegacyIcon(selectedIcon) : null),
    [selectedIcon],
  );

  const options = useMemo(() => {
    const matches = searchMdiIcons(query);
    if (
      resolvedSelected &&
      isMdiIconName(resolvedSelected) &&
      !matches.some((option) => option.name === resolvedSelected)
    ) {
      const current = searchMdiIcons('').find((option) => option.name === resolvedSelected);
      if (current) return [current, ...matches];
    }
    return matches;
  }, [query, resolvedSelected]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSelect = (icon: MdiIconName) => {
    tapHaptic();
    setQuery('');
    onSelect(icon);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Fermer" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
            <DraggableSheetSurface
              onClose={handleClose}
              sheetHeight={sheetHeight}
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.containerBackground,
                  borderColor: colors.containerBorder,
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                },
              ]}
            >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer le sélecteur d'icônes"
                onPress={handleClose}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <MdiIcon name="Close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            <View
              style={[
                styles.searchWrap,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <MdiIcon name="Search" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Rechercher une icône…"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>

            <Text style={[styles.countLabel, { color: colors.textMuted }]}>
              {options.length} icône{options.length > 1 ? 's' : ''}
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.grid}
            >
              {options.map((option) => {
                const selected = resolvedSelected === option.name;
                return (
                  <Pressable
                    key={option.name}
                    accessibilityRole="button"
                    accessibilityLabel={`Choisir l'icône ${option.label}`}
                    onPress={() => handleSelect(option.name)}
                    style={({ pressed }) => [
                      styles.choice,
                      {
                        backgroundColor: resolveUserPickedIconWellBackground(isLight),
                        borderColor: selected ? colors.primary : colors.border,
                      },
                      selected && styles.choiceSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <UserPickedIconBadge
                      icon={option.name}
                      size={ICON_WELL_SIZE}
                      wellGlyphWhite
                    />
                    <Text
                      style={[styles.choiceLabel, { color: colors.textMuted }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            </DraggableSheetSurface>
          </KeyboardAvoidingView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  keyboard: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    paddingVertical: 10,
  },
  countLabel: {
    fontSize: typography.micro,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  choice: {
    width: 78,
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
  },
  choiceSelected: {
    borderWidth: 1.5,
  },
  choiceLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  pressed: { opacity: 0.72 },
});
