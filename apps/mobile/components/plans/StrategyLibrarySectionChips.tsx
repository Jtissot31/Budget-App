import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SwipeBackExclusion } from '@/components/gestures/SwipeBackExclusion';
import { DARK_CANVAS, interSemiboldText, radius, spacing, typography } from '@/constants/theme';
import {
  STRATEGY_LIBRARY_FILTER_OPTIONS,
  type StrategyLibraryFilterId,
} from '@/lib/plans/planStrategyLibrary';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  value: StrategyLibraryFilterId;
  onChange: (next: StrategyLibraryFilterId) => void;
  /** Masquer « Suggéré » s’il n’y a aucune suggestion. */
  showSuggested?: boolean;
};

const CHIP_FADE_WIDTH = 28;

export function StrategyLibrarySectionChips({
  value,
  onChange,
  showSuggested = true,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const options = STRATEGY_LIBRARY_FILTER_OPTIONS.filter(
    (option) => showSuggested || option.id !== 'suggested',
  );
  const fadeEdge = isLight ? colors.background : DARK_CANVAS;

  return (
    <View style={styles.wrap}>
      <SwipeBackExclusion>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {options.map((option) => {
            const active = value === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filtrer : ${option.label}`}
                onPress={() => {
                  tapHaptic();
                  onChange(option.id);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : {
                        borderColor: colors.border,
                        backgroundColor: colors.input,
                      },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    interSemiboldText,
                    { color: active ? DARK_CANVAS : colors.textMuted },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SwipeBackExclusion>

      <LinearGradient
        pointerEvents="none"
        colors={[`${fadeEdge}00`, fadeEdge]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.fadeRight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  content: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingRight: CHIP_FADE_WIDTH,
  },
  fadeRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: CHIP_FADE_WIDTH,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: typography.meta,
  },
  pressed: {
    opacity: 0.82,
  },
});
