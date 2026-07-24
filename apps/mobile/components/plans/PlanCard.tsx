import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { DashboardCard } from '@/components/DashboardCard';
import { OnyxContainer } from '@/components/OnyxContainer';
import { planFinanceContainerPressedStyle } from '@/constants/planFinanceKit';
import { moneyAmountTypography, radius, spacing, typographyKit } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { isPlanSuggere, planProgressionPourcent, type Plan } from '@/lib/plans/Plan';
import {
  getCategoryIcon,
  PLAN_CARD_PADDING,
  PLAN_CAROUSEL,
  PLAN_HOME_ROW,
  PLAN_HUB,
  planCardActiveStrategyAccent,
  planCardHomeAmountLine,
  planCardHomeProgressColor,
  planCardHomeSuggestedHint,
  planCardMetaLine,
  planCardPrimaryMetricIsMoney,
  planCardPrimaryMetricLine,
  planCardProgressColor,
  planCardSuggestedAccent,
  planCardSummaryLine,
  planCategoryLabel,
  planCarouselCardShellStyle,
  planCarouselMetaStyle,
  planCarouselProgressTrackStyle,
  planCarouselTitleStyle,
  planHomeRowInnerStyle,
  planStatusLabel,
} from '@/lib/plans/planCardPresentation';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  plan: Plan;
  /** Affiche la raison de recommandation (sans barre de progression). */
  suggested?: boolean;
  /**
   * `home` — même shell DashboardCard + densité que Accueil « Tes plans ».
   * `carousel` — tuile horizontale legacy.
   * `full` — carte Onyx explorateur / liste dense.
   */
  layout?: 'full' | 'carousel' | 'home';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PlanCard({ plan, suggested = false, layout = 'full', onPress, style }: Props) {
  const { colors } = useAppTheme();
  const pct = planProgressionPourcent(plan);
  const showSuggested = suggested || isPlanSuggere(plan);
  const isCarousel = layout === 'carousel';
  const isHome = layout === 'home';
  const suggestedAccent = planCardSuggestedAccent(colors);
  const activeAccent = planCardActiveStrategyAccent(colors);
  const progressColor = isHome
    ? planCardHomeProgressColor(plan, colors)
    : planCardProgressColor(plan);
  const primaryMetric = showSuggested || isCarousel || isHome ? null : planCardPrimaryMetricLine(plan);
  const primaryIsMoney = primaryMetric != null && planCardPrimaryMetricIsMoney(plan);
  /** Full layout: raison. Home: short catalog tagline. Carousel: title only. */
  const hint = showSuggested && !isCarousel && !isHome ? planCardSummaryLine(plan) : null;
  const homeSuggestedHint = isHome && showSuggested ? planCardHomeSuggestedHint(plan) : null;
  const metaLine = isCarousel
    ? showSuggested
      ? null
      : planCategoryLabel(plan.category)
    : isHome
      ? null
      : planCardMetaLine(plan);
  const showCarouselProgress = isCarousel && !showSuggested;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const homeAmount = isHome && !showSuggested ? planCardHomeAmountLine(plan) : null;

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
      {isHome ? (
        showSuggested ? (
          <DashboardCard padding={0} innerStyle={[styles.homeSuggestedInner, style]}>
            <View style={styles.homeSuggestedTopRow}>
              <Text
                style={[typographyKit.microUpper, styles.homeCategory, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {planCategoryLabel(plan.category)}
              </Text>
              <Text
                style={[
                  typographyKit.microUpper,
                  styles.homeSuggestedStatus,
                  { color: suggestedAccent.status },
                ]}
                numberOfLines={1}
              >
                {planStatusLabel(plan)}
              </Text>
            </View>

            <View style={styles.homeSuggestedBody}>
              <View style={[styles.homeIconWell, { backgroundColor: suggestedAccent.iconWash }]}>
                <AppIcon
                  family="material-community"
                  name={getCategoryIcon(plan.category)}
                  size={PLAN_HOME_ROW.iconSize}
                  color={suggestedAccent.iconGlyph}
                />
              </View>

              <View style={styles.homeCopy}>
                <Text
                  style={[typographyKit.rowTitle, styles.homeTitle, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {plan.titre}
                </Text>
                {homeSuggestedHint ? (
                  <Text
                    style={[
                      typographyKit.metaMedium,
                      styles.homeSuggestedHint,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {homeSuggestedHint}
                  </Text>
                ) : null}
              </View>
            </View>
          </DashboardCard>
        ) : (
          <DashboardCard padding={0} innerStyle={[styles.homeActiveInner, planHomeRowInnerStyle(), style]}>
            <View
              pointerEvents="none"
              style={[
                styles.homeActiveEdge,
                {
                  width: PLAN_HUB.activeEdgeWidth,
                  backgroundColor: activeAccent.edge,
                },
              ]}
            />
            <View style={[styles.homeIconWell, { backgroundColor: colors.input }]}>
              <AppIcon
                family="material-community"
                name={getCategoryIcon(plan.category)}
                size={PLAN_HOME_ROW.iconSize}
                color={activeAccent.iconGlyph}
              />
            </View>

            <View style={styles.homeCopy}>
              <View style={styles.homeTitleRow}>
                <Text
                  style={[typographyKit.rowTitle, styles.homeTitle, { color: colors.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {plan.titre}
                </Text>
                {homeAmount ? (
                  <Text
                    style={[
                      moneyAmountTypography({ tier: 'row' }),
                      styles.homeAmount,
                      { color: colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {homeAmount}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.homeProgressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: progressColor,
                      width: `${clampedPct}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.homeMetaRow}>
                <Text
                  style={[typographyKit.microUpper, styles.homeCategory, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {planCategoryLabel(plan.category)}
                </Text>
                <Text style={[typographyKit.microMedium, styles.homePct, { color: progressColor }]}>
                  {clampedPct}%
                </Text>
              </View>
            </View>
          </DashboardCard>
        )
      ) : (
        <OnyxContainer style={[styles.card, isCarousel && styles.cardCarousel, style]}>
          {isCarousel ? (
            <>
              {metaLine ? (
                <View style={styles.carouselTopRow}>
                  <Text style={[styles.carouselMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {metaLine}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.carouselBody, !metaLine && styles.carouselBodySuggested]}>
                <View
                  style={[
                    styles.iconWell,
                    {
                      backgroundColor: showSuggested
                        ? suggestedAccent.iconWash
                        : colors.input,
                    },
                  ]}
                >
                  <AppIcon
                    family="material-community"
                    name={getCategoryIcon(plan.category)}
                    size={PLAN_CAROUSEL.iconSize}
                    color={
                      showSuggested ? suggestedAccent.iconGlyph : colors.textSecondary
                    }
                  />
                </View>
                <Text
                  style={[styles.planNameCarousel, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {plan.titre}
                </Text>
              </View>

              {showCarouselProgress ? (
                <View style={styles.carouselFooter}>
                  <View style={[styles.progressTrackCarousel, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: progressColor,
                          width: `${clampedPct}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressPct, { color: colors.textMuted }]}>
                    {clampedPct} %
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <AppIcon
                family="material-community"
                name={getCategoryIcon(plan.category)}
                size={20}
                color={showSuggested ? suggestedAccent.iconGlyph : colors.textSecondary}
              />

              <Text style={[styles.planName, { color: colors.text }]} numberOfLines={2}>
                {plan.titre}
              </Text>

              {showSuggested ? (
                <>
                  <Text style={[styles.planMeta, { color: suggestedAccent.status }]} numberOfLines={1}>
                    {metaLine}
                  </Text>
                  {hint ? (
                    <Text style={[styles.planHint, { color: colors.textMuted }]} numberOfLines={3}>
                      {hint}
                    </Text>
                  ) : null}
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
                  <Text style={[styles.planMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {metaLine}
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: progressColor,
                          width: `${clampedPct}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              )}
            </>
          )}
        </OnyxContainer>
      )}
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
  homeIconWell: {
    width: PLAN_HOME_ROW.iconWellSize,
    height: PLAN_HOME_ROW.iconWellSize,
    borderRadius: PLAN_HOME_ROW.iconWellRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /** Active hub strategy: clip thin green left rail to the card radius. */
  homeActiveInner: {
    overflow: 'hidden',
    position: 'relative',
  },
  homeActiveEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderBottomLeftRadius: radius.card,
  },
  /** Suggested home: column shell so labels span the full card width. */
  homeSuggestedInner: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingVertical: PLAN_HOME_ROW.paddingVertical,
    paddingHorizontal: PLAN_HOME_ROW.paddingHorizontal,
  },
  homeSuggestedBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PLAN_HOME_ROW.contentGap,
  },
  homeCopy: {
    flex: 1,
    minWidth: 0,
  },
  homeTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  homeTitle: {
    flex: 1,
    minWidth: 0,
  },
  homeAmount: {
    flexShrink: 0,
    fontSize: typographyKit.micro.fontSize,
    lineHeight: typographyKit.micro.lineHeight,
    fontWeight: '600',
  },
  homeProgressTrack: {
    marginTop: spacing.sm,
    height: PLAN_HOME_ROW.progressHeight,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  homeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  homeSuggestedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  homeCategory: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  homeSuggestedStatus: {
    flexShrink: 0,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  homeSuggestedHint: {
    marginTop: spacing.xs,
  },
  homePct: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '600',
  },
  carouselTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  carouselMeta: {
    ...planCarouselMetaStyle(),
    flexShrink: 1,
  },
  /** Icon + title side-by-side — removes sparse vertical gap. */
  carouselBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    flex: 1,
  },
  carouselBodySuggested: {
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  iconWell: {
    width: PLAN_CAROUSEL.iconWellSize,
    height: PLAN_CAROUSEL.iconWellSize,
    borderRadius: PLAN_CAROUSEL.iconWellSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planName: {
    ...typographyKit.rowTitle,
  },
  planNameCarousel: {
    ...planCarouselTitleStyle(),
    flex: 1,
    minWidth: 0,
  },
  planPrimarySteps: {
    ...typographyKit.rowTitle,
  },
  planMeta: {
    ...typographyKit.metaMedium,
  },
  planHint: {
    ...typographyKit.metaMedium,
  },
  carouselFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  progressPct: {
    ...typographyKit.microMedium,
    fontSize: 11,
    letterSpacing: 0.15,
    flexShrink: 0,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.xs,
    alignSelf: 'stretch',
  },
  progressTrackCarousel: {
    ...planCarouselProgressTrackStyle(),
    marginTop: 0,
    flex: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
