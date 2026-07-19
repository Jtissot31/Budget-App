/**
 * Modèle canonique des **plans financiers** (feature « Tes plans »).
 *
 * Distinct du système **Objectifs** (gamification XP / niveaux / badges).
 * Ne pas confondre avec `RfaGoal`, `goal-detail`, etc.
 */

// ─── Catégories ─────────────────────────────────────────────────────────────

export type PlanCategory =
  | 'epargne'
  | 'dette'
  | 'investissement'
  | 'budget'
  | 'fiscal'
  | 'risque'
  | 'comportemental';

export const PLAN_CATEGORIES = [
  'epargne',
  'dette',
  'investissement',
  'budget',
  'fiscal',
  'risque',
  'comportemental',
] as const satisfies readonly PlanCategory[];

// ─── Sous-types par catégorie ───────────────────────────────────────────────

export type PlanSubtypeEpargne =
  | 'fonds_urgence'
  | 'mise_de_fonds'
  | 'voyage'
  | 'achat_majeur'
  | 'coussin_saisonnier'
  | 'evenement_vie';

export type PlanSubtypeDette =
  | 'dette_individuelle'
  | 'snowball'
  | 'avalanche'
  | 'bombe_nucleaire'
  | 'consolidation'
  | 'marge_credit';

export type PlanSubtypeInvestissement =
  | 'reer'
  | 'celi'
  | 'reee'
  | 'celiapp'
  | 'rattrapage_cotisation';

export type PlanSubtypeBudget = 'enveloppe' | 'zero_based' | 'ratio_fixe_variable';

export type PlanSubtypeFiscal =
  | 'reserve_impots_autonome'
  | 'acomptes_provisionnels'
  | 'optimisation_reer_celi';

export type PlanSubtypeRisque = 'fonds_assurance' | 'revue_protection';

export type PlanSubtypeComportemental =
  | 'reduction_abonnements'
  | 'no_spend_challenge'
  | 'sortie_categorie_derapage';

/** Union de tous les sous-types supportés. */
export type PlanSubtype =
  | PlanSubtypeEpargne
  | PlanSubtypeDette
  | PlanSubtypeInvestissement
  | PlanSubtypeBudget
  | PlanSubtypeFiscal
  | PlanSubtypeRisque
  | PlanSubtypeComportemental;

export const PLAN_SUBTYPES_BY_CATEGORY = {
  epargne: [
    'fonds_urgence',
    'mise_de_fonds',
    'voyage',
    'achat_majeur',
    'coussin_saisonnier',
    'evenement_vie',
  ],
  dette: ['dette_individuelle', 'snowball', 'avalanche', 'bombe_nucleaire', 'consolidation', 'marge_credit'],
  investissement: ['reer', 'celi', 'reee', 'celiapp', 'rattrapage_cotisation'],
  budget: ['enveloppe', 'zero_based', 'ratio_fixe_variable'],
  fiscal: ['reserve_impots_autonome', 'acomptes_provisionnels', 'optimisation_reer_celi'],
  risque: ['fonds_assurance', 'revue_protection'],
  comportemental: ['reduction_abonnements', 'no_spend_challenge', 'sortie_categorie_derapage'],
} as const satisfies Record<PlanCategory, readonly PlanSubtype[]>;

/** Sous-types sans cible monétaire — progression basée sur les étapes uniquement. */
export const PLAN_SUBTYPES_SANS_MONTANT_CIBLE: readonly PlanSubtype[] = [
  'revue_protection',
  'no_spend_challenge',
  'reduction_abonnements',
  'sortie_categorie_derapage',
] as const;

// ─── Statuts ────────────────────────────────────────────────────────────────

export type PlanStatut = 'actif' | 'complete' | 'en_pause' | 'suggere';

export const PLAN_STATUTS = ['actif', 'complete', 'en_pause', 'suggere'] as const satisfies readonly PlanStatut[];

export type PlanEtapeStatut = 'a_faire' | 'en_cours' | 'complete';

// ─── Signaux déclencheurs (traçabilité moteur de reco — non affiché UI) ───

export type PlanSignalDeclencheur =
  | 'fonds_urgence:couverture_moins_3_mois'
  | 'reer:revenu_stable_tranche_moyenne_droits_disponibles'
  | 'celi:droits_disponibles_sans_objectif_court_terme'
  | 'celiapp:locataire_jeune_epargne_recurrente'
  | 'snowball:plusieurs_dettes_actives'
  | 'avalanche:plusieurs_dettes_actives'
  | 'bombe_nucleaire:liquidites_disponibles'
  | 'consolidation:plusieurs_dettes_actives'
  | 'dette_individuelle:dette_unique'
  | 'marge_credit:marge_utilisee'
  | 'reserve_impots_autonome:travailleur_autonome'
  | 'enveloppe:categories_depassees_consecutives'
  | 'no_spend_challenge:depenses_discretionnaires_hausse'
  | 'reduction_abonnements:abonnements_nombreux';

// ─── Entités ────────────────────────────────────────────────────────────────

export type PlanEtape = {
  id: string;
  titre: string;
  description?: string;
  statut: PlanEtapeStatut;
  /** Date cible ou date de complétion (ISO 8601 ou libellé affichable). */
  date?: string;
};

/** Source d'une dette sélectionnée dans l'assistant de remboursement. */
export type PlanDebtSource = 'loan' | 'credit_card' | 'manual';

/** Dette sélectionnée / ordonnée pour un plan snowball / avalanche. */
export type PlanDebtSelection = {
  id: string;
  source: PlanDebtSource;
  label: string;
  solde: number;
  /** Taux annuel en % (ex. 19.99). */
  taux_interet: number;
  /** Paiement minimum mensuel équivalent. */
  paiement_minimum: number;
  /** Ordre de remboursement à la création (1 = priorité). */
  ordre: number;
};

export type PlanExtraCadence = 'week' | 'month';

/** Instantané faisabilité budget au moment de la création. */
export type PlanDebtFeasibilitySnapshot = {
  realiste: boolean;
  surplus_mensuel: number;
  extra_mensuel: number;
  message: string;
  suggestions?: string[];
};

/**
 * Paramètres spécifiques au type de plan, saisis dans le formulaire de création
 * piloté par `planTypeFormConfig`. Tous optionnels — un plan sauvegardé avant
 * l'introduction de ce champ reste valide (rétrocompatibilité).
 */
export type PlanParametres = {
  /** Dette : solde de départ (sert de cible de remboursement). */
  solde_initial?: number;
  /** Dette : taux d'intérêt annuel en pourcentage (ex. 19.99). */
  taux_interet?: number;
  /** Dette / comportemental : paiement ou économie mensuelle. */
  paiement_mensuel?: number;
  /** Budget : enveloppe mensuelle cible (sert de cible de dépenses). */
  budget_mensuel?: number;
  /** Comportemental : durée d'un défi en jours (ex. no-spend 30 j). */
  duree_jours?: number;
  /** Fiscal : pourcentage de chaque entrée mis en réserve. */
  pourcentage_reserve?: number;
  /** Dettes sélectionnées (assistant snowball / avalanche). */
  dettes?: PlanDebtSelection[];
  /** Stratégie d'ordre utilisée pour la projection. */
  strategie_dette?: 'snowball' | 'avalanche';
  /** Montant supplémentaire au-delà des minimums. */
  extra_paiement?: number;
  /** Cadence de l'extra : semaine | mois. */
  extra_cadence?: PlanExtraCadence;
  /** Projection à la création : jours estimés jusqu'à dette zéro. */
  projection_jours?: number;
  /** Instantané faisabilité budget. */
  faisabilite?: PlanDebtFeasibilitySnapshot;
};

/** Champs communs à tous les plans financiers. */
export type PlanBase = {
  id: string;
  category: PlanCategory;
  subtype: PlanSubtype;
  titre: string;
  description: string;
  statut: PlanStatut;
  /** Null pour les sous-types sans cible monétaire (ex. revue_protection). */
  montant_actuel: number | null;
  montant_cible: number | null;
  compte_lie?: string;
  cadence?: string;
  date_debut?: string;
  date_cible?: string;
  /** Paramètres spécifiques au type — optionnel (rétrocompatible). */
  parametres?: PlanParametres;
  etapes: PlanEtape[];
  /**
   * Référence au signal RFA / règle qui a généré la suggestion.
   * Réservé au debug et à la traçabilité — ne pas afficher à l'utilisateur.
   */
  signal_declencheur?: PlanSignalDeclencheur;
};

/** Plan recommandé par l'IA, pas encore activé par l'utilisateur. */
export type PlanSuggere = PlanBase & {
  statut: 'suggere';
  /** Texte narratif (2–3 phrases) généré par Claude — obligatoire si suggéré. */
  raison_recommandation: string;
  signal_declencheur: PlanSignalDeclencheur;
};

/** Plan actif, terminé ou en pause — pas de raison_recommandation. */
export type PlanActifOuTermine = PlanBase & {
  statut: 'actif' | 'complete' | 'en_pause';
  raison_recommandation?: never;
};

/**
 * Plan financier canonique.
 * Discriminant `statut`: `suggere` exige `raison_recommandation` + `signal_declencheur`.
 */
export type Plan = PlanSuggere | PlanActifOuTermine;

// ─── Labels UI (français) ─────────────────────────────────────────────────

export const PLAN_CATEGORY_LABELS: Record<PlanCategory, string> = {
  epargne: 'Épargne',
  dette: 'Dette',
  investissement: 'Investissement',
  budget: 'Budget',
  fiscal: 'Fiscal',
  risque: 'Risque',
  comportemental: 'Comportemental',
};

export const PLAN_SUBTYPE_LABELS: Record<PlanSubtype, string> = {
  fonds_urgence: "Fonds d'urgence",
  mise_de_fonds: 'Mise de fonds',
  voyage: 'Voyage',
  achat_majeur: 'Achat majeur',
  coussin_saisonnier: 'Coussin saisonnier',
  evenement_vie: 'Événement de vie',
  dette_individuelle: 'Dette individuelle',
  snowball: 'Remboursement boule de neige',
  avalanche: 'Remboursement avalanche',
  bombe_nucleaire: 'Bombe nucléaire',
  consolidation: 'Consolidation de dettes',
  marge_credit: 'Marge de crédit',
  reer: 'REER',
  celi: 'CELI',
  reee: 'REEE',
  celiapp: 'CELIAPP',
  rattrapage_cotisation: 'Rattrapage de cotisation',
  enveloppe: 'Enveloppes',
  zero_based: 'Budget base zéro',
  ratio_fixe_variable: 'Ratio fixe / variable',
  reserve_impots_autonome: 'Réserve impôts autonome',
  acomptes_provisionnels: 'Acomptes provisionnels',
  optimisation_reer_celi: 'Optimisation REER / CELI',
  fonds_assurance: "Fonds d'assurance",
  revue_protection: 'Revue de protection',
  reduction_abonnements: 'Réduction abonnements',
  no_spend_challenge: 'Défi no-spend',
  sortie_categorie_derapage: 'Sortie catégorie dérapage',
};

export const PLAN_STATUT_LABELS: Record<PlanStatut, string> = {
  actif: 'Actif',
  complete: 'Complété',
  en_pause: 'En pause',
  suggere: 'Suggéré',
};

// ─── Validation & gardes ────────────────────────────────────────────────────

export function isPlanCategory(value: string): value is PlanCategory {
  return (PLAN_CATEGORIES as readonly string[]).includes(value);
}

export function isPlanSubtypeForCategory(category: PlanCategory, subtype: string): subtype is PlanSubtype {
  return (PLAN_SUBTYPES_BY_CATEGORY[category] as readonly string[]).includes(subtype);
}

export function isPlanSuggere(plan: Plan): plan is PlanSuggere {
  return plan.statut === 'suggere';
}

/** Sous-types gérés comme objectifs d'épargne — exclus du carrousel plans financiers. */
export const SAVINGS_GOAL_PLAN_SUBTYPES: readonly PlanSubtype[] = ['fonds_urgence'] as const;

export function isSavingsGoalPlanSubtype(subtype: PlanSubtype): boolean {
  return (SAVINGS_GOAL_PLAN_SUBTYPES as readonly string[]).includes(subtype);
}

export function planSubtypeSansMontantCible(subtype: PlanSubtype): boolean {
  return (PLAN_SUBTYPES_SANS_MONTANT_CIBLE as readonly string[]).includes(subtype);
}

export function assertPlanTaxonomy(plan: Pick<Plan, 'category' | 'subtype'>): void {
  if (!isPlanSubtypeForCategory(plan.category, plan.subtype)) {
    throw new Error(
      `Sous-type « ${plan.subtype} » incompatible avec la catégorie « ${plan.category} ».`,
    );
  }
}

export function planCategoryForSubtype(subtype: PlanSubtype): PlanCategory {
  for (const category of PLAN_CATEGORIES) {
    if (isPlanSubtypeForCategory(category, subtype)) {
      return category;
    }
  }
  throw new Error(`Sous-type « ${subtype} » inconnu.`);
}

// ─── Helpers compatibilité UI (barre %, cartes dashboard) ───────────────────
//
// Les composants existants (carousel « Tes plans », PlanDetailScreen) consomment
// encore `DashboardPlanDetail` via mock. Ces helpers permettent de dériver les
// mêmes chiffres depuis le type `Plan` sans dupliquer la logique métier.

export function planEtapeEstComplete(etape: PlanEtape): boolean {
  return etape.statut === 'complete';
}

export function planEtapesCompletees(plan: Plan): { done: number; total: number } {
  const total = plan.etapes.length;
  const done = plan.etapes.filter(planEtapeEstComplete).length;
  return { done, total };
}

export function planPossedeCibleMonetaire(plan: Plan): boolean {
  if (planSubtypeSansMontantCible(plan.subtype)) return false;
  return plan.montant_cible != null && plan.montant_cible > 0;
}

/**
 * Progression 0–100 pour barres et hero.
 * - Avec cible monétaire : ratio montant_actuel / montant_cible.
 * - Sans cible : ratio d'étapes complétées.
 * - Plan complété : 100.
 */
export function planProgressionPourcent(plan: Plan): number {
  if (plan.statut === 'complete') return 100;

  if (planPossedeCibleMonetaire(plan)) {
    const cible = plan.montant_cible!;
    const actuel = plan.montant_actuel ?? 0;
    return Math.min(100, Math.max(0, Math.round((actuel / cible) * 100)));
  }

  const { done, total } = planEtapesCompletees(plan);
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

export function planMontantRestant(plan: Plan): number | null {
  if (!planPossedeCibleMonetaire(plan)) return null;
  const actuel = plan.montant_actuel ?? 0;
  return Math.max(0, plan.montant_cible! - actuel);
}

/** Index de la première étape non complétée (pour timeline / prochaine action). */
export function planIndexEtapeActive(plan: Plan): number {
  const index = plan.etapes.findIndex((etape) => etape.statut !== 'complete');
  return index === -1 ? Math.max(0, plan.etapes.length - 1) : index;
}

/** Ton visuel de la barre de progression (aligné dashboard actuel). */
export function planProgressionPositive(plan: Plan): boolean {
  if (plan.statut === 'suggere') return true;
  if (plan.category === 'budget' && planProgressionPourcent(plan) >= 85) return false;
  return plan.statut === 'actif' || plan.statut === 'complete';
}
