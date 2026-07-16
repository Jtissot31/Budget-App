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
  planCardMetaLine,
  planCardPrimaryMetricIsMoney,
  planCardPrimaryMetricLine,
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

/** Compact carousel shell — tighter than full plan cards (~134px). */
const CAROUSEL_PADDING = 8;
const CAROUSEL_GAP = 2;
const CAROUSEL_ICON = 16;
const CAROUSEL_PROGRESS_H = 4;

/**
 * Uniform carousel height sized for the taller suggested layout
 * (eyebrow + 2-line hint). Active cards share the same fixed height.
 */
const CAROUSEL_CARD_HEIGHT =
  CAROUSEL_PADDING * 2 +
  CAROUSEL_ICON +
  typographyKit.rowTitle.lineHeight * 2 +
  typographyKit.metaMedium.lineHeight +
  typographyKit.metaMedium.lineHeight * 2 +
  CAROUSEL_GAP * 4 +
  CAROUSEL_PROGRESS_H;

export function PlanCard({ plan, suggested = false, layout = 'full', onPress, style }: Props) {
  const { colors } = useAppTheme();
  const pct = planProgressionPourcent(plan);
  const progressColor = planCardProgressColor(plan);
  const showSuggested = suggested || isPlanSuggere(plan);
  const isCarousel = layout === 'carousel';
  const primaryMetric = showSuggested ? null : planCardPrimaryMetricLine(plan);
  const primaryIsMoney = primaryMetric != null && planCardPrimaryMetricIsMoney(plan);
  const hint = showSuggested ? planCardSummaryLine(plan) : null;
  const hintLines = isCarousel ? 2 : 3;

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
      <PlanFinanceContainer
        style={[styles.card, isCarousel && styles.cardCarousel, style]}
      >
        <AppIcon
          family="material-community"
          name={getCategoryIcon(plan.category)}
          size={isCarousel ? CAROUSEL_ICON : 20}
          color={colors.textSecondary}
        />

        <Text
          style={[styles.planName, isCarousel && styles.planNameCarousel, { color: colors.text }]}
          numberOfLines={2}
        >
          {plan.titre}
        </Text>

        {showSuggested ? (
          <>
            <Text
              style={[styles.planMeta, isCarousel && styles.planMetaCarousel, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {planCardMetaLine(plan)}
            </Text>
            <Text
              style={[styles.planHint, isCarousel && styles.planHintCarousel, { color: colors.textMuted }]}
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
                    ? [moneyAmountTypography({ tier: 'row' }), isCarousel && styles.planPrimaryCarousel]
                    : [styles.planPrimarySteps, isCarousel && styles.planPrimaryCarousel],
                  { color: colors.text },
                ]}
                numberOfLines={1}
              >
                {primaryMetric}
              </Text>
            ) : null}
            <Text
              style={[styles.planMeta, isCarousel && styles.planMetaCarousel, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {planCardMetaLine(plan)}
            </Text>
          </>
        )}

        {!showSuggested ? (
          <View
            style={[
              styles.progressTrack,
              isCarousel && styles.progressTrackCarousel,
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
        ) : isCarousel ? (
          <View style={[styles.progressTrackPlaceholder, styles.progressTrackCarousel]} />
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
  cardCarousel: {
    height: CAROUSEL_CARD_HEIGHT,
    padding: CAROUSEL_PADDING,
    gap: CAROUSEL_GAP,
  },
  planName: {
    ...typographyKit.rowTitle,
  },
  planNameCarousel: {
    minHeight: typographyKit.rowTitle.lineHeight * 2,
  },
  planPrimarySteps: {
    ...typographyKit.rowTitle,
  },
  planPrimaryCarousel: {
    minHeight: typographyKit.rowAmount.lineHeight,
  },
  planMeta: {
    ...typographyKit.metaMedium,
  },
  planMetaCarousel: {
    minHeight: typographyKit.metaMedium.lineHeight,
  },
  planHint: {
    ...typographyKit.metaMedium,
  },
  planHintCarousel: {
    minHeight: typographyKit.metaMedium.lineHeight * 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.xs,
    alignSelf: 'stretch',
  },
  progressTrackCarousel: {
    height: CAROUSEL_PROGRESS_H,
    marginTop: 0,
  },
  progressTrackPlaceholder: {
    height: 4,
    marginTop: spacing.xs,
    alignSelf: 'stretch',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
