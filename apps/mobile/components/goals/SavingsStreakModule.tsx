import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoalProgressFill } from '@/components/GoalProgressFill';
import {
  GOAL_PROGRESS_FILL,
  detailProgressBarStyle,
  goalProgressTrackColor,
  jakartaBoldText,
  jakartaExtraBoldText,
  spacing,
  typography,
} from '@/constants/theme';
import type { SavingsStreakStats } from '@/lib/savingsGamification';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  streak: SavingsStreakStats;
  compact?: boolean;
};

const MILESTONE_PROGRESS_BAR = detailProgressBarStyle();

export const SavingsStreakModule = memo(function SavingsStreakModule({
  streak,
  compact = false,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const trackColor = goalProgressTrackColor(isLight);
  const flameColor = streak.current > 0 ? '#FB923C' : colors.textMuted;
  const milestonePct = useMemo(
    () => Math.min(100, Math.max(0, Math.round(streak.milestoneProgress * 100))),
    [streak.milestoneProgress],
  );

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessibilityRole="summary"
      accessibilityLabel={`Série actuelle ${streak.current} semaines, record ${streak.best}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: isLight ? 'rgba(251, 146, 60, 0.12)' : 'rgba(251, 146, 60, 0.16)' }]}>
          <Ionicons name={streak.current > 0 ? 'flame' : 'flame-outline'} size={compact ? 18 : 20} color={flameColor} />
        </View>
        <View style={styles.statsBlock}>
          <View style={styles.statRow}>
            <Text style={[styles.statValue, { color: colors.text }]}>{streak.current}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>série actuelle</Text>
          </View>
          {!compact ? (
            <View style={styles.statRow}>
              <Text style={[styles.bestValue, { color: colors.textMuted }]}>{streak.best}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>record</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[styles.message, { color: streak.current > 0 ? GOAL_PROGRESS_FILL : colors.textMuted }]} numberOfLines={2}>
        {streak.encouragingMessage}
      </Text>

      <View style={styles.milestoneRow}>
        <Text style={[styles.milestoneLabel, { color: colors.textMuted }]}>
          Prochain palier · {streak.nextMilestone} sem.
        </Text>
        <View style={[MILESTONE_PROGRESS_BAR.track, styles.milestoneTrack, { backgroundColor: trackColor }]}>
          <GoalProgressFill pct={milestonePct} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  wrapCompact: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  statValue: {
    ...jakartaExtraBoldText,
    fontSize: typography.title,
    letterSpacing: -0.4,
  },
  bestValue: {
    ...jakartaBoldText,
    fontSize: typography.meta,
  },
  statLabel: {
    ...jakartaBoldText,
    fontSize: typography.micro,
  },
  message: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  milestoneRow: {
    gap: spacing.xs,
  },
  milestoneLabel: {
    ...jakartaBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.2,
  },
  milestoneTrack: {
    alignSelf: 'stretch',
    height: 6,
  },
});
