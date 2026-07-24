import { useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import {
  FIELD_LEADING_TILE_SIZE,
  PickerLeadingTile,
  SettingsPickerSheet,
  type SettingsPickerOption,
} from '@/components/SettingsPickerSheet';
import {
  containerSurfaceStyle,
  FORM_SECTION_LABEL_STYLE,
  jakartaMediumText,
  radius,
  spacing,
  typography,
  typographyKit,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

/** Compact leading glyph in the closed field — same size for every category. */
const FIELD_CATEGORY_ICON_WELL = 28;
const FIELD_CATEGORY_ICON_GLYPH = 18;

type Props = {
  label: string;
  options: SettingsPickerOption<string>[];
  selectedId: string;
  onSelect: (id: string) => void;
  pickerTitle?: string;
  placeholder?: string;
  emptyHint?: string;
  labelStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Form select matching transaction-detail Account/Category UX:
 * labeled control + SettingsPickerSheet (not chip grids).
 */
export function SettingsSelectField({
  label,
  options,
  selectedId,
  onSelect,
  pickerTitle,
  placeholder = 'Choisir',
  emptyHint,
  labelStyle,
  style,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const sheetSurface = useMemo(() => containerSurfaceStyle(isLight), [isLight]);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedId) ?? null,
    [options, selectedId],
  );

  const selectedLabel =
    selectedOption?.fieldLabel?.trim() || selectedOption?.label?.trim() || '';

  const selectedBudgetIcon = selectedOption?.budgetCategoryIcon;
  const selectedLogoUrl = selectedOption?.logoUrl;
  const selectedIcon = selectedOption?.icon;
  const showAccountLeading =
    !selectedBudgetIcon && Boolean(selectedLogoUrl?.trim() || selectedIcon);
  const disabled = options.length === 0;

  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: colors.text }, labelStyle]}>{label}</Text>
      {disabled ? (
        <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
          {emptyHint ?? 'Aucune option disponible.'}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choisir ${label.toLowerCase()}`}
          onPress={() => {
            tapHaptic();
            setPickerOpen(true);
          }}
          style={({ pressed }) => [
            styles.inputButton,
            sheetSurface,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.valueRow}>
            {selectedBudgetIcon ? (
              <BudgetCategoryIcon
                icon={selectedBudgetIcon.icon}
                name={selectedBudgetIcon.name ?? selectedLabel}
                id={selectedOption?.id}
                wellSize={FIELD_CATEGORY_ICON_WELL}
                glyphSize={FIELD_CATEGORY_ICON_GLYPH}
              />
            ) : showAccountLeading ? (
              <PickerLeadingTile
                icon={selectedIcon}
                logoUrl={selectedLogoUrl}
                label={selectedLabel}
                iconColor={colors.textSecondary}
                wellBackground={colors.input}
                defaultBorder={colors.border}
                size={FIELD_LEADING_TILE_SIZE}
              />
            ) : null}
            <Text
              style={[
                styles.inputText,
                { color: selectedLabel ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {selectedLabel || placeholder}
            </Text>
          </View>
          <AppIcon family="ionicons" name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
      )}

      <SettingsPickerSheet
        visible={pickerOpen}
        title={pickerTitle ?? label}
        options={options}
        selectedId={selectedId}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          onSelect(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    ...FORM_SECTION_LABEL_STYLE,
  },
  inputButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  valueRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    ...typographyKit.bodyMedium,
  },
  emptyHint: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
  },
});
