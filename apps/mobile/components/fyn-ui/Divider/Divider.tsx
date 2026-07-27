import { StyleSheet, View } from 'react-native';
import { BORDER, COLORS, SPACING } from '@/constants/design-tokens';

export type DividerProps = {
  color?: string;
  margin?: number;
};

/**
 * Divider — hairline horizontal rule for list / section separation.
 */
export function Divider({
  color = COLORS.border,
  margin = SPACING.md,
}: DividerProps) {
  return (
    <View
      style={[
        styles.divider,
        { borderTopColor: color, marginVertical: margin },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: BORDER.width,
    borderTopWidth: BORDER.width,
  },
});
