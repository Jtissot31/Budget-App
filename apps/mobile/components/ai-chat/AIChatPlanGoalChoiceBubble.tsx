import { useCallback, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  interMediumText,
  interRegularText,
  interSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import {
  planGoalLabel,
  type ChatPlanGoalChoice,
  type PlanGoal,
} from '@/lib/plans/planGoalClarification';
import { tapHaptic } from '@/lib/haptics';
import { useAIChatColors } from './theme';

const PLAN_SURFACE = '#111111';
const PLAN_BORDER = 'rgba(255, 255, 255, 0.12)';
const PLAN_SELECTED_BORDER = '#4ADE80';
const CARD_RADIUS = 13;

export type PlanGoalChoiceBubbleState = ChatPlanGoalChoice;

type Props = {
  state: PlanGoalChoiceBubbleState;
  onConfirm: (goal: PlanGoal) => void;
};

function goalIcon(goal: PlanGoal): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (goal) {
    case 'budget_rebalance':
      return 'scale-balance';
    case 'debt_repayment':
      return 'chart-line-variant';
    case 'reduce_bills':
      return 'tag-minus-outline';
    case 'emergency_fund':
      return 'shield-check-outline';
    case 'savings_investment':
      return 'piggy-bank-outline';
    default:
      return 'clipboard-text-outline';
  }
}

export function AIChatPlanGoalChoiceBubble({ state, onConfirm }: Props) {
  const palette = useAIChatColors();
  const { suggested, options, frozen, confirmedGoal } = state;
  const [selectedGoal, setSelectedGoal] = useState<PlanGoal | null>(null);

  const effectiveSelection = frozen ? confirmedGoal ?? null : selectedGoal ?? suggested;

  const handleSelect = useCallback(
    (goal: PlanGoal) => {
      if (frozen) return;
      tapHaptic();
      setSelectedGoal(goal);
    },
    [frozen],
  );

  const handleConfirm = useCallback(() => {
    if (frozen || !effectiveSelection) return;
    tapHaptic();
    onConfirm(effectiveSelection);
  }, [effectiveSelection, frozen, onConfirm]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bubble, { backgroundColor: palette.aiBubble, borderColor: palette.border }]}>
        <View style={styles.cards}>
          {options.map((option) => {
            const selected = effectiveSelection === option.goal;
            const isSuggested = option.goal === suggested;
            const dimmed = frozen && !selected;

            return (
              <Pressable
                key={option.goal}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={frozen}
                onPress={() => handleSelect(option.goal)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: PLAN_SURFACE,
                    borderColor: selected ? PLAN_SELECTED_BORDER : PLAN_BORDER,
                    opacity: dimmed ? 0.45 : pressed ? 0.88 : 1,
                  },
                ]}
              >
                {isSuggested && !frozen ? (
                  <View style={styles.recommendedBadge}>
                    <Text style={[styles.recommendedLabel, interMediumText]}>Recommandé</Text>
                  </View>
                ) : null}

                {selected ? (
                  <View style={styles.checkmark}>
                    <AppIcon
                      family="material-community"
                      name="check-circle"
                      size={18}
                      color={PLAN_SELECTED_BORDER}
                    />
                  </View>
                ) : null}

                <View style={styles.cardHeader}>
                  <AppIcon
                    family="material-community"
                    name={goalIcon(option.goal)}
                    size={18}
                    color={dimmed ? palette.textMuted : palette.text}
                  />
                  <View style={styles.cardTitles}>
                    <Text
                      style={[styles.cardTitle, { color: palette.text }, interSemiboldText]}
                      numberOfLines={1}
                    >
                      {option.title}
                    </Text>
                    <Text
                      style={[styles.cardCategory, { color: palette.textMuted }, interMediumText]}
                      numberOfLines={1}
                    >
                      {planGoalLabel(option.goal)}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[styles.cardReason, { color: palette.textMuted }, interRegularText]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {option.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!frozen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuer avec cet objectif"
            disabled={!effectiveSelection}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: effectiveSelection ? PLAN_SELECTED_BORDER : 'rgba(255, 255, 255, 0.08)',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <AppIcon
              family="material"
              name="arrow-right-alt"
              size={16}
              color={effectiveSelection ? '#0E0E10' : 'rgba(255, 255, 255, 0.35)'}
            />
            <Text
              style={[
                styles.ctaLabel,
                interSemiboldText,
                { color: effectiveSelection ? '#0E0E10' : 'rgba(255, 255, 255, 0.35)' },
              ]}
            >
              Continuer
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
    maxWidth: '92%',
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  cards: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 1,
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  recommendedLabel: {
    fontSize: typography.micro,
    color: PLAN_SELECTED_BORDER,
  },
  checkmark: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.lg,
    marginTop: spacing.sm,
  },
  cardTitles: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    fontSize: typography.caption,
  },
  cardCategory: {
    fontSize: typography.micro,
  },
  cardReason: {
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
  },
  cta: {
    minHeight: 44,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  ctaLabel: {
    fontSize: typography.caption,
  },
});
