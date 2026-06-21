import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  jakartaMediumText,
  jakartaRegularText,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { QuickSuggestion } from './types';

type Props = {
  suggestions: readonly QuickSuggestion[];
  onSuggestionPress: (message: string) => void;
  disabled?: boolean;
};

export function EmptyState({ suggestions, onSuggestionPress, disabled = false }: Props) {
  const { colors, isLight } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.welcome, { color: colors.textMuted }, jakartaRegularText]}>
        Comment puis-je vous aider ?
      </Text>

      <View style={styles.chips}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion.label}
            accessibilityRole="button"
            accessibilityLabel={suggestion.message}
            disabled={disabled}
            onPress={() => {
              tapHaptic();
              onSuggestionPress(suggestion.message);
            }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: isLight ? colors.surface : colors.surfaceElevated,
                borderColor: colors.border,
              },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.chipText, { color: colors.text }, jakartaMediumText]}>
              {suggestion.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    gap: spacing.lg,
    minHeight: 0,
  },
  welcome: {
    fontSize: typography.body,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: 320,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontSize: typography.meta,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
});
