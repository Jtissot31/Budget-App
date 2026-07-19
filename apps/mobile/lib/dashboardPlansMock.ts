import { MaterialCommunityIcons } from '@expo/vector-icons';

// TODO: brancher sur vraies données plans (RfaActivePlan / table SQLite dédiée — voir lib/ai/types.ts)

export type DashboardPlanMetricTone = 'default' | 'positive' | 'warning' | 'danger';

export type DashboardPlanMetric = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: DashboardPlanMetricTone;
};

export type DashboardPlanStep = {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
  dueLabel?: string;
};

export type DashboardPlanDetail = {
  id: string;
  name: string;
  category: string;
  status: string;
  statusTone: 'positive' | 'warning';
  progress: number;
  progressPositive: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  currentAmount: number;
  targetAmount: number;
  /** Ligne hero spécifique au type — remplace le format montant générique si présent. */
  heroPrimary?: string;
  /** Ligne secondaire hero spécifique au type. */
  heroSecondary?: string;
  /** Résumé en une phrase — visible sur liste et détail */
  summary: string;
  strategy: {
    name: string;
    description: string;
  };
  startedAtLabel: string;
  targetDateLabel: string;
  estimatedCompletionLabel: string;
  contributionLabel: string;
  linkedAccountLabel?: string;
  nextAction: {
    title: string;
    description: string;
  };
  metrics: DashboardPlanMetric[];
  /** TODO: brancher sur génération IA réelle du rationale */
  rationale: string;
  impactBullets?: string[];
  steps: DashboardPlanStep[];
};

/** Alias produit — plan financier (≠ objectifs gamifiés). */
export type PlanFinancier = DashboardPlanDetail;

export const MOCK_DASHBOARD_PLANS: DashboardPlanDetail[] = [
  {
    id: 'mock-fonds-urgence',
    name: "Fonds d'urgence",
    category: 'Épargne',
    status: 'Actif',
    statusTone: 'positive',
    progress: 62,
    progressPositive: true,
    icon: 'shield-check-outline',
    currentAmount: 6_200,
    targetAmount: 10_000,
    summary: '3 mois de dépenses en réserve.',
    strategy: {
      name: 'Épargne automatique',
      description: '150 $ par semaine, compte séparé.',
    },
    startedAtLabel: 'Janvier 2026',
    targetDateLabel: 'Octobre 2026',
    estimatedCompletionLabel: 'Fin oct. 2026',
    contributionLabel: '150 $ / semaine',
    linkedAccountLabel: 'Épargne · Desjardins · 4521',
    nextAction: {
      title: 'Automatiser le virement',
      description: 'Encore 1 300 $ pour atteindre 75 %.',
    },
    metrics: [
      { id: 'remaining', label: 'Reste à épargner', value: '3 800 $', tone: 'default' },
      { id: 'cadence', label: 'Cadence', value: '150 $/sem.', hint: 'Virement auto', tone: 'positive' },
      { id: 'runway', label: 'Couverture actuelle', value: '~1,9 mois', hint: 'Dépenses essentielles', tone: 'default' },
      { id: 'eta', label: 'Objectif estimé', value: 'Oct. 2026', tone: 'positive' },
    ],
    rationale: 'Plus de la moitié atteinte. À ce rythme, 3 mois de couverture d’ici l’automne.',
    impactBullets: ['Évite le crédit en cas d’imprévu', 'Couvre ~1,9 mois aujourd’hui'],
    steps: [
      {
        id: '1',
        label: 'Fixer la cible',
        completed: true,
        dueLabel: 'Janv. 2026',
      },
      {
        id: '2',
        label: 'Automatiser le virement',
        completed: true,
        dueLabel: 'Fév. 2026',
      },
      {
        id: '3',
        label: 'Atteindre 75 %',
        completed: false,
        dueLabel: 'Mi-août 2026',
      },
      {
        id: '4',
        label: 'Atteindre 10 000 $',
        completed: false,
        dueLabel: 'Oct. 2026',
      },
    ],
  },
  {
    id: 'mock-dettes',
    name: 'Remboursement dettes',
    category: 'Dette',
    status: 'En cours',
    statusTone: 'positive',
    progress: 34,
    progressPositive: true,
    icon: 'credit-card-outline',
    currentAmount: 4_300,
    targetAmount: 12_700,
    summary: 'Éliminer 12 700 $ de dettes à intérêt en priorisant les soldes les plus coûteux.',
    strategy: {
      name: 'Méthode avalanche',
      description:
        'Rembourser d’abord la dette au taux le plus élevé (Visa 19,99 %), tout en payant le minimum sur les autres. Minimise le total d’intérêts payés.',
    },
    startedAtLabel: 'Novembre 2025',
    targetDateLabel: 'Mars 2028',
    estimatedCompletionLabel: 'D’ici mars 2028',
    contributionLabel: '420 $ / mois',
    linkedAccountLabel: 'Visa · 4782 (prioritaire)',
    nextAction: {
      title: 'Verser 420 $ sur la Visa · 4782',
      description:
        'C’est la dette au taux le plus élevé (19,99 %). Ce paiement réduira le solde de ~420 $ et économisera ~70 $ d’intérêts sur les 12 prochains mois.',
    },
    metrics: [
      { id: 'remaining', label: 'Solde restant', value: '8 400 $', tone: 'warning' },
      { id: 'cadence', label: 'Paiement cible', value: '420 $/mois', tone: 'default' },
      { id: 'interest', label: 'Intérêts évités', value: '~840 $/an', hint: 'Vs. minimum seul', tone: 'positive' },
      { id: 'eta', label: 'Libération estimée', value: 'Mars 2028', tone: 'default' },
    ],
    rationale:
      'La méthode avalanche réduit le total des intérêts payés. Priorise la carte au taux le plus élevé tout en gardant les minimums sur les autres dettes. À ce rythme, tu seras libre de dettes consommatrices en ~26 mois.',
    impactBullets: [
      'Visa · 4782 : 4 300 $ restants à 19,99 % — priorité #1',
      'Prêt auto : 4 100 $ à 6,9 % — minimum seulement pour l’instant',
      '420 $/mois = ~840 $ d’intérêts économisés par an vs. payer le minimum',
    ],
    steps: [
      {
        id: '1',
        label: 'Lister toutes les dettes et taux',
        description: '3 dettes identifiées : Visa 19,99 %, Mastercard 14,9 %, prêt auto 6,9 %.',
        completed: true,
        dueLabel: 'Terminé en nov. 2025',
      },
      {
        id: '2',
        label: 'Choisir la méthode avalanche',
        description: 'Stratégie validée : attaquer la Visa en premier.',
        completed: true,
        dueLabel: 'Terminé en déc. 2025',
      },
      {
        id: '3',
        label: 'Rembourser la Visa · 4782 (4 300 $ → 0 $)',
        description: 'Dette prioritaire — environ 10 mois de paiements à 420 $/mois.',
        completed: false,
        dueLabel: 'Objectif : janv. 2027',
      },
      {
        id: '4',
        label: 'Dette totale sous 8 000 $',
        description: 'Après la Visa, basculer les 420 $ sur la Mastercard.',
        completed: false,
        dueLabel: 'Objectif : sept. 2027',
      },
    ],
  },
  {
    id: 'mock-budget',
    name: 'Budget enveloppe',
    category: 'Budget',
    status: 'Attention',
    statusTone: 'warning',
    progress: 88,
    progressPositive: false,
    icon: 'wallet-outline',
    currentAmount: 3_520,
    targetAmount: 4_000,
    summary: 'Répartir 4 000 $ par mois en enveloppes (fixe, variable, loisirs) pour éviter les dépassements.',
    strategy: {
      name: 'Enveloppes par catégorie',
      description:
        'Chaque catégorie a un plafond. Quand l’enveloppe est vide, tu attends le mois suivant — sauf pour les imprévus couverts par le fonds d’urgence.',
    },
    startedAtLabel: 'Mars 2026',
    targetDateLabel: 'Fin juin 2026',
    estimatedCompletionLabel: '12 jours restants',
    contributionLabel: '480 $ restants',
    linkedAccountLabel: 'Tous comptes courants',
    nextAction: {
      title: 'Limiter les dépenses discrétionnaires',
      description:
        'Il reste 480 $ sur 800 $ d’enveloppe « Loisirs + sorties ». Évite les achats non planifiés cette semaine pour clôturer le mois dans le vert.',
    },
    metrics: [
      { id: 'remaining', label: 'Marge mensuelle', value: '480 $', tone: 'warning' },
      { id: 'used', label: 'Dépensé', value: '3 520 $', hint: 'Sur 4 000 $', tone: 'default' },
      { id: 'risk', label: 'Enveloppe à risque', value: 'Loisirs', hint: '88 % utilisé', tone: 'danger' },
      { id: 'eta', label: 'Clôture du mois', value: '12 jours', tone: 'warning' },
    ],
    rationale:
      'Tu approches la limite globale du mois (88 %). Réduire les dépenses discrétionnaires cette semaine évitera un dépassement avant la fin du mois. Les enveloppes « Épicerie » et « Transport » sont encore dans les clous.',
    impactBullets: [
      'Épicerie : 620 $ / 700 $ — dans la marge',
      'Transport : 280 $ / 350 $ — dans la marge',
      'Loisirs + sorties : 720 $ / 800 $ — surveiller de près',
    ],
    steps: [
      {
        id: '1',
        label: 'Définir les enveloppes par catégorie',
        description: 'Fixe 1 400 $, variable 1 800 $, loisirs 800 $ pour ce mois.',
        completed: true,
        dueLabel: 'Terminé en mars 2026',
      },
      {
        id: '2',
        label: 'Suivre les dépenses chaque semaine',
        description: 'Revue hebdo chaque dimanche — prochaine : dans 3 jours.',
        completed: true,
        dueLabel: 'En cours',
      },
      {
        id: '3',
        label: 'Rester sous 90 % du budget mensuel',
        description: 'Tu es à 88 % — encore 120 $ de marge avant ce seuil.',
        completed: false,
        dueLabel: 'Objectif : avant le 30 juin',
      },
      {
        id: '4',
        label: 'Clôturer le mois dans le vert',
        description: 'Aucune enveloppe dépassée et total ≤ 4 000 $.',
        completed: false,
        dueLabel: 'Objectif : 30 juin 2026',
      },
    ],
  },
];

export function getDashboardPlanById(planId: string): DashboardPlanDetail | undefined {
  return MOCK_DASHBOARD_PLANS.find((plan) => plan.id === planId);
}
