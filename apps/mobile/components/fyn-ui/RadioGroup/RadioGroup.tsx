import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BORDER,
  COLORS,
  COMPONENTS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/design-tokens';

export type RadioOption = {
  label: string;
  value: string;
};

export type RadioGroupProps = {
  options: RadioOption[];
  value: string;
  onSelect: (value: string) => void;
};

/**
 * RadioGroup — single-select chip row; selected option uses accent green fill.
 */
export function RadioGroup({ options, value, onSelect }: RadioGroupProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.radio,
              selected && styles.radioSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                TYPOGRAPHY.body,
                styles.label,
                selected && styles.labelSelected,
                selected && { color: COLORS.textOnGreen },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.surface,
    borderWidth: BORDER.width,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  radio: {
    flex: 1,
    minWidth: COMPONENTS.radioGroup.optionMinWidth,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  radioSelected: {
    backgroundColor: COLORS.green,
  },
  label: {
    color: COLORS.textMuted,
  },
  labelSelected: {
    fontFamily: TYPOGRAPHY.families.uiSemibold,
  },
  pressed: {
    opacity: COMPONENTS.button.pressedOpacity,
  },
});
