import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { planFinanceContainerPressedStyle } from '@/constants/planFinanceKit';
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { isPlanSuggere, planProgressionPourcent, type Plan } from '@/lib/plans/Plan';
import {
  getCategoryIcon,
  PLAN_CARD_PADDING,
  planCardCarouselMetaLine,
  planCardMetaLine,
  planCardPrimaryMetricIsMoney,
  planCardPrimaryMetricLine,
  planCardProgressColor,
  planCardSummaryLine,
  PLAN_CAROUSEL,
  planCarouselCardShellStyle,
  planCarouselMetaStyle,
  planCarouselProgressTrackStyle,
  planCarouselTitleStyle,
} from '@/lib/plans/planCardPresentation';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  plan: Plan;
  /** Affiche la raison de recommandation (sans barre de progression). */
  suggested?: boolean;
  /** Tuile carrousel Accueil / hub — même shell que {@link HomePlansCarousel}. */
  layout?: 'full' | 'carousel';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PlanCard({ plan, suggested = false, layout = 'full', onPress, style }: Props) {
  const { colors } = useAppTheme();
  const pct = planProgressionPourcent(plan);
  const progressColor = planCardProgressColor(plan);
  const showSuggested = suggested || isPlanSuggere(plan);
  const isCarousel = layout === 'carousel';
  const primaryMetric = showSuggested || isCarousel ? null : planCardPrimaryMetricLine(plan);
  const primaryIsMoney = primaryMetric != null && planCardPrimaryMetricIsMoney(plan);
  const hint = showSuggested ? planCardSummaryLine(plan) : null;
  const hintLines = isCarousel ? 2 : 3;
  const metaLine = isCarousel ? planCardCarouselMetaLine(plan) : planCardMetaLine(plan);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${plan.titre}`}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        isCarousel && styles.pressableCarousel,
        pressed && planFinanceContainerPressedStyle(),
      ]}
    >
      <PlanFinanceContainer style={[styles.card, isCarousel && styles.cardCarousel, style]}>
        <AppIcon
          family="material-community"
          name={getCategoryIcon(plan.category)}
          size={isCarousel ? PLAN_CAROUSEL.iconSize : 20}
          color={colors.textSecondary}
        />

        <Text
          style={[
            isCarousel ? styles.planNameCarousel : styles.planName,
            { color: colors.text },
          ]}
          numberOfLines={2}
        >
          {plan.titre}
        </Text>

        {showSuggested ? (
          <>
            <Text
              style={[
                isCarousel ? styles.planMetaCarousel : styles.planMeta,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {metaLine}
            </Text>
            <Text
              style={[
                isCarousel ? styles.planHintCarousel : styles.planHint,
                { color: colors.textMuted },
              ]}
              numberOfLines={hintLines}
            >
              {hint}
            </Text>
          </>
        ) : (
          <>
            {primaryMetric ? (
              <Text
                style={[
                  primaryIsMoney
                    ? moneyAmountTypography({ tier: 'row' })
                    : styles.planPrimarySteps,
                  { color: colors.text },
                ]}
                numberOfLines={1}
              >
                {primaryMetric}
              </Text>
            ) : null}
            <Text
              style={[
                isCarousel ? styles.planMetaCarousel : styles.planMeta,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {metaLine}
            </Text>
          </>
        )}

        {!showSuggested ? (
          <View
            style={[
              isCarousel ? styles.progressTrackCarousel : styles.progressTrack,
              { backgroundColor: colors.border },
            ]}
          >
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
  pressableCarousel: {
    alignSelf: 'stretch',
  },
  card: {
    padding: PLAN_CARD_PADDING,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  cardCarousel: planCarouselCardShellStyle(),
  planName: {
    ...typographyKit.rowTitle,
  },
  planNameCarousel: planCarouselTitleStyle(),
  planPrimarySteps: {
    ...typographyKit.rowTitle,
  },
  planMeta: {
    ...typographyKit.metaMedium,
  },
  planMetaCarousel: planCarouselMetaStyle(),
  planHint: {
    ...typographyKit.metaMedium,
  },
  planHintCarousel: planCarouselMetaStyle(),
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.xs,
    alignSelf: 'stretch',
  },
  progressTrackCarousel: {
    ...planCarouselProgressTrackStyle(),
    alignSelf: 'stretch',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
