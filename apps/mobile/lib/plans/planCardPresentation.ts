import { MaterialCommunityIcons } from '@expo/vector-icons';
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

import { DARK_CANVAS } from '@/constants/theme';

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
