import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { interSemiboldText, spacing, typography } from '@/constants/theme';
import { PLAN_CATEGORIES, type PlanCategory } from '@/lib/plans/Plan';
import { PLAN_HUB, planCategoryLabel } from '@/lib/plans/planCardPresentation';
import type { PlanCategoryFilter } from '@/lib/plans/planHubData';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  value: PlanCategoryFilter;
  onChange: (next: PlanCategoryFilter) => void;
};

const FILTER_OPTIONS: { id: PlanCategoryFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  ...PLAN_CATEGORIES.map((category) => ({
    id: category as PlanCategoryFilter,
    label: planCategoryLabel(category),
  })),
];

const CHIP_FADE_WIDTH = 28;

export function PlanCategoryFilterChips({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {FILTER_OPTIONS.map((option) => {
          const active = value === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                tapHaptic();
                onChange(option.id);
              }}
              style={({ pressed }) => [
                styles.chip,
                active
                  ? styles.chipActive
                  : { borderColor: PLAN_HUB.border, backgroundColor: 'transparent' },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  interSemiboldText,
                  { color: active ? '#0E0E10' : 'rgba(255, 255, 255, 0.55)' },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(14, 14, 16, 0)', PLAN_HUB.background]}
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
    paddingHorizontal: spacing.lg,
    paddingRight: spacing.lg + CHIP_FADE_WIDTH,
    gap: spacing.sm,
    alignItems: 'center',
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
    borderRadius: PLAN_HUB.radiusSmall,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: PLAN_HUB.accent,
    borderColor: PLAN_HUB.accent,
  },
  chipLabel: {
    fontSize: typography.meta,
  },
  pressed: {
    opacity: 0.82,
  },
});
