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

function canRecommendAcceleratedDebtPlan(ctx: PlanRecommendationContext): boolean {
  return ctx.cashflow_viable_pour_extra_dette;
}

function formatSurplusFr(surplus: number): string {
  const abs = Math.round(Math.abs(surplus)).toLocaleString('fr-CA');
  if (surplus < 0) return `−${abs}`;
  if (surplus > 0) return `+${abs}`;
  return '0';
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
      ctx.droits_cotisation_reer_disponibles > 0 &&
      !ctx.contexte_dette_lourde,
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
      ctx.droits_cotisation_celi_disponibles > 0 &&
      !ctx.objectif_court_terme_actif &&
      !ctx.contexte_dette_lourde,
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
      ctx.epargne_recurrente_detectee &&
      !ctx.contexte_dette_lourde,
    buildRaisonHeuristique: () =>
      'Tu épargnes déjà régulièrement sans être propriétaire — le CELIAPP peut accélérer une mise de fonds avec un avantage fiscal.',
  },
  {
    id: 'rule-snowball',
    subtype: 'snowball',
    category: 'dette',
    priority: 1,
    titre: 'Remboursement boule de neige',
    description:
      'Tu élimines les plus petits soldes en premier ; chaque dette réglée libère son paiement minimum pour la suivante. Moins optimal en intérêts, mais les victoires rapides aident quand la pile semble lourde.',
    signal: 'snowball:plusieurs_dettes_actives',
    defaultMontantCible: null,
    evaluate: (ctx) => canRecommendAcceleratedDebtPlan(ctx) && ctx.nombre_dettes_actives >= 2,
    buildRaisonHeuristique: (ctx) =>
      `${ctx.nombre_dettes_actives} dettes actives — la boule de neige règle les plus petits soldes en premier. Chaque dette éliminée libère son paiement minimum pour la suivante. Moins d'intérêts économisés qu'en avalanche, mais les victoires rapides gardent la motivation.`,
  },
  {
    id: 'rule-avalanche',
    subtype: 'avalanche',
    category: 'dette',
    priority: 1,
    titre: 'Remboursement avalanche',
    description:
      "Tu envoies chaque surplus sur la dette au taux le plus élevé, minimums ailleurs. Tu paies moins d'intérêts au total — idéal si tu tiens sur la durée sans avoir besoin de petites victoires rapides.",
    signal: 'avalanche:plusieurs_dettes_actives',
    defaultMontantCible: null,
    evaluate: (ctx) => canRecommendAcceleratedDebtPlan(ctx) && ctx.nombre_dettes_actives >= 2,
    buildRaisonHeuristique: (ctx) =>
      `${ctx.nombre_dettes_actives} dettes actives — l'avalanche attaque d'abord le taux le plus élevé. Chaque dollar en extra va là où il coûte le plus cher ; tu paies moins d'intérêts qu'avec la boule de neige. Parfait si tu veux optimiser le coût total sans compter sur des victoires rapides.`,
  },
  {
    id: 'rule-bombe-nucleaire',
    subtype: 'bombe_nucleaire',
    category: 'dette',
    priority: 1,
    titre: 'Bombe nucléaire',
    description:
      "Un gros paiement unique sur ta dette la plus chère — bonus, épargne ou vente. Tu coupes des mois d'intérêts d'un coup, à condition de garder une réserve d'urgence derrière.",
    signal: 'bombe_nucleaire:liquidites_disponibles',
    defaultMontantCible: null,
    evaluate: (ctx) =>
      canRecommendAcceleratedDebtPlan(ctx) &&
      ctx.nombre_dettes_actives >= 1 &&
      ctx.liquidites_excedentaires >= Math.max(ctx.depenses_mensuelles * 0.25, 750),
    buildRaisonHeuristique: (ctx) =>
      `Environ ${Math.round(ctx.liquidites_excedentaires).toLocaleString('fr-CA')} $ au-dessus d'un mois de sécurité — assez pour frapper fort. Tu envoies un gros paiement sur ta dette la plus chère et tu coupes des mois d'intérêts d'un coup. À envisager seulement si tu gardes une réserve d'urgence derrière.`,
  },
  {
    id: 'rule-consolidation',
    subtype: 'consolidation',
    category: 'dette',
    priority: 1,
    titre: 'Consolidation de dettes',
    description:
      "Regrouper plusieurs dettes en un seul prêt à taux plus bas. Un paiement mensuel, moins de risque d'oubli — vérifie que les frais et le nouveau taux valent le coup.",
    signal: 'consolidation:plusieurs_dettes_actives',
    defaultMontantCible: null,
    evaluate: (ctx) => canRecommendAcceleratedDebtPlan(ctx) && ctx.nombre_dettes_actives >= 3,
    buildRaisonHeuristique: (ctx) =>
      `${ctx.nombre_dettes_actives} paiements différents, c'est lourd à gérer. La consolidation regroupe tout en un prêt unique, souvent à taux plus bas. Un seul paiement mensuel, moins de risque d'oubli — vérifie que les frais et le nouveau taux valent vraiment le coup.`,
  },
  {
    id: 'rule-dette-individuelle',
    subtype: 'dette_individuelle',
    category: 'dette',
    priority: 1,
    titre: 'Dette individuelle',
    description:
      'Un seul prêt à rembourser — pas besoin de choisir entre stratégies. Tu fixes un surplus mensuel au-dessus du minimum et un échéancier clair vers la date de liberté.',
    signal: 'dette_individuelle:dette_unique',
    defaultMontantCible: null,
    evaluate: (ctx) => canRecommendAcceleratedDebtPlan(ctx) && ctx.nombre_dettes_actives === 1,
    buildRaisonHeuristique: (ctx) =>
      `Une seule dette de ${Math.round(ctx.dette_totale).toLocaleString('fr-CA')} $ — pas besoin de choisir entre avalanche et boule de neige. Tu fixes un montant mensuel au-dessus du minimum et un échéancier clair. Chaque surplus accélère directement ta date de liberté.`,
  },
  {
    id: 'rule-marge-credit',
    subtype: 'marge_credit',
    category: 'dette',
    priority: 2,
    titre: 'Marge de crédit',
    description:
      'Ta marge utilisée coûte cher en intérêts variables. Tu la rembourses en priorité sous un seuil sain — ça libère de la flexibilité pour les vrais imprévus.',
    signal: 'marge_credit:marge_utilisee',
    defaultMontantCible: null,
    evaluate: (ctx) => canRecommendAcceleratedDebtPlan(ctx) && ctx.a_marge_credit_active,
    buildRaisonHeuristique: () =>
      "Ta marge de crédit reste utilisée — les intérêts variables grignotent ton cashflow. Tu la rembourses en priorité sous un seuil sain (ex. 30 %). Ça libère de la capacité d'emprunt pour les imprévus sans retomber sur le crédit.",
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
    priority: 1,
    titre: 'Budget par enveloppes',
    description: 'Reprendre le contrôle des catégories qui dépassent.',
    signal: 'enveloppe:categories_depassees_consecutives',
    defaultMontantCible: null,
    evaluate: (ctx) =>
      !ctx.cashflow_viable_pour_extra_dette || ctx.categorie_depassee_mois_consecutifs >= 2,
    buildRaisonHeuristique: (ctx) =>
      !ctx.cashflow_viable_pour_extra_dette
        ? `Tes dépenses (${Math.round(ctx.depenses_mensuelles).toLocaleString('fr-CA')} $/mois) dépassent ou serrent tes revenus (${Math.round(ctx.revenu_mensuel_net).toLocaleString('fr-CA')} $/mois) — surplus d’environ ${formatSurplusFr(ctx.surplus_mensuel)} $/mois. Des enveloppes aident à couper là où ça compte avant d’accélérer les dettes.`
        : `${ctx.categorie_depassee_mois_consecutifs} catégories dépassent leur limite — des enveloppes mensuelles clarifient où couper sans surprise.`,
  },
  {
    id: 'rule-no-spend',
    subtype: 'no_spend_challenge',
    category: 'comportemental',
    priority: 2,
    titre: 'Défi no-spend',
    description: 'Réduire les dépenses discrétionnaires sur une période ciblée.',
    signal: 'no_spend_challenge:depenses_discretionnaires_hausse',
    defaultMontantCible: null,
    evaluate: (ctx) =>
      !ctx.cashflow_viable_pour_extra_dette ||
      (ctx.depense_discretionnaire_tendance === 'hausse' && ctx.mois_consecutifs_depense_hausse >= 3),
    buildRaisonHeuristique: (ctx) =>
      !ctx.cashflow_viable_pour_extra_dette
        ? `Sans marge mensuelle (surplus ~${formatSurplusFr(ctx.surplus_mensuel)} $/mois), un défi no-spend de 30 jours peut libérer de l’oxygène avant tout plan de remboursement accéléré.`
        : 'Tes dépenses discrétionnaires augmentent depuis plusieurs mois — un défi no-spend de 30 jours peut casser la tendance.',
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
    evaluate: (ctx) =>
      ctx.nombre_abonnements_recurrents >= 3 &&
      (!ctx.cashflow_viable_pour_extra_dette ||
        (ctx.nombre_abonnements_recurrents >= 5 && !ctx.contexte_dette_lourde)),
    buildRaisonHeuristique: (ctx) =>
      !ctx.cashflow_viable_pour_extra_dette
        ? `${ctx.nombre_abonnements_recurrents} abonnements détectés — les couper peut rétablir un surplus avant d’accélérer le remboursement des dettes.`
        : `${ctx.nombre_abonnements_recurrents} abonnements détectés — une revue ciblée libère souvent 50–150 $/mois sans effort majeur.`,
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
