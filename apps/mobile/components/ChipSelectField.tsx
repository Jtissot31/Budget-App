/**
 * Inline single-choice field: a labeled, horizontally scrolling row of chips — no popup.
 * Same props/options as `SettingsSelectField`, so call sites can swap freely.
 * The selected chip is filled and kept scrolled into view.
 */
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { accentForKey } from '@/components/kit/charts';
import { PressScale } from '@/components/kit/motion';
import { PickerLeadingTile, type SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { FORM_SECTION_LABEL_STYLE, jakartaMediumText, jakartaSemiboldText, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CHIP_HEIGHT = 38;
const CHIP_ICON = 18;
/** Leave the previous chip peeking when auto-scrolling to the selection. */
const SCROLL_LEAD = 24;

type Props = {
  label: string;
  options: SettingsPickerOption<string>[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyHint?: string;
  labelStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  /** Unused — accepted so `SettingsSelectField` call sites can swap without edits. */
  pickerTitle?: string;
  placeholder?: string;
};

export function ChipSelectField({ label, options, selectedId, onSelect, emptyHint, labelStyle, style }: Props) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});

  // Keep the selected chip visible (e.g. a pre-filled category far down the list).
  useEffect(() => {
    const timer = setTimeout(() => {
      const x = chipX.current[selectedId];
      if (x != null) scrollRef.current?.scrollTo({ x: Math.max(0, x - SCROLL_LEAD), animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedId, options.length]);

  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: colors.textMuted }, labelStyle]}>{label}</Text>
      {options.length === 0 ? (
        <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{emptyHint ?? 'Aucune option disponible.'}</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.row}
        >
          {options.map((option) => {
            const selected = option.id === selectedId;
            const fg = selected ? colors.background : colors.text;
            return (
              <View
                key={option.id}
                onLayout={(event) => {
                  chipX.current[option.id] = event.nativeEvent.layout.x;
                }}
              >
                <PressScale
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label} : ${option.label}`}
                  onPress={() => {
                    if (selected) return;
                    tapHaptic();
                    onSelect(option.id);
                  }}
                  scaleTo={0.94}
                  style={[styles.chip, { backgroundColor: selected ? colors.text : colors.surfaceElevated }]}
                >
                  {option.budgetCategoryIcon ? (
                    <BudgetCategoryIcon
                      icon={option.budgetCategoryIcon.icon}
                      name={option.budgetCategoryIcon.name ?? option.label}
                      id={option.id}
                      tint={accentForKey(option.id)}
                      bare
                      wellSize={CHIP_ICON}
                      glyphSize={16}
                    />
                  ) : option.logoAsset != null || option.logoUrl || option.icon ? (
                    <PickerLeadingTile
                      icon={option.icon}
                      logoUrl={option.logoUrl}
                      logoAsset={option.logoAsset}
                      label={option.label}
                      iconColor={fg}
                      wellBackground="transparent"
                      size={CHIP_ICON + 2}
                    />
                  ) : null}
                  <Text
                    style={[selected ? styles.chipTextSelected : styles.chipText, { color: fg }]}
                    numberOfLines={1}
                  >
                    {option.fieldLabel?.trim() || option.label}
                  </Text>
                </PressScale>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...FORM_SECTION_LABEL_STYLE },
  emptyHint: { ...jakartaMediumText, fontSize: typography.meta, lineHeight: 18 },
  row: { gap: 8, paddingRight: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: CHIP_HEIGHT,
    paddingLeft: 11,
    paddingRight: 14,
    borderRadius: CHIP_HEIGHT / 2,
  },
  chipText: { ...jakartaMediumText, fontSize: 14 },
  chipTextSelected: { ...jakartaSemiboldText, fontSize: 14 },
});
