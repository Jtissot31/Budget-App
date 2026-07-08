import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoalProgressFill } from '@/components/GoalProgressFill';
import { MdiIcon } from '@/components/MdiIcon';
import type { IconName } from '@/constants/categoryOptions';
import {
  detailProgressBarStyle,
  getGoalGreenShade,
  GOAL_PROGRESS_FILL,
  goalProgressTrackColor,
  jakartaBoldText,
  jakartaExtraBoldText,
  moneyAmountTypography,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import type { GoalProgressionSnapshot } from '@/lib/savingsGamification';
import { resolveMdiOrLegacyIcon, resolveStoredIconToMdi } from '@/lib/mdiIconCatalog';
import { rowTitleTextProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  goal: GoalProgressionSnapshot;
  onPress?: (goalId: string) => void;
};

function GoalProgressionIcon({ icon, color }: { icon: string; color: string }) {
  const mdiName = resolveStoredIconToMdi(icon) ?? resolveMdiOrLegacyIcon(icon);
  const isMdi = resolveStoredIconToMdi(icon) != null;

  return isMdi ? (
    <MdiIcon name={mdiName} size={16} color={color} />
  ) : (
    <Ionicons name={icon as IconName} size={16} color={color} />
  );
}

const GOAL_PROGRESSION_BAR = detailProgressBarStyle();

export const GoalProgressionRow = memo(function GoalProgressionRow({ goal, onPress }: Props) {
  const { colors, isLight } = useAppTheme();
  const accent = goal.completed ? GOAL_PROGRESS_FILL : getGoalGreenShade(goal.goalId, isLight);
  const trackColor = goalProgressTrackColor(isLight);

  const content = (
    <View style={[styles.row, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.topLine}>
        <View style={styles.titleBlock}>
          <GoalProgressionIcon icon={goal.icon} color={accent} />
          <Text style={[styles.name, { color: colors.text }]} {...rowTitleTextProps}>
            {goal.name}
          </Text>
        </View>
        <Text style={[styles.pct, { color: accent }]}>{goal.pct} %</Text>
      </View>

      <View style={[GOAL_PROGRESSION_BAR.track, styles.track, { backgroundColor: trackColor }]}>
        <GoalProgressFill pct={goal.pct} />
      </View>

      <Text style={[styles.amounts, { color: colors.textMuted }]}>
        {formatDisplayMoneyAbsolute(goal.currentAmount)} / {formatDisplayMoneyAbsolute(goal.targetAmount)}
        {goal.completed ? ' · Objectif atteint !' : ''}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(goal.goalId)}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...jakartaExtraBoldText,
    flex: 1,
    minWidth: 0,
    fontSize: typography.caption,
  },
  pct: {
    ...jakartaBoldText,
    fontSize: typography.micro,
  },
  track: {
    alignSelf: 'stretch',
  },
  amounts: {
    ...moneyAmountTypography({ tier: 'row', fontSize: typography.micro }),
  },
  pressed: {
    opacity: 0.78,
  },
});
