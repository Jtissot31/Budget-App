import { getSetting, setSetting } from '@/lib/db';
import {
  listRecentExpenseTransactions,
  transactionNeedsReview,
} from '@/lib/transactionInsights';
import type { Transaction } from '@/types';

export const IGNORED_REVIEW_TRANSACTION_IDS_KEY = 'ignored_review_transaction_ids';
export const SEEN_REVIEW_TRANSACTION_IDS_KEY = 'seen_review_transaction_ids';

export type TransactionReviewSettings = {
  ignoredIds: string[];
  seenIds: string[];
};

function parseIdList(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

function serializeIdList(ids: readonly string[]): string {
  return JSON.stringify([...new Set(ids)]);
}

export async function getTransactionReviewSettings(): Promise<TransactionReviewSettings> {
  const [ignoredRaw, seenRaw] = await Promise.all([
    getSetting(IGNORED_REVIEW_TRANSACTION_IDS_KEY, '[]'),
    getSetting(SEEN_REVIEW_TRANSACTION_IDS_KEY, '[]'),
  ]);

  return {
    ignoredIds: parseIdList(ignoredRaw),
    seenIds: parseIdList(seenRaw),
  };
}

const silentSetting = { emit: false as const };

export async function ignoreReviewTransaction(transactionId: string): Promise<void> {
  const settings = await getTransactionReviewSettings();
  if (settings.ignoredIds.includes(transactionId)) return;
  await setSetting(
    IGNORED_REVIEW_TRANSACTION_IDS_KEY,
    serializeIdList([...settings.ignoredIds, transactionId]),
    silentSetting,
  );
}

export async function markReviewTransactionsSeen(transactionIds: readonly string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  const settings = await getTransactionReviewSettings();
  const next = new Set([...settings.seenIds, ...transactionIds]);
  await setSetting(SEEN_REVIEW_TRANSACTION_IDS_KEY, serializeIdList([...next]), silentSetting);
}

function sameIdList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

/** Drop stale ignored/seen ids outside the review window or no longer incomplete. */
export function pruneTransactionReviewSettings(
  transactions: readonly Transaction[],
  settings: TransactionReviewSettings,
): TransactionReviewSettings {
  const recentExpenses = listRecentExpenseTransactions(transactions);
  const recentIds = new Set(recentExpenses.map((tx) => tx.id));
  const stillIncomplete = new Set(
    recentExpenses.filter(transactionNeedsReview).map((tx) => tx.id),
  );

  return {
    ignoredIds: settings.ignoredIds.filter((id) => recentIds.has(id) && stillIncomplete.has(id)),
    seenIds: settings.seenIds.filter((id) => recentIds.has(id) && stillIncomplete.has(id)),
  };
}

async function persistTransactionReviewSettings(settings: TransactionReviewSettings): Promise<void> {
  await Promise.all([
    setSetting(IGNORED_REVIEW_TRANSACTION_IDS_KEY, serializeIdList(settings.ignoredIds), silentSetting),
    setSetting(SEEN_REVIEW_TRANSACTION_IDS_KEY, serializeIdList(settings.seenIds), silentSetting),
  ]);
}

export async function syncTransactionReviewSettings(
  transactions: readonly Transaction[],
): Promise<TransactionReviewSettings> {
  const stored = await getTransactionReviewSettings();
  const pruned = pruneTransactionReviewSettings(transactions, stored);
  if (!sameIdList(stored.ignoredIds, pruned.ignoredIds) || !sameIdList(stored.seenIds, pruned.seenIds)) {
    await persistTransactionReviewSettings(pruned);
  }
  return pruned;
}
