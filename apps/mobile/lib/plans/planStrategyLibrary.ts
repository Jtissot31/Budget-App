import type { PlanSuggere, PlanSubtype } from './Plan';
import { PLAN_CATEGORY_LABELS, PLAN_SUBTYPE_LABELS } from './Plan';
import { getCatalogEntry, type PlanCatalogEntry } from './planCatalogData';

/**
 * Bibliothèque de stratégies financières — sections d’exploration (`/plans/explore`).
 * Distinct des situations de vie (`PLAN_SITUATIONS`) et des catégories techniques.
 */
export type StrategyLibrarySectionId =
  | 'comportemental'
  | 'abonnements'
  | 'dettes'
  | 'epargne'
  | 'budget'
  | 'investissement'
  | 'fiscal'
  | 'protection';

/** Filtre horizontal bibliothèque — Tout / Suggéré / sections catalogue. */
export type StrategyLibraryFilterId = 'all' | 'suggested' | StrategyLibrarySectionId;

export type StrategyLibrarySection = {
  id: StrategyLibrarySectionId;
  /** Eyebrow uppercase (ex. « HABITUDES »). */
  eyebrow: string;
  /** Titre de section. */
  title: string;
  /** Accroche courte sous le titre. */
  blurb: string;
  subtypes: readonly PlanSubtype[];
};

export const STRATEGY_LIBRARY_SECTIONS: readonly StrategyLibrarySection[] = [
  {
    id: 'comportemental',
    eyebrow: 'Habitudes',
    title: 'Comportemental',
    blurb: 'Défis et rituels pour reprendre le contrôle de tes dépenses du quotidien.',
    subtypes: ['no_spend_challenge', 'sortie_categorie_derapage'],
  },
  {
    id: 'abonnements',
    eyebrow: 'Fuites',
    title: 'Abonnements & fuites',
    blurb: 'Repère ce qui sort chaque mois sans que tu y penses, puis coupe le superflu.',
    subtypes: ['reduction_abonnements'],
  },
  {
    id: 'dettes',
    eyebrow: 'Remboursement',
    title: 'Dettes & remboursement',
    blurb: 'Choisis une méthode claire pour accélérer le remboursement et réduire les intérêts.',
    subtypes: [
      'dette_individuelle',
      'snowball',
      'avalanche',
      'bombe_nucleaire',
      'consolidation',
      'marge_credit',
    ],
  },
  {
    id: 'epargne',
    eyebrow: 'Objectifs',
    title: 'Épargne & objectifs',
    blurb: 'Réserves, projets et jalons — une cible chiffrée, une cadence réaliste.',
    subtypes: [
      'fonds_urgence',
      'mise_de_fonds',
      'voyage',
      'achat_majeur',
      'coussin_saisonnier',
      'evenement_vie',
    ],
  },
  {
    id: 'budget',
    eyebrow: 'Cashflow',
    title: 'Budget & cashflow',
    blurb: 'Structure tes revenus et dépenses pour garder de la marge chaque mois.',
    subtypes: ['enveloppe', 'zero_based', 'ratio_fixe_variable'],
  },
  {
    id: 'investissement',
    eyebrow: 'Croissance',
    title: 'Investissement & comptes enregistrés',
    blurb: 'REER, CELI, REEE, CELIAPP — maximise l’espace fiscal selon tes objectifs.',
    subtypes: ['reer', 'celi', 'reee', 'celiapp', 'rattrapage_cotisation'],
  },
  {
    id: 'fiscal',
    eyebrow: 'Impôts',
    title: 'Fiscal & travail autonome',
    blurb: 'Réserves, acomptes et optimisation pour éviter les mauvaises surprises.',
    subtypes: ['reserve_impots_autonome', 'acomptes_provisionnels', 'optimisation_reer_celi'],
  },
  {
    id: 'protection',
    eyebrow: 'Sécurité',
    title: 'Protection & risques',
    blurb: 'Franchises, couvertures et coussins pour absorber les imprévus.',
    subtypes: ['fonds_assurance', 'revue_protection'],
  },
] as const;

/** Badge / tag affiché sur la carte (plus court que le titre de section). */
export const STRATEGY_LIBRARY_BADGES: Record<StrategyLibrarySectionId, string> = {
  comportemental: 'Habitudes',
  abonnements: 'Abonnements',
  dettes: 'Dettes',
  epargne: 'Épargne',
  budget: 'Budget',
  investissement: 'Investir',
  fiscal: 'Fiscal',
  protection: 'Protection',
};

/** Libellés des chips de section (toggle bibliothèque). */
export const STRATEGY_LIBRARY_CHIP_LABELS: Record<StrategyLibrarySectionId, string> = {
  comportemental: 'Habitudes',
  abonnements: 'Abonnements',
  dettes: 'Dettes',
  epargne: 'Épargne',
  budget: 'Budget',
  investissement: 'Investissement',
  fiscal: 'Fiscal',
  protection: 'Protection',
};

export const STRATEGY_LIBRARY_FILTER_OPTIONS: readonly {
  id: StrategyLibraryFilterId;
  label: string;
}[] = [
  { id: 'all', label: 'Tout' },
  { id: 'suggested', label: 'Suggéré' },
  ...STRATEGY_LIBRARY_SECTIONS.map((section) => ({
    id: section.id as StrategyLibraryFilterId,
    label: STRATEGY_LIBRARY_CHIP_LABELS[section.id],
  })),
];

const SUBTYPE_TO_SECTION = Object.fromEntries(
  STRATEGY_LIBRARY_SECTIONS.flatMap((section) =>
    section.subtypes.map((subtype) => [subtype, section.id]),
  ),
) as Record<PlanSubtype, StrategyLibrarySectionId>;

export function strategyLibrarySectionForSubtype(
  subtype: PlanSubtype,
): StrategyLibrarySectionId | undefined {
  return SUBTYPE_TO_SECTION[subtype];
}

export function strategyLibraryBadgeForSubtype(subtype: PlanSubtype): string {
  const sectionId = SUBTYPE_TO_SECTION[subtype];
  if (sectionId) return STRATEGY_LIBRARY_BADGES[sectionId];
  const entry = getCatalogEntry(subtype);
  return entry ? entry.category : 'Stratégie';
}

export function catalogEntriesForSection(
  section: StrategyLibrarySection,
): PlanCatalogEntry[] {
  return section.subtypes
    .map((subtype) => getCatalogEntry(subtype))
    .filter((entry): entry is PlanCatalogEntry => entry != null);
}

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function haystackMatchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return normalizeSearch(haystack).includes(query);
}

/** Recherche titre / description / tags (badge, catégorie, section). */
export function catalogEntryMatchesSearch(
  entry: PlanCatalogEntry,
  rawQuery: string,
): boolean {
  const query = normalizeSearch(rawQuery);
  if (!query) return true;
  const sectionId = SUBTYPE_TO_SECTION[entry.subtype];
  const section = sectionId
    ? STRATEGY_LIBRARY_SECTIONS.find((item) => item.id === sectionId)
    : undefined;
  const parts = [
    entry.label,
    entry.description,
    strategyLibraryBadgeForSubtype(entry.subtype),
    PLAN_CATEGORY_LABELS[entry.category],
    PLAN_SUBTYPE_LABELS[entry.subtype],
    section?.eyebrow ?? '',
    section?.title ?? '',
    sectionId ? STRATEGY_LIBRARY_CHIP_LABELS[sectionId] : '',
  ];
  return parts.some((part) => haystackMatchesQuery(part, query));
}

export function suggestedPlanMatchesSearch(plan: PlanSuggere, rawQuery: string): boolean {
  const query = normalizeSearch(rawQuery);
  if (!query) return true;
  const parts = [
    plan.titre,
    plan.description,
    plan.raison_recommandation,
    strategyLibraryBadgeForSubtype(plan.subtype),
    PLAN_CATEGORY_LABELS[plan.category],
    PLAN_SUBTYPE_LABELS[plan.subtype],
  ];
  return parts.some((part) => haystackMatchesQuery(part, query));
}
