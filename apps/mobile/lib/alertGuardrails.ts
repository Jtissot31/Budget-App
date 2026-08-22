/**
 * Anti-spam guardrails for alerts: cooldown before the same condition is raised again,
 * and a cap on how many alerts of one type can be on screen at once.
 *
 * Run tests: npx --yes tsx --tsconfig tsconfig.json lib/alertGuardrails.test.ts
 */

import type { AlertKindKey } from '@/lib/alertIdentity';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long an identity stays quiet after being surfaced, before it may be raised again.
 * Budget overruns are month-scoped by identity, so the window covers a whole month.
 */
export const ALERT_RERAISE_COOLDOWN_MS: Record<AlertKindKey, number> = {
  budget_over: 31 * DAY_MS,
  balance_low: DAY_MS,
  low_funds: DAY_MS,
  credit_limit: DAY_MS,
  plan_adaptation: 7 * DAY_MS,
  fyn: DAY_MS,
  other: DAY_MS,
};

/** A condition may jump its cooldown only when it gets materially worse. */
export const ALERT_WORSENING_RATIO = 1.5;
export const ALERT_WORSENING_MIN_DELTA = 25;

/** Simultaneous alerts of one type before the rest collapse into a single aggregate. */
export const ALERT_MAX_CONCURRENT: Record<AlertKindKey, number> = {
  budget_over: 3,
  balance_low: 3,
  low_funds: 3,
  credit_limit: 3,
  plan_adaptation: 3,
  fyn: 5,
  other: 5,
};

export type AlertRaiseDecision =
  /** No row for this identity yet. */
  | 'insert'
  /** Row exists and stays as-is for the user — refresh its content only. */
  | 'update'
  /** Cooldown elapsed (or the condition worsened) — surface it as unread again. */
  | 'reraise';

export type ExistingRaiseState = {
  lu: boolean;
  createdAt: string;
  raisedAt?: string;
  raisedMontant?: number | null;
  montant?: number | null;
};

function timeOf(value: string | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/** Growth big enough to be worth interrupting the user again inside a cooldown. */
export function hasMateriallyWorsened(
  previousAmount: number | null | undefined,
  nextAmount: number | null | undefined,
): boolean {
  if (previousAmount == null || nextAmount == null) return false;
  const previous = Math.abs(previousAmount);
  const next = Math.abs(nextAmount);
  if (previous <= 0) return next >= ALERT_WORSENING_MIN_DELTA;
  return next >= previous * ALERT_WORSENING_RATIO && next - previous >= ALERT_WORSENING_MIN_DELTA;
}

export function decideAlertRaise(params: {
  type: AlertKindKey;
  now: Date | number;
  existing?: ExistingRaiseState | null;
  montant?: number | null;
}): AlertRaiseDecision {
  const { existing } = params;
  if (!existing) return 'insert';
  // Already sitting unread in the list — refreshing the copy is enough.
  if (!existing.lu) return 'update';

  const now = typeof params.now === 'number' ? params.now : params.now.getTime();
  const lastRaised = timeOf(existing.raisedAt ?? existing.createdAt);
  const elapsed = now - lastRaised;
  if (elapsed >= ALERT_RERAISE_COOLDOWN_MS[params.type]) return 'reraise';

  const previousAmount = existing.raisedMontant ?? existing.montant;
  return hasMateriallyWorsened(previousAmount, params.montant) ? 'reraise' : 'update';
}

/**
 * Keep at most N alerts per type, in list order, and hand the overflow to `aggregate`
 * so callers can render one summary row in place of the hidden entries.
 */
export function capAlertsPerType<T>(
  items: T[],
  options: {
    typeOf: (item: T) => AlertKindKey | null;
    aggregate: (type: AlertKindKey, hidden: T[]) => T | null;
    maxPerType?: Partial<Record<AlertKindKey, number>>;
  },
): T[] {
  const counts = new Map<AlertKindKey, number>();
  const hidden = new Map<AlertKindKey, T[]>();
  const aggregateSlots = new Map<AlertKindKey, number>();
  const kept: T[] = [];

  for (const item of items) {
    const type = options.typeOf(item);
    if (!type) {
      kept.push(item);
      continue;
    }

    const seen = (counts.get(type) ?? 0) + 1;
    counts.set(type, seen);

    const max = options.maxPerType?.[type] ?? ALERT_MAX_CONCURRENT[type];
    if (seen <= max) {
      kept.push(item);
      continue;
    }

    if (!aggregateSlots.has(type)) aggregateSlots.set(type, kept.length);
    hidden.set(type, [...(hidden.get(type) ?? []), item]);
  }

  const insertions = [...aggregateSlots.entries()]
    .map(([type, index]) => ({ type, index, item: options.aggregate(type, hidden.get(type) ?? []) }))
    .filter((entry): entry is { type: AlertKindKey; index: number; item: T } => entry.item != null)
    .sort((a, b) => b.index - a.index);

  for (const insertion of insertions) {
    kept.splice(insertion.index, 0, insertion.item);
  }

  return kept;
}
