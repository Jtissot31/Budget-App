import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  interExtraBoldText,
  interMediumText,
  interSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import {
  MOCK_SAVINGS_GOALS,
  savingsGoalListSubtitle,
  savingsGoalProgressSummary,
} from '@/lib/savingsGoalsMock';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export default function SavingsGoalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const onTrackCount = MOCK_SAVINGS_GOALS.filter((goal) => goal.statusTone === 'positive').length;

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }, interExtraBoldText]}>
            Objectifs d'épargne
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.intro, { color: colors.textMuted }, interMediumText]}>
            {MOCK_SAVINGS_GOALS.length} objectifs · {onTrackCount} en bonne voie
          </Text>

          {MOCK_SAVINGS_GOALS.map((goal) => {
            const progressColor = goal.progressPositive ? colors.accentGreen : colors.danger;
            const statusColor = goal.statusTone === 'positive' ? colors.accentGreen : colors.warning;

            return (
              <Pressable
                key={goal.id}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${goal.name}`}
                onPress={() => {
                  tapHaptic();
                  // goal-detail charge depuis SQLite — mock ids affichent « Objectif introuvable »
                  router.push({ pathname: '/goal-detail', params: { goalId: goal.id } });
                }}
                style={({ pressed }) => [
                  styles.goalCard,
                  {
                    backgroundColor: colors.containerBackground,
                    borderColor: colors.containerBorder,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.goalHeader}>
                  <MaterialCommunityIcons name={goal.icon} size={22} color={colors.textSecondary} />
                  <View style={styles.goalHeaderCopy}>
                    <Text style={[styles.goalName, { color: colors.text }, interSemiboldText]} numberOfLines={2}>
                      {goal.name}
                    </Text>
                    <View style={styles.goalMetaRow}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.goalMeta, { color: statusColor }, interMediumText]}>{goal.status}</Text>
                      <Text style={[styles.goalMeta, { color: colors.textMuted }, interMediumText]}>
                        · {goal.category}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </View>

                <Text style={[styles.goalSummary, { color: colors.textMuted }, interMediumText]} numberOfLines={2}>
                  {goal.summary}
                </Text>

                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: progressColor,
                          width: `${Math.min(100, Math.max(0, goal.progress))}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressPct, { color: colors.text }, interSemiboldText]}>{goal.progress} %</Text>
                </View>

                <Text style={[styles.progressDetail, { color: colors.textMuted }, interMediumText]}>
                  {savingsGoalProgressSummary(goal)}
                </Text>
                <Text style={[styles.goalSubtitle, { color: colors.textMuted }, interMediumText]}>
                  {savingsGoalListSubtitle(goal)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backHit: { padding: spacing.xs },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 30 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  intro: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  goalCard: {
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  goalHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  goalName: {
    fontSize: 13,
    lineHeight: 18,
  },
  goalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  goalMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  goalSummary: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 5,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressPct: {
    fontSize: typography.micro,
    minWidth: 36,
    textAlign: 'right',
  },
  progressDetail: {
    fontSize: typography.micro,
  },
  goalSubtitle: {
    fontSize: 11,
  },
  pressed: { opacity: 0.78 },
});
