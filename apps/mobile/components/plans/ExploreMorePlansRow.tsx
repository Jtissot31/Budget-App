import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  onPress: () => void;
  prominent?: boolean;
};

export function ExploreMorePlansRow({ onPress, prominent = false }: Props) {
  const { colors: pf } = planFinanceKit;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Explorer plus de plans financiers"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        prominent && styles.rowProminent,
        {
          backgroundColor: prominent ? pf.surfaceElevated : 'transparent',
          borderColor: pf.accent,
        },
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons name="auto-awesome" size={18} color={pf.accent} />
      <Text style={[styles.label, interSemiboldText]}>Explorer plus de plans financiers</Text>
      <MaterialIcons name="chevron-right" size={20} color={pf.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: planFinanceKit.layout.cardPadding,
    paddingVertical: spacing.md,
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  rowProminent: {
    borderStyle: 'solid',
    borderWidth: 1,
    paddingVertical: spacing.lg,
  },
  label: {
    flex: 1,
    color: planFinanceKit.colors.text,
    fontSize: typography.caption,
    lineHeight: typography.caption + 4,
  },
  pressed: {
    opacity: 0.82,
  },
});
