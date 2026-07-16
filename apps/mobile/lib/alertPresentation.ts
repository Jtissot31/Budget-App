import type { AlertCenterItem, AlertCenterKind, AlertCenterSection } from '@/lib/alerts';

/** Softer section labels for the Messages list. */
export const ALERT_SECTION_LABELS_REASSURING: Record<AlertCenterSection, string> = {
  urgent: 'À SURVEILLER',
  opportunities: 'OPPORTUNITÉS',
};

export const ALERT_TITLES = {
  lowFunds: 'Solde serré avant échéance',
  creditLimit: 'Peu de marge sur ta carte',
  budgetOver: 'Enveloppe budgétaire dépassée',
  highInterestDebt: 'Dette à taux élevé',
  balanceLow: 'Solde bas sur un compte',
} as const;

export type AlertSolution = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  /** Expo Router pathname, or null for non-navigating tips. */
  href: string | null;
  params?: Record<string, string>;
};

export type AlertDetailContent = {
  eyebrow: string;
  icon: { family: 'ionicons' | 'material-community'; name: string };
  accentToken: 'accent' | 'muted';
  problemLabel: string;
  problemBody: string;
  fixLabel: string;
  fixBody: string;
  actionsLabel: string;
  solutions: AlertSolution[];
};

/** Prefer kind over title heuristics when mapping payment sources. */
export function paymentKindFromSourceTitle(title: string): AlertCenterKind {
  const lower = title.toLowerCase();
  if (
    lower.includes('carte') ||
    lower.includes('limite') ||
    lower.includes('crédit') ||
    lower.includes('credit') ||
    lower.includes('marge')
  ) {
    return 'credit_limit';
  }
  if (lower.includes('budget') || lower.includes('enveloppe') || lower.includes('réajuster')) {
    return 'budget_over';
  }
  if (lower.includes('dette') || lower.includes('alléger') || lower.includes('taux élevé')) {
    return 'high_interest_debt';
  }
  return 'low_funds';
}

/** Typical recurring bill merchants when metadata is missing (telecom, streaming, rent, etc.). */
const RECURRING_PAYMENT_NAME_HINTS = [
  'fizz',
  'netflix',
  'spotify',
  'bell',
  'telus',
  'rogers',
  'videotron',
  'koodo',
  'virgin',
  'loyer',
  'assurance',
  'gym',
  'éconofitness',
  'econofitness',
  'abonnement',
];

function normalizePaymentHint(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function recurringHintFromPaymentName(paymentName?: string): boolean {
  if (!paymentName?.trim()) return false;
  const normalized = normalizePaymentHint(paymentName);
  return RECURRING_PAYMENT_NAME_HINTS.some(
    (hint) => normalized.includes(hint) || hint.includes(normalized),
  );
}

/** True when the alert concerns a recurring bill that cannot usually be postponed or split. */
export function isRecurringPaymentAlert(
  item: Pick<AlertCenterItem, 'recurring' | 'paymentName' | 'message' | 'id'>,
): boolean {
  if (item.recurring === true) return true;
  if (item.recurring === false) return false;

  if (item.id === 'payment-live') return true;
  if (item.id === 'payment-mock-credit') return false;

  if (recurringHintFromPaymentName(item.paymentName)) return true;

  const message = normalizePaymentHint(item.message ?? '');
  return RECURRING_PAYMENT_NAME_HINTS.some((hint) => message.includes(hint));
}

function creditLimitSolutions(
  item: Pick<AlertCenterItem, 'accountId' | 'recurring' | 'paymentName' | 'message' | 'id'>,
): AlertSolution[] {
  const accountParams = item.accountId ? { accountId: item.accountId } : undefined;
  const recurring = isRecurringPaymentAlert(item);

  const transferIn: AlertSolution = {
    id: 'transfer-in',
    title: 'Virer de l’argent disponible',
    description: 'Approvisionne en transférant depuis un autre compte.',
    ctaLabel: 'Faire un virement',
    href: '/add-transaction',
    params: { type: 'transfer' },
  };

  const payDown: AlertSolution = {
    id: 'pay-down',
    title: 'Rembourser la carte',
    description: 'Un paiement sur le solde libère immédiatement de la marge.',
    ctaLabel: 'Ouvrir le portefeuille',
    href: '/(tabs)/accounts',
  };

  const thirdAction: AlertSolution = recurring
    ? {
        id: 'trim-other-spending',
        title: 'Baisser d’autres dépenses',
        description: 'Coupe 1–2 achats facultatifs pour garder de la marge.',
        ctaLabel: 'Voir l’historique',
        href: '/(tabs)/transactions',
      }
    : {
        id: 'pause-or-split',
        title: 'Reporter ou fractionner le paiement',
        description: 'Décale l’achat ou paie une partie plus tard.',
        ctaLabel: 'Voir le compte',
        href: item.accountId ? '/account-detail' : null,
        params: accountParams,
      };

  const fynPlan: AlertSolution = {
    id: 'fyn-credit',
    title: 'Demander un plan à Fyn',
    description: 'Fyn peut proposer un plan concret pour garder de la marge.',
    ctaLabel: 'Parler à Fyn',
    href: '/ai-chat',
  };

  return [transferIn, payDown, thirdAction, fynPlan];
}

function lowFundsSolutions(
  item: Pick<AlertCenterItem, 'accountId' | 'recurring' | 'paymentName' | 'message' | 'id'>,
): AlertSolution[] {
  const recurring = isRecurringPaymentAlert(item);

  const transfer: AlertSolution = {
    id: 'transfer',
    title: 'Virer de l’argent disponible',
    description: 'Approvisionne le compte depuis un autre compte.',
    ctaLabel: 'Faire un virement',
    href: '/add-transaction',
    params: { type: 'transfer' },
  };

  const secondAction: AlertSolution = recurring
    ? {
        id: 'trim-other-spending',
        title: 'Baisser d’autres dépenses',
        description: 'Coupe ou reporte un achat facultatif avant l’échéance.',
        ctaLabel: 'Voir l’historique',
        href: '/(tabs)/transactions',
      }
    : {
        id: 'timing',
        title: 'Aligner paiement et dépôt',
        description: 'Décale le paiement juste après l’arrivée du salaire.',
        ctaLabel: 'Voir l’agenda',
        href: '/(tabs)/transactions',
        params: { view: 'agenda' },
      };

  const fynFunds: AlertSolution = {
    id: 'fyn-funds',
    title: 'Trouver une solution avec Fyn',
    description: 'Plan simple pour passer l’échéance.',
    ctaLabel: 'Parler à Fyn',
    href: '/ai-chat',
  };

  return [transfer, secondAction, fynFunds];
}

export function alertListIcon(kind: AlertCenterKind): {
  family: 'ionicons' | 'material-community';
  name: string;
} {
  switch (kind) {
    case 'credit_limit':
      return { family: 'ionicons', name: 'card-outline' };
    case 'budget_over':
      return { family: 'ionicons', name: 'pie-chart-outline' };
    case 'high_interest_debt':
      return { family: 'ionicons', name: 'trending-down-outline' };
    case 'low_funds':
      return { family: 'ionicons', name: 'wallet-outline' };
    case 'fyn':
    default:
      return { family: 'ionicons', name: 'bulb-outline' };
  }
}

export function buildAlertDetailContent(
  item: Pick<
    AlertCenterItem,
    'kind' | 'title' | 'message' | 'accountId' | 'montant' | 'recurring' | 'paymentName' | 'id'
  >,
): AlertDetailContent {
  switch (item.kind) {
    case 'credit_limit':
      return {
        eyebrow: 'Carte de crédit',
        icon: { family: 'ionicons', name: 'card-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody:
          item.message ||
          'Ce paiement laisserait peu de marge sur ta carte de crédit.',
        fixLabel: 'Comment le régler',
        fixBody: isRecurringPaymentAlert(item)
          ? 'Garde au moins 20–30 % de marge libre : vire de l’argent disponible d’un autre compte, ou rembourse avant l’échéance. Un paiement récurrent se paie en entier — ajuste ailleurs si besoin.'
          : 'Garde au moins 20–30 % de marge libre : vire de l’argent disponible d’un autre compte, ou rembourse un montant avant l’échéance.',
        actionsLabel: 'Tes actions',
        solutions: creditLimitSolutions(item),
      };

    case 'budget_over':
      return {
        eyebrow: 'Budget',
        icon: { family: 'ionicons', name: 'pie-chart-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody:
          item.message ||
          'Une enveloppe budgétaire a été dépassée ce mois-ci.',
        fixLabel: 'Comment le régler',
        fixBody:
          'Réajuste l’enveloppe concernée ou déplace du budget d’une catégorie moins utilisée pour revenir dans tes limites.',
        actionsLabel: 'Tes actions',
        solutions: [
          {
            id: 'review-budget',
            title: 'Réajuster l’enveloppe',
            description: 'Augmente la catégorie ou redistribue le budget.',
            ctaLabel: 'Voir mon budget',
            href: '/(tabs)/budgets',
          },
          {
            id: 'review-spending',
            title: 'Revoir les dépenses récentes',
            description: 'Repère 1–2 achats à reporter ce mois-ci.',
            ctaLabel: 'Voir l’historique',
            href: '/(tabs)/transactions',
          },
          {
            id: 'fyn-budget',
            title: 'Obtenir des pistes avec Fyn',
            description: 'Suggestions d’ajustements selon tes habitudes.',
            ctaLabel: 'Parler à Fyn',
            href: '/ai-chat',
          },
        ],
      };

    case 'high_interest_debt':
      return {
        eyebrow: 'Dette',
        icon: { family: 'ionicons', name: 'trending-down-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody:
          item.message ||
          'Une dette porte un taux d’intérêt élevé et te coûte plus cher au fil du temps.',
        fixLabel: 'Comment le régler',
        fixBody:
          'Priorise le remboursement de cette dette — chaque surplus réduit les intérêts futurs.',
        actionsLabel: 'Tes actions',
        solutions: [
          {
            id: 'open-debt',
            title: 'Consulter le prêt',
            description: 'Vérifie le solde, le taux et la prochaine échéance.',
            ctaLabel: 'Voir mes obligations',
            href: '/(tabs)/goals',
          },
          {
            id: 'debt-plan',
            title: 'Choisir une stratégie de remboursement',
            description: 'Avalanche (taux élevés) ou boule de neige (petits soldes).',
            ctaLabel: 'Explorer les plans',
            href: '/plans/explore',
          },
          {
            id: 'fyn-debt',
            title: 'Plan personnalisé avec Fyn',
            description: 'Trouve un rythme de remboursement réaliste.',
            ctaLabel: 'Parler à Fyn',
            href: '/ai-chat',
          },
        ],
      };

    case 'low_funds':
      return {
        eyebrow: 'Compte',
        icon: { family: 'ionicons', name: 'wallet-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody:
          item.message ||
          'Il pourrait manquer de liquidités pour couvrir un prochain paiement.',
        fixLabel: 'Comment le régler',
        fixBody: isRecurringPaymentAlert(item)
          ? 'Couvre le montant manquant par un virement ou en réduisant d’autres dépenses avant l’échéance.'
          : 'Couvre le montant manquant par un virement, un report de paiement ou en attendant le prochain dépôt.',
        actionsLabel: 'Tes actions',
        solutions: lowFundsSolutions(item),
      };

    case 'fyn':
    default:
      return {
        eyebrow: 'Conseil Fyn',
        icon: { family: 'ionicons', name: 'bulb-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody: item.message || item.title,
        fixLabel: 'Comment le régler',
        fixBody: 'Discute avec Fyn ou explore un plan pour clarifier la prochaine étape.',
        actionsLabel: 'Tes actions',
        solutions: [
          {
            id: 'fyn-chat',
            title: 'Discuter avec Fyn',
            description: 'Pose ta question pour obtenir une réponse concrète.',
            ctaLabel: 'Ouvrir Fyn',
            href: '/ai-chat',
          },
          {
            id: 'plans',
            title: 'Explorer un plan financier',
            description: 'Modèles pour épargner, rembourser ou stabiliser ton budget.',
            ctaLabel: 'Explorer les plans',
            href: '/plans/explore',
          },
        ],
      };
  }
}
