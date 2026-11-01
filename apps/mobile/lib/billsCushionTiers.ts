/**
 * « Factures d'avance » — a cushion that covers the user's recurring payments (rent, insurance,
 * subscriptions…) so direct debits always go through, even if a paycheque is late.
 *
 * It is a ladder of small, reachable steps instead of one big target: 2 weeks → 1 month →
 * 2 months → 3 months of recurring payments. The goal's target is always the next step the
 * saved amount hasn't reached yet, so it adjusts itself to how much the user puts aside.
 * Pure: no I/O (see `billsCushion.ts` for the storage side).
 */
import type { RecurringPayment } from '@/types';

export const BILLS_GOAL_PREFIX = 'Factures d’avance';

export type CushionTier = {
  id: '2w' | '1m' | '2m' | '3m';
  /** « 2 semaines », « 1 mois »… */
  label: string;
  /** How many months of recurring payments this step covers. */
  months: number;
  amount: number;
};

const TIER_DEFS: { id: CushionTier['id']; label: string; months: number }[] = [
  { id: '2w', label: '2 semaines', months: 0.5 },
  { id: '1m', label: '1 mois', months: 1 },
  { id: '2m', label: '2 mois', months: 2 },
  { id: '3m', label: '3 mois', months: 3 },
];

function monthlyEquivalent(payment: RecurringPayment): number {
  const amount = Number.isFinite(payment.amount) ? Math.max(0, payment.amount) : 0;
  switch (payment.frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'biweekly':
      return (amount * 26) / 12;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

/** What the user owes every month in recurring payments (income excluded). */
export function monthlyRecurringBills(payments: readonly RecurringPayment[]): number {
  return payments
    .filter((payment) => payment.active && (payment.kind ?? 'payment') !== 'income')
    .reduce((sum, payment) => sum + monthlyEquivalent(payment), 0);
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

/** The four steps for a given monthly bill total, strictly increasing. */
export function cushionTiers(monthlyBills: number): CushionTier[] {
  const base = monthlyBills > 0 ? monthlyBills : 1000;
  const tiers: CushionTier[] = [];
  let previous = 0;
  for (const def of TIER_DEFS) {
    const amount = Math.max(roundTo(base * def.months, 50), previous + 50);
    tiers.push({ ...def, amount });
    previous = amount;
  }
  return tiers;
}

export type TierProgress = {
  /** The step currently being worked on (the last one once everything is reached). */
  current: CushionTier;
  /** Steps already covered by the saved amount. */
  reached: CushionTier[];
  /** True when even the last step is covered. */
  complete: boolean;
};

export function tierProgress(saved: number, tiers: readonly CushionTier[]): TierProgress {
  const reached = tiers.filter((tier) => saved >= tier.amount);
  const next = tiers.find((tier) => saved < tier.amount);
  const last = tiers[tiers.length - 1] as CushionTier;
  return { current: next ?? last, reached, complete: next == null };
}

/** Months needed to reach `target` from `saved` at `monthly` per month (null when not saving). */
export function monthsToReach(target: number, saved: number, monthly: number): number | null {
  const remaining = Math.max(0, target - saved);
  if (remaining === 0) return 0;
  if (!(monthly > 0)) return null;
  return Math.ceil(remaining / monthly);
}

/** « Factures d'avance · 2 semaines » — the tier shows in the name so progress stays readable. */
export function billsGoalName(tier: CushionTier): string {
  return `${BILLS_GOAL_PREFIX} · ${tier.label}`;
}

export function isBillsGoalName(name: string): boolean {
  return name.startsWith(BILLS_GOAL_PREFIX);
}
