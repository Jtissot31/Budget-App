import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import type { AlertCenterItem, AlertCenterKind, AlertCenterSection } from '@/lib/alerts';
import {
  accountBalanceRowTitle,
  accountBalanceSubtitle,
} from '@/lib/accountBalancePresentation';
import { formatPersonDirectedPaymentLabel } from '@/lib/loanPresentation';
import type { SimulatedAccount } from '@/types';

/** Softer section labels for the Messages list. */
export const ALERT_SECTION_LABELS_REASSURING: Record<AlertCenterSection, string> = {
  urgent: 'À SURVEILLER',
  opportunities: 'OPPORTUNITÉS',
};

export const ALERT_TITLES = {
  lowFunds: 'Solde serré avant échéance',
  creditLimit: 'Marge insuffisante sur ta carte',
  budgetOver: 'Enveloppe budgétaire dépassée',
  highInterestDebt: 'Dette à taux élevé',
  balanceLow: 'Solde bas sur un compte',
  planAdaptation: 'Adaptation de plan proposée',
} as const;

function merchantLabelFromPaymentName(paymentName?: string): string | null {
  const trimmed = paymentName?.trim();
  if (!trimmed) return null;
  return formatPersonDirectedPaymentLabel(trimmed);
}

/** Merchant-aware title for credit-limit payment alerts (e.g. « Fizz : marge insuffisante »). */
export function buildCreditLimitAlertTitle(paymentName?: string): string {
  const merchant = merchantLabelFromPaymentName(paymentName);
  if (merchant) return `${merchant} : marge insuffisante`;
  return ALERT_TITLES.creditLimit;
}

/** Merchant-aware title for low-funds payment alerts. */
export function buildLowFundsAlertTitle(paymentName?: string): string {
  const merchant = merchantLabelFromPaymentName(paymentName);
  if (merchant) return `${merchant} : solde insuffisant`;
  return ALERT_TITLES.lowFunds;
}

/** Prefer merchant-aware title when payment metadata is available. */
export function resolveAlertDisplayTitle(
  item: Pick<AlertCenterItem, 'kind' | 'title' | 'paymentName'>,
): string {
  if (item.kind === 'credit_limit') {
    return buildCreditLimitAlertTitle(item.paymentName);
  }
  if (item.kind === 'low_funds') {
    return buildLowFundsAlertTitle(item.paymentName);
  }
  return item.title;
}

/** Short type-only nav/header title on alert detail (not merchant-aware). */
export function alertTypeHeaderTitle(kind: AlertCenterKind): string {
  switch (kind) {
    case 'credit_limit':
      return 'Alerte Limite de crédit';
    case 'low_funds':
      return 'Alerte Solde bas';
    case 'budget_over':
      return 'Alerte Budget';
    case 'high_interest_debt':
      return 'Alerte Dette';
    case 'plan_adaptation':
      return 'Adaptation de plan';
    case 'fyn':
    default:
      return 'Alerte Fyn';
  }
}

function normalizeAccountLast4(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function extractLast4FromAccountName(name: string): string | null {
  const digits = name.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

/**
 * Premium one-line account identity for alert detail
 * (e.g. « Visa Desjardins ···· 4242 »).
 */
export function formatAlertAccountIdentity(
  account: Pick<SimulatedAccount, 'name' | 'last4' | 'institution' | 'kind'>,
): string {
  const title = accountBalanceRowTitle(account);
  const subtitle = accountBalanceSubtitle(account);
  const base = subtitle ? `${title} ${subtitle}` : title;
  const last4 = normalizeAccountLast4(account.last4) ?? extractLast4FromAccountName(account.name);
  if (last4 && !base.includes(last4)) {
    return `${base} ···· ${last4}`;
  }
  return base;
}

/**
 * Resolve the specific account this alert refers to (name + last4), not a generic category.
 * Prefer `accountId`; for credit-limit alerts, fall back to the linked credit card.
 */
export function resolveAlertAccountIdentity(
  item: Pick<AlertCenterItem, 'accountId' | 'kind'>,
  simulatedAccounts: SimulatedAccount[],
): string | null {
  if (item.accountId) {
    const matched = simulatedAccounts.find((account) => account.id === item.accountId);
    if (matched) return formatAlertAccountIdentity(matched);
  }

  if (item.kind === 'credit_limit') {
    const creditFromDb = simulatedAccounts.find((account) => account.kind === 'credit');
    if (creditFromDb) return formatAlertAccountIdentity(creditFromDb);

    const dashboardCredit = DASHBOARD_ACCOUNTS.find((account) => account.kind === 'credit');
    if (dashboardCredit) {
      return formatAlertAccountIdentity({
        name: dashboardCredit.name,
        kind: dashboardCredit.kind,
        last4: normalizeAccountLast4(dashboardCredit.number),
        institution: dashboardCredit.domain,
      });
    }
  }

  return null;
}

export type AlertSolution = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  /** Expo Router pathname, or null for non-navigating tips / local actions. */
  href: string | null;
  params?: Record<string, string>;
  /** Local alert-detail action (plan adaptation confirm flow). */
  localAction?: 'accept_adaptation' | 'dismiss_adaptation';
};

export type AlertDetailContent = {
  eyebrow: string;
  icon: { family: 'ionicons' | 'material-community'; name: string };
  accentToken: 'accent' | 'muted';
  problemLabel: string;
  problemBody: string;
  /** Preventative tip fallback for the AI insight card (not shown as subtitle). */
  insightFallbackBody: string;
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
    case 'plan_adaptation':
      return { family: 'ionicons', name: 'swap-horizontal-outline' };
    case 'fyn':
    default:
      return { family: 'ionicons', name: 'bulb-outline' };
  }
}

export function buildAlertDetailContent(
  item: Pick<
    AlertCenterItem,
    | 'kind'
    | 'title'
    | 'message'
    | 'accountId'
    | 'montant'
    | 'recurring'
    | 'paymentName'
    | 'id'
    | 'adaptationProposalId'
    | 'relatedPlanId'
  >,
): AlertDetailContent {
  switch (item.kind) {
    case 'credit_limit': {
      const merchant = merchantLabelFromPaymentName(item.paymentName);
      return {
        eyebrow: 'Carte de crédit',
        icon: { family: 'ionicons', name: 'card-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody:
          item.message ||
          (merchant
            ? `Le paiement ${merchant} laisserait peu de marge sur ta carte de crédit.`
            : 'Ce paiement laisserait peu de marge sur ta carte de crédit.'),
        insightFallbackBody: isRecurringPaymentAlert(item)
          ? 'Pour les paiements récurrents sur carte, garde 20–30 % de marge libre avant chaque échéance — tu éviteras ce genre d’alerte.'
          : 'Avant un gros achat sur carte, vérifie ta marge disponible : un coussin de 20–30 % t’évite les surprises.',
        actionsLabel: 'Tes actions',
        solutions: creditLimitSolutions(item),
      };
    }

    case 'budget_over':
      return {
        eyebrow: 'Budget',
        icon: { family: 'ionicons', name: 'pie-chart-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody:
          item.message ||
          'Une enveloppe budgétaire a été dépassée ce mois-ci.',
        insightFallbackBody:
          'En début de mois, répartis ton budget avec une petite marge dans chaque enveloppe — tu limites les dépassements.',
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
        insightFallbackBody:
          'Quand tu as un surplus, vise d’abord les dettes à taux élevé — chaque mois compte pour réduire les intérêts.',
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
        insightFallbackBody: isRecurringPaymentAlert(item)
          ? 'Vérifie ton solde 3–4 jours avant chaque paiement récurrent — un petit rappel t’évite les mauvaises surprises.'
          : 'Garde un coussin de quelques jours de dépenses sur ton compte courant pour absorber les échéances imprévues.',
        actionsLabel: 'Tes actions',
        solutions: lowFundsSolutions(item),
      };

    case 'plan_adaptation':
      return {
        eyebrow: 'Plan financier',
        icon: { family: 'ionicons', name: 'swap-horizontal-outline' },
        accentToken: 'accent',
        problemLabel: 'Proposition',
        problemBody:
          item.message ||
          'Fyn a détecté une adaptation utile pour un de tes plans actifs.',
        insightFallbackBody:
          'Les adaptations automatiques restent des propositions : rien ne change tant que tu n’as pas confirmé.',
        actionsLabel: 'Tes actions',
        solutions: [
          {
            id: 'accept-adaptation',
            title: 'Appliquer l’adaptation',
            description: 'Confirme le changement proposé sur ton plan.',
            ctaLabel: 'Confirmer',
            href: null,
            localAction: 'accept_adaptation',
          },
          {
            id: 'view-plan',
            title: 'Voir le plan',
            description: 'Consulte le plan avant de décider.',
            ctaLabel: 'Ouvrir le plan',
            href: item.relatedPlanId ? '/plans/[id]' : '/(tabs)/goals',
            params: item.relatedPlanId ? { id: item.relatedPlanId } : undefined,
          },
          {
            id: 'dismiss-adaptation',
            title: 'Ignorer pour l’instant',
            description: 'Garde le plan tel quel — aucune modification.',
            ctaLabel: 'Ignorer',
            href: null,
            localAction: 'dismiss_adaptation',
          },
        ],
      };

    case 'fyn':
    default:
      return {
        eyebrow: 'Conseil Fyn',
        icon: { family: 'ionicons', name: 'bulb-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody: item.message || item.title,
        insightFallbackBody:
          'Consulte régulièrement tes alertes et ton budget — repérer les tendances tôt simplifie les ajustements.',
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
