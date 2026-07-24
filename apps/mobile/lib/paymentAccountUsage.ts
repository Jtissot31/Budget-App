import {
  parseAccountIdFromNote,
  parseTransferAccountsFromNote,
} from '@/lib/accountTransactionFlow';
import type { Transaction } from '@/types';

/** How often each account was used as a payment / deposit / transfer source. */
export function countPaymentAccountUsage(
  transactions: readonly Pick<Transaction, 'type' | 'note'>[],
): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (id: string | null | undefined) => {
    const trimmed = id?.trim();
    if (!trimmed) return;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  };

  for (const tx of transactions) {
    if (tx.type === 'transfer') {
      const compteId = parseAccountIdFromNote(tx.note);
      if (compteId) {
        // Person transfer / compte: line — count that payment account.
        bump(compteId);
        continue;
      }
      const { sourceId } = parseTransferAccountsFromNote(tx.note);
      bump(sourceId);
      continue;
    }

    bump(parseAccountIdFromNote(tx.note));
  }

  return counts;
}

/**
 * Most-used accounts first; ties broken by French label (stable secondary sort).
 * Does not mutate the input array.
 */
export function sortByPaymentAccountUsage<T extends { id: string; label: string }>(
  options: readonly T[],
  usageCounts: ReadonlyMap<string, number>,
): T[] {
  return [...options].sort((a, b) => {
    const usageDiff = (usageCounts.get(b.id) ?? 0) - (usageCounts.get(a.id) ?? 0);
    if (usageDiff !== 0) return usageDiff;
    return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
  });
}
