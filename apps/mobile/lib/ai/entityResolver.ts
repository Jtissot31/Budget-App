import { normalizeSearch } from '@/lib/categoryInference';
import type {
  Category,
  Loan,
  RecurringPayment,
  SavingsGoal,
  SimulatedAccount,
  Transaction,
  WealthAsset,
} from '@/types';

export type EntityRef = { id?: string; nom?: string };

function scoreMatch(label: string, query: string): number {
  const normalizedLabel = normalizeSearch(label);
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return 0;
  if (normalizedLabel === normalizedQuery) return 100;
  if (normalizedLabel.includes(normalizedQuery)) return 80;
  if (normalizedQuery.includes(normalizedLabel)) return 70;
  const queryTokens = normalizedQuery.split(' ');
  const labelTokens = normalizedLabel.split(' ');
  const overlap = queryTokens.filter((token) => labelTokens.some((lt) => lt.includes(token) || token.includes(lt)));
  if (overlap.length > 0) return 50 + overlap.length * 5;
  return 0;
}

export function fuzzyFindByName<T>(
  items: T[],
  query: string | undefined,
  getLabel: (item: T) => string,
): T | null {
  if (!query?.trim()) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreMatch(getLabel(item), query);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 50 ? best : null;
}

export function findByIdOrName<T extends { id: string }>(
  items: T[],
  ref: EntityRef,
  getLabel: (item: T) => string,
): T | null {
  if (ref.id?.trim()) {
    return items.find((item) => item.id === ref.id?.trim()) ?? null;
  }
  if (ref.nom?.trim()) {
    return fuzzyFindByName(items, ref.nom, getLabel);
  }
  return null;
}

export function resolveSavingsGoal(goals: SavingsGoal[], ref: EntityRef): SavingsGoal | null {
  return findByIdOrName(goals, ref, (goal) => goal.name);
}

export function resolveCategory(categories: Category[], ref: EntityRef): Category | null {
  return findByIdOrName(categories, ref, (category) => category.name);
}

export function resolveAccount(accounts: SimulatedAccount[], ref: EntityRef): SimulatedAccount | null {
  if (ref.id?.trim()) {
    return accounts.find((account) => account.id === ref.id?.trim()) ?? null;
  }
  if (ref.nom?.trim()) {
    const direct = fuzzyFindByName(accounts, ref.nom, (account) => account.name);
    if (direct) return direct;
    const normalized = normalizeSearch(ref.nom);
    if (normalized.includes('cheque') || normalized.includes('checking')) {
      return fuzzyFindByName(accounts, 'cheque', (account) => account.name)
        ?? accounts.find((account) => account.kind === 'checking')
        ?? null;
    }
    if (normalized.includes('epargne') || normalized.includes('savings')) {
      return accounts.find((account) => account.kind === 'savings') ?? null;
    }
    if (normalized.includes('credit')) {
      return accounts.find((account) => account.kind === 'credit') ?? null;
    }
    if (normalized.includes('cash') || normalized.includes('argent')) {
      return accounts.find((account) => account.kind === 'cash') ?? null;
    }
  }
  return null;
}

export function resolveWealthAsset(assets: WealthAsset[], ref: EntityRef): WealthAsset | null {
  return findByIdOrName(assets, ref, (asset) => asset.name);
}

export function resolveLoan(loans: Loan[], ref: EntityRef): Loan | null {
  return findByIdOrName(loans, ref, (loan) => loan.name);
}

export function resolveRecurringPayment(
  payments: RecurringPayment[],
  ref: EntityRef,
): RecurringPayment | null {
  return findByIdOrName(payments, ref, (payment) => payment.name);
}

export function resolveTransaction(transactions: Transaction[], ref: EntityRef): Transaction | null {
  return findByIdOrName(transactions, ref, (transaction) => transaction.label);
}

export function mapAccountKind(
  value: string | undefined,
): SimulatedAccount['kind'] | undefined {
  if (!value) return undefined;
  const normalized = normalizeSearch(value);
  if (normalized.includes('credit')) return 'credit';
  if (normalized.includes('epargne') || normalized.includes('savings')) return 'savings';
  if (normalized.includes('cash') || normalized.includes('argent')) return 'cash';
  if (normalized.includes('cheque') || normalized.includes('checking')) return 'checking';
  return undefined;
}
