import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import {
  BORDER,
  COLORS,
  COMPONENTS,
  ICON,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/design-tokens';

export type ListItemProps = {
  icon?: ReactNode;
  label: string;
  value?: string | ReactNode;
  onPress: () => void;
  showChevron?: boolean;
};

/**
 * ListItem — settings / options row with optional icon, value, and chevron.
 */
export function ListItem({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
}: ListItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}

      <View style={styles.content}>
        <Text style={[TYPOGRAPHY.body, styles.label]}>{label}</Text>
        {value != null && value !== '' ? (
          typeof value === 'string' || typeof value === 'number' ? (
            <Text style={[TYPOGRAPHY.caption, styles.value]}>{value}</Text>
          ) : (
            <View style={styles.valueNode}>{value}</View>
          )
        ) : null}
      </View>

      {showChevron ? (
        <ChevronRight size={ICON.listChevron} color={COLORS.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: BORDER.width,
    borderBottomColor: COLORS.border,
  },
  icon: {
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
  },
  label: {
    color: COLORS.text,
  },
  value: {
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  valueNode: {
    marginTop: SPACING.xs,
  },
  pressed: {
    opacity: COMPONENTS.button.pressedOpacity,
  },
});
