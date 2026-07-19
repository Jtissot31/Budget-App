/**
 * Pure snowball / avalanche payoff simulation.
 * Monthly steps: accrue interest → pay minimums → apply extra (+ freed mins) to the target debt.
 */

export type DebtPayoffStrategy = 'snowball' | 'avalanche';

export type DebtPayoffInput = {
  id: string;
  balance: number;
  /** Annual interest rate in percent (ex. 19.99). */
  annualRatePercent: number;
  /** Minimum payment expressed as a monthly amount. */
  minimumMonthly: number;
};

export type OrderedDebt = DebtPayoffInput & {
  ordre: number;
};

export type DebtPayoffProjection = {
  /** Estimated calendar days until all selected debts reach zero. */
  daysToDebtFree: number;
  monthsToDebtFree: number;
  /** False when payments cannot outpace interest (or simulation hit the safety cap). */
  reachable: boolean;
  totalInterestPaid: number;
  orderedDebts: OrderedDebt[];
};

const DAYS_PER_MONTH = 365.25 / 12;
const MAX_MONTHS = 600;

export function orderDebtsForStrategy(
  debts: readonly DebtPayoffInput[],
  strategy: DebtPayoffStrategy,
): OrderedDebt[] {
  const sorted = [...debts].sort((a, b) => {
    if (strategy === 'snowball') {
      if (a.balance !== b.balance) return a.balance - b.balance;
      return b.annualRatePercent - a.annualRatePercent;
    }
    if (a.annualRatePercent !== b.annualRatePercent) {
      return b.annualRatePercent - a.annualRatePercent;
    }
    return a.balance - b.balance;
  });
  return sorted.map((debt, index) => ({ ...debt, ordre: index + 1 }));
}

export function extraToMonthly(amount: number, cadence: 'week' | 'month'): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return cadence === 'week' ? (amount * 52) / 12 : amount;
}

/**
 * Simulate classic debt snowball / avalanche payoff.
 * Extra monthly is applied to the current focus debt (first unpaid in ordered list);
 * when a debt is cleared, its minimum joins the extra pool (cascade).
 */
export function projectDebtPayoff(
  debts: readonly DebtPayoffInput[],
  strategy: DebtPayoffStrategy,
  extraMonthly: number,
): DebtPayoffProjection {
  const ordered = orderDebtsForStrategy(
    debts.filter((d) => d.balance > 0.005),
    strategy,
  );

  if (ordered.length === 0) {
    return {
      daysToDebtFree: 0,
      monthsToDebtFree: 0,
      reachable: true,
      totalInterestPaid: 0,
      orderedDebts: [],
    };
  }

  type State = {
    balance: number;
    min: number;
    rate: number;
    paidOff: boolean;
  };

  const states: State[] = ordered.map((d) => ({
    balance: Math.max(0, d.balance),
    min: Math.max(0, d.minimumMonthly),
    rate:
      Number.isFinite(d.annualRatePercent) && d.annualRatePercent > 0
        ? d.annualRatePercent / 100 / 12
        : 0,
    paidOff: false,
  }));

  let months = 0;
  let totalInterest = 0;
  const baseExtra = Math.max(0, extraMonthly);

  while (states.some((s) => !s.paidOff) && months < MAX_MONTHS) {
    months += 1;

    for (const s of states) {
      if (s.paidOff) continue;
      const interest = s.balance * s.rate;
      totalInterest += interest;
      s.balance += interest;
    }

    const cascadeExtra = states.filter((s) => s.paidOff).reduce((sum, s) => sum + s.min, 0);
    let attackBudget = baseExtra + cascadeExtra;

    for (const s of states) {
      if (s.paidOff) continue;
      const payment = Math.min(s.min, s.balance);
      s.balance = Math.max(0, s.balance - payment);
    }

    while (attackBudget > 0.005) {
      const focusIndex = states.findIndex((s) => !s.paidOff && s.balance > 0.005);
      if (focusIndex < 0) break;
      const focus = states[focusIndex]!;
      const applied = Math.min(attackBudget, focus.balance);
      focus.balance = Math.max(0, focus.balance - applied);
      attackBudget -= applied;
      if (focus.balance > 0.005) break;
    }

    for (const s of states) {
      if (s.paidOff) continue;
      if (s.balance <= 0.005) {
        s.balance = 0;
        s.paidOff = true;
      }
    }

    const remaining = states.filter((s) => !s.paidOff);
    if (remaining.length === 0) break;

    const nextCascade = states.filter((s) => s.paidOff).reduce((sum, s) => sum + s.min, 0);
    const canCoverInterest = remaining.some((s) => s.min > s.balance * s.rate + 0.005);
    const hasAttack = baseExtra + nextCascade > 0.005;
    if (!canCoverInterest && !hasAttack) {
      return {
        daysToDebtFree: Math.round(months * DAYS_PER_MONTH),
        monthsToDebtFree: months,
        reachable: false,
        totalInterestPaid: totalInterest,
        orderedDebts: ordered,
      };
    }
  }

  const reachable = states.every((s) => s.paidOff);
  return {
    daysToDebtFree: reachable
      ? Math.round(months * DAYS_PER_MONTH)
      : Math.round(MAX_MONTHS * DAYS_PER_MONTH),
    monthsToDebtFree: reachable ? months : MAX_MONTHS,
    reachable,
    totalInterestPaid: totalInterest,
    orderedDebts: ordered,
  };
}

export function formatDebtFreeDuration(days: number): string {
  if (days <= 0) return 'Déjà libre de dettes';
  if (days < 30) return `${days} jour${days > 1 ? 's' : ''}`;
  const months = Math.round(days / DAYS_PER_MONTH);
  if (months < 12) return `environ ${months} mois`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `environ ${years} an${years > 1 ? 's' : ''}`;
  return `environ ${years} an${years > 1 ? 's' : ''} et ${rem} mois`;
}
