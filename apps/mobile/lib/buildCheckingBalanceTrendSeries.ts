import { getTransactionAccountDeltas } from '@/lib/accountTransactionFlow';
import { sumVisibleCheckingBalance } from '@/lib/homeCheckingBalance';
import type { SimulatedAccount, Transaction } from '@/types';

export const CHECKING_BALANCE_SPARKLINE_DAY_COUNT = 30;

type AccountScope = {
  ids: Set<string>;
  namesLower: Set<string>;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseTxTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCheckingAccountScope(accounts: SimulatedAccount[]): AccountScope {
  const ids = new Set<string>();
  const namesLower = new Set<string>();
  for (const account of accounts) {
    if (account.hidden || account.kind !== 'checking') continue;
    ids.add(account.id);
    namesLower.add(account.name.trim().toLowerCase());
  }
  return { ids, namesLower };
}

function isInAccountScope(id: string, scope: AccountScope): boolean {
  return scope.ids.has(id) || scope.namesLower.has(id.trim().toLowerCase());
}

function getTransactionCheckingDelta(
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

function balanceAtCutoff(
  currentCheckingBalance: number,
  transactions: readonly Transaction[],
  cutoffMs: number,
  accountScope: AccountScope,
): number {
  let value = currentCheckingBalance;
  const sorted = [...transactions].sort((a, b) => {
    const byDate = parseTxTime(b.date) - parseTxTime(a.date);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  for (const tx of sorted) {
    if (parseTxTime(tx.date) > cutoffMs) {
      value -= getTransactionCheckingDelta(tx, accountScope);
    }
  }

  return value;
}

/**
 * Solde chèque quotidien sur les N derniers jours (inclus aujourd'hui).
 * Même logique de replay transactionnelle que `buildNetWorthDailySeries`.
 */
export function buildCheckingBalanceDailyValues(
  accounts: SimulatedAccount[],
  transactions: readonly Transaction[],
  now: Date = new Date(),
  dayCount: number = CHECKING_BALANCE_SPARKLINE_DAY_COUNT,
): number[] {
  const accountScope = buildCheckingAccountScope(accounts);
  const currentCheckingBalance = sumVisibleCheckingBalance(accounts);
  const today = startOfDay(now);
  const nowMs = now.getTime();

  if (accountScope.ids.size === 0 && accountScope.namesLower.size === 0) {
    return Array.from({ length: dayCount }, () => 0);
  }

  const dayAnchors = Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (dayCount - 1 - index));
    return startOfDay(day);
  });

  return dayAnchors.map((day) => {
    const isToday = isSameCalendarDay(day, today);
    const dayEndMs = isToday ? nowMs : endOfDay(day).getTime();
    return isToday
      ? currentCheckingBalance
      : balanceAtCutoff(currentCheckingBalance, transactions, dayEndMs, accountScope);
  });
}
