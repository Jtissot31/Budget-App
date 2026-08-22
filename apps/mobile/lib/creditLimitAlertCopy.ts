/**
 * Credit-limit alert title copy — pure helpers (no React Native).
 * Threshold: rounded utilization ≥ 99 % (or already over limit) → exceeded wording.
 * Exactly 98 % and below → approaching.
 */

export const CREDIT_LIMIT_EXCEEDED_TITLE_PCT = 99;

export const CREDIT_LIMIT_ALERT_REASONS = {
  approaching: 'La marge approche dangereusement la limite',
  exceeded: 'Marge de crédit dépassée',
} as const;

/** True when credit-limit alert title should use the exceeded wording. */
export function isCreditLimitExceededTitle(
  utilizationAfterPct?: number | null,
  isOverLimit?: boolean,
): boolean {
  if (isOverLimit) return true;
  if (typeof utilizationAfterPct !== 'number' || !Number.isFinite(utilizationAfterPct)) {
    return false;
  }
  return Math.round(utilizationAfterPct) >= CREDIT_LIMIT_EXCEEDED_TITLE_PCT;
}

/**
 * Payment/subscription credit-limit reason — condition only (no merchant in title).
 * `paymentName` kept for call-site compatibility; name stays in body/metadata.
 */
export function buildCreditLimitAlertReason(
  _paymentName?: string,
  utilizationAfterPct?: number | null,
  isOverLimit?: boolean,
): string {
  if (isCreditLimitExceededTitle(utilizationAfterPct, isOverLimit)) {
    return CREDIT_LIMIT_ALERT_REASONS.exceeded;
  }
  return CREDIT_LIMIT_ALERT_REASONS.approaching;
}

/** Parse « 91 % » / « environ 91% » from alert body for Accueil / Messages titles. */
export function parseUtilizationPctFromMessage(message?: string | null): number | null {
  const pct = message?.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!pct) return null;
  const n = Number(pct[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
