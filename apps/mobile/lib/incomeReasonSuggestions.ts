import { parseRaisonFromNote } from '@/lib/accountTransactionFlow';
import { getLastIncomeReasonForContact } from '@/lib/contactHistory';
import { getSetting, setSetting } from '@/lib/db';
import type { Transaction } from '@/types';

const INCOME_REASON_SUGGESTIONS_KEY = 'income_reason_suggestions';

export const EMPLOYER_INCOME_REASON = 'Salaire' as const;

export const DEFAULT_INCOME_REASONS = [
  EMPLOYER_INCOME_REASON,
  'Travail',
  'Vente',
  'Don',
  'Remboursement',
  'Prime',
] as const;

function parseCustomSuggestions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function normalizeReasonKey(reason: string): string {
  return reason.trim().toLowerCase();
}

function mergeIncomeReasonSuggestions(custom: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const reason of [...DEFAULT_INCOME_REASONS, ...custom]) {
    const trimmed = reason.trim();
    const key = normalizeReasonKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }

  return merged;
}

export async function getIncomeReasonSuggestions(): Promise<string[]> {
  const raw = await getSetting(INCOME_REASON_SUGGESTIONS_KEY, '[]');
  return mergeIncomeReasonSuggestions(parseCustomSuggestions(raw));
}

/** Most recent non-empty income reason across all income transactions. */
export function getLastGlobalIncomeReason(transactions: Transaction[]): string | null {
  const incomeTxs = transactions
    .filter((tx) => tx.type === 'income')
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  for (const tx of incomeTxs) {
    const reason = parseRaisonFromNote(tx.note);
    if (reason?.trim()) return reason.trim();
  }

  return null;
}

/** Pick reason after selecting an income source contact or employer. */
export function resolveIncomeReasonForSelectedContact(
  transactions: Transaction[],
  contactName: string,
  isEmployer: boolean,
): string {
  const fromContact = getLastIncomeReasonForContact(transactions, contactName);
  if (fromContact) return fromContact;
  if (isEmployer) return EMPLOYER_INCOME_REASON;
  return getLastGlobalIncomeReason(transactions) ?? '';
}

export async function saveIncomeReasonSuggestion(reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) return;

  const isDefault = DEFAULT_INCOME_REASONS.some(
    (preset) => normalizeReasonKey(preset) === normalizeReasonKey(trimmed),
  );
  if (isDefault) return;

  const raw = await getSetting(INCOME_REASON_SUGGESTIONS_KEY, '[]');
  const custom = parseCustomSuggestions(raw);
  const key = normalizeReasonKey(trimmed);
  if (custom.some((item) => normalizeReasonKey(item) === key)) return;

  await setSetting(INCOME_REASON_SUGGESTIONS_KEY, JSON.stringify([...custom, trimmed]));
}
