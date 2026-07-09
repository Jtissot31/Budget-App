import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  interExtraBoldText,
  interMediumText,
  interSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { planListSubtitle, planProgressSummary } from '@/lib/dashboardPlanPresentation';
import { MOCK_DASHBOARD_PLANS } from '@/lib/dashboardPlansMock';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export default function PlansListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const activeCount = MOCK_DASHBOARD_PLANS.filter((plan) => plan.statusTone === 'positive').length;
  const attentionCount = MOCK_DASHBOARD_PLANS.length - activeCount;

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
            <AppIcon family="material" name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }, interExtraBoldText]}>Tes plans</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.intro, { color: colors.textMuted }, interMediumText]}>
            {MOCK_DASHBOARD_PLANS.length} plans actifs · {activeCount} en bonne voie
            {attentionCount > 0 ? ` · ${attentionCount} à surveiller` : ''}
          </Text>

          {MOCK_DASHBOARD_PLANS.map((plan) => {
            const progressColor = plan.progressPositive ? colors.accentGreen : colors.danger;
            const statusColor = plan.statusTone === 'positive' ? colors.accentGreen : colors.warning;

            return (
              <Pressable
                key={plan.id}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${plan.name}`}
                onPress={() => {
                  tapHaptic();
                  router.push({ pathname: '/plan-detail', params: { planId: plan.id } });
                }}
                style={({ pressed }) => [
                  styles.planCard,
                  { backgroundColor: colors.containerBackground },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.planHeader}>
                  <AppIcon family="material-community" name={plan.icon} size={24} color={colors.textSecondary} />
                  <View style={styles.planHeaderCopy}>
                    <Text style={[styles.planName, { color: colors.text }, interSemiboldText]}>{plan.name}</Text>
                    <View style={styles.planMetaRow}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.planMeta, { color: statusColor }, interMediumText]}>{plan.status}</Text>
                      <Text style={[styles.planMeta, { color: colors.textMuted }, interMediumText]}>
                        · {plan.category}
                      </Text>
                    </View>
                  </View>
                  <AppIcon family="material" name="chevron-right" size={20} color={colors.textMuted} />
                </View>

                <Text style={[styles.planSummary, { color: colors.textMuted }, interMediumText]} numberOfLines={2}>
                  {plan.summary}
                </Text>

                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: progressColor,
                          width: `${Math.min(100, Math.max(0, plan.progress))}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressPct, { color: colors.text }, interSemiboldText]}>{plan.progress} %</Text>
                </View>

                <Text style={[styles.progressDetail, { color: colors.textMuted }, interMediumText]}>
                  {planProgressSummary(plan)}
                </Text>
                <Text style={[styles.planSubtitle, { color: colors.textMuted }, interMediumText]}>
                  {planListSubtitle(plan)}
                </Text>

                <View style={[styles.nextActionPreview, { borderTopColor: colors.border }]}>
                  <AppIcon family="material" name="flag" size={14} color={statusColor} />
                  <Text style={[styles.nextActionText, { color: colors.text }, interMediumText]} numberOfLines={2}>
                    {plan.nextAction.title}
                  </Text>
                </View>
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
  planCard: {
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  planHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  planName: {
    fontSize: typography.caption,
  },
  planMetaRow: {
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
  planMeta: {
    fontSize: typography.micro,
  },
  planSummary: {
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
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPct: {
    fontSize: typography.micro,
    minWidth: 36,
    textAlign: 'right',
  },
  progressDetail: {
    fontSize: typography.micro,
  },
  planSubtitle: {
    fontSize: 11,
  },
  nextActionPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextActionText: {
    flex: 1,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  pressed: { opacity: 0.78 },
});
