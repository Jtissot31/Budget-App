import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { TextStyle, ViewStyle } from 'react-native';
import { DARK_CANVAS, radius, spacing, typographyKit } from '@/constants/theme';
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
import { PLAN_SUBTYPE_DESCRIPTIONS } from './planCatalogData';
import { formatPlanSuggestionReasonForCard } from './planSuggestionCopy';

export const PLAN_HUB = {
  background: DARK_CANVAS,
  surface: '#111111',
  accent: '#4ADE80',
  /** Soft wash for suggested icon wells — shells stay `#111`. */
  accentMuted: 'rgba(74, 222, 128, 0.12)',
  danger: '#C96560',
  warning: '#C9974A',
  border: 'rgba(255, 255, 255, 0.12)',
  radiusCard: 13,
  radiusSmall: 8,
  activeEdgeWidth: 2,
} as const;

type PlanCardChromeColors = {
  primary: string;
  /** Prefer soft `#4ADE80` when present; falls back to `primary`. */
  accentGreen?: string;
  successMuted: string;
  textMuted: string;
  textSecondary: string;
  input: string;
  surfaceElevated: string;
};

function planHubAccent(colors: PlanCardChromeColors): string {
  return colors.accentGreen ?? colors.primary;
}

/**
 * Suggested-plan chrome — soft status tint + muted icon wash (shells stay `#111`).
 * Category labels (DETTE, etc.) stay muted at the call site.
 */
export function planCardSuggestedAccent(colors: PlanCardChromeColors) {
  const accent = planHubAccent(colors);
  return {
    status: accent,
    iconWash: colors.successMuted,
    iconGlyph: accent,
  } as const;
}

/** Active hub strategy — thin accent rail + glyph (well stays neutral). */
export function planCardActiveStrategyAccent(colors: PlanCardChromeColors) {
  const accent = planHubAccent(colors);
  return {
    edge: accent,
    iconGlyph: accent,
  } as const;
}

/** Padding interne des cartes plan — aligné Accueil / hub. */
export const PLAN_CARD_PADDING = 20;
/** Espacement vertical entre cartes dans une liste. */
export const PLAN_CARD_LIST_GAP = 14;

/**
 * Rangée Accueil / hub « Tes plans » — même densité que {@link HomePlansCarousel}.
 * Shell: `DashboardCard` (voir PlanCard `layout="home"`).
 */
export const PLAN_HOME_ROW = {
  iconWellSize: 44,
  iconSize: 20,
  iconWellRadius: radius.md,
  listGap: spacing.sm,
  paddingVertical: spacing.lg,
  paddingHorizontal: spacing.lg + 4,
  contentGap: spacing.md + 2,
  progressHeight: 4,
} as const;

export function planHomeRowInnerStyle(): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PLAN_HOME_ROW.contentGap,
    paddingVertical: PLAN_HOME_ROW.paddingVertical,
    paddingHorizontal: PLAN_HOME_ROW.paddingHorizontal,
  };
}

/** Montant « actuel / cible » — même format que Accueil. */
export function planCardHomeAmountLine(plan: Plan): string | null {
  if (isPlanSuggere(plan) || !planPossedeCibleMonetaire(plan)) return null;
  return `${formatDisplayMoneyAbsolute(plan.montant_actuel ?? 0)} / ${formatDisplayMoneyAbsolute(plan.montant_cible!)}`;
}

/**
 * Accueil / hub « Tes plans » — tagline courte sous le titre (plans suggérés).
 * Prefers catalog one-liner; falls back to sanitized raison / description.
 */
export function planCardHomeSuggestedHint(plan: Plan): string | null {
  if (!isPlanSuggere(plan)) return null;
  const catalog = PLAN_SUBTYPE_DESCRIPTIONS[plan.subtype]?.trim();
  if (catalog) return catalog;
  const fallback = formatPlanSuggestionReasonForCard(
    plan.raison_recommandation,
    plan.description,
    plan.subtype,
  );
  return fallback.trim() || null;
}

/**
 * Couleur de progression Accueil / hub row — accent Épargne, danger Budget dépassé,
 * sinon muted (comme {@link HomePlansCarousel}).
 */
export function planCardHomeProgressColor(
  plan: Plan,
  colors: { danger: string; primary: string; textMuted: string },
): string {
  if (plan.category === 'budget' && !planProgressionPositive(plan)) return colors.danger;
  if (plan.category === 'epargne') return colors.primary;
  return colors.textMuted;
}

/**
 * @deprecated Ancien carrousel horizontal hub — Accueil / hub utilisent {@link PLAN_HOME_ROW}.
 */
export const PLAN_CAROUSEL = {
  cardWidth: 196,
  cardGap: spacing.sm,
  edgeFadeWidth: 56,
  iconSize: 16,
  iconWellSize: 32,
  /** Tighter than full Onyx card padding (20) — carousel only. */
  padding: spacing.md + 2,
  contentGap: spacing.sm,
  titleFontSize: 14,
  metaFontSize: 11,
  minHeight: 148,
  progressHeight: 3,
  progressRadius: 2,
  progressMarginTop: 'auto' as const,
} as const;

/** @deprecated Préférer {@link PLAN_CAROUSEL.cardWidth}. */
export const PLAN_CAROUSEL_CARD_MIN_WIDTH = PLAN_CAROUSEL.cardWidth;

export function planCarouselCardShellStyle(): Pick<
  ViewStyle,
  'width' | 'minHeight' | 'padding' | 'gap' | 'justifyContent'
> {
  return {
    width: PLAN_CAROUSEL.cardWidth,
    minHeight: PLAN_CAROUSEL.minHeight,
    padding: PLAN_CAROUSEL.padding,
    gap: PLAN_CAROUSEL.contentGap,
    justifyContent: 'flex-start',
  };
}

export function planCarouselTitleStyle(): TextStyle {
  return {
    ...typographyKit.bodyBold,
    fontSize: PLAN_CAROUSEL.titleFontSize,
    letterSpacing: -0.3,
    lineHeight: PLAN_CAROUSEL.titleFontSize + 5,
  };
}

export function planCarouselMetaStyle(): TextStyle {
  return {
    ...typographyKit.microUpper,
    fontSize: PLAN_CAROUSEL.metaFontSize,
    letterSpacing: 0.5,
  };
}

export function planCarouselProgressTrackStyle(): ViewStyle {
  return {
    height: PLAN_CAROUSEL.progressHeight,
    borderRadius: PLAN_CAROUSEL.progressRadius,
    overflow: 'hidden',
    marginTop: PLAN_CAROUSEL.progressMarginTop,
    alignSelf: 'stretch',
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
