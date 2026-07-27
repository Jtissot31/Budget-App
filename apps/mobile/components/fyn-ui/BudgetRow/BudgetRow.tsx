import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  COLORS,
  COMPONENTS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/design-tokens';

export type BudgetRowProps = {
  category: string;
  spent: number;
  limit: number;
  onPress?: () => void;
};

type BudgetStatus = 'normal' | 'warning' | 'alert';

function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return spent > 0 ? 'alert' : 'normal';
  const pct = (spent / limit) * 100;
  if (pct <= 100) return 'normal';
  if (pct <= 115) return 'warning';
  return 'alert';
}

const STATUS_COLOR: Record<BudgetStatus, string> = {
  normal: COLORS.green,
  warning: COLORS.amber,
  alert: COLORS.red,
};

/**
 * BudgetRow — category label, thin progress track, and usage percent with status color.
 * ≤100% green · 100–115% amber · >115% red.
 */
export function BudgetRow({ category, spent, limit, onPress }: BudgetRowProps) {
  const status = getBudgetStatus(spent, limit);
  const percentage = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 100 : 0;
  const statusColor = STATUS_COLOR[status];
  const fillWidth = `${Math.min(Math.max(percentage, 0), 100)}%` as `${number}%`;

  const body = (
    <>
      <Text style={[TYPOGRAPHY.body, styles.category]}>{category}</Text>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: fillWidth,
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>
      <Text style={[TYPOGRAPHY.caption, { color: statusColor }]}>
        {`${Math.round(percentage)}%`}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.row}>{body}</View>;
}

const styles = StyleSheet.create({
  row: {
    marginVertical: SPACING.md,
  },
  category: {
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  progressBar: {
    height: COMPONENTS.progressBar.thinHeight,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  pressed: {
    opacity: COMPONENTS.button.pressedOpacity,
  },
});
