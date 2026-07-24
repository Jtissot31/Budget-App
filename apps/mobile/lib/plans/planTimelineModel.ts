import type { PlanFinancier } from '@/lib/dashboardPlansMock';
import { planActiveStepIndex } from '@/lib/dashboardPlanPresentation';
import type { PlanSubtype } from '@/lib/plans/Plan';
import { planCategoryForSubtype } from '@/lib/plans/Plan';
import { getPlanSubtypeConfig } from '@/lib/plans/planSubtypeConfig';

export type PlanTimelineStepStatus = 'completed' | 'active' | 'upcoming';

export type PlanTimelineStep = {
  id: string;
  title: string;
  /** Brief line under the title (upcoming / completed context). */
  summary?: string;
  /** Expanded explanation — shown on the active step. */
  detail?: string;
  /** Date / objective line, e.g. "Terminé en nov. 2025" or "Objectif : janv. 2027". */
  dateLabel?: string;
  status: PlanTimelineStepStatus;
};

export type PlanTimelineStepSeed = {
  title: string;
  summary?: string;
};

/** Maps an in-progress plan's steps into the shared timeline model. */
export function timelineStepsFromPlan(plan: PlanFinancier): PlanTimelineStep[] {
  const activeIndex = planActiveStepIndex(plan);

  return plan.steps.map((step, index) => {
    const isActive = !step.completed && index === activeIndex;
    const status: PlanTimelineStepStatus = step.completed
      ? 'completed'
      : isActive
        ? 'active'
        : 'upcoming';

    const detail = isActive ? plan.nextAction.description : undefined;
    const summary =
      isActive && detail && step.description === detail ? undefined : step.description;

    return {
      id: step.id,
      title: step.label,
      summary,
      detail,
      dateLabel: step.dueLabel,
      status,
    };
  });
}

type RoadmapSeed = {
  title: string;
  summary: string;
};

const STRATEGY_ROADMAPS: Partial<Record<PlanSubtype, readonly RoadmapSeed[]>> = {
  avalanche: [
    {
      title: 'Classer les dettes par taux',
      summary: 'Du taux d’intérêt le plus élevé au plus bas, peu importe le solde.',
    },
    {
      title: 'Payer les minimums partout',
      summary: 'Sauf sur la dette au taux le plus élevé — celle-là reçoit le surplus.',
    },
    {
      title: 'Attaquer la dette la plus coûteuse',
      summary: 'Tout le surplus va sur le taux le plus élevé jusqu’à 0 $.',
    },
    {
      title: 'Enchaîner jusqu’à zéro dette',
      summary: 'Passe au taux suivant et répète jusqu’à ce que tout soit payé.',
    },
  ],
  snowball: [
    {
      title: 'Classer les dettes par solde',
      summary: 'De la plus petite à la plus grande, peu importe le taux.',
    },
    {
      title: 'Payer les minimums partout',
      summary: 'Sauf sur la plus petite dette — celle-là reçoit le surplus.',
    },
    {
      title: 'Éliminer la plus petite dette',
      summary: 'Tout le surplus jusqu’à remboursement complet pour une victoire rapide.',
    },
    {
      title: 'Rouler le paiement suivant',
      summary: 'Ajoute le minimum libéré à la prochaine plus petite dette.',
    },
  ],
  fonds_urgence: [
    {
      title: 'Fixer la cible de couverture',
      summary: 'Typiquement 3 mois de dépenses essentielles.',
    },
    {
      title: 'Ouvrir un compte séparé',
      summary: 'Épargne liquide, accessible, distincte du courant.',
    },
    {
      title: 'Automatiser les versements',
      summary: 'Cadence hebdo ou mensuelle jusqu’à la cible.',
    },
    {
      title: 'Atteindre la réserve complète',
      summary: 'Puis réorienter le surplus vers d’autres objectifs.',
    },
  ],
  mise_de_fonds: [
    { title: 'Estimer la mise de fonds', summary: 'Pourcentage et montant selon le prix cible.' },
    { title: 'Choisir le véhicule', summary: 'CELIAPP, CELI ou compte dédié selon ton échéance.' },
    { title: 'Fixer la cadence', summary: 'Montant par paie aligné sur la date d’achat visée.' },
    { title: 'Atteindre le seuil', summary: 'Réviser le plan si le marché ou le prix change.' },
  ],
  voyage: [
    { title: 'Budgéter le voyage', summary: 'Transport, hébergement, activités et marge.' },
    { title: 'Ouvrir une enveloppe dédiée', summary: 'Épargne isolée du budget courant.' },
    { title: 'Verser chaque mois', summary: 'Cadence jusqu’à la date de départ.' },
    { title: 'Partir sans dette', summary: 'Objectif atteint avant le départ.' },
  ],
  achat_majeur: [
    { title: 'Définir le montant', summary: 'Prix cible + marge pour imprévus.' },
    { title: 'Comparer cash vs financement', summary: 'Évite un crédit coûteux si possible.' },
    { title: 'Épargner selon le calendrier', summary: 'Versements jusqu’à l’achat.' },
    { title: 'Acheter au comptant', summary: 'Ou minimiser le financement restant.' },
  ],
  coussin_saisonnier: [
    { title: 'Lister les pics saisonniers', summary: 'Fêtes, impôts, rentrée, assurances…' },
    { title: 'Répartir sur 12 mois', summary: 'Montant mensuel = total annuel ÷ 12.' },
    { title: 'Alimenter le coussin', summary: 'Virement automatique chaque mois.' },
    { title: 'Dépenser sans creux', summary: 'Payer les pics depuis le coussin, pas à crédit.' },
  ],
  evenement_vie: [
    { title: 'Chiffrer l’événement', summary: 'Budget par poste avec date limite.' },
    { title: 'Découper en jalons', summary: 'Acomptes et échéances intermédiaires.' },
    { title: 'Épargner par étape', summary: 'Cadence alignée sur chaque jalon.' },
    { title: 'Clôturer sans dépassement', summary: 'Réserver une marge pour les imprévus.' },
  ],
  enveloppe: [
    {
      title: 'Définir les enveloppes',
      summary: 'Fixe, variable, loisirs — avec un plafond par catégorie.',
    },
    {
      title: 'Allouer le revenu du mois',
      summary: 'Chaque dollar a une destination avant les dépenses.',
    },
    {
      title: 'Suivre chaque semaine',
      summary: 'Ajuste tôt quand une enveloppe approche de la limite.',
    },
    {
      title: 'Clôturer le mois dans le vert',
      summary: 'Aucune enveloppe dépassée, marge reportée ou épargnée.',
    },
  ],
  zero_based: [
    { title: 'Lister tous les revenus', summary: 'Chaque dollar qui entre ce mois-ci.' },
    { title: 'Assigner chaque dollar', summary: 'Besoins, envies, épargne, dettes.' },
    { title: 'Vivre selon le plan', summary: 'Ajuster dès qu’un poste dérape.' },
    { title: 'Recommencer le mois suivant', summary: 'Budget base zéro à chaque période.' },
  ],
  ratio_fixe_variable: [
    { title: 'Séparer fixe et variable', summary: 'Loyer, assurances vs épicerie, loisirs.' },
    { title: 'Fixer le ratio cible', summary: 'Garder assez de marge sur le variable.' },
    { title: 'Suivre avec alertes', summary: 'Corriger dès que le ratio dérive.' },
    { title: 'Protéger la marge', summary: 'Réduire le variable avant de toucher à l’épargne.' },
  ],
  dette_individuelle: [
    {
      title: 'Choisir la dette cible',
      summary: 'Une dette précise avec solde et taux connus.',
    },
    {
      title: 'Fixer le paiement accéléré',
      summary: 'Au-delà du minimum, cadence réaliste pour toi.',
    },
    {
      title: 'Suivre le solde chaque mois',
      summary: 'Vérifie intérêts évités et date de fin estimée.',
    },
    {
      title: 'Rembourser à 0 $',
      summary: 'Puis redirige le paiement vers épargne ou autre dette.',
    },
  ],
  bombe_nucleaire: [
    { title: 'Identifier la source du capital', summary: 'Bonus, vente d’actif ou épargne excédentaire.' },
    { title: 'Choisir la dette cible', summary: 'La plus coûteuse ou celle qui libère le plus de cashflow.' },
    { title: 'Effectuer le paiement massif', summary: 'Une seule opération pour réduire ou éliminer.' },
    { title: 'Recaler le plan restant', summary: 'Réaffecter les minimums libérés.' },
  ],
  consolidation: [
    { title: 'Inventorier toutes les dettes', summary: 'Soldes, taux et conditions.' },
    { title: 'Comparer les offres', summary: 'Taux, frais et durée du prêt unifié.' },
    { title: 'Regrouper les soldes', summary: 'Un seul paiement mensuel.' },
    { title: 'Suivre le calendrier unique', summary: 'Éviter de recharger les anciennes cartes.' },
  ],
  marge_credit: [
    { title: 'Mesurer l’utilisation actuelle', summary: 'Solde ÷ limite disponible.' },
    { title: 'Fixer un seuil sain', summary: 'Souvent sous 30 % d’utilisation.' },
    { title: 'Rembourser de façon ciblée', summary: 'Surplus mensuel jusqu’au seuil.' },
    { title: 'Maintenir la marge', summary: 'Éviter de réutiliser la limite libérée.' },
  ],
  reer: [
    { title: 'Vérifier l’espace REER', summary: 'Droits de cotisation disponibles.' },
    { title: 'Choisir le montant et la cadence', summary: 'Aligné sur ton taux d’imposition.' },
    { title: 'Automatiser les cotisations', summary: 'Versements périodiques.' },
    { title: 'Réviser à la déclaration', summary: 'Ajuster selon le remboursement d’impôt.' },
  ],
  celi: [
    { title: 'Vérifier l’espace CELI', summary: 'Plafond disponible cette année.' },
    { title: 'Définir l’objectif', summary: 'Horizon 3–7 ans typiquement.' },
    { title: 'Verser régulièrement', summary: 'Automatiser selon l’espace restant.' },
    { title: 'Laisser croître libre d’impôt', summary: 'Éviter les retraits inutiles.' },
  ],
  reee: [
    { title: 'Ouvrir ou vérifier le REEE', summary: 'Bénéficiaire et subventions.' },
    { title: 'Viser les bonifications', summary: 'Cotiser pour maximiser les subventions.' },
    { title: 'Maintenir la cadence', summary: 'Versements jusqu’à la majorité.' },
    { title: 'Planifier les retraits études', summary: 'Quand les études commencent.' },
  ],
  celiapp: [
    { title: 'Confirmer l’admissibilité', summary: 'Premier acheteur et conditions CELIAPP.' },
    { title: 'Fixer la cotisation annuelle', summary: 'Jusqu’au plafond permis.' },
    { title: 'Épargner jusqu’à la mise de fonds', summary: 'Combiner avec autres véhicules si besoin.' },
    { title: 'Retirer pour l’achat', summary: 'Selon les règles du compte.' },
  ],
  rattrapage_cotisation: [
    { title: 'Mesurer l’écart', summary: 'Cotisations manquées vs cible.' },
    { title: 'Étaler le rattrapage', summary: 'Plan sur plusieurs mois réaliste.' },
    { title: 'Exécuter les versements', summary: 'Prioriser REER ou CELI selon le cas.' },
    { title: 'Revenir au rythme de croisière', summary: 'Une fois l’écart comblé.' },
  ],
  reserve_impots_autonome: [
    { title: 'Estimer le taux à mettre de côté', summary: 'Selon ton taux marginal.' },
    { title: 'Séparer à chaque encaissement', summary: 'Pourcentage fixe vers la réserve.' },
    { title: 'Payer les échéances', summary: 'Depuis la réserve, pas le courant.' },
    { title: 'Ajuster après bilan', summary: 'Recaler le % si trop ou trop peu.' },
  ],
  acomptes_provisionnels: [
    { title: 'Lister les échéances', summary: 'Calendrier trimestriel connu.' },
    { title: 'Provisionner chaque mois', summary: '1/3 du prochain acompte.' },
    { title: 'Payer à temps', summary: 'Évite pénalités et intérêts.' },
    { title: 'Réviser les montants', summary: 'Selon les revenus de l’année.' },
  ],
  optimisation_reer_celi: [
    { title: 'Cartographier les espaces', summary: 'REER et CELI disponibles.' },
    { title: 'Choisir la répartition', summary: 'Selon tranche d’impôt et horizon.' },
    { title: 'Exécuter la stratégie', summary: 'Cotisations dans le bon ordre.' },
    { title: 'Réévaluer chaque année', summary: 'Revenus et objectifs évoluent.' },
  ],
  fonds_assurance: [
    { title: 'Lister franchises et lacunes', summary: 'Ce que l’assurance ne couvre pas.' },
    { title: 'Fixer le montant de réserve', summary: 'Somme des franchises + marge.' },
    { title: 'Épargner progressivement', summary: 'Compte liquide dédié.' },
    { title: 'Maintenir le niveau', summary: 'Reconstituer après un sinistre.' },
  ],
  revue_protection: [
    { title: 'Inventorier les polices', summary: 'Vie, invalidité, habitation, auto…' },
    { title: 'Comparer aux besoins actuels', summary: 'Situation familiale et actifs.' },
    { title: 'Ajuster les couvertures', summary: 'Hausse, baisse ou changement.' },
    { title: 'Planifier la prochaine revue', summary: 'Annuellement ou après un événement de vie.' },
  ],
  reduction_abonnements: [
    { title: 'Lister tous les abonnements', summary: 'Cartes, comptes, app stores.' },
    { title: 'Classer utile vs superflu', summary: 'Ce que tu utilises vraiment.' },
    { title: 'Annuler progressivement', summary: 'Commencer par les plus chers / inutilisés.' },
    { title: 'Réaffecter l’argent libéré', summary: 'Vers dettes ou épargne.' },
  ],
  no_spend_challenge: [
    { title: 'Définir les règles', summary: 'Ce qui est interdit vs essentiel.' },
    { title: 'Choisir la durée', summary: 'Souvent 14 ou 30 jours.' },
    { title: 'Suivre chaque jour', summary: 'Noter les tentations et exceptions.' },
    { title: 'Capitaliser l’élan', summary: 'Transformer en habitude durable.' },
  ],
  sortie_categorie_derapage: [
    { title: 'Identifier la catégorie', summary: 'Celle qui dépasse le plus souvent.' },
    { title: 'Fixer un plafond temporaire', summary: 'Plus strict pour 30–60 jours.' },
    { title: 'Suivre chaque semaine', summary: 'Corriger avant la fin du mois.' },
    { title: 'Rétablir le budget normal', summary: 'Une fois le contrôle repris.' },
  ],
};

const CATEGORY_FALLBACK: Record<string, readonly RoadmapSeed[]> = {
  epargne: [
    { title: 'Définir la cible', summary: 'Montant et échéance clairs.' },
    { title: 'Choisir le compte', summary: 'Véhicule adapté à l’horizon.' },
    { title: 'Automatiser les versements', summary: 'Cadence réaliste chaque paie.' },
    { title: 'Atteindre l’objectif', summary: 'Ajuster si la vie change.' },
  ],
  dette: [
    { title: 'Lister dettes et taux', summary: 'Vue complète de ce que tu dois.' },
    { title: 'Choisir la stratégie', summary: 'Avalanche, boule de neige ou autre.' },
    { title: 'Exécuter les paiements', summary: 'Minimums + surplus sur la cible.' },
    { title: 'Enchaîner jusqu’à zéro', summary: 'Libérer chaque dette une à une.' },
  ],
  investissement: [
    { title: 'Clarifier l’horizon', summary: 'Court, moyen ou long terme.' },
    { title: 'Choisir le compte', summary: 'REER, CELI, REEE selon le but.' },
    { title: 'Cotiser régulièrement', summary: 'Discipline avant le timing.' },
    { title: 'Réviser la stratégie', summary: 'Une fois par année.' },
  ],
  budget: [
    { title: 'Structurer le mois', summary: 'Catégories et plafonds.' },
    { title: 'Suivre les dépenses', summary: 'Revue hebdomadaire courte.' },
    { title: 'Corriger les dérapages', summary: 'Avant la fin de période.' },
    { title: 'Clôturer dans le vert', summary: 'Sans dépassement global.' },
  ],
  fiscal: [
    { title: 'Estimer les obligations', summary: 'Impôts et acomptes à venir.' },
    { title: 'Mettre de côté', summary: 'Réserve dédiée à chaque encaissement.' },
    { title: 'Payer aux échéances', summary: 'Sans toucher au budget courant.' },
    { title: 'Ajuster le pourcentage', summary: 'Après chaque bilan.' },
  ],
  risque: [
    { title: 'Cartographier les risques', summary: 'Ce qui pourrait te coûter cher.' },
    { title: 'Combler les lacunes', summary: 'Assurance ou réserve selon le cas.' },
    { title: 'Mettre en place la protection', summary: 'Actions concrètes et suivi.' },
    { title: 'Réviser périodiquement', summary: 'Ta situation évolue.' },
  ],
  comportemental: [
    { title: 'Diagnostiquer le comportement', summary: 'Où l’argent fuit vraiment.' },
    { title: 'Fixer une règle simple', summary: 'Facile à tenir au quotidien.' },
    { title: 'Suivre pendant la période', summary: 'Mesurer sans se juger.' },
    { title: 'Ancrer la nouvelle habitude', summary: 'Transformer le défi en routine.' },
  ],
};

function defaultRoadmapForSubtype(subtype: PlanSubtype): RoadmapSeed[] {
  const categorySeeds = CATEGORY_FALLBACK[planCategoryForSubtype(subtype)];
  if (categorySeeds) return [...categorySeeds];

  const config = getPlanSubtypeConfig(subtype);
  return [
    { title: 'Comprendre l’objectif', summary: config.shortDescription },
    { title: 'Appliquer la stratégie', summary: config.strategy },
    {
      title: 'Suivre les jalons',
      summary: config.impactBullets[0] ?? 'Mesure ta progression régulièrement.',
    },
    {
      title: 'Atteindre le résultat',
      summary: config.impactBullets[1] ?? 'Réoriente ensuite vers le prochain objectif.',
    },
  ];
}

/**
 * Roadmap for explanatory / template plan pages.
 * First step is active (narrative focus); remaining steps are upcoming.
 */
export function timelineStepsForTemplate(
  subtype: PlanSubtype,
  options?: { whyDetail?: string; strategyDetail?: string },
): PlanTimelineStep[] {
  const seeds = STRATEGY_ROADMAPS[subtype] ?? defaultRoadmapForSubtype(subtype);
  const activeDetail =
    options?.strategyDetail?.trim() || options?.whyDetail?.trim() || undefined;

  return seeds.map((seed, index) => {
    const isFirst = index === 0;
    return {
      id: `${subtype}-roadmap-${index + 1}`,
      title: seed.title,
      summary: seed.summary,
      detail: isFirst ? activeDetail || seed.summary : undefined,
      dateLabel: isFirst ? 'Prochaine étape' : undefined,
      status: (isFirst ? 'active' : 'upcoming') as PlanTimelineStepStatus,
    };
  });
}

/** Build timeline steps from strategy copy (strings or titled seeds). */
export function timelineStepsFromStrategyCopy(
  steps: readonly string[] | readonly PlanTimelineStepSeed[],
  options?: { activeDetail?: string },
): PlanTimelineStep[] {
  return steps.map((raw, index) => {
    const isFirst = index === 0;
    const seed: PlanTimelineStepSeed =
      typeof raw === 'string'
        ? { title: shortTitleFromStep(raw, index), summary: raw }
        : raw;

    return {
      id: `strategy-${index + 1}`,
      title: seed.title,
      summary: isFirst ? undefined : seed.summary,
      detail: isFirst ? options?.activeDetail ?? seed.summary ?? seed.title : undefined,
      dateLabel: isFirst ? 'Commence ici' : undefined,
      status: (isFirst ? 'active' : 'upcoming') as PlanTimelineStepStatus,
    };
  });
}

function shortTitleFromStep(text: string, index: number): string {
  const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? text;
  if (firstSentence.length <= 52) return firstSentence;
  return `Étape ${index + 1}`;
}
