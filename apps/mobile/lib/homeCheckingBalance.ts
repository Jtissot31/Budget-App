import type { SimulatedAccount } from '@/types';

/** Solde total des comptes chèque visibles — sans épargne, crédit, ni réserves de plans. */
export function sumVisibleCheckingBalance(accounts: SimulatedAccount[]): number {
  return accounts
    .filter((account) => !account.hidden && account.kind === 'checking')
    .reduce((sum, account) => sum + account.balance, 0);
}

/** Flux net du mois courant : revenus − dépenses. */
export function computeMonthlyNetFlux(monthlyIncome: number, monthlyExpenses: number): number {
  return monthlyIncome - monthlyExpenses;
}
