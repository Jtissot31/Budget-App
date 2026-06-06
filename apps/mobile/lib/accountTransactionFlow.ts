import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import type { SavingsGoal, SimulatedAccount, Transaction, TransactionType } from '@/types';

export type AccountMoneyFlow = {
  moneyIn: number;
  moneyOut: number;
};

export function parseAccountIdFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('compte:'));
  return line?.slice('compte:'.length).trim() || null;
}

export function resolveAccountIdLabel(
  accountId: string,
  accounts: readonly SimulatedAccount[] = [],
): string {
  const simulated =
    accounts.find((account) => account.id === accountId) ??
    accounts.find((account) => account.name.trim().toLowerCase() === accountId.toLowerCase());
  if (simulated) {
    const name = simulated.name.trim();
    return simulated.last4 ? `${name} • ${simulated.last4}` : name;
  }

  const manual = MANUAL_ENTRY_ACCOUNTS.find((account) => account.id === accountId);
  if (manual) return manual.label;

  return accountId;
}

export function resolveEndpointLabel(
  endpointId: string,
  accounts: readonly SimulatedAccount[] = [],
  savingsGoals: readonly Pick<SavingsGoal, 'id' | 'name'>[] = [],
): string {
  const goal = savingsGoals.find((item) => item.id === endpointId);
  if (goal) return goal.name.trim();

  return resolveAccountIdLabel(endpointId, accounts);
}

export function resolveTransactionAccountLabel(
  tx: Pick<Transaction, 'type' | 'note'>,
  accounts: readonly SimulatedAccount[] = [],
): string | null {
  if (tx.type !== 'expense') return null;

  const accountId = parseAccountIdFromNote(tx.note);
  if (!accountId) return null;

  return resolveAccountIdLabel(accountId, accounts);
}

export function getTransactionPaymentMethodFieldLabel(type: TransactionType): string {
  if (type === 'income') return 'Compte de dépôt';
  if (type === 'transfer') return 'Transfert';
  return 'Payé avec';
}

export function resolveTransactionPaymentMethodLabel(
  tx: Pick<Transaction, 'type' | 'note'>,
  context: {
    accounts?: readonly SimulatedAccount[];
    savingsGoals?: readonly Pick<SavingsGoal, 'id' | 'name'>[];
  } = {},
): string | null {
  const accounts = context.accounts ?? [];
  const savingsGoals = context.savingsGoals ?? [];

  if (tx.type === 'transfer') {
    const { sourceId, destinationId } = parseTransferAccountsFromNote(tx.note);
    const source = sourceId ? resolveEndpointLabel(sourceId, accounts, savingsGoals) : null;
    const destination = destinationId ? resolveEndpointLabel(destinationId, accounts, savingsGoals) : null;
    if (source && destination) return `${source} → ${destination}`;
    if (source) return source;
    if (destination) return destination;
    return null;
  }

  const accountId = parseAccountIdFromNote(tx.note);
  if (!accountId) return null;

  return resolveEndpointLabel(accountId, accounts, savingsGoals);
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

export type InsufficientFundsViolation = {
  accountId: string;
  accountLabel: string;
};

/** Returns the first checking/savings account that would drop below zero after applying transaction deltas. */
export function findInsufficientFundsViolation(
  accounts: readonly SimulatedAccount[],
  nextDeltas: Array<{ id: string; delta: number }>,
  previousTx?: Pick<Transaction, 'amount' | 'type' | 'note'> | null,
): InsufficientFundsViolation | null {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const netDeltas = new Map<string, number>();

  if (previousTx) {
    for (const { id, delta } of getTransactionAccountDeltas(previousTx)) {
      netDeltas.set(id, (netDeltas.get(id) ?? 0) - delta);
    }
  }

  for (const { id, delta } of nextDeltas) {
    netDeltas.set(id, (netDeltas.get(id) ?? 0) + delta);
  }

  for (const [accountId, delta] of netDeltas) {
    if (delta >= 0) continue;
    const account = accountById.get(accountId);
    if (!account || (account.kind !== 'checking' && account.kind !== 'savings')) continue;
    if (account.balance + delta < 0) {
      const name = account.name.trim();
      return {
        accountId,
        accountLabel: account.last4 ? `${name} • ${account.last4}` : name,
      };
    }
  }

  return null;
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
