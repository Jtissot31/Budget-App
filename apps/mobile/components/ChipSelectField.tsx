/**
 * Inline single-choice field: a labeled, horizontally scrolling row of chips — no popup.
 * Same props/options as `SettingsSelectField`, so call sites can swap freely.
 * The selected chip is filled and moves to the front, so the current choice is always visible first.
 */
import { useEffect, useMemo, useRef } from 'react';
import Animated, { LinearTransition } from 'react-native-reanimated';
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
const REORDER = LinearTransition.springify().damping(18).stiffness(220);

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
  /** Move the selected chip to the front (animated). Off = chips stay put, only the selection highlights. */
  reorderSelected?: boolean;
};

export function ChipSelectField({
  label,
  options,
  selectedId,
  onSelect,
  emptyHint,
  labelStyle,
  style,
  reorderSelected = true,
}: Props) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Selected option first; the rest keep their original order.
  const ordered = useMemo(() => {
    if (!reorderSelected) return options;
    const selected = options.find((option) => option.id === selectedId);
    return selected ? [selected, ...options.filter((option) => option.id !== selectedId)] : options;
  }, [options, reorderSelected, selectedId]);

  // Bring the row back to the start so the (now first) selected chip is in view.
  useEffect(() => {
    if (reorderSelected) scrollRef.current?.scrollTo({ x: 0, animated: true });
  }, [reorderSelected, selectedId]);

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
          {ordered.map((option) => {
            const selected = option.id === selectedId;
            const fg = selected ? colors.background : colors.text;
            return (
              <Animated.View key={option.id} layout={reorderSelected ? REORDER : undefined}>
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
              </Animated.View>
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
