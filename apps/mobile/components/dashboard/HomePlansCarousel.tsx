import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '@/components/icons/AppIcon';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { planFinanceKit } from '@/constants/planFinanceKit';
import {
  PAGE_PADDING_HORIZONTAL,
  interMediumText,
  interSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import {
  PLAN_CAROUSEL,
  planCarouselCardShellStyle,
  planCarouselMetaStyle,
  planCarouselProgressTrackStyle,
  planCarouselTitleStyle,
} from '@/lib/plans/planCardPresentation';
import { useAppTheme } from '@/lib/themeContext';

const EDGE_FADE_WIDTH = PLAN_CAROUSEL.edgeFadeWidth;

// TODO: brancher sur vraies données plans (RfaActivePlan / table dédiée — voir lib/ai/types.ts)
type MockDashboardPlan = {
  id: string;
  name: string;
  category: string;
  status: string;
  progress: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  progressPositive?: boolean;
};

const MOCK_DASHBOARD_PLANS: MockDashboardPlan[] = [
  {
    id: 'mock-fonds-urgence',
    name: "Fonds d'urgence",
    category: 'Épargne',
    status: 'Actif',
    progress: 62,
    icon: 'shield-check-outline',
    progressPositive: true,
  },
  {
    id: 'mock-dettes',
    name: 'Remboursement dettes',
    category: 'Dette',
    status: 'En cours',
    progress: 34,
    icon: 'credit-card-outline',
    progressPositive: true,
  },
  {
    id: 'mock-budget',
    name: 'Budget enveloppe',
    category: 'Budget',
    status: 'Attention',
    progress: 88,
    icon: 'wallet-outline',
    progressPositive: false,
  },
];

export function HomePlansCarousel() {
  const { colors } = useAppTheme();
  const canvas = planFinanceKit.colors.background;
  const showFade = MOCK_DASHBOARD_PLANS.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <AppIcon family="material" name="auto-awesome" size={16} color={colors.text} />
          <Text style={[styles.headerTitle, { color: colors.text }, interSemiboldText]}>Tes plans</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir tous les plans"
          onPress={() => {
            tapHaptic();
            // TODO: navigation vers écran plans financiers
          }}
          hitSlop={8}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={[styles.headerLink, { color: colors.textMuted }, interMediumText]}>Voir tout</Text>
        </Pressable>
      </View>

      <View style={styles.carouselBleed}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
        >
          {MOCK_DASHBOARD_PLANS.map((plan) => {
            const progressColor = plan.progressPositive ? colors.accentGreen : colors.danger;
            return (
              <PlanFinanceContainer key={plan.id} style={styles.planCard}>
                <AppIcon family="material-community" name={plan.icon} size={PLAN_CAROUSEL.iconSize} color={colors.textSecondary} />
                <Text style={[styles.planName, { color: colors.text }]} numberOfLines={2}>
                  {plan.name}
                </Text>
                <Text style={[styles.planMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {plan.category} · {plan.status}
                </Text>
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
              </PlanFinanceContainer>
            );
          })}
        </ScrollView>

        {showFade ? (
          <LinearGradient
            pointerEvents="none"
            colors={[`${canvas}00`, canvas]}
            locations={[0, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.edgeFade}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.caption,
  },
  headerLink: {
    fontSize: typography.micro,
  },
  carouselBleed: {
    position: 'relative',
    marginRight: -PAGE_PADDING_HORIZONTAL,
  },
  carouselContent: {
    gap: PLAN_CAROUSEL.cardGap,
    paddingRight: EDGE_FADE_WIDTH,
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: EDGE_FADE_WIDTH,
    zIndex: 2,
  },
  planCard: planCarouselCardShellStyle(),
  planName: planCarouselTitleStyle(),
  planMeta: planCarouselMetaStyle(),
  progressTrack: planCarouselProgressTrackStyle(),
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});
