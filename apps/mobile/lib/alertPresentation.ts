import { StyleSheet } from 'react-native';
import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import type { AppColors } from '@/constants/theme';
import type { AlertCenterItem, AlertCenterKind, AlertCenterSection } from '@/lib/alerts';
import {
  accountBalanceRowTitle,
  accountBalanceSubtitle,
} from '@/lib/accountBalancePresentation';
import {
  budgetCategoryFromAlertTitle,
  extractBudgetOverCategory,
  normalizeBudgetOverTitle,
} from '@/lib/alertIdentity';
import {
  buildCreditLimitAlertReason,
  CREDIT_LIMIT_ALERT_REASONS,
  isCreditLimitExceededTitle,
  parseUtilizationPctFromMessage,
} from '@/lib/creditLimitAlertCopy';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatPersonDirectedPaymentLabel } from '@/lib/loanPresentation';
import type { SimulatedAccount } from '@/types';

/** Softer section labels for the Messages list. */
export const ALERT_SECTION_LABELS_REASSURING: Record<AlertCenterSection, string> = {
  urgent: 'À SURVEILLER',
  opportunities: 'OPPORTUNITÉS',
};

/** Accueil large line — reason only (no action cue). */
export const ALERT_REASONS = {
  lowFunds: 'Solde insuffisant',
  /** Default / under 99 % used after payment. */
  creditLimit: CREDIT_LIMIT_ALERT_REASONS.approaching,
  /** At least 99 % used after payment, or limit already exceeded. */
  creditLimitExceeded: CREDIT_LIMIT_ALERT_REASONS.exceeded,
  budgetOver: 'Budget dépassé',
  highInterestDebt: 'Dette à taux élevé',
  balanceLow: 'Solde bas',
  planAdaptation: 'Adaptation de plan proposée',
} as const;

/** Accueil small line — required action cue. */
export const ALERT_ACTIONS = {
  lowFunds: 'Virement requis',
  creditLimit: 'Action requise',
  budgetOver: 'Ajustement requis',
  highInterestDebt: 'Prioriser le remboursement',
  balanceLow: 'Ajout requis',
  planAdaptation: 'Confirmation requise',
  fyn: 'Voir le détail',
} as const;

/** Combined one-line titles (storage / alert center). */
export const ALERT_TITLES = {
  lowFunds: `${ALERT_REASONS.lowFunds}, ${ALERT_ACTIONS.lowFunds.toLowerCase()}`,
  creditLimit: `${ALERT_REASONS.creditLimit}, ${ALERT_ACTIONS.creditLimit.toLowerCase()}`,
  budgetOver: `${ALERT_REASONS.budgetOver}, ${ALERT_ACTIONS.budgetOver.toLowerCase()}`,
  highInterestDebt: `${ALERT_REASONS.highInterestDebt}, ${ALERT_ACTIONS.highInterestDebt.toLowerCase()}`,
  balanceLow: `${ALERT_REASONS.balanceLow}, ${ALERT_ACTIONS.balanceLow.toLowerCase()}`,
  planAdaptation: ALERT_REASONS.planAdaptation,
} as const;

function joinReasonAction(reason: string, action: string): string {
  const cue = action.charAt(0).toLowerCase() + action.slice(1);
  return `${reason}, ${cue}`;
}

function merchantLabelFromPaymentName(paymentName?: string): string | null {
  const trimmed = paymentName?.trim();
  if (!trimmed) return null;
  return formatPersonDirectedPaymentLabel(trimmed);
}

/**
 * Accueil large reason — category + « dépassé » only (no overrun amount in the title).
 * `overspendAmount` kept for call-site compatibility; amount stays in body/metadata.
 */
export function buildBudgetOverAlertReason(
  categoryName?: string,
  _overspendAmount?: number | null,
): string {
  const cat = categoryName?.trim();
  return cat ? `Budget ${cat} dépassé` : ALERT_REASONS.budgetOver;
}

/** Concrete budget-over title (e.g. « Budget Épicerie dépassé, ajustement requis »). */
export function buildBudgetOverAlertTitle(
  categoryName?: string,
  overspendAmount?: number | null,
): string {
  return joinReasonAction(
    buildBudgetOverAlertReason(categoryName, overspendAmount),
    ALERT_ACTIONS.budgetOver,
  );
}

export function buildHighInterestDebtAlertReason(productName?: string): string {
  const name = productName?.trim();
  if (name) return `${name} : taux élevé`;
  return ALERT_REASONS.highInterestDebt;
}

/** High-interest debt title with product name. */
export function buildHighInterestDebtAlertTitle(productName?: string): string {
  return joinReasonAction(
    buildHighInterestDebtAlertReason(productName),
    ALERT_ACTIONS.highInterestDebt,
  );
}

export function buildBalanceLowAlertReason(accountName?: string): string {
  const name = accountName?.trim();
  if (name) return `${name} : solde bas`;
  return ALERT_REASONS.balanceLow;
}

/** Balance-low title with account name. */
export function buildBalanceLowAlertTitle(accountName?: string): string {
  return joinReasonAction(buildBalanceLowAlertReason(accountName), ALERT_ACTIONS.balanceLow);
}

/** Condition-only title for credit-limit payment alerts (no merchant in title). */
export function buildCreditLimitAlertTitle(
  _paymentName?: string,
  utilizationAfterPct?: number | null,
  isOverLimit?: boolean,
): string {
  return joinReasonAction(
    buildCreditLimitAlertReason(_paymentName, utilizationAfterPct, isOverLimit),
    ALERT_ACTIONS.creditLimit,
  );
}

/**
 * Alert-detail hero “why” line for credit-limit risk.
 * Card identity lives on the account meta line — do not repeat Visa / last4 here.
 */
export function buildCreditLimitHeroProblemBody(params: {
  paymentAmount: number;
  utilizationAfterPct: number;
  /** @deprecated Unused — account line shows the card; kept for call-site compatibility. */
  cardName?: string;
  isOverLimit?: boolean;
}): string {
  const amountLabel = formatDisplayMoneyAbsolute(params.paymentAmount);
  if (params.isOverLimit || isCreditLimitExceededTitle(params.utilizationAfterPct, params.isOverLimit)) {
    return `Après le paiement de ${amountLabel}, la limite de crédit serait dépassée.`;
  }
  const pct = Math.round(params.utilizationAfterPct);
  return `Après le paiement de ${amountLabel}, environ ${pct} % de la limite sera utilisée.`;
}

/**
 * Payment low-funds reason — condition only (no merchant in title).
 * `paymentName` kept for call-site compatibility; name stays in body/metadata.
 */
export function buildLowFundsAlertReason(_paymentName?: string): string {
  return ALERT_REASONS.lowFunds;
}

/** Condition-only title for low-funds payment alerts (no merchant in title). */
export function buildLowFundsAlertTitle(_paymentName?: string): string {
  return joinReasonAction(buildLowFundsAlertReason(), ALERT_ACTIONS.lowFunds);
}

/**
 * Strip legacy « Merchant : marge insuffisante » / bare « Marge insuffisante »
 * so Accueil updates without waiting for alert re-evaluation.
 */
export function normalizePaymentConditionTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;
  if (/^marge insuffisante\b/i.test(trimmed)) {
    return trimmed.replace(/^marge insuffisante/i, ALERT_REASONS.creditLimit);
  }
  const marge = trimmed.match(/^.+?\s*:\s*(marge insuffisante)(.*)$/i);
  if (marge) return `${ALERT_REASONS.creditLimit}${marge[2] ?? ''}`;
  const solde = trimmed.match(/^.+?\s*:\s*(solde insuffisant)(.*)$/i);
  if (solde) return `${ALERT_REASONS.lowFunds}${solde[2] ?? ''}`;
  return trimmed;
}

/** Payment + budget title normalizers for list / Accueil display. */
export function normalizeAlertDisplayTitle(title: string): string {
  return normalizeBudgetOverTitle(normalizePaymentConditionTitle(title));
}

/** True for bare « Budget dépassé… » titles (no category between Budget and dépassé). */
export function isGenericBudgetOverTitle(title?: string | null): boolean {
  const t = (title ?? '').trim();
  if (!t) return true;
  if (t === ALERT_TITLES.budgetOver || t === ALERT_REASONS.budgetOver) return true;
  return /^Budget dépassée?(?!\p{L})/iu.test(t);
}

export function isGenericBudgetOverAlert(alert: {
  categorie?: string;
  kind?: string;
  titre?: string;
  title?: string;
}): boolean {
  const isBudget = alert.categorie === 'budget' || alert.kind === 'budget_over';
  if (!isBudget) return false;
  return isGenericBudgetOverTitle(alert.titre ?? alert.title);
}

/**
 * Prefer category overrun alerts; drop the redundant generic « Budget dépassé »
 * twin when any named category overrun is present.
 */
export function suppressGenericBudgetOverAlerts<
  T extends {
    categorie?: string;
    kind?: string;
    titre?: string;
    title?: string;
  },
>(alerts: T[]): T[] {
  const hasCategoryOverrun = alerts.some(
    (alert) =>
      (alert.categorie === 'budget' || alert.kind === 'budget_over') &&
      !isGenericBudgetOverAlert(alert),
  );
  if (!hasCategoryOverrun) return alerts;
  return alerts.filter((alert) => !isGenericBudgetOverAlert(alert));
}

function debtProductFromMessage(message: string): string | undefined {
  const m = message.match(/^(.+?)\s+porte\s+un\s+taux/i);
  return m?.[1]?.trim() || undefined;
}

function balanceAccountFromMessage(message: string): string | undefined {
  const m = message.match(/solde\s+de\s+(.+?)\s+est\s+bas/i);
  return m?.[1]?.trim() || undefined;
}

export type AlertHomeLines = {
  /** Large Accueil title — reason only (no overrun amount). */
  reason: string;
  /** Small Accueil subtitle — required action. */
  action: string;
};

/**
 * Accueil copy hierarchy: reason (large) + action (small).
 * Derives from message/metadata so older stored generic titles still read well.
 */
export function alertHomeLines(
  item: Pick<AlertCenterItem, 'kind' | 'title' | 'message' | 'paymentName' | 'montant'>,
): AlertHomeLines {
  const message = item.message?.trim() ?? '';

  switch (item.kind) {
    case 'budget_over':
      return {
        reason: buildBudgetOverAlertReason(
          extractBudgetOverCategory(item.title, message),
          item.montant,
        ),
        action: ALERT_ACTIONS.budgetOver,
      };
    case 'credit_limit': {
      const fromMessage = parseUtilizationPctFromMessage(message);
      const overLimitHint = /dépass/i.test(message);
      return {
        reason: buildCreditLimitAlertReason(item.paymentName, fromMessage, overLimitHint),
        action: ALERT_ACTIONS.creditLimit,
      };
    }
    case 'low_funds': {
      const account = balanceAccountFromMessage(message);
      if (account) {
        return {
          reason: buildBalanceLowAlertReason(account),
          action: ALERT_ACTIONS.balanceLow,
        };
      }
      return {
        reason: buildLowFundsAlertReason(item.paymentName),
        action: ALERT_ACTIONS.lowFunds,
      };
    }
    case 'high_interest_debt':
      return {
        reason: buildHighInterestDebtAlertReason(debtProductFromMessage(message)),
        action: ALERT_ACTIONS.highInterestDebt,
      };
    case 'plan_adaptation':
      return {
        reason: item.title || ALERT_REASONS.planAdaptation,
        action: ALERT_ACTIONS.planAdaptation,
      };
    case 'fyn':
    default:
      return {
        reason: item.title,
        action: ALERT_ACTIONS.fyn,
      };
  }
}

/** Accueil large title — reason only (action lives in the subtitle). */
export function alertHomePrimaryTitle(
  item: Pick<AlertCenterItem, 'kind' | 'title' | 'message' | 'paymentName' | 'montant'>,
): string {
  return normalizeAlertDisplayTitle(alertHomeLines(item).reason);
}

/** Accueil small subtitle — required action cue. */
export function alertHomeActionLine(
  item: Pick<AlertCenterItem, 'kind' | 'title' | 'message' | 'paymentName' | 'montant'>,
): string {
  return alertHomeLines(item).action;
}

/** Prefer concrete Accueil-style title when payment/metadata is available. */
export function resolveAlertDisplayTitle(
  item: Pick<AlertCenterItem, 'kind' | 'title' | 'message' | 'paymentName' | 'montant'>,
): string {
  const { reason, action } = alertHomeLines(item);
  const normalizedReason = normalizeAlertDisplayTitle(reason);
  if (!action) return normalizedReason;
  return joinReasonAction(normalizedReason, action);
}

/** First clause of a longer body, capped for compact list rows. */
function firstMessageClause(text: string, maxLen = 52): string {
  const first = text.split(/[.!?]/)[0]?.trim() ?? '';
  if (!first) return '';
  if (first.length <= maxLen) return first;
  return `${first.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Compact meta only (amount, %, timing) — tertiary; Accueil subtitle uses `alertHomeActionLine`.
 * Full `message` stays for detail.
 */
export function alertListShortReason(
  item: Pick<AlertCenterItem, 'kind' | 'title' | 'message' | 'paymentName'>,
): string {
  const message = item.message?.trim() ?? '';

  switch (item.kind) {
    case 'credit_limit': {
      const pct = message.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (pct) {
        const n = pct[1].replace(',', '.');
        return `Marge ~${n} % après ce paiement`;
      }
      if (/dépasser/i.test(message)) return 'Risque de dépassement de marge';
      if (/peu de marge/i.test(message)) return 'Peu de marge après paiement';
      return 'Sur ta carte de crédit';
    }
    case 'budget_over':
      return 'Ce mois-ci';
    case 'high_interest_debt': {
      const rateMatch = message.match(/taux\s+de\s+(\d+(?:[.,]\d+)?)\s*%/i);
      if (rateMatch) {
        const rate = Math.round(Number.parseFloat(rateMatch[1].replace(',', '.')));
        if (Number.isFinite(rate)) return `Taux ${rate} %`;
      }
      return 'Intérêts élevés';
    }
    case 'low_funds': {
      const shortfall = message.match(/manque\s+([^.]+?)(?:\s+pour\s+|\.|$)/i);
      if (shortfall?.[1]) return `Manque ${shortfall[1].trim()}`;
      const bal = message.match(/est\s+bas\s+\(([^)]+)\)/i);
      if (bal?.[1]) return `Solde ${bal[1].trim()}`;
      return 'Avant la prochaine échéance';
    }
    case 'plan_adaptation':
      return firstMessageClause(message) || 'Proposition en attente';
    case 'fyn':
    default:
      return firstMessageClause(message) || 'Détail disponible';
  }
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
      return 'Alerte';
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

function dashboardAccountAsSimulated(
  dashboard: (typeof DASHBOARD_ACCOUNTS)[number],
): SimulatedAccount {
  return {
    id: dashboard.id,
    name: dashboard.name,
    kind: dashboard.kind,
    balance: dashboard.balance,
    institution: dashboard.domain || undefined,
    last4: normalizeAccountLast4(dashboard.number) ?? undefined,
    creditLimit: dashboard.creditLimit,
    createdAt: '',
  };
}

/**
 * Credit-limit alert account (logo + identity). Prefer `accountId`, then the
 * linked credit card, then the dashboard mock Visa.
 */
export function resolveAlertCreditAccount(
  item: Pick<AlertCenterItem, 'accountId' | 'kind'>,
  simulatedAccounts: SimulatedAccount[],
): SimulatedAccount | null {
  if (item.accountId) {
    const matched = simulatedAccounts.find((account) => account.id === item.accountId);
    if (matched) return matched;
  }

  if (item.kind !== 'credit_limit') return null;

  const creditFromDb = simulatedAccounts.find((account) => account.kind === 'credit');
  if (creditFromDb) return creditFromDb;

  const dashboardCredit = DASHBOARD_ACCOUNTS.find((account) => account.kind === 'credit');
  return dashboardCredit ? dashboardAccountAsSimulated(dashboardCredit) : null;
}

/**
 * Resolve the specific account this alert refers to (name + last4), not a generic category.
 * Prefer `accountId`; for credit-limit alerts, fall back to the linked credit card.
 */
export function resolveAlertAccountIdentity(
  item: Pick<AlertCenterItem, 'accountId' | 'kind'>,
  simulatedAccounts: SimulatedAccount[],
): string | null {
  const creditAccount = resolveAlertCreditAccount(item, simulatedAccounts);
  if (creditAccount) return formatAlertAccountIdentity(creditAccount);

  if (item.accountId) {
    const matched = simulatedAccounts.find((account) => account.id === item.accountId);
    if (matched) return formatAlertAccountIdentity(matched);
  }

  return null;
}

export type AlertSolutionIcon = {
  family: 'ionicons' | 'material-community';
  name: string;
};

export type AlertSolution = {
  id: string;
  title: string;
  description: string;
  /** Fuller French copy for the option detail sheet (falls back to `description`). */
  detailBody?: string;
  ctaLabel: string;
  /** Distinct option glyph — never a step number. */
  icon?: AlertSolutionIcon;
  /** Expo Router pathname, or null for non-navigating tips / local actions. */
  href: string | null;
  params?: Record<string, string>;
  /** Local alert-detail action (plan adaptation confirm flow). */
  localAction?: 'accept_adaptation' | 'dismiss_adaptation';
};

const DEFAULT_SOLUTION_ICON: AlertSolutionIcon = {
  family: 'ionicons',
  name: 'ellipse-outline',
};

/** Option glyph for alert-detail rows (choices, not a numbered sequence). */
export function alertSolutionOptionIcon(
  solution: Pick<AlertSolution, 'id' | 'icon'>,
): AlertSolutionIcon {
  return solution.icon ?? DEFAULT_SOLUTION_ICON;
}

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

  return [
    {
      id: 'pay-down',
      title: 'Rembourser la carte',
      description: 'Libère de la marge tout de suite.',
      detailBody:
        'Effectue un paiement sur ta carte pour faire baisser le solde utilisé. Tu récupères de la marge disponible et tu réduis le risque de dépasser ta limite après le prochain prélèvement.',
      ctaLabel: 'Ouvrir le portefeuille',
      icon: { family: 'ionicons', name: 'card-outline' },
      href: '/(tabs)/accounts',
    },
    {
      id: 'transfer-in',
      title: 'Virer vers la carte',
      description: 'Depuis un compte avec du disponible.',
      detailBody:
        'Transfère de l’argent depuis un compte chèque ou épargne vers ta carte. Le virement augmente ta marge sans attendre le prochain remboursement planifié.',
      ctaLabel: 'Faire un virement',
      icon: { family: 'ionicons', name: 'swap-horizontal-outline' },
      href: '/add-transaction',
      params: { type: 'transfer' },
    },
    recurring
      ? {
          id: 'trim-other-spending',
          title: 'Couper 1–2 dépenses',
          description: 'Garde de la marge avant l’échéance.',
          detailBody:
            'Repère une ou deux dépenses facultatives à réduire ou reporter avant le paiement. Moins de sorties sur la carte = plus de marge pour absorber l’échéance.',
          ctaLabel: 'Voir l’historique',
          icon: { family: 'ionicons', name: 'pricetag-outline' },
          href: '/(tabs)/transactions',
        }
      : {
          id: 'pause-or-split',
          title: 'Reporter ou fractionner',
          description: 'Décale l’achat ou paie une partie plus tard.',
          detailBody:
            'Décale l’achat à une date où tu auras plus de marge, ou paie seulement une partie maintenant pour rester sous la limite.',
          ctaLabel: 'Voir le compte',
          icon: { family: 'ionicons', name: 'calendar-outline' },
          href: item.accountId ? '/account-detail' : null,
          params: accountParams,
        },
  ];
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
    icon: { family: 'ionicons', name: 'swap-horizontal-outline' },
    href: '/add-transaction',
    params: { type: 'transfer' },
  };

  const secondAction: AlertSolution = recurring
    ? {
        id: 'trim-other-spending',
        title: 'Baisser d’autres dépenses',
        description: 'Coupe ou reporte un achat facultatif avant l’échéance.',
        ctaLabel: 'Voir l’historique',
        icon: { family: 'ionicons', name: 'pricetag-outline' },
        href: '/(tabs)/transactions',
      }
    : {
        id: 'timing',
        title: 'Aligner paiement et dépôt',
        description: 'Décale le paiement juste après l’arrivée du salaire.',
        ctaLabel: 'Voir l’agenda',
        icon: { family: 'ionicons', name: 'calendar-outline' },
        href: '/(tabs)/transactions',
        params: { view: 'agenda' },
      };

  return [transfer, secondAction];
}

export function alertListIcon(kind: AlertCenterKind): {
  family: 'ionicons' | 'material-community';
  name: string;
} {
  switch (kind) {
    case 'credit_limit':
      return { family: 'ionicons', name: 'card' };
    case 'budget_over':
      return { family: 'ionicons', name: 'pie-chart' };
    case 'high_interest_debt':
      return { family: 'ionicons', name: 'trending-down' };
    case 'low_funds':
      return { family: 'ionicons', name: 'wallet' };
    case 'plan_adaptation':
      return { family: 'ionicons', name: 'swap-horizontal' };
    case 'fyn':
    default:
      return { family: 'ionicons', name: 'bulb' };
  }
}

/**
 * Accueil NOTIFICATIONS & ALERTES preview glyph.
 * Stress alerts → custom triangle+exclamation (`AlertTriangleIcon`);
 * info / success → Ionicons info.
 */
export type HomeAlertPreviewIconName = 'alert-triangle' | 'information-circle';

export function homeAlertPreviewIcon(
  item: Pick<AlertCenterItem, 'kind' | 'severity'>,
): HomeAlertPreviewIconName {
  if (item.severity === 'danger' || item.severity === 'warning') return 'alert-triangle';
  return 'information-circle';
}

/**
 * Accueil triangle tint — yellow (à venir) vs red (vraiment urgent).
 *
 * Rule (documented + used by `homeAlertPreviewAccent`):
 * - **red** (`colors.danger`): `severity === 'danger'` — déjà vrai / action requise
 *   maintenant (budget dépassé, solde déjà bas, dépassement de limite, AI `critique`).
 * - **yellow** (`colors.warning`): `severity === 'warning'` — risque à venir
 *   (paiement / marge future, AI `attention`).
 * - **muted** (`colors.textSecondary`): `info` / `success` — non stress.
 */
export type HomeAlertIconTone = 'urgent' | 'upcoming' | 'neutral';

export function homeAlertIconTone(
  item: Pick<AlertCenterItem, 'severity'>,
): HomeAlertIconTone {
  if (item.severity === 'danger') return 'urgent';
  if (item.severity === 'warning') return 'upcoming';
  return 'neutral';
}

/**
 * Accueil alert card shell — slightly elevated vs page glass so the stack reads clearly
 * without severity-tinted (anxious) card fills.
 */
export function homeAlertPreviewSurface(
  colors: Pick<AppColors, 'surfaceElevated' | 'border'>,
  isLight: boolean,
): {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
} {
  return {
    backgroundColor: colors.surfaceElevated,
    // Dark: the elevated glass fill already separates the card from the canvas, so the
    // outline stays under the standard container border.
    // Light: the near-white fill sits on a near-white canvas, so the outline is the only
    // card edge — keep it a full 1px at the standard container alpha.
    borderColor: isLight ? colors.border : 'rgba(255, 255, 255, 0.1)',
    borderWidth: isLight ? 1 : StyleSheet.hairlineWidth,
  };
}

/**
 * Accueil alert icon well + glyph — Proto list-icon system.
 * Well: always-filled `colors.iconWell` (light: pale gray plate; dark: elevated glass).
 * Glyph: `colors.text` in light theme (Agenda outline-icon pattern); dark keeps
 * red / yellow / muted tone.
 */
export function homeAlertPreviewAccent(
  item: Pick<AlertCenterItem, 'kind' | 'severity'>,
  colors: Pick<AppColors, 'text' | 'textSecondary' | 'danger' | 'warning' | 'iconWell'>,
  isLight: boolean,
): {
  iconBg: string;
  iconColor: string;
  icon: HomeAlertPreviewIconName;
  tone: HomeAlertIconTone;
} {
  const icon = homeAlertPreviewIcon(item);
  const tone = homeAlertIconTone(item);
  const iconBg = colors.iconWell;

  if (isLight) {
    return { iconBg, iconColor: colors.text, icon, tone };
  }
  if (tone === 'urgent') {
    return { iconBg, iconColor: colors.danger, icon, tone };
  }
  if (tone === 'upcoming') {
    return { iconBg, iconColor: colors.warning, icon, tone };
  }
  return { iconBg, iconColor: colors.textSecondary, icon, tone };
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
      return {
        eyebrow: 'Carte de crédit',
        icon: { family: 'ionicons', name: 'card-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody:
          item.message ||
          'Ce paiement utiliserait une trop grande part de la limite de ta carte de crédit.',
        insightFallbackBody: isRecurringPaymentAlert(item)
          ? 'Pour les paiements récurrents sur carte, garde 20–30 % de marge libre avant chaque échéance — tu éviteras ce genre d’alerte.'
          : 'Avant un gros achat sur carte, vérifie ta marge disponible : un coussin de 20–30 % t’évite les surprises.',
        actionsLabel: 'Options',
        solutions: creditLimitSolutions(item),
      };
    }

    case 'budget_over': {
      const category = extractBudgetOverCategory(item.title, item.message);
      const overrun =
        typeof item.montant === 'number' && Number.isFinite(item.montant) && item.montant > 0
          ? formatDisplayMoneyAbsolute(item.montant)
          : null;
      const problemBody = overrun
        ? category
          ? `Dépassement de ${overrun} sur ${category} ce mois-ci.`
          : `Dépassement de ${overrun} ce mois-ci.`
        : category
          ? `L’enveloppe ${category} a dépassé son plafond ce mois-ci.`
          : item.message || 'Une enveloppe budgétaire a été dépassée ce mois-ci.';

      return {
        eyebrow: 'Budget',
        icon: { family: 'ionicons', name: 'pie-chart-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody,
        insightFallbackBody:
          'En début de mois, répartis ton budget avec une petite marge dans chaque enveloppe — tu limites les dépassements.',
        actionsLabel: 'Options',
        solutions: [
          {
            id: 'review-budget',
            title: 'Réajuster l’enveloppe',
            description: 'Augmente ou redistribue le budget.',
            ctaLabel: 'Voir mon budget',
            icon: { family: 'ionicons', name: 'pie-chart-outline' },
            href: '/(tabs)/budgets',
          },
          {
            id: 'review-spending',
            title: 'Revoir les dépenses',
            description: 'Repère 1–2 achats à reporter.',
            ctaLabel: 'Voir l’historique',
            icon: { family: 'ionicons', name: 'receipt-outline' },
            href: '/(tabs)/transactions',
          },
        ],
      };
    }

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
        actionsLabel: 'Options',
        solutions: [
          {
            id: 'open-debt',
            title: 'Consulter le prêt',
            description: 'Vérifie le solde, le taux et la prochaine échéance.',
            ctaLabel: 'Voir mes obligations',
            icon: { family: 'ionicons', name: 'document-text-outline' },
            href: '/(tabs)/goals',
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
        actionsLabel: 'Options',
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
          'Une adaptation est proposée pour un de tes plans actifs.',
        insightFallbackBody:
          'Les adaptations automatiques restent des propositions : rien ne change tant que tu n’as pas confirmé.',
        actionsLabel: 'Options',
        solutions: [
          {
            id: 'accept-adaptation',
            title: 'Appliquer l’adaptation',
            description: 'Confirme le changement proposé sur ton plan.',
            ctaLabel: 'Confirmer',
            icon: { family: 'ionicons', name: 'checkmark-circle-outline' },
            href: null,
            localAction: 'accept_adaptation',
          },
          {
            id: 'view-plan',
            title: 'Voir le plan',
            description: 'Consulte le plan avant de décider.',
            ctaLabel: 'Ouvrir le plan',
            icon: { family: 'ionicons', name: 'map-outline' },
            href: item.relatedPlanId ? '/plans/[id]' : '/(tabs)/goals',
            params: item.relatedPlanId ? { id: item.relatedPlanId } : undefined,
          },
          {
            id: 'dismiss-adaptation',
            title: 'Ignorer pour l’instant',
            description: 'Garde le plan tel quel — aucune modification.',
            ctaLabel: 'Ignorer',
            icon: { family: 'ionicons', name: 'close-circle-outline' },
            href: null,
            localAction: 'dismiss_adaptation',
          },
        ],
      };

    case 'fyn':
    default:
      return {
        eyebrow: 'Conseil',
        icon: { family: 'ionicons', name: 'bulb-outline' },
        accentToken: 'accent',
        problemLabel: 'Le problème',
        problemBody: item.message || item.title,
        insightFallbackBody:
          'Consulte régulièrement tes alertes et ton budget — repérer les tendances tôt simplifie les ajustements.',
        actionsLabel: 'Options',
        solutions: [
          {
            id: 'review-budget',
            title: 'Revoir le budget',
            description: 'Vérifie tes enveloppes et tes plafonds.',
            ctaLabel: 'Voir mon budget',
            icon: { family: 'ionicons', name: 'pie-chart-outline' },
            href: '/(tabs)/budgets',
          },
          {
            id: 'review-activity',
            title: 'Voir l’activité',
            description: 'Repasse les dernières transactions.',
            ctaLabel: 'Voir l’historique',
            icon: { family: 'ionicons', name: 'receipt-outline' },
            href: '/(tabs)/transactions',
          },
        ],
      };
  }
}
