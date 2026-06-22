import type { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PLAN_CATEGORY_LABELS,
  PLAN_STATUT_LABELS,
  isPlanSuggere,
  planMontantRestant,
  planPossedeCibleMonetaire,
  planProgressionPourcent,
  planProgressionPositive,
  type Plan,
  type PlanCategory,
} from './Plan';

export const PLAN_HUB = {
  background: '#0E0E10',
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

export function planCardMetaLine(plan: Plan): string {
  const pct = planProgressionPourcent(plan);
  if (isPlanSuggere(plan)) {
    return `Suggéré · ${planCategoryLabel(plan.category)}`;
  }
  return `${pct} % · ${planCategoryLabel(plan.category)}`;
}

export function planCardSummaryLine(plan: Plan): string {
  const pct = planProgressionPourcent(plan);
  if (isPlanSuggere(plan)) {
    return plan.raison_recommandation;
  }
  if (planPossedeCibleMonetaire(plan)) {
    const remaining = planMontantRestant(plan) ?? 0;
    const { formatDisplayMoneyAbsolute } = require('@/lib/formatDisplayMoney') as typeof import('@/lib/formatDisplayMoney');
    return `${formatDisplayMoneyAbsolute(remaining)} restants · ${pct} %`;
  }
  const { done, total } = plan.etapes.reduce(
    (acc, etape) => {
      acc.total += 1;
      if (etape.statut === 'complete') acc.done += 1;
      return acc;
    },
    { done: 0, total: 0 },
  );
  return `${done}/${total} étapes · ${pct} %`;
}

/** Vert par défaut ; rouge seulement en urgence réelle (ex. budget dépassé). */
export function planCardProgressColor(plan: Plan): string {
  if (plan.category === 'budget' && !planProgressionPositive(plan)) {
    return PLAN_HUB.danger;
  }
  return PLAN_HUB.accent;
}
