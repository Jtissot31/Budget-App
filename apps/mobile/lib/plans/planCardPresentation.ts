import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TextStyle, ViewStyle } from 'react-native';
import { PLAN_FINANCE_CONTAINER } from '@/constants/planFinanceKit';
import { DARK_CANVAS, interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import {
  PLAN_CATEGORY_LABELS,
  PLAN_STATUT_LABELS,
  isPlanSuggere,
  planEtapesCompletees,
  planMontantRestant,
  planPossedeCibleMonetaire,
  planProgressionPourcent,
  planProgressionPositive,
  type Plan,
  type PlanCategory,
} from './Plan';

export const PLAN_HUB = {
  background: DARK_CANVAS,
  surface: '#111111',
  accent: '#4ADE80',
  danger: '#C96560',
  warning: '#C9974A',
  border: 'rgba(255, 255, 255, 0.12)',
  radiusCard: 13,
  radiusSmall: 8,
} as const;

/** Padding interne des cartes plan — aligné Accueil / hub. */
export const PLAN_CARD_PADDING = 20;
/** Espacement vertical entre cartes dans une liste. */
export const PLAN_CARD_LIST_GAP = 14;

/**
 * Tuiles carrousel « Tes plans » — Accueil ({@link HomePlansCarousel}) et hub
 * ({@link PlanHubCardCarousel}). Source unique pour éviter la dérive visuelle.
 */
export const PLAN_CAROUSEL = {
  cardWidth: 190,
  cardGap: spacing.sm,
  edgeFadeWidth: 56,
  iconSize: 20,
  padding: PLAN_FINANCE_CONTAINER.padding.card,
  contentGap: spacing.sm,
  titleFontSize: 13,
  metaFontSize: 11,
  progressHeight: 4,
  progressRadius: 2,
  progressMarginTop: spacing.xs,
} as const;

/** @deprecated Préférer {@link PLAN_CAROUSEL.cardWidth}. */
export const PLAN_CAROUSEL_CARD_MIN_WIDTH = PLAN_CAROUSEL.cardWidth;

export function planCarouselCardShellStyle(): Pick<ViewStyle, 'width' | 'padding' | 'gap'> {
  return {
    width: PLAN_CAROUSEL.cardWidth,
    padding: PLAN_CAROUSEL.padding,
    gap: PLAN_CAROUSEL.contentGap,
  };
}

export function planCarouselTitleStyle(): TextStyle {
  return {
    ...interSemiboldText,
    fontSize: PLAN_CAROUSEL.titleFontSize,
  };
}

export function planCarouselMetaStyle(): TextStyle {
  return {
    ...interMediumText,
    fontSize: PLAN_CAROUSEL.metaFontSize,
  };
}

export function planCarouselProgressTrackStyle(): ViewStyle {
  return {
    height: PLAN_CAROUSEL.progressHeight,
    borderRadius: PLAN_CAROUSEL.progressRadius,
    overflow: 'hidden',
    marginTop: PLAN_CAROUSEL.progressMarginTop,
  };
}

/** Icône fixe par catégorie — source unique pour toute l'app. */
export const PLAN_CATEGORY_ICONS = {
  epargne: 'shield-check-outline',
  dette: 'credit-card-outline',
  investissement: 'piggy-bank-outline',
  budget: 'wallet-outline',
  fiscal: 'file-document-outline',
  risque: 'shield-alert-outline',
  comportemental: 'target',
} as const satisfies Record<PlanCategory, keyof typeof MaterialCommunityIcons.glyphMap>;

export function getCategoryIcon(category: PlanCategory): keyof typeof MaterialCommunityIcons.glyphMap {
  return PLAN_CATEGORY_ICONS[category];
}

/** @deprecated Utiliser {@link getCategoryIcon} — conservé pour imports existants. */
export function planSubtypeIcon(category: PlanCategory): keyof typeof MaterialCommunityIcons.glyphMap {
  return getCategoryIcon(category);
}

export function planStatusLabel(plan: Plan): string {
  return PLAN_STATUT_LABELS[plan.statut];
}

export function planCategoryLabel(category: PlanCategory): string {
  return PLAN_CATEGORY_LABELS[category];
}

/**
 * Secondary meta line — % appears here at most once (never again in the primary metric).
 * Suggested: eyebrow « Suggéré · Catégorie ».
 * Active / complete: « 62 % · Épargne » (bar repeats % visually only).
 */
export function planCardMetaLine(plan: Plan): string {
  if (isPlanSuggere(plan)) {
    return `Suggéré · ${planCategoryLabel(plan.category)}`;
  }
  const pct = planProgressionPourcent(plan);
  return `${pct} % · ${planCategoryLabel(plan.category)}`;
}

/** Meta carrousel Accueil / hub — « Catégorie · Statut » (sans % ni montant). */
export function planCardCarouselMetaLine(plan: Plan): string {
  if (isPlanSuggere(plan)) {
    return `Suggéré · ${planCategoryLabel(plan.category)}`;
  }
  return `${planCategoryLabel(plan.category)} · ${PLAN_STATUT_LABELS[plan.statut]}`;
}

/**
 * Primary metric for active / complete plans — money or étapes, without %.
 * Suggested plans: empty (hint goes through {@link planCardSummaryLine}).
 */
export function planCardPrimaryMetricLine(plan: Plan): string | null {
  if (isPlanSuggere(plan)) return null;

  if (planPossedeCibleMonetaire(plan)) {
    if (plan.statut === 'complete') {
      const attained = plan.montant_actuel ?? plan.montant_cible ?? 0;
      return `${formatDisplayMoneyAbsolute(attained)} atteints`;
    }
    const remaining = planMontantRestant(plan) ?? 0;
    return `${formatDisplayMoneyAbsolute(remaining)} restants`;
  }

  const { done, total } = planEtapesCompletees(plan);
  return `${done}/${total} étapes`;
}

/** True when the primary metric is a dollar amount (use moneyAmountTypography). */
export function planCardPrimaryMetricIsMoney(plan: Plan): boolean {
  return !isPlanSuggere(plan) && planPossedeCibleMonetaire(plan);
}

/**
 * Suggested-plan hint (raison). For active plans returns the primary metric
 * (compat) — prefer {@link planCardPrimaryMetricLine} in new UI.
 */
export function planCardSummaryLine(plan: Plan): string {
  if (isPlanSuggere(plan)) {
    return plan.raison_recommandation;
  }
  return planCardPrimaryMetricLine(plan) ?? '';
}

/** Vert par défaut ; rouge seulement en urgence réelle (ex. budget dépassé). */
export function planCardProgressColor(plan: Plan): string {
  if (plan.category === 'budget' && !planProgressionPositive(plan)) {
    return PLAN_HUB.danger;
  }
  return PLAN_HUB.accent;
}
