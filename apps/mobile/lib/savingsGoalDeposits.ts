import {
  getTransactionAccountDeltas,
  parseTransferAccountsFromNote,
} from '@/lib/accountTransactionFlow';
import { goalInitialSaved } from '@/lib/savingsGoalProgress';
import type { SavingsGoal, SimulatedAccount, Transaction } from '@/types';

export type SavingsGoalDepositEvent = {
  goalId: string;
  ts: number;
  amount: number;
};

function parseTxTime(date: string): number {
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGoalCreatedTime(createdAt: string, fallbackMs: number): number {
  const parsed = new Date(createdAt).getTime();
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function noteReferencesGoal(note: string | undefined, goalId: string): boolean {
  const normalizedNote = (note ?? '').toLowerCase();
  const normalizedGoalId = goalId.trim().toLowerCase();
  if (!normalizedGoalId) return false;
  return (
    normalizedNote.includes(`goal:${normalizedGoalId}`) ||
    normalizedNote.includes(`objectif:${normalizedGoalId}`) ||
    normalizedNote.includes(`savingsgoal:${normalizedGoalId}`)
  );
}

export function buildLinkedAccountIdsByGoal(
  accounts: readonly SimulatedAccount[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const account of accounts) {
    const goalId = account.linkedSavingsGoalId?.trim();
    if (!goalId) continue;
    const ids = map.get(goalId) ?? new Set<string>();
    ids.add(account.id);
    map.set(goalId, ids);
  }
  return map;
}

/**
 * Signed deposit delta for one transaction toward a single savings goal.
 * Mirrors how goal balances are updated in add-transaction:
 * - direct transfers to/from the goal;
 * - transfers that move money on accounts linked to the goal;
 * - optional direct `savings_goal_id` or historical note markers on income/expense.
 */
export function getSavingsGoalDepositDelta(
  tx: Pick<Transaction, 'amount' | 'type' | 'note' | 'savingsGoalId' | 'date'>,
  goalId: string,
  linkedAccountIds: ReadonlySet<string>,
): number {
  const trimmedGoalId = goalId.trim();
  if (!trimmedGoalId) return 0;

  if (tx.type === 'transfer') {
    const { sourceId, destinationId } = parseTransferAccountsFromNote(tx.note);
    let delta = 0;
    if (destinationId === trimmedGoalId) delta += tx.amount;
    if (sourceId === trimmedGoalId) delta -= tx.amount;
    if (delta !== 0) return delta;

    for (const { id, delta: accountDelta } of getTransactionAccountDeltas(tx)) {
      if (linkedAccountIds.has(id)) delta += accountDelta;
    }
    return delta;
  }

  if (tx.savingsGoalId?.trim() === trimmedGoalId || noteReferencesGoal(tx.note, trimmedGoalId)) {
    if (tx.type === 'income') return tx.amount;
    if (tx.type === 'expense') return -tx.amount;
  }

  return 0;
}

/** Flat list of deposit events (initial saved + transaction deltas) for charting. */
export function buildSavingsGoalDepositEvents(
  goals: readonly SavingsGoal[],
  transactions: readonly Transaction[],
  accounts: readonly SimulatedAccount[],
  nowMs: number = Date.now(),
): SavingsGoalDepositEvent[] {
  const events: SavingsGoalDepositEvent[] = [];
  const linkedAccountIdsByGoal = buildLinkedAccountIdsByGoal(accounts);
  const goalIds = new Set(goals.map((goal) => goal.id));

  for (const goal of goals) {
    const initial = goalInitialSaved(goal);
    if (initial > 0) {
      events.push({
        goalId: goal.id,
        ts: parseGoalCreatedTime(goal.createdAt, nowMs),
        amount: initial,
      });
    }
  }

  for (const tx of transactions) {
    const txMs = parseTxTime(tx.date);
    for (const goalId of goalIds) {
      const linkedAccountIds = linkedAccountIdsByGoal.get(goalId) ?? new Set<string>();
      const delta = getSavingsGoalDepositDelta(tx, goalId, linkedAccountIds);
      if (delta === 0) continue;
      events.push({ goalId, ts: txMs, amount: delta });
    }
  }

  return events;
}

export function cumulativeSavingsDepositsAt(
  events: readonly SavingsGoalDepositEvent[],
  endMs: number,
  goalFilter?: ReadonlySet<string>,
): number {
  let total = 0;
  for (const event of events) {
    if (event.ts > endMs) continue;
    if (goalFilter && !goalFilter.has(event.goalId)) continue;
    total += event.amount;
  }
  return Math.max(0, total);
}
