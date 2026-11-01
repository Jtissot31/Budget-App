/**
 * Inline single-choice field: a labeled, horizontally scrolling row of chips — no popup.
 * Same props/options as `SettingsSelectField`, so call sites can swap freely.
 * Chips keep their place: the selected one is filled, and the row scrolls to it only when it is off screen.
 */
import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { PressScale } from '@/components/kit/motion';
import { PickerLeadingTile, type SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { FORM_SECTION_LABEL_STYLE, jakartaMediumText, jakartaSemiboldText, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

const CHIP_HEIGHT = 38;
const CHIP_ICON = 18;

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
  /** Hide the section label (e.g. inside a Settings row that already shows one). */
  showLabel?: boolean;
};

export function ChipSelectField({
  label,
  options,
  selectedId,
  onSelect,
  emptyHint,
  labelStyle,
  style,
  showLabel = true,
}: Props) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const chipFrames = useRef(new Map<string, { x: number; width: number }>());
  const scrollX = useRef(0);
  const viewportWidth = useRef(0);

  /** A choice made outside the row (auto-suggested category, edit mode) can sit off screen. */
  const revealChip = useCallback((id: string, animated: boolean) => {
    const frame = chipFrames.current.get(id);
    if (!frame || viewportWidth.current <= 0) return;
    const visible =
      frame.x >= scrollX.current && frame.x + frame.width <= scrollX.current + viewportWidth.current;
    if (!visible) scrollRef.current?.scrollTo({ x: Math.max(0, frame.x), animated });
  }, []);

  useEffect(() => {
    revealChip(selectedId, true);
  }, [revealChip, selectedId]);

  return (
    <View style={[styles.field, style]}>
      {showLabel ? <Text style={[styles.label, { color: colors.textMuted }, labelStyle]}>{label}</Text> : null}
      {options.length === 0 ? (
        <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{emptyHint ?? 'Aucune option disponible.'}</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.row}
          scrollEventThrottle={32}
          onScroll={(event) => {
            scrollX.current = event.nativeEvent.contentOffset.x;
          }}
          onLayout={(event) => {
            viewportWidth.current = event.nativeEvent.layout.width;
            revealChip(selectedId, false);
          }}
        >
          {options.map((option) => {
            const selected = option.id === selectedId;
            const fg = selected ? colors.background : colors.text;
            return (
              <View
                key={option.id}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  chipFrames.current.set(option.id, { x, width });
                  if (selected) revealChip(option.id, false);
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
                      tint={selected ? colors.background : colors.text}
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
