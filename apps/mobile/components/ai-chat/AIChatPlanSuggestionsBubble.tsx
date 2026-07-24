import { useCallback, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  interMediumText,
  interSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import {
  planSuggestionCategoryLabel,
  planSuggestionSubtypeLabel,
} from '@/lib/plans/planRecommendationEngine';
import {
  formatPlanSuggestionReasonForCard,
  resolvePlanSuggestionDetailReason,
} from '@/lib/plans/planSuggestionCopy';
import { buildTemplateDetailParams } from '@/lib/plans/planCreateNavigation';
import type { PlanSuggere } from '@/lib/plans/Plan';
import { tapHaptic } from '@/lib/haptics';
import { CONTAINER_SURFACE, DASHBOARD_VALUE_GREEN, interRegularText } from '@/constants/theme';
import { useAIChatColors } from './theme';

const PLAN_SURFACE = CONTAINER_SURFACE;
const PLAN_BORDER = 'rgba(255, 255, 255, 0.12)';
const PLAN_SELECTED_BORDER = DASHBOARD_VALUE_GREEN;
const CARD_RADIUS = 13;

export type PlanSuggestionsBubbleState = {
  suggestions: PlanSuggere[];
  intro: string;
  frozen: boolean;
  confirmedIds: string[];
};

type Props = {
  state: PlanSuggestionsBubbleState;
  onConfirm: (selectedPlans: PlanSuggere[]) => void;
};

function planIcon(subtype: PlanSuggere['subtype']): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (subtype) {
    case 'fonds_urgence':
      return 'shield-check-outline';
    case 'snowball':
    case 'avalanche':
    case 'bombe_nucleaire':
    case 'consolidation':
    case 'dette_individuelle':
    case 'marge_credit':
      return 'chart-line-variant';
    case 'reer':
    case 'celi':
    case 'celiapp':
      return 'piggy-bank-outline';
    case 'enveloppe':
      return 'wallet-outline';
    case 'reduction_abonnements':
      return 'tag-minus-outline';
    case 'no_spend_challenge':
      return 'calendar-remove-outline';
    case 'reserve_impots_autonome':
      return 'file-document-outline';
    default:
      return 'clipboard-text-outline';
  }
}

export function AIChatPlanSuggestionsBubble({ state, onConfirm }: Props) {
  const router = useRouter();
  const palette = useAIChatColors();
  const { suggestions, intro, frozen, confirmedIds } = state;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const effectiveSelected = frozen ? confirmedIds : selectedIds;
  const selectedCount = effectiveSelected.length;

  const toggleSelection = useCallback(
    (planId: string) => {
      if (frozen) return;
      tapHaptic();
      setSelectedIds((current) =>
        current.includes(planId) ? current.filter((id) => id !== planId) : [...current, planId],
      );
    },
    [frozen],
  );

  const handleOpenDetail = useCallback(
    (plan: PlanSuggere) => {
      tapHaptic();
      router.push({
        pathname: '/plans/template/[subtype]',
        params: buildTemplateDetailParams(plan.subtype, {
          raison: resolvePlanSuggestionDetailReason(
            plan.raison_recommandation,
            plan.description,
            plan.subtype,
          ),
          suggestedId: plan.id,
        }) as { subtype: string | number },
      });
    },
    [router],
  );

  const selectedPlans = useMemo(
    () => suggestions.filter((plan) => effectiveSelected.includes(plan.id)),
    [effectiveSelected, suggestions],
  );

  const handleConfirm = useCallback(() => {
    if (frozen || selectedPlans.length === 0) return;
    tapHaptic();
    onConfirm(selectedPlans);
  }, [frozen, onConfirm, selectedPlans]);

  if (suggestions.length === 0) {
    return null;
  }

  const introText = intro.trim();

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bubble, { backgroundColor: palette.aiBubble, borderColor: palette.border }]}>
        {introText ? (
          <Text style={[styles.intro, { color: palette.text }, interRegularText]}>{introText}</Text>
        ) : null}

        <View style={styles.cards}>
          {suggestions.map((plan) => {
            const selected = effectiveSelected.includes(plan.id);
            const dimmed = frozen && !selected;

            return (
              <View
                key={plan.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: PLAN_SURFACE,
                    borderColor: selected ? PLAN_SELECTED_BORDER : PLAN_BORDER,
                    opacity: dimmed ? 0.45 : 1,
                  },
                ]}
              >
                {!frozen ? (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={
                      selected ? `Désélectionner ${plan.titre}` : `Sélectionner ${plan.titre}`
                    }
                    hitSlop={8}
                    onPress={() => toggleSelection(plan.id)}
                    style={styles.selectControl}
                  >
                    <AppIcon
                      family="material-community"
                      name={selected ? 'check-circle' : 'circle-outline'}
                      size={20}
                      color={selected ? PLAN_SELECTED_BORDER : palette.textMuted}
                    />
                  </Pressable>
                ) : selected ? (
                  <View style={styles.selectControl}>
                    <AppIcon
                      family="material-community"
                      name="check-circle"
                      size={20}
                      color={PLAN_SELECTED_BORDER}
                    />
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Voir les détails de ${plan.titre}`}
                  onPress={() => handleOpenDetail(plan)}
                  style={({ pressed }) => [styles.cardBody, pressed && styles.cardBodyPressed]}
                >
                  <View style={styles.cardHeader}>
                    <AppIcon
                      family="material-community"
                      name={planIcon(plan.subtype)}
                      size={18}
                      color={dimmed ? palette.textMuted : palette.text}
                    />
                    <View style={styles.cardTitles}>
                      <Text
                        style={[styles.cardTitle, { color: palette.text }, interSemiboldText]}
                        numberOfLines={1}
                      >
                        {plan.titre}
                      </Text>
                      <Text
                        style={[styles.cardCategory, { color: palette.textMuted }, interMediumText]}
                        numberOfLines={1}
                      >
                        {planSuggestionCategoryLabel(plan)} · {planSuggestionSubtypeLabel(plan)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[styles.cardReason, { color: palette.textMuted }, interRegularText]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {formatPlanSuggestionReasonForCard(
                      plan.raison_recommandation,
                      plan.description,
                      plan.subtype,
                    )}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {!frozen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Créer ${selectedCount} plan${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}`}
            disabled={selectedCount === 0}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: selectedCount > 0 ? PLAN_SELECTED_BORDER : 'rgba(255, 255, 255, 0.08)',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <AppIcon family="material" 
              name="auto-awesome"
              size={16}
              color={selectedCount > 0 ? '#0E0E10' : 'rgba(255, 255, 255, 0.35)'}
            />
            <Text
              style={[
                styles.ctaLabel,
                interSemiboldText,
                { color: selectedCount > 0 ? '#0E0E10' : 'rgba(255, 255, 255, 0.35)' },
              ]}
            >
              Créer {selectedCount} plan{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
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
  intro: {
    fontSize: typography.body,
    lineHeight: typography.body + 6,
  },
  cards: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  selectControl: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.xs,
    paddingRight: spacing.lg + spacing.sm,
  },
  cardBodyPressed: {
    opacity: 0.88,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.lg,
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
