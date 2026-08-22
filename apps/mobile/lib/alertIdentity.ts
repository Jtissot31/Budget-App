/**
 * Stable alert identity: type + scoping entity + period.
 *
 * Identity must never be derived from user-facing copy. Titles carry volatile parts
 * (overrun amounts, merchant names) and get rewritten by normalizers, so keying alerts
 * on their title made every copy change look like a brand-new alert.
 *
 * Run tests: npx --yes tsx --tsconfig tsconfig.json lib/alertIdentity.test.ts
 */

import type { AIAlert } from '@/lib/ai/types';
import { getLocalMonthKey, monthKeyFromDate } from '@/lib/monthRangeFilter';

/** Alert taxonomy shared by identity keys, cooldowns and caps (mirrors alert type preferences). */
export type AlertKindKey =
  | 'credit_limit'
  | 'low_funds'
  | 'balance_low'
  | 'budget_over'
  | 'plan_adaptation'
  | 'fyn'
  | 'other';

/** Persisted alert list cap (oldest rows fall off). */
export const MAX_STORED_ALERTS = 50;

/** Minimum shape needed to derive an identity from a stored alert. */
export type IdentifiableAlert = Pick<
  AIAlert,
  'categorie' | 'titre' | 'message' | 'createdAt' | 'id'
> &
  Partial<Pick<AIAlert, 'dedupeKey' | 'compteReference' | 'adaptationProposalId' | 'relatedPlanId'>>;

export type AlertIdentityOptions = {
  /** Maps a legacy budget alert's category name to its stable category id. */
  resolveBudgetCategoryId?: (categoryName: string) => string | undefined;
};

function slug(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'inconnu';
}

export function budgetOverAlertKey(categoryRef: string, monthKey: string): string {
  return `budget_over:${slug(categoryRef)}:${monthKey}`;
}

export function currentBudgetOverAlertKey(categoryRef: string, now: Date = new Date()): string {
  return budgetOverAlertKey(categoryRef, monthKeyFromDate(now));
}

export function balanceLowAlertKey(accountRef: string): string {
  return `balance_low:${slug(accountRef)}`;
}

export function planAdaptationAlertKey(planId: string, kind: string): string {
  return `plan_adaptation:${slug(planId)}:${slug(kind)}`;
}

/** Payment-derived alerts (credit limit / low funds) are scoped by their payment source. */
export function paymentAlertIdentityKey(kind: string, sourceId: string): string {
  return `${slug(kind)}:${slug(sourceId)}`;
}

export function genericAlertKey(kind: AlertKindKey, ref: string): string {
  return `${kind}:${slug(ref)}`;
}

/**
 * Strip legacy overrun amounts from budget titles
 * (e.g. « Budget Épicerie dépassé de 324,95$ » → « Budget Épicerie dépassé »).
 */
export function normalizeBudgetOverTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;
  return trimmed.replace(/(dépassée?)(\s+de\s+[\d\s\u00a0\u202f.,]+(?:[KkMm])?\$)/gi, '$1');
}

/**
 * Category from « Budget Épicerie dépassé… » titles; undefined for bare « Budget dépassé… ».
 * The trailing lookahead replaces `\b`, which never matches after an accented letter.
 */
export function budgetCategoryFromAlertTitle(title: string): string | undefined {
  const match = title.trim().match(/^Budget\s+(.+?)\s+dépassée?(?!\p{L})/iu);
  const name = match?.[1]?.trim();
  return name || undefined;
}

function budgetCategoryFromMessage(message: string): string | undefined {
  const enveloppe = message.match(/enveloppe\s+(.+?)\s+a\s+(?:été\s+)?dépassée/i);
  if (enveloppe?.[1]?.trim()) return enveloppe[1].trim();
  // Legacy copy: « Tu as dépassé ton budget Épicerie ce mois-ci. »
  const legacy = message.match(/budget\s+(.+?)\s+ce mois/i);
  return legacy?.[1]?.trim() || undefined;
}

/** Named enveloppe overrun (e.g. Épicerie) vs legacy/global « Budget dépassé ». */
export function extractBudgetOverCategory(
  title?: string | null,
  message?: string | null,
): string | undefined {
  return budgetCategoryFromAlertTitle(title ?? '') ?? budgetCategoryFromMessage(message ?? '');
}

function balanceAccountFromMessage(message: string): string | undefined {
  const match = message.match(/solde\s+de\s+(.+?)\s+est\s+bas/i);
  return match?.[1]?.trim() || undefined;
}

/** Taxonomy bucket for a persisted alert (pure — safe for storage-layer code). */
export function alertKindKeyForAiAlert(
  alert: Pick<IdentifiableAlert, 'categorie'> & Partial<Pick<AIAlert, 'adaptationProposalId'>>,
): AlertKindKey {
  if (alert.categorie === 'plan' || alert.adaptationProposalId) return 'plan_adaptation';
  if (alert.categorie === 'budget') return 'budget_over';
  if (alert.categorie === 'solde_bas') return 'balance_low';
  if (alert.categorie === 'fonds_insuffisants') return 'low_funds';
  if (alert.categorie === 'credit') return 'credit_limit';
  if (alert.categorie === 'autre') return 'other';
  return 'fyn';
}

/**
 * Identity for a stored alert. Rows written before identity keys existed are
 * back-filled from their scoping metadata (never from the volatile part of the copy).
 */
export function resolveAlertIdentityKey(
  alert: IdentifiableAlert,
  options?: AlertIdentityOptions,
): string {
  const stored = alert.dedupeKey?.trim();
  if (stored) return stored;

  const kind = alertKindKeyForAiAlert(alert);

  switch (kind) {
    case 'budget_over': {
      const categoryName = extractBudgetOverCategory(alert.titre, alert.message);
      const categoryId = categoryName
        ? options?.resolveBudgetCategoryId?.(categoryName)
        : undefined;
      return budgetOverAlertKey(categoryId ?? categoryName ?? 'global', getLocalMonthKey(alert.createdAt));
    }
    case 'plan_adaptation':
      return planAdaptationAlertKey(
        alert.relatedPlanId ?? alert.adaptationProposalId ?? alert.id,
        'legacy',
      );
    case 'balance_low':
      return balanceLowAlertKey(
        alert.compteReference ?? balanceAccountFromMessage(alert.message) ?? alert.titre,
      );
    default:
      return genericAlertKey(kind, normalizeBudgetOverTitle(alert.titre));
  }
}

function timeOf(iso: string): number {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

/**
 * Collapse copies of one condition into a single row:
 * freshest copy for the content, oldest for identity and first-seen time.
 */
function mergeDuplicateAlerts(group: AIAlert[], dedupeKey: string): AIAlert {
  if (group.length === 1) return { ...group[0], dedupeKey };

  const byAge = [...group].sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
  const oldest = byAge[0];
  const newest = byAge[byAge.length - 1];
  const lastRaisedAt = byAge.reduce(
    (latest, alert) => (timeOf(alert.raisedAt ?? alert.createdAt) > timeOf(latest) ? (alert.raisedAt ?? alert.createdAt) : latest),
    oldest.raisedAt ?? oldest.createdAt,
  );

  return {
    ...newest,
    id: oldest.id,
    createdAt: oldest.createdAt,
    // A copy the user already dismissed means the condition was seen — do not nag again.
    lu: group.some((alert) => alert.lu),
    dedupeKey,
    raisedAt: lastRaisedAt,
    raisedMontant: newest.raisedMontant ?? newest.montant,
  };
}

/** One row per identity, keeping the order of first appearance. */
export function dedupeAiAlerts(alerts: AIAlert[], options?: AlertIdentityOptions): AIAlert[] {
  const order: string[] = [];
  const groups = new Map<string, AIAlert[]>();

  for (const alert of alerts) {
    const key = resolveAlertIdentityKey(alert, options);
    const group = groups.get(key);
    if (group) {
      group.push(alert);
      continue;
    }
    groups.set(key, [alert]);
    order.push(key);
  }

  return order.map((key) => mergeDuplicateAlerts(groups.get(key) ?? [], key));
}

/**
 * Self-healing pass for the persisted list: normalize legacy budget titles, back-fill
 * identity keys, then collapse the duplicates those legacy titles produced.
 */
export function repairStoredAlerts(alerts: AIAlert[], options?: AlertIdentityOptions): AIAlert[] {
  const normalized = alerts.map((alert) =>
    alert.categorie === 'budget' ? { ...alert, titre: normalizeBudgetOverTitle(alert.titre) } : alert,
  );
  return dedupeAiAlerts(normalized, options).slice(0, MAX_STORED_ALERTS);
}

/** Compose/render backstop: never show two entries sharing one identity. */
export function dedupeAlertItemsByIdentity<T extends { id: string; dedupeKey?: string; read?: boolean }>(
  items: T[],
): T[] {
  const seen = new Map<string, T>();
  const order: string[] = [];

  for (const item of items) {
    const key = item.dedupeKey?.trim() || item.id;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      order.push(key);
      continue;
    }
    // Keep the first (newest) entry, but an unread copy must keep the badge lit.
    if (existing.read && item.read === false) {
      seen.set(key, { ...existing, read: false });
    }
  }

  return order.map((key) => seen.get(key) as T);
}
