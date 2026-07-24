import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { RemoteLogoImage } from '@/components/IconFrame';
import { OnyxContainer } from '@/components/OnyxContainer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

/** Selected Onyx row outline — white on charcoal shell (not primary green). */
const SELECTED_ROW_OUTLINE = planFinanceKit.colors.text;
/** Leading logo / glyph tile — must match `RemoteLogoImage` size for centered contain. */
export const PICKER_LEADING_TILE_SIZE = 36;
/** Closed `SettingsSelectField` trigger — matches budget category well. */
export const FIELD_LEADING_TILE_SIZE = 28;
/** Compact picker tiles need a larger logo fill than the default 68% well inset. */
const PICKER_LOGO_INSET_RATIO = 0.9;
/** Wide card-network wordmarks (Visa, etc.) read better with almost full-tile fill. */
const PICKER_CARD_NETWORK_LOGO_INSET_RATIO = 0.96;

const CARD_NETWORK_LOGO_URI_RE = /visa|mastercard|amex|americanexpress|discover/i;

function pickerLogoInsetRatio(logoUrl: string, label?: string | null): number {
  const haystack = `${logoUrl} ${label ?? ''}`;
  return CARD_NETWORK_LOGO_URI_RE.test(haystack)
    ? PICKER_CARD_NETWORK_LOGO_INSET_RATIO
    : PICKER_LOGO_INSET_RATIO;
}

export type SettingsPickerOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
  /**
   * Closed-field label for `SettingsSelectField` when `label` is the sheet
   * primary line (e.g. account name without last4).
   */
  fieldLabel?: string;
  /** Ionicons leading glyph for account / generic rows. */
  icon?: string | null;
  /** Institution / merchant logo URI — preferred over `icon` when available. */
  logoUrl?: string | null;
  /** Renders a budget category glyph matching `BudgetCategoryRow`. */
  budgetCategoryIcon?: {
    icon?: string | null;
    name?: string;
  };
};

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: SettingsPickerOption<T>[];
  selectedId: T;
  onClose: () => void;
  onSelect: (id: T) => void;
};

export function PickerLeadingTile({
  icon,
  logoUrl,
  label,
  iconColor,
  wellBackground,
  defaultBorder,
  size = PICKER_LEADING_TILE_SIZE,
}: {
  icon?: string | null;
  logoUrl?: string | null;
  label?: string | null;
  iconColor: string;
  wellBackground: string;
  defaultBorder: string;
  /** Tile edge length — sheet rows use 36, closed field uses 28. */
  size?: number;
}) {
  const uri = logoUrl?.trim() || null;
  const [logoFailed, setLogoFailed] = useState(false);
  const glyphSize = size <= FIELD_LEADING_TILE_SIZE ? 16 : 18;
  const wellRadius = size <= FIELD_LEADING_TILE_SIZE ? 8 : 10;

  useEffect(() => {
    setLogoFailed(false);
  }, [uri]);

  const showLogo = Boolean(uri) && !logoFailed;

  if (!showLogo && !icon) return null;

  // Tile shell always matches other institution wells — selected white outline
  // stays on the Onyx row only, never on the logo tile.
  return (
    <View
      style={[
        styles.iconWell,
        {
          width: size,
          height: size,
          borderRadius: wellRadius,
          backgroundColor: wellBackground,
          borderColor: defaultBorder,
        },
      ]}
    >
      {showLogo && uri ? (
        <RemoteLogoImage
          uri={uri}
          size={size}
          insetRatio={pickerLogoInsetRatio(uri, label)}
          onError={() => setLogoFailed(true)}
        />
      ) : icon ? (
        <AppIcon family="ionicons" name={icon} size={glyphSize} color={iconColor} />
      ) : null}
    </View>
  );
}

export function SettingsPickerSheet<T extends string>({
  visible,
  title,
  options,
  selectedId,
  onClose,
  onSelect,
}: Props<T>) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.78);

  const backdropColor = useMemo(
    () => (isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)'),
    [isLight],
  );

  const handleSelect = (id: T) => {
    tapHaptic();
    onSelect(id);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
            <DraggableSheetSurface
              onClose={onClose}
              sheetHeight={sheetHeight}
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.background,
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
                  accessibilityLabel="Fermer"
                  onPress={onClose}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.closeButton,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon family="ionicons" name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {options.map((option) => {
                  const selected = option.id === selectedId;
                  const iconColor = selected ? colors.primary : colors.textSecondary;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => handleSelect(option.id)}
                      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                    >
                      <OnyxContainer
                        halo={false}
                        style={[
                          styles.optionRow,
                          selected && {
                            borderColor: SELECTED_ROW_OUTLINE,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        {option.budgetCategoryIcon ? (
                          <BudgetCategoryIcon
                            icon={option.budgetCategoryIcon.icon}
                            name={option.budgetCategoryIcon.name ?? option.label}
                            id={option.id}
                          />
                        ) : (
                          <PickerLeadingTile
                            icon={option.icon}
                            logoUrl={option.logoUrl}
                            label={option.label}
                            iconColor={iconColor}
                            wellBackground={colors.input}
                            defaultBorder={colors.border}
                          />
                        )}
                        <View style={styles.optionCopy}>
                          <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={1}>
                            {option.label}
                          </Text>
                          {option.description ? (
                            <Text
                              style={[styles.optionDescription, { color: colors.textMuted }]}
                              numberOfLines={1}
                            >
                              {option.description}
                            </Text>
                          ) : null}
                        </View>
                        {selected ? (
                          <AppIcon
                            family="ionicons"
                            name="checkmark-circle"
                            size={22}
                            color={colors.primary}
                          />
                        ) : (
                          <View style={[styles.radio, { borderColor: colors.borderStrong }]} />
                        )}
                      </OnyxContainer>
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboard: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    borderWidth: 1,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: {
    ...jakartaBoldText,
    fontSize: typography.body,
    flex: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: ONYX_CONTAINER.listGap,
  },
  optionRow: {
    ...onyxContainerRowLayoutStyle(),
    minHeight: 56,
  },
  iconWell: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionLabel: {
    ...jakartaSemiboldText,
    fontSize: typography.body,
  },
  optionDescription: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.82,
  },
});
