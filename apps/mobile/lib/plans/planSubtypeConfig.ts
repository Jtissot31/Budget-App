import type { PlanSubtype } from './Plan';
import { PLAN_RECOMMENDATION_RULES } from './planRecommendationRules';
import { PLAN_SUBTYPE_DESCRIPTIONS } from './planCatalogData';

export type PlanSituationId =
  | 'securite_financiere'
  | 'devenir_proprietaire'
  | 'experiences_evenements'
  | 'sortir_dettes'
  | 'fructifier_argent'
  | 'controler_budget'
  | 'travailleur_autonome'
  | 'controler_depenses';

export type PlanSituation = {
  id: PlanSituationId;
  label: string;
  subtypes: readonly PlanSubtype[];
};

export const PLAN_SITUATIONS: readonly PlanSituation[] = [
  {
    id: 'securite_financiere',
    label: 'Te sentir en sécurité financière',
    subtypes: ['fonds_urgence', 'fonds_assurance', 'revue_protection'],
  },
  {
    id: 'devenir_proprietaire',
    label: 'Devenir propriétaire',
    subtypes: ['mise_de_fonds', 'celiapp'],
  },
  {
    id: 'experiences_evenements',
    label: 'Vivre une expérience ou un événement',
    subtypes: ['voyage', 'evenement_vie', 'coussin_saisonnier', 'achat_majeur'],
  },
  {
    id: 'sortir_dettes',
    label: 'Te sortir de tes dettes',
    subtypes: ['dette_individuelle', 'snowball', 'avalanche', 'consolidation', 'marge_credit'],
  },
  {
    id: 'fructifier_argent',
    label: 'Faire fructifier ton argent',
    subtypes: ['reer', 'celi', 'reee', 'rattrapage_cotisation'],
  },
  {
    id: 'controler_budget',
    label: 'Mieux contrôler ton budget',
    subtypes: ['enveloppe', 'zero_based', 'ratio_fixe_variable'],
  },
  {
    id: 'travailleur_autonome',
    label: 'Gérer ton statut de travailleur autonome',
    subtypes: ['reserve_impots_autonome', 'acomptes_provisionnels', 'optimisation_reer_celi'],
  },
  {
    id: 'controler_depenses',
    label: 'Reprendre le contrôle de tes dépenses',
    subtypes: ['reduction_abonnements', 'no_spend_challenge', 'sortie_categorie_derapage'],
  },
] as const;

/** Situation de vie par sous-type — distinct de la catégorie technique. */
export const PLAN_SUBTYPE_SITUATIONS: Record<PlanSubtype, PlanSituationId> = Object.fromEntries(
  PLAN_SITUATIONS.flatMap((situation) =>
    situation.subtypes.map((subtype) => [subtype, situation.id]),
  ),
) as Record<PlanSubtype, PlanSituationId>;

export type PlanSubtypeConfig = {
  subtype: PlanSubtype;
  situation: PlanSituationId;
  shortDescription: string;
  fullDescription: string;
  strategy: string;
  impactBullets: readonly string[];
};

const DEFAULT_IMPACT: readonly string[] = [
  'Structure tes finances avec un objectif clair.',
  'Réduit le stress lié aux imprévus.',
  'Facilite le suivi de ta progression.',
];

function ruleStrategy(subtype: PlanSubtype): string | undefined {
  return PLAN_RECOMMENDATION_RULES.find((rule) => rule.subtype === subtype)?.description;
}

function buildConfig(
  subtype: PlanSubtype,
  fullDescription: string,
  strategy: string,
  impactBullets: readonly string[] = DEFAULT_IMPACT,
): PlanSubtypeConfig {
  return {
    subtype,
    situation: PLAN_SUBTYPE_SITUATIONS[subtype],
    shortDescription: PLAN_SUBTYPE_DESCRIPTIONS[subtype],
    fullDescription,
    strategy: ruleStrategy(subtype) ?? strategy,
    impactBullets,
  };
}

export const PLAN_SUBTYPE_CONFIGS: Record<PlanSubtype, PlanSubtypeConfig> = {
  fonds_urgence: buildConfig(
    'fonds_urgence',
    'Constitue une réserve liquide pour absorber les imprévus sans recourir au crédit. Trois mois de dépenses essentielles est la cible recommandée pour la plupart des ménages.',
    'Versements automatiques vers un compte séparé jusqu’à atteindre la cible.',
    ['Couvre les urgences sans dette.', 'Stabilise ton budget mensuel.', 'Libère de la marge pour investir ensuite.'],
  ),
  mise_de_fonds: buildConfig(
    'mise_de_fonds',
    'Épargne progressivement pour une mise de fonds immobilière. Un plan structuré t’aide à atteindre le seuil requis sans sacrifier ta stabilité financière.',
    'Cotisations régulières alignées sur ta date d’achat visée.',
    ['Accélère ton accès à la propriété.', 'Évite les décisions impulsives.', 'Clarifie combien épargner chaque mois.'],
  ),
  voyage: buildConfig(
    'voyage',
    'Met de côté un montant dédié pour un voyage sans l’imputer sur ton budget courant. Tu voyages sans culpabilité ni dette au retour.',
    'Épargne par versements fixes jusqu’à la date de départ.',
    ['Finance le voyage en avance.', 'Évite le solde de carte au retour.', 'Rend l’objectif concret et motivant.'],
  ),
  achat_majeur: buildConfig(
    'achat_majeur',
    'Prépare un achat important (auto, rénovation, équipement) avec une cible chiffrée et une cadence réaliste.',
    'Épargne ciblée avant l’achat plutôt qu’un financement coûteux.',
    ['Réduit les intérêts sur financement.', 'Donne le temps de comparer les options.', 'Évite les achats impulsifs.'],
  ),
  coussin_saisonnier: buildConfig(
    'coussin_saisonnier',
    'Anticipe les dépenses récurrentes mais saisonnières (fêtes, impôts municipaux, rentrée scolaire) pour lisser ton budget sur l’année.',
    'Mise de côté mensuelle proportionnelle aux dépenses saisonnières connues.',
    ['Évite les creux de trésorerie.', 'Lisse les pics de dépenses.', 'Réduit le stress en fin d’année.'],
  ),
  evenement_vie: buildConfig(
    'evenement_vie',
    'Prépare financièrement un événement de vie majeur (mariage, naissance, déménagement) sans compromettre tes autres priorités.',
    'Plan par jalons avec montants intermédiaires.',
    ['Garde le contrôle des coûts.', 'Coordonne épargne et échéances.', 'Évite l’endettement lié à l’événement.'],
  ),
  dette_individuelle: buildConfig(
    'dette_individuelle',
    'Rembourse une dette précise avec un calendrier et une cadence de paiement supplémentaire.',
    'Paiements accélérés au-delà du minimum requis.',
    ['Réduit le total d’intérêts payés.', 'Donne une date de fin claire.', 'Libère de la capacité d’épargne ensuite.'],
  ),
  snowball: buildConfig(
    'snowball',
    'Élimine tes dettes en commençant par les plus petits soldes pour libérer rapidement des paiements minimums et créer de l’élan.',
    'Minimum sur toutes les dettes, surplus sur la plus petite.',
    ['Victoires rapides qui motivent.', 'Simplifie le nombre de créanciers.', 'Libère des flux mensuels.'],
  ),
  avalanche: buildConfig(
    'avalanche',
    'Priorise les dettes au taux d’intérêt le plus élevé pour minimiser le coût total du remboursement.',
    'Surplus dirigé vers la dette la plus coûteuse en intérêts.',
    ['Minimise les intérêts totaux.', 'Approche mathématiquement optimale.', 'Accélère la liberté financière.'],
  ),
  consolidation: buildConfig(
    'consolidation',
    'Regroupe plusieurs dettes en un seul prêt pour simplifier les paiements et potentiellement réduire le taux global.',
    'Évaluation puis remboursement unifié avec un calendrier unique.',
    ['Un seul paiement à gérer.', 'Peut réduire le taux effectif.', 'Clarifie ta situation de dette.'],
  ),
  marge_credit: buildConfig(
    'marge_credit',
    'Réduis l’utilisation de ta marge de crédit sous un seuil sain pour améliorer ton profil financier et réduire les intérêts.',
    'Remboursements ciblés jusqu’à un ratio d’utilisation défini.',
    ['Baisse les intérêts variables.', 'Améliore ta flexibilité.', 'Réduit le risque de dépassement.'],
  ),
  reer: buildConfig(
    'reer',
    'Cotise au REER de façon structurée pour combiner épargne retraite et avantage fiscal selon ton espace disponible.',
    'Cotisations périodiques alignées sur tes droits de déduction.',
    ['Réduit l’impôt à court terme.', 'Construit la retraite.', 'Discipline d’épargne automatique.'],
  ),
  celi: buildConfig(
    'celi',
    'Maximise ton épargne libre d’impôt à court et moyen terme avec des cotisations régulières au CELI.',
    'Versements automatiques selon l’espace CELI disponible.',
    ['Croissance libre d’impôt.', 'Flexibilité de retrait.', 'Idéal pour objectifs à 3–7 ans.'],
  ),
  reee: buildConfig(
    'reee',
    'Épargne pour les études d’un enfant avec les subventions gouvernementales du REEE.',
    'Cotisations pour maximiser les bonifications gouvernementales.',
    ['Subventions gouvernementales incluses.', 'Croissance à long terme.', 'Prépare les études sans stress.'],
  ),
  celiapp: buildConfig(
    'celiapp',
    'Utilise le CELIAPP pour accélérer une première mise de fonds immobilière avec un avantage fiscal dédié.',
    'Épargne mensuelle vers le plafond CELIAPP.',
    ['Avantage fiscal pour la propriété.', 'Complète la mise de fonds.', 'Cadre clair pour premiers acheteurs.'],
  ),
  rattrapage_cotisation: buildConfig(
    'rattrapage_cotisation',
    'Rattrape des années de cotisations manquées au REER ou CELI pour combler l’écart avec tes objectifs.',
    'Plan de rattrapage étalé sur plusieurs mois.',
    ['Comble l’écart d’épargne passé.', 'Optimise l’espace disponible.', 'Remet la progression sur les rails.'],
  ),
  enveloppe: buildConfig(
    'enveloppe',
    'Alloue un montant fixe par catégorie de dépenses et suis tes enveloppes mensuelles pour éviter les dépassements.',
    'Budget mensuel par catégorie avec suivi en temps réel.',
    ['Limite les dépassements.', 'Rend les choix de dépenses conscients.', 'Clarifie les priorités mensuelles.'],
  ),
  zero_based: buildConfig(
    'zero_based',
    'Assigne chaque dollar de revenu à une catégorie dès le début du mois pour un contrôle maximal.',
    'Budget base zéro recréé chaque période.',
    ['Élimine l’argent « sans destination ».', 'Force les arbitrages conscients.', 'Améliore le taux d’épargne.'],
  ),
  ratio_fixe_variable: buildConfig(
    'ratio_fixe_variable',
    'Sépare dépenses fixes et variables avec un ratio cible pour garder de la marge sur les imprévus.',
    'Suivi du ratio fixe/variable avec alertes.',
    ['Protège la marge de manœuvre.', 'Identifie les dérapages tôt.', 'Structure le budget simplement.'],
  ),
  reserve_impots_autonome: buildConfig(
    'reserve_impots_autonome',
    'Met de côté une portion de chaque paiement pour couvrir les impôts en travail autonome ou revenus variables.',
    'Pourcentage fixe de chaque encaissement vers une réserve dédiée.',
    ['Évite les mauvaises surprises fiscales.', 'Lisse la trésorerie.', 'Sépare revenu net et impôts.'],
  ),
  acomptes_provisionnels: buildConfig(
    'acomptes_provisionnels',
    'Planifie les acomptes provisionnels trimestriels pour rester conforme sans stress de dernière minute.',
    'Calendrier trimestriel avec montants provisionnés.',
    ['Conformité fiscale simplifiée.', 'Paiements étalés.', 'Moins de pénalités et d’intérêts.'],
  ),
  optimisation_reer_celi: buildConfig(
    'optimisation_reer_celi',
    'Optimise la répartition REER/CELI selon ta tranche d’imposition et tes objectifs à court terme.',
    'Stratégie combinée REER + CELI personnalisée.',
    ['Maximise l’avantage fiscal global.', 'Aligne épargne et objectifs.', 'Évite les cotisations mal orientées.'],
  ),
  fonds_assurance: buildConfig(
    'fonds_assurance',
    'Constitue une réserve pour franchises et imprévus non couverts par ton assurance.',
    'Épargne dédiée aux franchises et sinistres.',
    ['Réduit l’impact des sinistres.', 'Évite l’emprunt d’urgence.', 'Complète ta couverture existante.'],
  ),
  revue_protection: buildConfig(
    'revue_protection',
    'Évalue et ajuste ta couverture d’assurance et de protection pour coller à ta situation actuelle.',
    'Audit par étapes de tes polices et besoins.',
    ['Couverture alignée sur ta réalité.', 'Évite le sur- ou sous-assurance.', 'Clarifie les lacunes.'],
  ),
  reduction_abonnements: buildConfig(
    'reduction_abonnements',
    'Passe en revue et coupe les abonnements peu utilisés pour libérer du flux mensuel.',
    'Audit puis annulation progressive des abonnements non essentiels.',
    ['Libère 50–150 $/mois typiquement.', 'Réduit la fuite financière.', 'Simplifie tes paiements récurrents.'],
  ),
  no_spend_challenge: buildConfig(
    'no_spend_challenge',
    'Limite les dépenses discrétionnaires sur une période ciblée pour casser une tendance à la hausse.',
    'Défi no-spend de 30 jours avec règles claires.',
    ['Casse les habitudes de dépense.', 'Crée une prise de conscience.', 'Redonne de la marge rapidement.'],
  ),
  sortie_categorie_derapage: buildConfig(
    'sortie_categorie_derapage',
    'Reprend le contrôle d’une catégorie de dépenses qui dépasse systématiquement son budget.',
    'Plafond temporaire et suivi hebdomadaire de la catégorie.',
    ['Stoppe le dérapage rapidement.', 'Identifie les déclencheurs.', 'Rétablit l’équilibre du budget.'],
  ),
};

export function getPlanSubtypeConfig(subtype: PlanSubtype): PlanSubtypeConfig {
  return PLAN_SUBTYPE_CONFIGS[subtype];
}

export function getSituationForSubtype(subtype: PlanSubtype): PlanSituation {
  const situationId = PLAN_SUBTYPE_SITUATIONS[subtype];
  return PLAN_SITUATIONS.find((s) => s.id === situationId)!;
}
