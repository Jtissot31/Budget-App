import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { isPlanSuggere, planProgressionPourcent, type Plan } from '@/lib/plans/Plan';
import {
  getCategoryIcon,
  PLAN_CARD_PADDING,
  planCardMetaLine,
  planCardProgressColor,
  planCardSummaryLine,
} from '@/lib/plans/planCardPresentation';
import { useAppTheme } from '@/lib/themeContext';
type Props = {
  plan: Plan;
  /** Affiche la raison de recommandation (sans barre de progression). */
  suggested?: boolean;
  /** Largeur fixe pour le carrousel Accueil. */
  layout?: 'full' | 'carousel';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PlanCard({ plan, suggested = false, layout = 'full', onPress, style }: Props) {
  const { colors } = useAppTheme();
  const pct = planProgressionPourcent(plan);
  const progressColor = planCardProgressColor(plan);
  const showSuggested = suggested || isPlanSuggere(plan);
  const summaryLines = showSuggested ? 4 : 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${plan.titre}`}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <PlanFinanceContainer
        style={[styles.card, layout === 'carousel' && styles.cardCarousel, style]}
      >
        <MaterialCommunityIcons
          name={getCategoryIcon(plan.category)}
          size={20}
          color={colors.textSecondary}
        />

        <Text style={[styles.planName, { color: colors.text }, interSemiboldText]} numberOfLines={2}>
          {plan.titre}
        </Text>

        <Text style={[styles.planMeta, { color: colors.textMuted }, interMediumText]} numberOfLines={1}>
          {planCardMetaLine(plan)}
        </Text>

        <Text
          style={[styles.planHint, { color: colors.textMuted }, interMediumText]}
          numberOfLines={summaryLines}
        >
          {planCardSummaryLine(plan)}
        </Text>

        {!showSuggested ? (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: progressColor,
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </PlanFinanceContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: PLAN_CARD_PADDING,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  cardCarousel: {
    minWidth: 168,
    maxWidth: 200,
  },
  planName: {
    fontSize: 13,
    lineHeight: 18,
  },
  planMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  planHint: {
    fontSize: typography.meta,
    lineHeight: 20,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.xs,
    alignSelf: 'stretch',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});
