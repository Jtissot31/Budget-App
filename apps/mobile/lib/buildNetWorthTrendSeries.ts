import type { NetWorthTrendPoint } from '@/components/PortfolioChartCard';
import { getTransactionAccountDeltas } from '@/lib/accountTransactionFlow';
import type { NetWorthChartScope } from '@/lib/settings';
import type { SimulatedAccount, Transaction } from '@/types';

/** Monthly anchors supplied to `PortfolioChartCard` period slicing (6M / 1A / Tout use last 5). */
export const NET_WORTH_TREND_MONTH_COUNT = 12;

const MONTH_LABELS_FR = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

type AccountScope = {
  ids: Set<string>;
  namesLower: Set<string>;
};

function monthLabelFr(date: Date): string {
  return MONTH_LABELS_FR[date.getMonth()] ?? '???';
}

function buildAccountScopeLookup(accounts: SimulatedAccount[]): AccountScope {
  const ids = new Set<string>();
  const namesLower = new Set<string>();
  for (const account of accounts) {
    ids.add(account.id);
    namesLower.add(account.name.trim().toLowerCase());
  }
  return { ids, namesLower };
}

function isInAccountScope(id: string, scope: AccountScope): boolean {
  return scope.ids.has(id) || scope.namesLower.has(id.trim().toLowerCase());
}

function getTransactionNetWorthDelta(
  tx: Pick<Transaction, 'amount' | 'type' | 'note'>,
  accountScope: AccountScope,
): number {
  let net = 0;
  for (const { id, delta } of getTransactionAccountDeltas(tx)) {
    if (isInAccountScope(id, accountScope)) {
      net += delta;
    }
  }
  return net;
}

function parseTxTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthAnchorDates(monthCount: number, now: Date): Date[] {
  return Array.from({ length: monthCount }, (_, index) => {
    return new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index), 1);
  });
}

function netWorthAtCutoff(
  currentAccountsNetWorth: number,
  transactions: readonly Transaction[],
  cutoffMs: number,
  accountScope: AccountScope,
): number {
  let value = currentAccountsNetWorth;
  const sorted = [...transactions].sort((a, b) => {
    const byDate = parseTxTime(b.date) - parseTxTime(a.date);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  for (const tx of sorted) {
    if (parseTxTime(tx.date) > cutoffMs) {
      value -= getTransactionNetWorthDelta(tx, accountScope);
    }
  }

  return value;
}

/**
 * Replays account-linked transactions backward from current balances to build monthly net-worth points.
 * Transfers between in-scope accounts net to zero; income/expense move the line.
 */
export function buildNetWorthTrendFromTransactions(
  scope: NetWorthChartScope,
  currentNetWorth: number,
  accounts: SimulatedAccount[],
  offAccountAssetsBalance: number,
  transactions: readonly Transaction[],
  now: Date = new Date(),
  monthCount: number = NET_WORTH_TREND_MONTH_COUNT,
): NetWorthTrendPoint[] {
  const anchors = monthAnchorDates(monthCount, now);

  if (scope === 'accounts_only' && accounts.length === 0) {
    return anchors.map((anchor) => ({ label: monthLabelFr(anchor), value: 0 }));
  }
  if (accounts.length === 0 && offAccountAssetsBalance === 0) {
    return anchors.map((anchor) => ({ label: monthLabelFr(anchor), value: 0 }));
  }

  const accountScope = buildAccountScopeLookup(accounts);
  const wealthOffset = scope === 'inclusive' ? offAccountAssetsBalance : 0;
  const currentAccountsNetWorth = currentNetWorth - wealthOffset;
  const nowMs = now.getTime();

  return anchors.map((anchor, index) => {
    const isCurrentMonth = index === anchors.length - 1;
    const cutoffMs = isCurrentMonth
      ? nowMs
      : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    const accountsValue = isCurrentMonth
      ? currentAccountsNetWorth
      : netWorthAtCutoff(currentAccountsNetWorth, transactions, cutoffMs, accountScope);

    return {
      label: monthLabelFr(anchor),
      value: accountsValue + wealthOffset,
    };
  });
}
