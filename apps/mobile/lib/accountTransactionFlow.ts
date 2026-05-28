import type { Transaction } from '@/types';

export type AccountMoneyFlow = {
  moneyIn: number;
  moneyOut: number;
};

export function parseAccountIdFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('compte:'));
  return line?.slice('compte:'.length).trim() || null;
}

export function parseTransferAccountsFromNote(note?: string): { sourceId: string | null; destinationId: string | null } {
  const line = note?.split('\n').find((part) => part.startsWith('transfert:'));
  const match = /^transfert:(.+)->(.+)$/.exec(line ?? '');
  return {
    sourceId: match?.[1]?.trim() || null,
    destinationId: match?.[2]?.trim() || null,
  };
}

/** Same balance semantics as `adjustSimulatedAccountBalance` / account detail: income +amount, expense −amount, transfers ±amount. */
export function getTransactionAccountDeltas(tx: Pick<Transaction, 'amount' | 'type' | 'note'>): Array<{ id: string; delta: number }> {
  if (tx.type === 'transfer') {
    const transfer = parseTransferAccountsFromNote(tx.note);
    return [
      transfer.sourceId ? { id: transfer.sourceId, delta: -tx.amount } : null,
      transfer.destinationId ? { id: transfer.destinationId, delta: tx.amount } : null,
    ].filter((item): item is { id: string; delta: number } => item !== null);
  }

  const accountId = parseAccountIdFromNote(tx.note);
  if (!accountId) return [];
  return [{ id: accountId, delta: tx.type === 'income' ? tx.amount : -tx.amount }];
}

export function accumulateAccountMoneyFlows(transactions: Iterable<Transaction>): Map<string, AccountMoneyFlow> {
  const map = new Map<string, AccountMoneyFlow>();

  for (const tx of transactions) {
    for (const { id, delta } of getTransactionAccountDeltas(tx)) {
      const cur = map.get(id) ?? { moneyIn: 0, moneyOut: 0 };
      if (delta > 0) {
        cur.moneyIn += delta;
      } else if (delta < 0) {
        cur.moneyOut += -delta;
      }
      map.set(id, cur);
    }
  }

  return map;
}
