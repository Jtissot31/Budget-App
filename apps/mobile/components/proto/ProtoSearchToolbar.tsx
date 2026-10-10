/**
 * Budget Proto search toolbar — glass search field, 44pt filter buttons, active filter chip.
 * Shared by the Transactions tab and the Documents library so both stay identical.
 */
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  jakartaMediumText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type IoniconName = keyof typeof Ionicons.glyphMap;

export const PROTO_TOOLBAR_CONTROL_SIZE = 44;

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
  /** Label for the trailing clear button (defaults to « Effacer la recherche »). */
  clearAccessibilityLabel?: string;
};

export function ProtoSearchField({
  value,
  onChangeText,
  placeholder = 'Rechercher',
  accessibilityLabel,
  clearAccessibilityLabel = 'Effacer la recherche',
}: SearchFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.searchRow,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
        },
      ]}
    >
      <AppIcon family="ionicons" name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        accessibilityLabel={accessibilityLabel}
      />
      {value.trim().length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          hitSlop={8}
          onPress={() => {
            tapHaptic();
            onChangeText('');
          }}
          style={styles.clearSearchBtn}
        >
          <AppIcon family="ionicons" name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ToolbarButtonProps = {
  icon: IoniconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Tints icon + border with the primary accent (filter applied). */
  active?: boolean;
};

export function ProtoToolbarIconButton({
  icon,
  onPress,
  accessibilityLabel,
  active = false,
}: ToolbarButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {/* Surface on a plain View: Android Pressable style functions are not reliably applied. */}
      <View
        style={[
          styles.toolbarButton,
          {
            backgroundColor: colors.containerBackground,
            borderColor: active ? colors.primary : colors.containerBorder,
          },
        ]}
      >
        <AppIcon
          family="ionicons"
          name={icon}
          size={20}
          color={active ? colors.primary : colors.textMuted}
        />
      </View>
    </Pressable>
  );
}

type FilterChipProps = {
  icon: IoniconName;
  label: string;
  onPress: () => void;
  onClear: () => void;
  accessibilityLabel: string;
  clearAccessibilityLabel: string;
};

/** Active-filter pill: tap the body to edit, the cross to reset. */
export function ProtoActiveFilterChip({
  icon,
  label,
  onPress,
  onClear,
  accessibilityLabel,
  clearAccessibilityLabel,
}: FilterChipProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.chipRow}>
      <View
        style={[
          styles.chip,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.containerBorder,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => [styles.chipMain, pressed && styles.pressed]}
        >
          <AppIcon family="ionicons" name={icon} size={14} color={colors.primary} />
          <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
          hitSlop={8}
          onPress={onClear}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <AppIcon family="ionicons" name="close" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
    minHeight: PROTO_TOOLBAR_CONTROL_SIZE,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    ...jakartaMediumText,
    fontSize: typography.body,
    padding: 0,
    margin: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  toolbarButton: {
    width: PROTO_TOOLBAR_CONTROL_SIZE,
    height: PROTO_TOOLBAR_CONTROL_SIZE,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    marginBottom: spacing.sm,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  chipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  chipText: {
    ...jakartaMediumText,
    fontSize: typography.caption,
    flexShrink: 1,
  },
  pressed: { opacity: 0.78 },
});
