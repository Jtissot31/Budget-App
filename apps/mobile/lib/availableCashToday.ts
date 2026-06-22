import {
  listActiveUpcomingRecurringPayments,
  resolvePaymentAccountForUpcoming,
  toPaymentResolutionAccounts,
  type PaymentResolutionAccount,
} from '@/lib/dashboardPaymentAlerts';
import { addDays, resolveNextPaycheckForAccount, startOfToday } from '@/lib/estimatedPaycheck';
import type { RecurringPayment, SimulatedAccount, Transaction } from '@/types';

export type AvailableCashTodayResult = {
  /** Solde total des comptes chèque (non masqués). */
  checkingBalanceTotal: number;
  /** Somme des paiements récurrents prélevés sur chèque/cash avant la prochaine paie. */
  upcomingBillsBeforePaycheck: number;
  /** checkingBalanceTotal − upcomingBillsBeforePaycheck */
  availableToday: number;
  /** Seuil de référence pour la jauge (= solde chèque, min. 1 $). */
  referenceThreshold: number;
  /** 0–100 pour la jauge (peut être >100 si disponible > seuil, clampé à l'affichage). */
  gaugePercent: number;
  /** Date ISO de la prochaine paie utilisée pour la fenêtre, ou null si estimée +14j. */
  nextPaycheckDateIso: string | null;
  /** True si la date de paie est une estimation (+14 jours) faute de données. */
  paycheckDateIsEstimated: boolean;
  /** Nombre de factures comptées dans la fenêtre. */
  billCount: number;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sumCheckingBalances(accounts: SimulatedAccount[], pool: PaymentResolutionAccount[]): number {
  const visibleChecking = accounts.filter((account) => !account.hidden && account.kind === 'checking');
  if (visibleChecking.length > 0) {
    return visibleChecking.reduce((sum, account) => sum + account.balance, 0);
  }
  return pool.filter((account) => account.kind === 'checking').reduce((sum, account) => sum + account.balance, 0);
}

function isLiquidOutflowAccount(kind: PaymentResolutionAccount['kind'] | undefined): boolean {
  return kind === 'checking' || kind === 'cash';
}

export type ComputeAvailableCashTodayInput = {
  simulatedAccounts: SimulatedAccount[];
  recurringPayments: RecurringPayment[];
  incomeTransactions: Transaction[];
  today?: Date;
};

/**
 * Argent disponible = solde chèque − factures récurrentes sur comptes liquides
 * dont la date est >= aujourd'hui et strictement avant la prochaine paie.
 * Réutilise listActiveUpcomingRecurringPayments + resolveNextPaycheckForAccount
 * (même pipeline que l'alerte « Fonds insuffisants »).
 */
export function computeAvailableCashToday(input: ComputeAvailableCashTodayInput): AvailableCashTodayResult {
  const today = input.today ?? startOfToday();
  const todayIso = isoDate(today);
  const pool = toPaymentResolutionAccounts(input.simulatedAccounts);
  const checkingBalanceTotal = sumCheckingBalances(input.simulatedAccounts, pool);

  const nextPaycheck = resolveNextPaycheckForAccount(
    undefined,
    input.recurringPayments,
    input.incomeTransactions,
    today,
  );

  let paycheckDateIsEstimated = false;
  let nextPaycheckDate = nextPaycheck?.date ?? null;
  if (!nextPaycheckDate) {
    nextPaycheckDate = addDays(today, 14);
    paycheckDateIsEstimated = true;
  }

  const nextPaycheckIso = isoDate(nextPaycheckDate);
  const upcoming = listActiveUpcomingRecurringPayments(input.recurringPayments, pool);

  let upcomingBillsBeforePaycheck = 0;
  let billCount = 0;

  for (const payment of upcoming) {
    if (payment.kind === 'income' || !payment.recurring) continue;
    if (payment.date < todayIso) continue;
    if (payment.date >= nextPaycheckIso) continue;

    const resolved = resolvePaymentAccountForUpcoming(payment.account, payment.accountId, pool);
    if (!isLiquidOutflowAccount(resolved?.kind)) continue;

    upcomingBillsBeforePaycheck += payment.amount;
    billCount += 1;
  }

  const availableToday = checkingBalanceTotal - upcomingBillsBeforePaycheck;
  const referenceThreshold = Math.max(checkingBalanceTotal, 1);
  const gaugePercent = (availableToday / referenceThreshold) * 100;

  return {
    checkingBalanceTotal,
    upcomingBillsBeforePaycheck,
    availableToday,
    referenceThreshold,
    gaugePercent,
    nextPaycheckDateIso: paycheckDateIsEstimated ? null : nextPaycheckIso,
    paycheckDateIsEstimated,
    billCount,
  };
}

export function gaugeZoneColor(
  gaugePercent: number,
  colors: { danger: string; warning: string; accentGreen: string },
): string {
  const clamped = Math.min(100, Math.max(0, gaugePercent));
  if (clamped < 35) return colors.danger;
  if (clamped < 65) return colors.warning;
  return colors.accentGreen;
}
