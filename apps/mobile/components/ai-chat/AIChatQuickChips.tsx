import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { interMediumText, PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAIChatColors } from './theme';
import type { AIQuickChip } from './types';

type Props = {
  chips: readonly AIQuickChip[];
  onChipPress: (message: string) => void;
  disabled?: boolean;
};

export function AIChatQuickChips({ chips, onChipPress, disabled = false }: Props) {
  const palette = useAIChatColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsContainer}
      contentContainerStyle={styles.chipsContent}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.label}
          accessibilityRole="button"
          accessibilityLabel={chip.message}
          disabled={disabled}
          onPress={() => {
            tapHaptic();
            onChipPress(chip.message);
          }}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
            pressed && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <Text style={[styles.chipText, { color: palette.text }, interMediumText]} numberOfLines={1}>
            {chip.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipsContainer: {
    maxHeight: 50,
    marginBottom: spacing.sm,
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: spacing.sm,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
