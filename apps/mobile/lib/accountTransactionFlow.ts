import { DASHBOARD_ACCOUNTS } from '@/constants/dashboardMockAccounts';
import { MANUAL_ENTRY_ACCOUNTS } from '@/constants/manualEntryAccounts';
import type { ReceiptStatus, SavingsGoal, SimulatedAccount, Transaction, TransactionType } from '@/types';

function normalizeAccountLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function last4RedundantWithName(name: string, last4: string): boolean {
  const trimmedLast4 = last4.trim();
  if (!trimmedLast4) return true;

  const normalizedName = normalizeAccountLabel(name);
  const normalizedLast4 = normalizeAccountLabel(trimmedLast4);
  if (normalizedName.endsWith(normalizedLast4)) return true;

  const suffixPatterns = [
    `· ${trimmedLast4}`,
    `·${trimmedLast4}`,
    `• ${trimmedLast4}`,
    `•${trimmedLast4}`,
    `****${trimmedLast4}`,
    `····${trimmedLast4}`,
  ];
  return suffixPatterns.some((pattern) => name.includes(pattern));
}

/** Picker / detail label — appends last4 only when the name does not already include it. */
export function formatPaymentAccountLabel(name: string, last4?: string | null): string {
  const trimmedName = name.trim();
  if (!trimmedName) return '';
  const trimmedLast4 = last4?.trim();
  if (!trimmedLast4 || last4RedundantWithName(trimmedName, trimmedLast4)) return trimmedName;
  return `${trimmedName} • ${trimmedLast4}`;
}

function isBareNumericAccountId(accountId: string): boolean {
  return /^\d+$/.test(accountId.trim());
}

export function getTransactionTypeLabel(type: TransactionType): string {
  if (type === 'income') return 'Revenu';
  if (type === 'transfer') return 'Transfert';
  return 'Dépense';
}

export function getReceiptStatusLabel(
  status?: ReceiptStatus | null,
  receiptUri?: string | null,
): string | null {
  if (status === 'scan_pending') return 'À scanner';
  if (status === 'attached' || receiptUri) return 'Reçu joint';
  return null;
}

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
  const trimmedId = accountId.trim();
  const simulated =
    accounts.find((account) => account.id === trimmedId) ??
    accounts.find((account) => account.name.trim().toLowerCase() === trimmedId.toLowerCase());
  if (simulated) {
    return formatPaymentAccountLabel(simulated.name, simulated.last4);
  }

  const dashboard = DASHBOARD_ACCOUNTS.find((account) => account.id === trimmedId);
  if (dashboard) {
    const last4 = dashboard.number.replace(/\D/g, '').slice(-4);
    return formatPaymentAccountLabel(dashboard.name, last4);
  }

  const manual = MANUAL_ENTRY_ACCOUNTS.find((account) => account.id === trimmedId);
  if (manual) return manual.label;

  if (isBareNumericAccountId(trimmedId)) return 'Compte supprimé';
  return trimmedId;
}

export function resolvePaymentAccountLabel(
  accountId: string,
  accounts: readonly SimulatedAccount[] = [],
  accountOptions: readonly { id: string; label: string }[] = [],
): string {
  const resolved = resolveAccountIdLabel(accountId, accounts);
  if (resolved !== accountId.trim()) return resolved;

  const fromOptions = accountOptions.find((option) => option.id === accountId.trim())?.label?.trim();
  if (fromOptions) return fromOptions;

  if (isBareNumericAccountId(accountId)) return 'Compte supprimé';
  return resolved;
}

export function isLikelySavingsGoalId(endpointId: string): boolean {
  const trimmed = endpointId.trim();
  return trimmed.startsWith('goal-') || trimmed.startsWith('goal_');
}

export function resolveEndpointLabel(
  endpointId: string,
  accounts: readonly SimulatedAccount[] = [],
  savingsGoals: readonly Pick<SavingsGoal, 'id' | 'name'>[] = [],
): string {
  const goal = savingsGoals.find((item) => item.id === endpointId);
  if (goal) return goal.name.trim();

  const accountLabel = resolveAccountIdLabel(endpointId, accounts);
  if (accountLabel !== endpointId) return accountLabel;

  if (isLikelySavingsGoalId(endpointId)) return 'Objectif supprimé';
  return 'Compte supprimé';
}

export function resolveTransactionHistorySubtitle(
  tx: Pick<Transaction, 'type' | 'note'>,
  context: {
    accounts?: readonly SimulatedAccount[];
    savingsGoals?: readonly Pick<SavingsGoal, 'id' | 'name'>[];
  } = {},
): string | null {
  const accounts = context.accounts ?? [];
  const savingsGoals = context.savingsGoals ?? [];

  if (isContactTransferTx(tx)) {
    const sourceId = parseAccountIdFromNote(tx.note);
    return sourceId ? resolveEndpointLabel(sourceId, accounts, savingsGoals) : null;
  }

  if (tx.type === 'transfer') {
    const { sourceId, destinationId } = parseTransferAccountsFromNote(tx.note);
    if (sourceId || destinationId) {
      const source = sourceId ? resolveEndpointLabel(sourceId, accounts, savingsGoals) : null;
      const destination = destinationId ? resolveEndpointLabel(destinationId, accounts, savingsGoals) : null;
      if (source && destination) return `${source} → ${destination}`;
      if (source) return source;
      if (destination) return destination;
    }

    const accountId = parseAccountIdFromNote(tx.note);
    return accountId ? resolveEndpointLabel(accountId, accounts, savingsGoals) : null;
  }

  return resolveTransactionPaymentMethodLabel(tx, { accounts, savingsGoals });
}

export function resolveTransactionAccountLabel(
  tx: Pick<Transaction, 'type' | 'note'>,
  accounts: readonly SimulatedAccount[] = [],
): string | null {
  if (tx.type !== 'expense' && tx.type !== 'income') return null;

  return resolveTransactionPaymentMethodLabel(tx, { accounts });
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

export function parseDestinataireFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('destinataire:'));
  return line?.slice('destinataire:'.length).trim() || null;
}

export function parseExpediteurFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('expediteur:'));
  return line?.slice('expediteur:'.length).trim() || null;
}

export function parseContactIdFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('contact:'));
  return line?.slice('contact:'.length).trim() || null;
}

export function parseIncomeSourceFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('source:'));
  return line?.slice('source:'.length).trim() || null;
}

export function parseMotifFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('motif:'));
  return line?.slice('motif:'.length).trim() || null;
}

export function parseRaisonFromNote(note?: string): string | null {
  const line = note?.split('\n').find((part) => part.startsWith('raison:'));
  return line?.slice('raison:'.length).trim() || null;
}

export function isContactTransferTx(tx: Pick<Transaction, 'type' | 'note'>): boolean {
  return tx.type === 'expense' && Boolean(parseDestinataireFromNote(tx.note));
}

export function isContactIncomeTx(tx: Pick<Transaction, 'type' | 'note'>): boolean {
  if (tx.type !== 'income') return false;
  return Boolean(
    parseExpediteurFromNote(tx.note) ||
      parseContactIdFromNote(tx.note) ||
      parseIncomeSourceFromNote(tx.note),
  );
}

export function isContactLinkedTx(tx: Pick<Transaction, 'type' | 'note'>): boolean {
  return isContactTransferTx(tx) || isContactIncomeTx(tx);
}

export function resolveContactNameFromTransaction(tx: Pick<Transaction, 'label' | 'note'>): string | null {
  return (
    parseDestinataireFromNote(tx.note) ??
    parseExpediteurFromNote(tx.note) ??
    parseIncomeSourceFromNote(tx.note) ??
    null
  );
}

export function appendContactIdToNote(note: string, contactId: string): string {
  const trimmedId = contactId.trim();
  if (!trimmedId) return note;
  const withoutExisting = note
    .split('\n')
    .filter((line) => !line.startsWith('contact:'))
    .join('\n')
    .trim();
  return withoutExisting ? `${withoutExisting}\ncontact:${trimmedId}` : `contact:${trimmedId}`;
}

export function buildAutoTransferLabel(sourceLabel: string, destinationLabel: string): string {
  return `Transfert ${sourceLabel} → ${destinationLabel}`;
}

export function isAutoTransferLabel(
  label: string,
  sourceLabel: string,
  destinationLabel: string,
): boolean {
  return label.trim() === buildAutoTransferLabel(sourceLabel, destinationLabel);
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

export function insufficientFundsAlertCopy(
  violation: InsufficientFundsViolation,
): { title: string; message: string } {
  return {
    title: 'Fonds insuffisants',
    message: `Le solde de ${violation.accountLabel} est insuffisant pour cette opération.`,
  };
}

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
    if (!account || (account.kind !== 'checking' && account.kind !== 'savings' && account.kind !== 'cash')) continue;
    if (account.balance + delta < 0) {
      return {
        accountId,
        accountLabel: formatPaymentAccountLabel(account.name, account.last4),
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
