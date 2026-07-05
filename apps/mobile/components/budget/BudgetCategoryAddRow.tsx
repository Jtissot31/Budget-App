import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { jakartaSemiboldText, radius, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  onPress: () => void;
};

export function BudgetCategoryAddRow({ onPress }: Props) {
  const { colors, isLight } = useAppTheme();
  const iconWellBg = isLight ? colors.surfaceElevated : colors.input;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter une catégorie budget"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.mainRow}>
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor: iconWellBg,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
        </View>

        <Text
          style={[styles.label, jakartaSemiboldText, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          Ajouter une catégorie
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.88,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
  },
});
