import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GOAL_PROGRESS_FILL, interBoldText, interExtraBoldText, spacing, typography } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import type { SavingsLevelStats } from '@/lib/savingsGamification';

type Props = {
  levelStats: SavingsLevelStats;
};

export function DiamondLevelBadge({ levelStats }: Props) {
  const { isLight } = useAppTheme();
  const glowColor = isLight ? 'rgba(74, 222, 128, 0.22)' : 'rgba(74, 222, 128, 0.16)';
  const borderColor = isLight ? 'rgba(74, 222, 128, 0.45)' : 'rgba(74, 222, 128, 0.35)';
  const innerBg = isLight ? 'rgba(74, 222, 128, 0.08)' : 'rgba(74, 222, 128, 0.12)';

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={`Niveau ${levelStats.level}, rang ${levelStats.rankLabel}, ${levelStats.points} points`}>
      <View style={[styles.glow, { backgroundColor: glowColor }]} />
      <View style={[styles.diamondShell, { borderColor }]}>
        <LinearGradient
          colors={[innerBg, isLight ? '#FFFFFF' : '#0B0D10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.diamondFill}
        >
          <View style={styles.diamondContent}>
            <Text style={[styles.levelPrefix, { color: GOAL_PROGRESS_FILL }]}>Niv.</Text>
            <Text style={[styles.levelValue, { color: GOAL_PROGRESS_FILL }]}>{levelStats.level}</Text>
            <Text style={[styles.rankLabel, { color: isLight ? '#166534' : '#86EFAC' }]} numberOfLines={1}>
              {levelStats.rankLabel}
            </Text>
          </View>
        </LinearGradient>
      </View>
      <Text style={[styles.pointsLabel, { color: isLight ? '#64748B' : '#94A3B8' }]}>
        {levelStats.points} pts
      </Text>
    </View>
  );
}

const DIAMOND_SIZE = 92;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: DIAMOND_SIZE + 16,
    gap: spacing.xs,
  },
  glow: {
    position: 'absolute',
    width: DIAMOND_SIZE + 20,
    height: DIAMOND_SIZE + 20,
    borderRadius: (DIAMOND_SIZE + 20) / 2,
    transform: [{ rotate: '45deg' }],
  },
  diamondShell: {
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
    transform: [{ rotate: '45deg' }],
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  diamondFill: {
    flex: 1,
  },
  diamondContent: {
    flex: 1,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: 1,
  },
  levelPrefix: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  levelValue: {
    ...interExtraBoldText,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  rankLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    textAlign: 'center',
    marginTop: 2,
  },
  pointsLabel: {
    ...interBoldText,
    fontSize: typography.micro,
    letterSpacing: 0.2,
  },
});
