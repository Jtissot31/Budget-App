import type { EstimatedPaycheck } from '@/lib/estimatedPaycheck';

import { formatPersonDirectedPaymentLabel } from '@/lib/loanPresentation';

export type CheckingFundsAlertOutcome =
  | 'covered_after_paycheck'
  | 'shortfall_before_and_after_pay'
  | 'shortfall_current_only';

export type InsufficientFundsCheckingAlert = {
  outcome: CheckingFundsAlertOutcome;
  currentShortfall: number;
  /** Renseigné seulement si la paie arrive avant l’échéance mais ne couvre pas tout. */
  shortfallAfterPaycheck: number | null;
  paycheckArrivesBeforePayment: boolean;
  resolvedPaycheck: EstimatedPaycheck | null;
};

export function evaluateCheckingInsufficientFunds(
  balance: number,
  paymentAmount: number,
  paymentDate: Date,
  resolvedPaycheck: EstimatedPaycheck | null,
): InsufficientFundsCheckingAlert | null {
  if (paymentAmount <= 0) return null;

  const payDate = resolvedPaycheck?.date ?? null;
  const payAmount = resolvedPaycheck?.alreadyReceived ? 0 : (resolvedPaycheck?.amount ?? 0);
  const paycheckBeforePayment = Boolean(payDate && payDate.getTime() <= paymentDate.getTime());
  const currentShortfall = Math.max(0, paymentAmount - balance);

  if (currentShortfall <= 0) return null;

  if (paycheckBeforePayment && balance + payAmount >= paymentAmount) {
    return {
      outcome: 'covered_after_paycheck',
      currentShortfall,
      shortfallAfterPaycheck: null,
      paycheckArrivesBeforePayment: true,
      resolvedPaycheck,
    };
  }

  if (paycheckBeforePayment) {
    const shortfallAfterPaycheck = Math.max(0, paymentAmount - balance - payAmount);
    return {
      outcome: 'shortfall_before_and_after_pay',
      currentShortfall,
      shortfallAfterPaycheck,
      paycheckArrivesBeforePayment: true,
      resolvedPaycheck,
    };
  }

  return {
    outcome: 'shortfall_current_only',
    currentShortfall,
    shortfallAfterPaycheck: null,
    paycheckArrivesBeforePayment: false,
    resolvedPaycheck,
  };
}

function paycheckLabel(paycheck: EstimatedPaycheck | null): string {
  if (!paycheck) return 'dépôt de paie';
  return paycheck.source === 'actual' ? 'dépôt de paie' : 'dépôt de paie estimé';
}

export function buildInsufficientFundsAlertCopy(
  paymentName: string,
  alert: InsufficientFundsCheckingAlert,
  formatMoney: (value: number) => string,
  formatPayDate: (date: Date) => string,
  daysUntilPaymentLabel: string,
): {
  forecastMessage: string;
  paymentLine: string;
  tone: 'success' | 'warning';
  riskBeforePay: boolean;
} {
  const quotedName = `« ${formatPersonDirectedPaymentLabel(paymentName)} »`;
  const pay = alert.resolvedPaycheck;
  const payPhrase = pay
    ? `${paycheckLabel(pay)} de ${formatMoney(pay.amount)} (${formatPayDate(pay.date)})`
    : paycheckLabel(pay);

  if (alert.outcome === 'covered_after_paycheck') {
    const payDateStr = pay ? ` le ${formatPayDate(pay.date)}` : '';
    return {
      forecastMessage: `Couvert par ta paie${payDateStr}.`,
      paymentLine: `Couvert · ${daysUntilPaymentLabel}`,
      tone: 'success',
      riskBeforePay: false,
    };
  }

  if (alert.outcome === 'shortfall_before_and_after_pay' && alert.shortfallAfterPaycheck != null) {
    const displayName = formatPersonDirectedPaymentLabel(paymentName);
    return {
      forecastMessage: `Il manque ${formatMoney(alert.currentShortfall)} pour le paiement de ${displayName}.`,
      paymentLine: `Manque ${formatMoney(alert.currentShortfall)} · ${daysUntilPaymentLabel}`,
      tone: 'warning',
      riskBeforePay: false,
    };
  }

  const noPayFragment = !alert.paycheckArrivesBeforePayment ? " Paie après l'échéance." : '';
  const displayName = formatPersonDirectedPaymentLabel(paymentName);

  return {
    forecastMessage: `Il manque ${formatMoney(alert.currentShortfall)} pour le paiement de ${displayName}.${noPayFragment}`.trim(),
    paymentLine: `Manque ${formatMoney(alert.currentShortfall)} · ${daysUntilPaymentLabel}`,
    tone: 'warning',
    riskBeforePay: !alert.paycheckArrivesBeforePayment,
  };
}

export function paycheckTimelineLegendLabel(paycheck: EstimatedPaycheck | null, formatPayDate: (date: Date) => string): string {
  if (!paycheck) return 'Dépôt de paie';
  const prefix = paycheck.source === 'actual' ? 'Dépôt de paie' : 'Dépôt de paie estimé';
  return `${prefix} · ${formatPayDate(paycheck.date)}`;
}
