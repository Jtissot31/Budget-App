import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/design-tokens';

export type BadgeStatus = 'success' | 'warning' | 'error';

export type BadgeProps = {
  status: BadgeStatus;
  label: string;
  style?: StyleProp<ViewStyle>;
};

const STATUS_COLOR: Record<BadgeStatus, string> = {
  success: COLORS.green,
  warning: COLORS.amber,
  error: COLORS.red,
};

/**
 * Badge — compact status chip (success / warning / error) with semantic colors.
 */
export function Badge({ status, label, style }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLOR[status] }, style]}>
      <Text style={[TYPOGRAPHY.caption, styles.label]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: TYPOGRAPHY.families.uiSemibold,
    color: COLORS.textOnGreen,
  },
});
