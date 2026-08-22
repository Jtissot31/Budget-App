import {
  PLAN_CATEGORIES,
  PLAN_CATEGORY_LABELS,
  PLAN_SUBTYPES_BY_CATEGORY,
  PLAN_SUBTYPE_LABELS,
  planCategoryForSubtype,
  type PlanCategory,
  type PlanSubtype,
} from './Plan';

/** Descriptions courtes (1–2 lignes) pour les cartes catalogue / bibliothèque. */
export const PLAN_SUBTYPE_DESCRIPTIONS: Record<PlanSubtype, string> = {
  fonds_urgence: 'Constitue 3 mois de dépenses essentielles pour absorber les imprévus sans crédit.',
  mise_de_fonds: 'Épargne structurée vers le seuil de mise de fonds immobilier.',
  voyage: 'Met de côté pour voyager sans toucher au budget courant ni à la carte.',
  achat_majeur: 'Finance un gros achat (auto, reno, équipement) avant d’emprunter.',
  coussin_saisonnier: 'Lisse fêtes, impôts municipaux et rentrée scolaire sur l’année.',
  evenement_vie: 'Prépare mariage, naissance ou déménagement avec des jalons clairs.',
  dette_individuelle: 'Cible une seule dette et rembourse au-delà du minimum.',
  snowball: 'Commence par les plus petits soldes pour créer de l’élan rapidement.',
  avalanche: 'Attaque d’abord le taux le plus élevé pour minimiser les intérêts.',
  bombe_nucleaire: 'Un gros paiement unique sur la dette la plus coûteuse ou libératrice.',
  consolidation: 'Regroupe plusieurs dettes en un seul prêt plus simple à gérer.',
  marge_credit: 'Réduis l’utilisation de ta marge pour baisser intérêts et risque.',
  reer: 'Cotise au REER selon ton espace et ta tranche d’imposition.',
  celi: 'Maximise l’épargne libre d’impôt pour objectifs à 3–7 ans.',
  reee: 'Épargne-études avec les subventions gouvernementales du REEE.',
  celiapp: 'Accélère une première mise de fonds avec l’avantage CELIAPP.',
  rattrapage_cotisation: 'Comble les années de cotisations REER ou CELI manquées.',
  enveloppe: 'Alloue un plafond fixe par catégorie et suis-le en temps réel.',
  zero_based: 'Assigne chaque dollar à une catégorie dès le début du mois.',
  ratio_fixe_variable: 'Garde un ratio cible entre fixes et variables pour préserver ta marge.',
  reserve_impots_autonome: 'Mets de côté un % de chaque encaissement pour les impôts.',
  acomptes_provisionnels: 'Planifie les acomptes trimestriels sans stress de dernière minute.',
  optimisation_reer_celi: 'Répartis REER et CELI selon fiscalité et horizons.',
  fonds_assurance: 'Réserve pour franchises et sinistres non couverts à 100 %.',
  revue_protection: 'Audite et ajuste assurances et couvertures à ta situation.',
  reduction_abonnements: 'Audit puis coupe les abonnements peu utilisés (souvent 50–150 $/mois).',
  no_spend_challenge: 'Défi sans dépenses discrétionnaires pour casser une mauvaise tendance.',
  sortie_categorie_derapage: 'Plafond temporaire et suivi serré d’une catégorie qui dérape.',
};

export type PlanCatalogEntry = {
  category: PlanCategory;
  subtype: PlanSubtype;
  label: string;
  description: string;
};

/** Meta ligne catalogue — libellé de catégorie (ex. « Épargne »). */
export function planCatalogCardMetaLine(category: PlanCategory): string {
  return PLAN_CATEGORY_LABELS[category];
}

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
