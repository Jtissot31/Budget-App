/**
 * Balance tab savings-goal row — icon, name, thin progress, saved / target, percent.
 * Height from {@link BALANCE_GOAL_ROW}.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import { BALANCE_GOAL_ROW } from '@/constants/planFinanceKit';
import {
  goalProgressTrackColor,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

const CHECK = 22;

function SelectCheck({ selected, borderColor }: { selected: boolean; borderColor: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.checkWell,
        {
          backgroundColor: selected ? colors.text : 'transparent',
          borderColor: selected ? colors.text : borderColor,
        },
      ]}
    >
      {selected ? (
        <AppIcon family="ionicons" name="checkmark" size={14} color={colors.background} />
      ) : null}
    </View>
  );
}

export function BalanceGoalRow({
  icon,
  title,
  saved,
  target,
  managing = false,
  selected = false,
  showTopDivider = false,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  icon: string;
  title: string;
  saved: number;
  target: number;
  managing?: boolean;
  selected?: boolean;
  showTopDivider?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
}) {
  const { colors, isLight } = useAppTheme();
  const safeTarget = Math.max(target, 0);
  const safeSaved = Math.max(saved, 0);
  const pct = safeTarget > 0 ? Math.min(1, safeSaved / safeTarget) : 0;
  const percentLabel = `${Math.round(pct * 100)}%`;

  return (
    <Pressable
      accessibilityRole={managing ? 'checkbox' : 'button'}
      accessibilityState={managing ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={({ pressed }) => [
        styles.row,
        showTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        pressed && { opacity: 0.82 },
      ]}
    >
      {managing ? (
        <SelectCheck selected={selected} borderColor={colors.borderStrong} />
      ) : (
        <UserPickedIconWell icon={icon} size={32} iconSize={16} noBackground color={colors.textSecondary} />
      )}
      <View style={styles.copy}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.track, { backgroundColor: goalProgressTrackColor(isLight) }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(pct * 100)}%`, backgroundColor: colors.success },
            ]}
          />
        </View>
      </View>
      <View style={styles.figures}>
        <Text style={styles.ratio} numberOfLines={1}>
          <Text style={[moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}>
            {formatDisplayMoneyAbsolute(safeSaved)}
          </Text>
          <Text style={[typographyKit.microMedium, { color: colors.textMuted }]}>
            {` / ${formatDisplayMoneyAbsolute(safeTarget)}`}
          </Text>
        </Text>
        <Text style={[styles.percent, { color: colors.success }]} numberOfLines={1}>
          {percentLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: BALANCE_GOAL_ROW.height,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  name: {
    ...typographyKit.rowTitle,
  },
  track: {
    height: spacing.xs,
    borderRadius: spacing.xs,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: spacing.xs,
  },
  figures: {
    flexShrink: 1,
    maxWidth: '46%',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  ratio: {
    textAlign: 'right',
  },
  percent: {
    ...typographyKit.metaSemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  checkWell: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
