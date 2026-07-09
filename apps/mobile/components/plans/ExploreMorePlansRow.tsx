import { Pressable, StyleSheet, Text } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { spacing, typographyKit } from '@/constants/theme';
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
        styles.linkButton,
        prominent && styles.linkButtonProminent,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          typographyKit.caption,
          { color: prominent ? pf.text : pf.textMuted },
        ]}
      >
        Explorer plus de plans financiers
      </Text>
      <AppIcon family="ionicons" name="chevron-forward" size={16} color={pf.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 36,
  },
  linkButtonProminent: {
    minHeight: 44,
  },
  pressed: {
    opacity: 0.82,
  },
});
