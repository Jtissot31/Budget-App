import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import { isDemoSeedEnabled } from '@/lib/demoSeedGate';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { resolvePaycheckForPaymentAlert } from '@/lib/estimatedPaycheck';
import {
  evaluateCheckingInsufficientFunds,
  type InsufficientFundsCheckingAlert,
} from '@/lib/insufficientFundsAlert';
import { creditUsedFromBalance } from '@/lib/creditLimitUtilization';
import { formatPersonDirectedPaymentLabel } from '@/lib/loanPresentation';
import type { PaymentAlertSource } from '@/lib/alerts';
import {
  buildCreditLimitAlertTitle,
  buildCreditLimitHeroProblemBody,
  buildLowFundsAlertTitle,
  formatAlertAccountIdentity,
} from '@/lib/alertPresentation';
import { CREDIT_LIMIT_MOCK_ALERT_NUMBERS } from '@/lib/resolveCreditLimitTimeline';
import type { RecurringPayment, RecurringPaymentKind, SimulatedAccount, Transaction } from '@/types';

type UpcomingPayment = {
  id?: string;
  name: string;
  amount: number;
  account: string;
  date: string;
  recurring: boolean;
  kind?: RecurringPaymentKind;
  accountId?: string;
};

type PaymentResolutionAccount = {
  id: string;
  name: string;
  balance: number;
  kind: SimulatedAccount['kind'];
  creditLimit?: number;
};

const MOCK_CREDIT_PAYMENT_NAME = 'Abonnement cloud';

function mockCreditCardDisplayName(): string {
  const dashboardCredit = DASHBOARD_ACCOUNTS.find((account) => account.kind === 'credit');
  if (!dashboardCredit) return 'Visa · 9104';
  return formatAlertAccountIdentity({
    name: dashboardCredit.name,
    kind: dashboardCredit.kind,
    last4: dashboardCredit.number,
    institution: dashboardCredit.domain,
  });
}

type CreditPaymentRisk =
  | { shouldWarn: false }
  | {
      shouldWarn: true;
      reason: 'over_limit' | 'high_utilization';
      usedAfter: number;
      headroomAfter: number;
      creditLimit: number;
      overLimitBy: number;
    };

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatMoneyDetailed(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

function normalizeAccountLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function primaryNormalizedAccountLabelKey(accountLabel: string) {
  const normalized = normalizeAccountLabel(accountLabel.trim());
  return normalized.split(/\s*•\s*/)[0]?.trim() ?? normalized;
}

const LEGACY_MANUAL_ACCOUNT_ID_TO_KIND: Record<string, PaymentResolutionAccount['kind']> = {
  checking: 'checking',
  credit: 'credit',
  savings: 'savings',
};

function kindRankForResolution(kind: PaymentResolutionAccount['kind']) {
  if (kind === 'checking') return 0;
  if (kind === 'cash') return 1;
  if (kind === 'savings') return 2;
  if (kind === 'credit') return 3;
  return 4;
}

function sortPaymentResolutionPool(pool: PaymentResolutionAccount[]): PaymentResolutionAccount[] {
  return [...pool].sort(
    (a, b) =>
      kindRankForResolution(a.kind) - kindRankForResolution(b.kind) ||
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );
}

function toPaymentResolutionAccounts(accounts: SimulatedAccount[]): PaymentResolutionAccount[] {
  if (accounts.length > 0) {
    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      balance: account.balance,
      kind: account.kind,
      creditLimit: account.creditLimit,
    }));
  }
  if (!isDemoSeedEnabled()) return [];
  return DASHBOARD_ACCOUNTS.map((account) => ({
    id: account.id,
    name: account.name,
    balance: account.balance,
    kind: account.kind,
    creditLimit: account.creditLimit,
  }));
}

function resolvePaymentAccountForUpcoming(
  accountLabel: string,
  accountId: string | undefined,
  pool: PaymentResolutionAccount[],
): PaymentResolutionAccount | undefined {
  const ordered = sortPaymentResolutionPool(pool);
  const rawId = accountId?.trim();

  if (rawId) {
    const byId = ordered.find((a) => a.id === rawId);
    if (byId) return byId;

    const legacyKind = LEGACY_MANUAL_ACCOUNT_ID_TO_KIND[rawId];
    if (legacyKind) {
      const byKind = ordered.find((a) => a.kind === legacyKind);
      if (byKind) return byKind;
    }
  }

  const label = normalizeAccountLabel(accountLabel);
  const labelKey = primaryNormalizedAccountLabelKey(accountLabel);

  const exactName = ordered.find((a) => normalizeAccountLabel(a.name) === labelKey);
  if (exactName) return exactName;

  const exactFullLabel = ordered.find((a) => normalizeAccountLabel(a.name) === label);
  if (exactFullLabel) return exactFullLabel;

  if (labelKey.length >= 3) {
    const uniqueByNamePrefix = ordered.filter(
      (a) =>
        normalizeAccountLabel(a.name) === labelKey ||
        normalizeAccountLabel(a.name).startsWith(`${labelKey} `),
    );
    if (uniqueByNamePrefix.length === 1) return uniqueByNamePrefix[0];
  }

  if (label.includes('cheque') || label.includes('cheq') || label.includes('courant')) {
    return ordered.find((a) => a.kind === 'checking');
  }
  if (label.includes('carte') || label.includes('credit')) {
    return ordered.find((a) => a.kind === 'credit');
  }
  if (label.includes('epargne')) {
    return ordered.find((a) => a.kind === 'savings');
  }

  return ordered.find(
    (a) =>
      normalizeAccountLabel(a.name).includes(label) ||
      (labelKey.length >= 4 && label.includes(normalizeAccountLabel(a.name))),
  );
}

function evaluateCreditPaymentRisk(
  creditLimit: number,
  balance: number,
  paymentAmount: number,
): CreditPaymentRisk {
  if (creditLimit <= 0 || paymentAmount <= 0) return { shouldWarn: false };
  const creditUsed = creditUsedFromBalance(balance);
  const usedAfter = creditUsed + paymentAmount;
  const headroomAfter = creditLimit - usedAfter;
  const headroomRatioAfter = headroomAfter / creditLimit;

  if (usedAfter > creditLimit) {
    return {
      shouldWarn: true,
      reason: 'over_limit',
      usedAfter,
      headroomAfter,
      creditLimit,
      overLimitBy: Math.max(0, usedAfter - creditLimit),
    };
  }
  if (headroomRatioAfter <= 0.1) {
    return {
      shouldWarn: true,
      reason: 'high_utilization',
      usedAfter,
      headroomAfter: Math.max(0, headroomAfter),
      creditLimit,
      overLimitBy: 0,
    };
  }
  return { shouldWarn: false };
}

function nextMonthlyDate(dueDay?: number | null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = Math.min(Math.max(dueDay ?? today.getDate(), 1), 28);
  const next = new Date(today.getFullYear(), today.getMonth(), day);
  if (next < today) next.setMonth(next.getMonth() + 1);
  return isoDate(next);
}

function getUpcomingPayments(
  recurringPayments: RecurringPayment[],
  resolutionPool: PaymentResolutionAccount[],
): UpcomingPayment[] {
  const persisted = recurringPayments
    .filter((payment) => payment.active)
    .map((payment) => {
      const resolved = resolvePaymentAccountForUpcoming(
        payment.accountLabel,
        payment.accountId,
        resolutionPool,
      );
      const displayAccount = resolved?.name?.trim() || payment.accountLabel;
      return {
        id: payment.id,
        name: payment.name,
        amount: payment.amount,
        account: displayAccount,
        date: payment.nextDate ?? nextMonthlyDate(payment.dueDay),
        recurring: true,
        kind: payment.kind,
        accountId: payment.accountId,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Never fall back to hardcoded mocks — an empty list after delete must stay empty.
  return persisted;
}

export type BuildPaymentAlertsInput = {
  recurringPayments: RecurringPayment[];
  simulatedAccounts: SimulatedAccount[];
  incomeTransactions: Transaction[];
  includeMockCredit?: boolean;
};

/** Live payment-risk alerts for the Alert Center (checking shortfall + credit limit). */
export function buildPaymentAlertSources({
  recurringPayments,
  simulatedAccounts,
  incomeTransactions,
  includeMockCredit = isDemoSeedEnabled(),
}: BuildPaymentAlertsInput): PaymentAlertSource[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = isoDate(today);

  const paymentResolutionPool = toPaymentResolutionAccounts(simulatedAccounts);
  const upcomingPayments = getUpcomingPayments(recurringPayments, paymentResolutionPool);
  const sortedUpcomingPayments = [...upcomingPayments].sort((a, b) => a.date.localeCompare(b.date));
  const defaultNextPayment =
    sortedUpcomingPayments.find((payment) => payment.date >= todayIso) ?? sortedUpcomingPayments[0] ?? null;

  // Empty recurring list (release APK / no demo seed) — return mock-only or [].
  let nextPayment = defaultNextPayment;

  let nextPaymentShortfall = 0;
  let showInsufficientFundsWarning = false;
  let creditRiskActive: Extract<CreditPaymentRisk, { shouldWarn: true }> | null = null;
  let creditRiskCardName = '';
  let checkingFundsAlert: InsufficientFundsCheckingAlert | null = null;

  if (nextPayment) {
    for (const candidate of sortedUpcomingPayments) {
      if (candidate.date < todayIso || candidate.kind === 'income' || !candidate.recurring) continue;

      const candidateAccount = resolvePaymentAccountForUpcoming(
        candidate.account,
        candidate.accountId,
        paymentResolutionPool,
      );
      if (!candidateAccount) continue;

      if (candidateAccount.kind === 'credit') {
        const creditLimit = candidateAccount.creditLimit;
        if (typeof creditLimit !== 'number' || creditLimit <= 0) continue;

        const risk = evaluateCreditPaymentRisk(creditLimit, candidateAccount.balance, candidate.amount);
        if (!risk.shouldWarn) continue;

        nextPayment = candidate;
        showInsufficientFundsWarning = true;
        creditRiskActive = risk;
        creditRiskCardName = candidateAccount.name.trim() || candidate.account;
        checkingFundsAlert = null;
        break;
      }

      const candidatePaymentDate = new Date(`${candidate.date}T00:00:00`);
      const resolvedPaycheck = resolvePaycheckForPaymentAlert(
        candidate.accountId,
        recurringPayments,
        incomeTransactions,
        candidatePaymentDate,
        today,
      );
      const alert = evaluateCheckingInsufficientFunds(
        candidateAccount.balance,
        candidate.amount,
        candidatePaymentDate,
        resolvedPaycheck,
      );
      if (!alert) continue;

      nextPayment = candidate;
      showInsufficientFundsWarning = true;
      creditRiskActive = null;
      checkingFundsAlert = alert;
      nextPaymentShortfall = alert.currentShortfall;
      break;
    }
  }

  const nextPaymentDate = nextPayment ? new Date(`${nextPayment.date}T00:00:00`) : today;
  const nextPaymentDisplayName = nextPayment
    ? formatPersonDirectedPaymentLabel(nextPayment.name)
    : '';

  const forecastShortfallMessage = (() => {
    if (!nextPayment) return '';
    if (creditRiskActive) {
      const utilizationAfterPct = Math.min(
        (creditRiskActive.usedAfter / creditRiskActive.creditLimit) * 100,
        100,
      );
      return buildCreditLimitHeroProblemBody({
        paymentAmount: nextPayment.amount,
        utilizationAfterPct,
        cardName: creditRiskCardName || nextPayment.account,
        isOverLimit: creditRiskActive.reason === 'over_limit',
      });
    }
    if (checkingFundsAlert || (!creditRiskActive && showInsufficientFundsWarning)) {
      const shortfall = checkingFundsAlert?.currentShortfall ?? nextPaymentShortfall;
      const noPayFragment =
        checkingFundsAlert && !checkingFundsAlert.paycheckArrivesBeforePayment
          ? ' Ton prochain dépôt arrive après l’échéance — anticiper aide à rester serein.'
          : '';
      return `Il te manque ${formatMoneyDetailed(shortfall)} pour ${nextPaymentDisplayName}.${noPayFragment}`.trim();
    }
    return '';
  })();

  const sources: PaymentAlertSource[] = [];

  if (nextPayment && showInsufficientFundsWarning && forecastShortfallMessage) {
    const kind = creditRiskActive ? ('credit_limit' as const) : ('low_funds' as const);
    // over_limit → danger (rouge / déjà critique) ; sinon warning (jaune / à venir)
    const severity =
      creditRiskActive?.reason === 'over_limit' ? ('danger' as const) : ('warning' as const);
    const creditUtilizationAfterPct = creditRiskActive
      ? Math.min((creditRiskActive.usedAfter / creditRiskActive.creditLimit) * 100, 100)
      : null;
    sources.push({
      id: 'live',
      kind,
      severity,
      title: creditRiskActive
        ? buildCreditLimitAlertTitle(
            nextPayment.name,
            creditUtilizationAfterPct,
            creditRiskActive.reason === 'over_limit',
          )
        : buildLowFundsAlertTitle(nextPayment.name),
      body: forecastShortfallMessage,
      dateLabel: formatShortDate(nextPaymentDate),
      paymentDateRaw: nextPaymentDate,
      accountId: nextPayment.accountId,
      recurring: nextPayment.recurring,
      paymentName: nextPayment.name,
    });
  }

  if (includeMockCredit) {
    const { creditLimit, balanceUsedBefore, paymentAmount } = CREDIT_LIMIT_MOCK_ALERT_NUMBERS;
    const utilizationAfterPct = Math.min(
      ((balanceUsedBefore + paymentAmount) / creditLimit) * 100,
      100,
    );
    sources.push({
      id: 'mock-credit',
      kind: 'credit_limit',
      title: buildCreditLimitAlertTitle(MOCK_CREDIT_PAYMENT_NAME, utilizationAfterPct),
      body: buildCreditLimitHeroProblemBody({
        paymentAmount,
        utilizationAfterPct,
        cardName: mockCreditCardDisplayName(),
      }),
      dateLabel: formatShortDate(today),
      paymentDateRaw: today,
      accountId: undefined,
      recurring: false,
      paymentName: MOCK_CREDIT_PAYMENT_NAME,
    });
  }

  sources.sort((a, b) => {
    const aTime = a.paymentDateRaw?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.paymentDateRaw?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return sources;
}
