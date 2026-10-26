/**
 * « Factures d'avance » — storage side. Creates the savings goal AND its envelope in the chosen
 * account, and moves the goal up the ladder (see `billsCushionTiers.ts`) as money is added.
 */
import { getGoalGreenShade } from '@/constants/theme';
import { newEnvelopeId, getEnvelopesByAccount, saveEnvelope } from '@/lib/accountEnvelopes';
import {
  BILLS_GOAL_PREFIX,
  billsGoalName,
  cushionTiers,
  isBillsGoalName,
  monthlyRecurringBills,
  tierProgress,
} from '@/lib/billsCushionTiers';
import { getRecurringPayments, getSavingsGoals, getSimulatedAccounts, upsertSavingsGoal } from '@/lib/db';
import type { SimulatedAccount } from '@/types';

export const BILLS_ENVELOPE_ICON = '💡';
const BILLS_GOAL_ICON = 'receipt-outline';

/** Accounts a cushion can live in (cash that is actually spendable, never a credit card). */
export function isCushionAccount(account: SimulatedAccount): boolean {
  return !account.hidden && (account.kind === 'checking' || account.kind === 'savings' || account.kind === 'cash');
}

/** Balance of an account not yet set aside in an envelope. */
export async function freeBalanceByAccount(accounts: readonly SimulatedAccount[]): Promise<Record<string, number>> {
  const envelopes = await getEnvelopesByAccount();
  const free: Record<string, number> = {};
  for (const account of accounts) {
    const assigned = (envelopes[account.id] ?? []).reduce((sum, envelope) => sum + envelope.amount, 0);
    free[account.id] = Math.max(0, account.balance - assigned);
  }
  return free;
}

export type CreateBillsCushionInput = {
  accountId: string;
  /** What the user plans to put aside each month (drives the goal's contribution). */
  monthlyContribution: number;
  /** Already set aside today; capped to what the account really has free. */
  initialAmount: number;
  isLight: boolean;
};

/** Creates the goal + the envelope in the chosen account, linked both ways. Returns the goal id. */
export async function createBillsCushionGoal(input: CreateBillsCushionInput): Promise<string> {
  const [payments, accounts] = await Promise.all([getRecurringPayments(), getSimulatedAccounts()]);
  const account = accounts.find((a) => a.id === input.accountId);
  if (!account) throw new Error('Compte introuvable');

  const free = (await freeBalanceByAccount([account]))[account.id] ?? 0;
  const saved = Math.max(0, Math.min(Math.round(input.initialAmount * 100) / 100, free));
  const tiers = cushionTiers(monthlyRecurringBills(payments));
  const { current } = tierProgress(saved, tiers);

  const now = new Date().toISOString();
  const goalId = `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const envelopeId = newEnvelopeId();
  const existing = (await getEnvelopesByAccount())[account.id] ?? [];

  await saveEnvelope(
    {
      id: envelopeId,
      accountId: account.id,
      name: BILLS_GOAL_PREFIX,
      icon: BILLS_ENVELOPE_ICON,
      amount: saved,
      displayOrder: existing.length,
      createdAt: now,
    },
    true,
    // The goal's save below emits once, so screens refresh with both already in place.
    { emit: false },
  );

  const monthly = Math.max(0, input.monthlyContribution);
  await upsertSavingsGoal({
    id: goalId,
    name: billsGoalName(current),
    targetAmount: current.amount,
    currentAmount: saved,
    initialSavedAmount: saved,
    weeklyContribution: monthly > 0 ? (monthly * 12) / 52 : undefined,
    contributionFrequency: 'monthly',
    color: getGoalGreenShade(goalId, input.isLight),
    icon: BILLS_GOAL_ICON,
    createdAt: now,
    linkedAccountId: account.id,
    linkedEnvelopeId: envelopeId,
    tierKind: 'bills',
  });
  return goalId;
}

export type TierAdvance = { goalId: string; reachedLabel: string | null; nextLabel: string | null };

/**
 * Keeps every « bills » goal on the right step: target = first step the saved amount hasn't
 * reached, from the user's current recurring payments. Cheap when nothing changed.
 */
export async function syncBillsCushionTiers(): Promise<TierAdvance[]> {
  const goals = (await getSavingsGoals()).filter((goal) => goal.tierKind === 'bills');
  if (goals.length === 0) return [];
  const tiers = cushionTiers(monthlyRecurringBills(await getRecurringPayments()));
  const advances: TierAdvance[] = [];

  for (const goal of goals) {
    const { current, reached, complete } = tierProgress(goal.currentAmount, tiers);
    const nameOk = !isBillsGoalName(goal.name) || goal.name === billsGoalName(current);
    if (goal.targetAmount === current.amount && nameOk) continue;
    await upsertSavingsGoal({
      ...goal,
      targetAmount: current.amount,
      // A renamed goal keeps the user's name.
      name: isBillsGoalName(goal.name) ? billsGoalName(current) : goal.name,
    });
    if (current.amount > goal.targetAmount) {
      advances.push({
        goalId: goal.id,
        reachedLabel: reached[reached.length - 1]?.label ?? null,
        nextLabel: complete ? null : current.label,
      });
    }
  }
  return advances;
}
