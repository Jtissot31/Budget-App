import {
  PLAN_CATEGORIES,
  PLAN_SUBTYPES_BY_CATEGORY,
  PLAN_SUBTYPE_LABELS,
  planCategoryForSubtype,
  type PlanCategory,
  type PlanSubtype,
} from './Plan';

/** Descriptions courtes (1 ligne) pour les cartes catalogue Explorer. */
export const PLAN_SUBTYPE_DESCRIPTIONS: Record<PlanSubtype, string> = {
  fonds_urgence: 'Réserve pour couvrir 3 mois de dépenses essentielles.',
  mise_de_fonds: 'Épargner pour un achat immobilier.',
  voyage: 'Mettre de côté pour un voyage planifié.',
  achat_majeur: 'Financer un achat important sans crédit.',
  coussin_saisonnier: 'Anticiper les dépenses saisonnières récurrentes.',
  evenement_vie: 'Préparer un mariage, naissance ou autre événement.',
  dette_individuelle: 'Rembourser une dette précise avec un plan structuré.',
  snowball: 'Éliminer les dettes de la plus petite à la plus grande.',
  avalanche: 'Prioriser les dettes au taux d’intérêt le plus élevé.',
  consolidation: 'Regrouper plusieurs dettes en un seul paiement.',
  marge_credit: 'Réduire l’utilisation de votre marge de crédit.',
  reer: 'Cotiser au REER selon votre espace et vos objectifs.',
  celi: 'Maximiser votre épargne libre d’impôt à court terme.',
  reee: 'Épargner pour les études d’un enfant.',
  celiapp: 'Préparer un premier achat immobilier avec le CELIAPP.',
  rattrapage_cotisation: 'Rattraper des cotisations manquées REER ou CELI.',
  enveloppe: 'Allouer un montant fixe par catégorie de dépenses.',
  zero_based: 'Assigner chaque dollar à une catégorie chaque mois.',
  ratio_fixe_variable: 'Séparer dépenses fixes et variables avec un ratio cible.',
  reserve_impots_autonome: 'Mettre de côté pour les impôts en travail autonome.',
  acomptes_provisionnels: 'Planifier les acomptes provisionnels trimestriels.',
  optimisation_reer_celi: 'Optimiser REER et CELI selon votre situation fiscale.',
  fonds_assurance: 'Constituer une réserve pour franchises et imprévus assurés.',
  revue_protection: 'Évaluer et ajuster votre couverture d’assurance.',
  reduction_abonnements: 'Identifier et réduire les abonnements inutiles.',
  no_spend_challenge: 'Limiter les dépenses discrétionnaires sur une période.',
  sortie_categorie_derapage: 'Reprendre le contrôle d’une catégorie qui dérape.',
};

export type PlanCatalogEntry = {
  category: PlanCategory;
  subtype: PlanSubtype;
  label: string;
  description: string;
};

export const PLAN_CATALOG_ENTRIES: readonly PlanCatalogEntry[] = PLAN_CATEGORIES.flatMap(
  (category) =>
    PLAN_SUBTYPES_BY_CATEGORY[category].map((subtype) => ({
      category,
      subtype,
      label: PLAN_SUBTYPE_LABELS[subtype],
      description: PLAN_SUBTYPE_DESCRIPTIONS[subtype],
    })),
);

export function filterCatalogByCategory(
  entries: readonly PlanCatalogEntry[],
  filter: 'all' | PlanCategory,
): PlanCatalogEntry[] {
  if (filter === 'all') return [...entries];
  return entries.filter((entry) => entry.category === filter);
}

export function getCatalogEntry(subtype: PlanSubtype): PlanCatalogEntry | undefined {
  return PLAN_CATALOG_ENTRIES.find((entry) => entry.subtype === subtype);
}

export function catalogEntryCategory(subtype: PlanSubtype): PlanCategory {
  return planCategoryForSubtype(subtype);
}
