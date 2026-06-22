import type { PlanCategory, PlanSignalDeclencheur, PlanSubtype } from './Plan';
import type { PlanRecommendationContext } from './buildPlanRecommendationContext';

export type PlanRecommendationRule = {
  id: string;
  subtype: PlanSubtype;
  category: PlanCategory;
  priority: 1 | 2 | 3;
  titre: string;
  description: string;
  signal: PlanSignalDeclencheur;
  defaultMontantCible: number | null;
  evaluate: (ctx: PlanRecommendationContext) => boolean;
  buildRaisonHeuristique: (ctx: PlanRecommendationContext) => string;
};

function monthsExpensesTarget(ctx: PlanRecommendationContext, months: number): number {
  return Math.round(ctx.depenses_mensuelles * months);
}

export const PLAN_RECOMMENDATION_RULES: readonly PlanRecommendationRule[] = [
  {
    id: 'rule-fonds-urgence',
    subtype: 'fonds_urgence',
    category: 'epargne',
    priority: 1,
    titre: "Fonds d'urgence",
    description: 'Constituer une réserve de liquidités pour couvrir les imprévus.',
    signal: 'fonds_urgence:couverture_moins_3_mois',
    defaultMontantCible: null,
    evaluate: (ctx) => ctx.couverture_mois < 3 && !ctx.plan_epargne_actif,
    buildRaisonHeuristique: (ctx) =>
      `Tu as environ ${ctx.couverture_mois.toFixed(1)} mois de dépenses en liquidités — en dessous des 3 mois recommandés. Un fonds d'urgence te protège sans recourir au crédit.`,
  },
  {
    id: 'rule-reer',
    subtype: 'reer',
    category: 'investissement',
    priority: 2,
    titre: 'Cotisation REER',
    description: 'Optimiser la déduction fiscale avec de l’espace de cotisation disponible.',
    signal: 'reer:revenu_stable_tranche_moyenne_droits_disponibles',
    defaultMontantCible: null,
    evaluate: (ctx) =>
      ctx.revenu_stable &&
      (ctx.tranche_imposition === 'moyenne' || ctx.tranche_imposition === 'haute') &&
      ctx.droits_cotisation_reer_disponibles > 0,
    buildRaisonHeuristique: (ctx) =>
      `Avec un revenu stable et environ ${ctx.droits_cotisation_reer_disponibles.toLocaleString('fr-CA')} $ de droits REER estimés, une cotisation structurée peut réduire ton impôt tout en épargnant.`,
  },
  {
    id: 'rule-celi',
    subtype: 'celi',
    category: 'investissement',
    priority: 2,
    titre: 'Cotisation CELI',
    description: 'Utiliser l’espace CELI disponible pour l’épargne flexible.',
    signal: 'celi:droits_disponibles_sans_objectif_court_terme',
    defaultMontantCible: null,
    evaluate: (ctx) =>
      ctx.droits_cotisation_celi_disponibles > 0 && !ctx.objectif_court_terme_actif,
    buildRaisonHeuristique: (ctx) =>
      `Tu as de l'espace CELI estimé à ${ctx.droits_cotisation_celi_disponibles.toLocaleString('fr-CA')} $ sans objectif court terme en cours — bon moment pour automatiser une cotisation.`,
  },
  {
    id: 'rule-celiapp',
    subtype: 'celiapp',
    category: 'investissement',
    priority: 3,
    titre: 'CELIAPP',
    description: 'Épargner pour une première propriété avec l’avantage CELIAPP.',
    signal: 'celiapp:locataire_jeune_epargne_recurrente',
    defaultMontantCible: null,
    evaluate: (ctx) =>
      !ctx.est_proprietaire &&
      ctx.age !== null &&
      ctx.age < 40 &&
      ctx.epargne_recurrente_detectee,
    buildRaisonHeuristique: () =>
      'Tu épargnes déjà régulièrement sans être propriétaire — le CELIAPP peut accélérer une mise de fonds avec un avantage fiscal.',
  },
  {
    id: 'rule-snowball',
    subtype: 'snowball',
    category: 'dette',
    priority: 1,
    titre: 'Remboursement boule de neige',
    description: 'Éliminer les dettes en commençant par les plus petits soldes.',
    signal: 'snowball:plusieurs_dettes_actives',
    defaultMontantCible: null,
    evaluate: (ctx) => ctx.nombre_dettes_actives >= 2,
    buildRaisonHeuristique: (ctx) =>
      `${ctx.nombre_dettes_actives} dettes actives — la méthode boule de neige libère rapidement des paiements minimums en éliminant les petits soldes en premier.`,
  },
  {
    id: 'rule-avalanche',
    subtype: 'avalanche',
    category: 'dette',
    priority: 1,
    titre: 'Remboursement avalanche',
    description: 'Prioriser les dettes au taux d’intérêt le plus élevé.',
    signal: 'avalanche:plusieurs_dettes_actives',
    defaultMontantCible: null,
    evaluate: (ctx) => ctx.nombre_dettes_actives >= 2,
    buildRaisonHeuristique: (ctx) =>
      `${ctx.nombre_dettes_actives} dettes actives — l'avalanche cible d'abord les taux les plus élevés pour payer moins d'intérêts au total.`,
  },
  {
    id: 'rule-reserve-impots',
    subtype: 'reserve_impots_autonome',
    category: 'fiscal',
    priority: 1,
    titre: 'Réserve impôts autonome',
    description: 'Mettre de côté les taxes sur revenus variables.',
    signal: 'reserve_impots_autonome:travailleur_autonome',
    defaultMontantCible: null,
    evaluate: (ctx) => ctx.revenu_travailleur_autonome_detecte,
    buildRaisonHeuristique: (ctx) =>
      `Avec un profil de revenus variables, une réserve d'environ ${Math.round(ctx.revenu_mensuel_net * 0.25).toLocaleString('fr-CA')} $/mois évite les surprises fiscales.`,
  },
  {
    id: 'rule-enveloppe',
    subtype: 'enveloppe',
    category: 'budget',
    priority: 2,
    titre: 'Budget par enveloppes',
    description: 'Reprendre le contrôle des catégories qui dépassent.',
    signal: 'enveloppe:categories_depassees_consecutives',
    defaultMontantCible: null,
    evaluate: (ctx) => ctx.categorie_depassee_mois_consecutifs >= 2,
    buildRaisonHeuristique: (ctx) =>
      `${ctx.categorie_depassee_mois_consecutifs} catégories dépassent leur limite — des enveloppes mensuelles clarifient où couper sans surprise.`,
  },
  {
    id: 'rule-no-spend',
    subtype: 'no_spend_challenge',
    category: 'comportemental',
    priority: 3,
    titre: 'Défi no-spend',
    description: 'Réduire les dépenses discrétionnaires sur une période ciblée.',
    signal: 'no_spend_challenge:depenses_discretionnaires_hausse',
    defaultMontantCible: null,
    evaluate: (ctx) =>
      ctx.depense_discretionnaire_tendance === 'hausse' && ctx.mois_consecutifs_depense_hausse >= 3,
    buildRaisonHeuristique: () =>
      'Tes dépenses discrétionnaires augmentent depuis plusieurs mois — un défi no-spend de 30 jours peut casser la tendance.',
  },
  {
    id: 'rule-abonnements',
    subtype: 'reduction_abonnements',
    category: 'comportemental',
    priority: 2,
    titre: 'Réduction abonnements',
    description: 'Passer en revue et couper les abonnements peu utilisés.',
    signal: 'reduction_abonnements:abonnements_nombreux',
    defaultMontantCible: null,
    evaluate: (ctx) => ctx.nombre_abonnements_recurrents >= 5,
    buildRaisonHeuristique: (ctx) =>
      `${ctx.nombre_abonnements_recurrents} abonnements détectés — une revue ciblée libère souvent 50–150 $/mois sans effort majeur.`,
  },
] as const;

export function resolveDefaultMontantCible(
  rule: PlanRecommendationRule,
  ctx: PlanRecommendationContext,
): number | null {
  if (rule.defaultMontantCible !== null) return rule.defaultMontantCible;
  switch (rule.subtype) {
    case 'fonds_urgence':
      return monthsExpensesTarget(ctx, 3);
    case 'reserve_impots_autonome':
      return Math.round(ctx.revenu_mensuel_net * 3);
    case 'reer':
    case 'celi':
      return Math.min(500 * 12, ctx.droits_cotisation_celi_disponibles);
    default:
      return null;
  }
}
